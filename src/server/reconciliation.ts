import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeText, round2 } from '@/lib/utils';
import { recalcEntry, settleEntry } from './finance';
import { parseStatementFile, transactionHash, StatementParseError } from './parsers';

// ---------------------------------------------------------------------------
// Importacao de extrato
// ---------------------------------------------------------------------------

export type ImportResult = {
  importId: string;
  fileType: string;
  parsed: number;
  imported: number;
  duplicates: number;
  autoMatched: number;
  periodStart: Date | null;
  periodEnd: Date | null;
  warnings: string[];
};

/**
 * Le o arquivo, grava as transacoes novas (ignorando duplicatas pelo hash) e
 * roda o motor de sugestao automatica sobre o que entrou.
 */
export async function importStatement(params: {
  companyId: string;
  bankAccountId: string;
  userId: string;
  fileName: string;
  buffer: Buffer;
  /** Concilia automaticamente as sugestoes com pontuacao muito alta. */
  autoReconcile?: boolean;
}): Promise<ImportResult> {
  const account = await prisma.bankAccount.findFirst({
    where: { id: params.bankAccountId, companyId: params.companyId },
  });
  if (!account) throw new StatementParseError('Conta bancaria invalida para esta empresa.');

  const statement = await parseStatementFile(params.buffer, params.fileName);

  const rows = statement.transactions.map((t) => ({
    ...t,
    hash: transactionHash({
      bankAccountId: params.bankAccountId,
      fitId: t.fitId,
      date: t.date,
      amount: t.amount,
      description: t.description,
    }),
  }));

  // Deduplica dentro do proprio arquivo (bancos repetem linhas em PDFs).
  const seen = new Set<string>();
  const unique = rows.filter((r) => (seen.has(r.hash) ? false : (seen.add(r.hash), true)));
  const inFileDuplicates = rows.length - unique.length;

  const existing = await prisma.bankTransaction.findMany({
    where: { bankAccountId: params.bankAccountId, hash: { in: unique.map((r) => r.hash) } },
    select: { hash: true },
  });
  const existingHashes = new Set(existing.map((e) => e.hash));
  const fresh = unique.filter((r) => !existingHashes.has(r.hash));

  const bankImport = await prisma.bankImport.create({
    data: {
      companyId: params.companyId,
      bankAccountId: params.bankAccountId,
      userId: params.userId,
      fileName: params.fileName,
      fileType: statement.fileType,
      fileSize: params.buffer.length,
      periodStart: statement.meta.periodStart ?? null,
      periodEnd: statement.meta.periodEnd ?? null,
      parsedCount: statement.transactions.length,
      importedCount: fresh.length,
      duplicateCount: rows.length - fresh.length,
      status: fresh.length === 0 ? 'PARTIAL' : 'DONE',
      message:
        fresh.length === 0
          ? 'Todos os lancamentos deste arquivo ja haviam sido importados.'
          : null,
      meta: JSON.stringify(statement.meta),
    },
  });

  if (fresh.length > 0) {
    await prisma.bankTransaction.createMany({
      data: fresh.map((r) => ({
        companyId: params.companyId,
        bankAccountId: params.bankAccountId,
        importId: bankImport.id,
        fitId: r.fitId ?? null,
        hash: r.hash,
        date: r.date,
        amount: round2(r.amount),
        direction: r.amount >= 0 ? 'IN' : 'OUT',
        description: r.description,
        memo: r.memo ?? null,
        documentNumber: r.documentNumber ?? null,
        balanceAfter: r.balanceAfter ?? null,
        status: 'PENDING',
      })),
    });
  }

  let autoMatched = 0;
  if (params.autoReconcile && fresh.length > 0) {
    autoMatched = await autoReconcileImport(params.companyId, bankImport.id);
  }

  const warnings = [...(statement.meta.warnings ?? [])];
  if (inFileDuplicates > 0) {
    warnings.push(`${inFileDuplicates} linha(s) repetida(s) dentro do proprio arquivo foram descartadas.`);
  }

  return {
    importId: bankImport.id,
    fileType: statement.fileType,
    parsed: statement.transactions.length,
    imported: fresh.length,
    duplicates: rows.length - fresh.length,
    autoMatched,
    periodStart: statement.meta.periodStart ?? null,
    periodEnd: statement.meta.periodEnd ?? null,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Motor de sugestao
// ---------------------------------------------------------------------------

export type MatchSuggestion = {
  entryId: string;
  score: number;
  reasons: string[];
  entry: {
    id: string;
    description: string;
    dueDate: Date;
    amount: number;
    paidAmount: number;
    kind: string;
    documentNumber: string | null;
    contactName: string | null;
    categoryName: string | null;
  };
};

/** Similaridade 0..1 entre dois textos, por sobreposicao de tokens (Dice). */
export function textSimilarity(a: string, b: string): number {
  const tokenize = (value: string) =>
    normalizeText(value)
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3);

  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));
  if (left.size === 0 || right.size === 0) return 0;

  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return (2 * intersection) / (left.size + right.size);
}

const DAY = 86400000;

/**
 * Pontua a aderencia entre uma transacao bancaria e um lancamento em aberto.
 *
 * Pesos (total 100):
 *  - valor exato .......... 55   (valor proximo ate 1% -> 35)
 *  - proximidade da data .. 25   (mesmo dia 25, decai ate 0 em 30 dias)
 *  - texto/contato ........ 15
 *  - numero do documento ... 5
 */
export function scoreMatch(
  bankTx: { date: Date; amount: number; description: string; documentNumber: string | null },
  entry: {
    dueDate: Date;
    amount: number;
    paidAmount: number;
    description: string;
    documentNumber: string | null;
    contact?: { name: string } | null;
  },
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const open = round2(entry.amount - entry.paidAmount);
  const bankAbs = Math.abs(bankTx.amount);
  const diff = Math.abs(open - bankAbs);

  if (diff < 0.005) {
    score += 55;
    reasons.push('Valor idêntico');
  } else if (open > 0 && diff / open <= 0.01) {
    score += 35;
    reasons.push('Valor equivalente (diferença até 1%)');
  } else if (open > 0 && diff / open <= 0.05) {
    score += 18;
    reasons.push('Valor aproximado (diferença até 5%)');
  } else {
    return { score: 0, reasons: [] };
  }

  const days = Math.abs(bankTx.date.getTime() - entry.dueDate.getTime()) / DAY;
  if (days === 0) {
    score += 25;
    reasons.push('Mesma data de vencimento');
  } else if (days <= 30) {
    const points = Math.round(25 * (1 - days / 30));
    score += points;
    if (days <= 3) reasons.push(`Data próxima (${Math.round(days)} dia(s))`);
  }

  const contactName = entry.contact?.name ?? '';
  const textScore = Math.max(
    textSimilarity(bankTx.description, entry.description),
    contactName ? textSimilarity(bankTx.description, contactName) : 0,
  );
  if (textScore > 0.15) {
    score += Math.round(15 * Math.min(1, textScore * 1.6));
    if (textScore > 0.45) reasons.push('Histórico compatível');
  }

  if (
    bankTx.documentNumber &&
    entry.documentNumber &&
    normalizeText(bankTx.documentNumber) === normalizeText(entry.documentNumber)
  ) {
    score += 5;
    reasons.push('Mesmo número de documento');
  }

  return { score: Math.min(100, score), reasons };
}

/** Sugere lancamentos em aberto compativeis com uma transacao bancaria. */
export async function suggestMatches(
  companyId: string,
  bankTransactionId: string,
  limit = 6,
): Promise<MatchSuggestion[]> {
  const bankTx = await prisma.bankTransaction.findFirst({
    where: { id: bankTransactionId, companyId },
  });
  if (!bankTx) return [];

  const kind = bankTx.direction === 'IN' ? 'RECEIVABLE' : 'PAYABLE';
  const windowStart = new Date(bankTx.date.getTime() - 60 * DAY);
  const windowEnd = new Date(bankTx.date.getTime() + 60 * DAY);

  const candidates = await prisma.financialEntry.findMany({
    where: {
      companyId,
      kind,
      status: { in: ['OPEN', 'PARTIAL'] },
      dueDate: { gte: windowStart, lte: windowEnd },
    },
    include: { contact: { select: { name: true } }, category: { select: { name: true } } },
    take: 400,
  });

  return candidates
    .map((entry) => {
      const { score, reasons } = scoreMatch(bankTx, entry);
      return {
        entryId: entry.id,
        score,
        reasons,
        entry: {
          id: entry.id,
          description: entry.description,
          dueDate: entry.dueDate,
          amount: entry.amount,
          paidAmount: entry.paidAmount,
          kind: entry.kind,
          documentNumber: entry.documentNumber,
          contactName: entry.contact?.name ?? null,
          categoryName: entry.category?.name ?? null,
        },
      };
    })
    .filter((s) => s.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Limiar a partir do qual a conciliacao automatica age sozinha. */
export const AUTO_MATCH_THRESHOLD = 85;

/**
 * Concilia automaticamente as transacoes de uma importacao quando existe uma
 * unica sugestao acima do limiar (evita escolher errado quando ha empate).
 */
export async function autoReconcileImport(companyId: string, importId: string): Promise<number> {
  const pending = await prisma.bankTransaction.findMany({
    where: { companyId, importId, status: 'PENDING' },
  });

  let matched = 0;
  for (const bankTx of pending) {
    const suggestions = await suggestMatches(companyId, bankTx.id, 3);
    const best = suggestions[0];
    if (!best || best.score < AUTO_MATCH_THRESHOLD) continue;
    // Empate tecnico: deixa para o usuario decidir.
    if (suggestions[1] && suggestions[1].score >= best.score - 5) continue;

    try {
      await reconcileWithEntry({
        companyId,
        bankTransactionId: bankTx.id,
        entryId: best.entryId,
        method: 'AUTO',
        score: best.score,
      });
      matched += 1;
    } catch {
      // Conflito de concorrencia: segue para a proxima transacao.
    }
  }
  return matched;
}

// ---------------------------------------------------------------------------
// Acoes de conciliacao
// ---------------------------------------------------------------------------

export class ReconciliationError extends Error {}

/**
 * Concilia uma transacao bancaria com um lancamento existente: registra a baixa
 * na conta do extrato, cria o vinculo e marca a transacao como conciliada.
 */
export async function reconcileWithEntry(params: {
  companyId: string;
  bankTransactionId: string;
  entryId: string;
  method?: 'AUTO' | 'MANUAL' | 'RULE' | 'CREATED';
  score?: number;
  paymentMethodId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const bankTx = await tx.bankTransaction.findFirst({
      where: { id: params.bankTransactionId, companyId: params.companyId },
    });
    if (!bankTx) throw new ReconciliationError('Transacao bancaria nao encontrada.');
    if (bankTx.status === 'RECONCILED') throw new ReconciliationError('Esta transacao ja foi conciliada.');

    const entry = await tx.financialEntry.findFirst({
      where: { id: params.entryId, companyId: params.companyId },
    });
    if (!entry) throw new ReconciliationError('Lancamento nao encontrado.');
    if (entry.status === 'CANCELED') throw new ReconciliationError('O lancamento esta cancelado.');

    const expectedKind = bankTx.direction === 'IN' ? 'RECEIVABLE' : 'PAYABLE';
    if (entry.kind !== expectedKind) {
      throw new ReconciliationError(
        bankTx.direction === 'IN'
          ? 'Uma entrada no extrato so pode ser conciliada com uma conta a receber.'
          : 'Uma saida no extrato so pode ser conciliada com uma conta a pagar.',
      );
    }

    const bankAbs = round2(Math.abs(bankTx.amount));
    const open = round2(entry.amount - entry.paidAmount);
    if (open <= 0) throw new ReconciliationError('O lancamento ja esta totalmente liquidado.');

    // Baixa parcial quando o extrato traz menos do que o saldo devedor;
    // a diferenca a maior vira juros/multa (recebimento) ou tarifa (pagamento).
    const amount = Math.min(bankAbs, open);
    const surplus = round2(bankAbs - amount);

    const settlement = await settleEntry(
      {
        companyId: params.companyId,
        entryId: entry.id,
        bankAccountId: bankTx.bankAccountId,
        paidAt: bankTx.date,
        amount,
        interest: entry.kind === 'RECEIVABLE' ? surplus : 0,
        fee: entry.kind === 'PAYABLE' ? surplus : 0,
        paymentMethodId: params.paymentMethodId ?? null,
        notes: `Conciliado com o extrato: ${bankTx.description}`.slice(0, 240),
      },
      tx,
    );

    await tx.reconciliationMatch.create({
      data: {
        bankTransactionId: bankTx.id,
        entryId: entry.id,
        settlementId: settlement.id,
        amount: bankAbs,
        score: params.score ?? 100,
        method: params.method ?? 'MANUAL',
      },
    });

    await tx.bankTransaction.update({
      where: { id: bankTx.id },
      data: { status: 'RECONCILED', reconciledAt: new Date() },
    });

    return settlement;
  });
}

/**
 * Cria um lancamento novo ja liquidado a partir da transacao bancaria.
 * Usado quando a movimentacao nao existia no sistema (tarifa, imposto, venda
 * avulsa etc.).
 */
export async function reconcileCreatingEntry(params: {
  companyId: string;
  bankTransactionId: string;
  description: string;
  categoryId?: string | null;
  contactId?: string | null;
  costCenterId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const bankTx = await tx.bankTransaction.findFirst({
      where: { id: params.bankTransactionId, companyId: params.companyId },
    });
    if (!bankTx) throw new ReconciliationError('Transacao bancaria nao encontrada.');
    if (bankTx.status === 'RECONCILED') throw new ReconciliationError('Esta transacao ja foi conciliada.');

    const amount = round2(Math.abs(bankTx.amount));
    const entry = await tx.financialEntry.create({
      data: {
        companyId: params.companyId,
        kind: bankTx.direction === 'IN' ? 'RECEIVABLE' : 'PAYABLE',
        description: params.description || bankTx.description,
        amount,
        dueDate: bankTx.date,
        issueDate: bankTx.date,
        competenceDate: bankTx.date,
        categoryId: params.categoryId ?? null,
        contactId: params.contactId ?? null,
        costCenterId: params.costCenterId ?? null,
        bankAccountId: bankTx.bankAccountId,
        notes: 'Lancamento criado pela conciliacao bancaria.',
        status: 'OPEN',
      },
    });

    const settlement = await tx.settlement.create({
      data: {
        companyId: params.companyId,
        entryId: entry.id,
        bankAccountId: bankTx.bankAccountId,
        paidAt: bankTx.date,
        amount,
        notes: `Conciliado com o extrato: ${bankTx.description}`.slice(0, 240),
      },
    });

    await recalcEntry(entry.id, tx);

    await tx.reconciliationMatch.create({
      data: {
        bankTransactionId: bankTx.id,
        entryId: entry.id,
        settlementId: settlement.id,
        amount,
        score: 100,
        method: 'CREATED',
      },
    });

    await tx.bankTransaction.update({
      where: { id: bankTx.id },
      data: { status: 'RECONCILED', reconciledAt: new Date() },
    });

    return entry;
  });
}

/** Desfaz a conciliacao: remove vinculo, estorna a baixa e volta para pendente. */
export async function undoReconciliation(companyId: string, bankTransactionId: string) {
  return prisma.$transaction(async (tx) => {
    const bankTx = await tx.bankTransaction.findFirst({
      where: { id: bankTransactionId, companyId },
      include: { matches: true },
    });
    if (!bankTx) throw new ReconciliationError('Transacao bancaria nao encontrada.');

    for (const match of bankTx.matches) {
      if (match.settlementId) {
        await tx.settlement.deleteMany({ where: { id: match.settlementId } });
      }
      await tx.reconciliationMatch.delete({ where: { id: match.id } });
      await recalcEntry(match.entryId, tx);
    }

    return tx.bankTransaction.update({
      where: { id: bankTx.id },
      data: { status: 'PENDING', reconciledAt: null },
    });
  });
}

/** Marca como ignorada (transferencia interna, estorno, lancamento irrelevante). */
export async function ignoreTransaction(companyId: string, bankTransactionId: string, notes?: string) {
  return prisma.bankTransaction.updateMany({
    where: { id: bankTransactionId, companyId, status: 'PENDING' },
    data: { status: 'IGNORED', notes: notes ?? null },
  });
}

// ---------------------------------------------------------------------------
// Regras de classificacao
// ---------------------------------------------------------------------------

/** Aplica as regras da empresa a uma descricao, devolvendo a primeira que casa. */
export async function applyRules(
  companyId: string,
  bankTx: { description: string; amount: number; direction: string },
  tx: Prisma.TransactionClient = prisma,
) {
  const rules = await tx.reconciliationRule.findMany({
    where: { companyId, isActive: true },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });

  const description = normalizeText(bankTx.description);
  const abs = Math.abs(bankTx.amount);

  for (const rule of rules) {
    if (rule.direction && rule.direction !== bankTx.direction) continue;
    if (rule.minAmount != null && abs < rule.minAmount) continue;
    if (rule.maxAmount != null && abs > rule.maxAmount) continue;
    if (!description.includes(normalizeText(rule.pattern))) continue;
    return rule;
  }
  return null;
}

/** Estatisticas exibidas no topo da tela de conciliacao. */
export async function getReconciliationStats(companyId: string, bankAccountId?: string) {
  const where: Prisma.BankTransactionWhereInput = {
    companyId,
    ...(bankAccountId ? { bankAccountId } : {}),
  };

  const [pending, reconciled, ignored, pendingIn, pendingOut] = await Promise.all([
    prisma.bankTransaction.count({ where: { ...where, status: 'PENDING' } }),
    prisma.bankTransaction.count({ where: { ...where, status: 'RECONCILED' } }),
    prisma.bankTransaction.count({ where: { ...where, status: 'IGNORED' } }),
    prisma.bankTransaction.aggregate({
      where: { ...where, status: 'PENDING', direction: 'IN' },
      _sum: { amount: true },
    }),
    prisma.bankTransaction.aggregate({
      where: { ...where, status: 'PENDING', direction: 'OUT' },
      _sum: { amount: true },
    }),
  ]);

  const total = pending + reconciled + ignored;
  return {
    pending,
    reconciled,
    ignored,
    total,
    pendingIn: round2(pendingIn._sum.amount ?? 0),
    pendingOut: round2(Math.abs(pendingOut._sum.amount ?? 0)),
    percent: total > 0 ? Math.round(((reconciled + ignored) / total) * 100) : 0,
  };
}
