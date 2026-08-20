import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { addDaysUTC, addMonthsUTC, round2 } from '@/lib/utils';

export type EntryKind = 'RECEIVABLE' | 'PAYABLE';
export type EntryStatus = 'OPEN' | 'PARTIAL' | 'PAID' | 'CANCELED';

export const ENTRY_STATUS_LABELS: Record<string, string> = {
  OPEN: 'Em aberto',
  PARTIAL: 'Parcial',
  PAID: 'Liquidado',
  CANCELED: 'Cancelado',
  OVERDUE: 'Vencido',
};

/** Status "visual": OPEN vencido vira OVERDUE. Nao e persistido. */
export function displayStatus(entry: { status: string; dueDate: Date }, today = startOfToday()): string {
  if (entry.status === 'OPEN' || entry.status === 'PARTIAL') {
    if (entry.dueDate.getTime() < today.getTime()) return 'OVERDUE';
  }
  return entry.status;
}

export function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Valor ainda em aberto de um lancamento. */
export function openAmount(entry: { amount: number; paidAmount: number }): number {
  return round2(Math.max(0, entry.amount - entry.paidAmount));
}

// ---------------------------------------------------------------------------
// Criacao de lancamentos (com parcelamento)
// ---------------------------------------------------------------------------

export type CreateEntryInput = {
  companyId: string;
  kind: EntryKind;
  description: string;
  amount: number;
  dueDate: Date;
  issueDate?: Date;
  competenceDate?: Date;
  contactId?: string | null;
  categoryId?: string | null;
  costCenterId?: string | null;
  bankAccountId?: string | null;
  orderId?: string | null;
  recurrenceId?: string | null;
  documentNumber?: string | null;
  notes?: string | null;
  tags?: string | null;
  installments?: number;
  /** Intervalo entre parcelas: MONTHLY (padrao) ou dias corridos. */
  installmentMode?: 'MONTHLY' | 'DAYS';
  installmentIntervalDays?: number;
};

/**
 * Cria um lancamento. Quando installments > 1 gera N parcelas ligadas por
 * groupId; a diferenca de arredondamento vai para a ultima parcela para que a
 * soma das parcelas seja exatamente igual ao valor total.
 */
export async function createEntries(
  input: CreateEntryInput,
  tx: Prisma.TransactionClient = prisma,
) {
  const installments = Math.max(1, Math.floor(input.installments ?? 1));
  const total = round2(input.amount);
  const groupId = installments > 1 ? crypto.randomUUID() : null;

  const per = round2(total / installments);
  const amounts = Array.from({ length: installments }, (_, i) =>
    i === installments - 1 ? round2(total - per * (installments - 1)) : per,
  );

  const issueDate = input.issueDate ?? startOfToday();
  const competenceDate = input.competenceDate ?? issueDate;

  const data = amounts.map((amount, index) => ({
    companyId: input.companyId,
    kind: input.kind,
    description:
      installments > 1
        ? `${input.description} (${index + 1}/${installments})`
        : input.description,
    amount,
    dueDate:
      input.installmentMode === 'DAYS'
        ? addDaysUTC(input.dueDate, (input.installmentIntervalDays ?? 30) * index)
        : addMonthsUTC(input.dueDate, index),
    issueDate,
    competenceDate,
    contactId: input.contactId ?? null,
    categoryId: input.categoryId ?? null,
    costCenterId: input.costCenterId ?? null,
    bankAccountId: input.bankAccountId ?? null,
    orderId: input.orderId ?? null,
    recurrenceId: input.recurrenceId ?? null,
    documentNumber: input.documentNumber ?? null,
    notes: input.notes ?? null,
    tags: input.tags ?? null,
    installment: index + 1,
    installments,
    groupId,
    status: 'OPEN',
  }));

  await tx.financialEntry.createMany({ data });

  return tx.financialEntry.findMany({
    where: groupId
      ? { groupId }
      : {
          companyId: input.companyId,
          description: data[0].description,
          dueDate: data[0].dueDate,
          amount: data[0].amount,
        },
    orderBy: { installment: 'asc' },
  });
}

// ---------------------------------------------------------------------------
// Baixa (liquidacao)
// ---------------------------------------------------------------------------

export type SettleInput = {
  companyId: string;
  entryId: string;
  bankAccountId: string;
  paidAt: Date;
  amount: number;
  discount?: number;
  interest?: number;
  fine?: number;
  fee?: number;
  paymentMethodId?: string | null;
  notes?: string | null;
};

export class FinanceError extends Error {}

/**
 * Registra uma baixa e recalcula o status do lancamento.
 *
 * O "valor pago" que abate o saldo devedor e amount + desconto: se um titulo de
 * R$ 100 e quitado com R$ 95 e R$ 5 de desconto, ele fica liquidado. Juros e
 * multa entram no caixa mas nao abatem o principal.
 */
export async function settleEntry(input: SettleInput, tx: Prisma.TransactionClient = prisma) {
  const entry = await tx.financialEntry.findFirst({
    where: { id: input.entryId, companyId: input.companyId },
  });
  if (!entry) throw new FinanceError('Lancamento nao encontrado.');
  if (entry.status === 'CANCELED') throw new FinanceError('Nao e possivel baixar um lancamento cancelado.');

  const amount = round2(input.amount);
  if (amount <= 0) throw new FinanceError('O valor da baixa deve ser maior que zero.');

  const discount = round2(input.discount ?? 0);
  const interest = round2(input.interest ?? 0);
  const fine = round2(input.fine ?? 0);
  const fee = round2(input.fee ?? 0);

  const account = await tx.bankAccount.findFirst({
    where: { id: input.bankAccountId, companyId: input.companyId },
  });
  if (!account) throw new FinanceError('Conta bancaria invalida.');

  const principal = round2(amount + discount - interest - fine);
  const remaining = round2(entry.amount - entry.paidAmount);
  if (principal > remaining + 0.005) {
    throw new FinanceError(
      `O valor informado abate R$ ${principal.toFixed(2)}, acima do saldo em aberto de R$ ${remaining.toFixed(2)}.`,
    );
  }

  const settlement = await tx.settlement.create({
    data: {
      companyId: input.companyId,
      entryId: entry.id,
      bankAccountId: input.bankAccountId,
      paymentMethodId: input.paymentMethodId ?? null,
      paidAt: input.paidAt,
      amount,
      discount,
      interest,
      fine,
      fee,
      notes: input.notes ?? null,
    },
  });

  await recalcEntry(entry.id, tx);
  return settlement;
}

/** Recalcula paidAmount/status a partir das baixas registradas. */
export async function recalcEntry(entryId: string, tx: Prisma.TransactionClient = prisma) {
  const entry = await tx.financialEntry.findUnique({
    where: { id: entryId },
    include: { settlements: true },
  });
  if (!entry) return null;

  const paidAmount = round2(
    entry.settlements.reduce(
      (sum, s) => sum + s.amount + s.discount - s.interest - s.fine,
      0,
    ),
  );
  const discount = round2(entry.settlements.reduce((s, x) => s + x.discount, 0));
  const interest = round2(entry.settlements.reduce((s, x) => s + x.interest, 0));
  const fine = round2(entry.settlements.reduce((s, x) => s + x.fine, 0));

  let status: EntryStatus = 'OPEN';
  if (entry.status === 'CANCELED') status = 'CANCELED';
  else if (paidAmount >= round2(entry.amount) - 0.005) status = 'PAID';
  else if (paidAmount > 0) status = 'PARTIAL';

  return tx.financialEntry.update({
    where: { id: entryId },
    data: { paidAmount, discount, interest, fine, status },
  });
}

/** Estorna uma baixa e recalcula o lancamento. */
export async function reverseSettlement(companyId: string, settlementId: string) {
  return prisma.$transaction(async (tx) => {
    const settlement = await tx.settlement.findFirst({
      where: { id: settlementId, companyId },
    });
    if (!settlement) throw new FinanceError('Baixa nao encontrada.');

    // Desfaz tambem a conciliacao ligada a essa baixa, devolvendo a transacao
    // bancaria para a fila de pendentes.
    const matches = await tx.reconciliationMatch.findMany({ where: { settlementId } });
    for (const match of matches) {
      await tx.reconciliationMatch.delete({ where: { id: match.id } });
      const remaining = await tx.reconciliationMatch.count({
        where: { bankTransactionId: match.bankTransactionId },
      });
      if (remaining === 0) {
        await tx.bankTransaction.update({
          where: { id: match.bankTransactionId },
          data: { status: 'PENDING', reconciledAt: null },
        });
      }
    }

    await tx.settlement.delete({ where: { id: settlementId } });
    return recalcEntry(settlement.entryId, tx);
  });
}

// ---------------------------------------------------------------------------
// Saldos
// ---------------------------------------------------------------------------

export type AccountBalance = {
  id: string;
  name: string;
  type: string;
  color: string;
  bankName: string | null;
  includeInCash: boolean;
  initialBalance: number;
  balance: number;
};

/**
 * Saldo de cada conta = saldo inicial + baixas recebidas - baixas pagas
 * + transferencias recebidas - transferencias enviadas (e tarifas).
 */
export async function getAccountBalances(companyId: string, until?: Date): Promise<AccountBalance[]> {
  const dateFilter = until ? { lte: until } : undefined;

  const [accounts, settlements, transfersOut, transfersIn] = await Promise.all([
    prisma.bankAccount.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ includeInCash: 'desc' }, { name: 'asc' }],
    }),
    prisma.settlement.findMany({
      where: { companyId, ...(dateFilter ? { paidAt: dateFilter } : {}) },
      select: { bankAccountId: true, amount: true, interest: true, fine: true, fee: true, entry: { select: { kind: true } } },
    }),
    prisma.transfer.groupBy({
      by: ['fromAccountId'],
      where: { companyId, ...(dateFilter ? { date: dateFilter } : {}) },
      _sum: { amount: true, fee: true },
    }),
    prisma.transfer.groupBy({
      by: ['toAccountId'],
      where: { companyId, ...(dateFilter ? { date: dateFilter } : {}) },
      _sum: { amount: true },
    }),
  ]);

  const movement = new Map<string, number>();
  const add = (id: string, value: number) => movement.set(id, (movement.get(id) ?? 0) + value);

  for (const s of settlements) {
    const cash = s.amount + s.interest + s.fine - s.fee;
    add(s.bankAccountId, s.entry.kind === 'RECEIVABLE' ? cash : -cash);
  }
  for (const t of transfersOut) add(t.fromAccountId, -((t._sum.amount ?? 0) + (t._sum.fee ?? 0)));
  for (const t of transfersIn) add(t.toAccountId, t._sum.amount ?? 0);

  return accounts.map((account) => ({
    id: account.id,
    name: account.name,
    type: account.type,
    color: account.color,
    bankName: account.bankName,
    includeInCash: account.includeInCash,
    initialBalance: account.initialBalance,
    balance: round2(account.initialBalance + (movement.get(account.id) ?? 0)),
  }));
}

export async function getTotalCash(companyId: string, until?: Date): Promise<number> {
  const balances = await getAccountBalances(companyId, until);
  return round2(balances.filter((b) => b.includeInCash).reduce((sum, b) => sum + b.balance, 0));
}

// ---------------------------------------------------------------------------
// Recorrencias
// ---------------------------------------------------------------------------

const FREQUENCY_MONTHS: Record<string, number> = {
  MONTHLY: 1,
  BIMONTHLY: 2,
  QUARTERLY: 3,
  SEMIANNUAL: 6,
  YEARLY: 12,
};

export function nextRecurrenceDate(from: Date, frequency: string, interval = 1): Date {
  if (frequency === 'WEEKLY') return addDaysUTC(from, 7 * interval);
  if (frequency === 'BIWEEKLY') return addDaysUTC(from, 14 * interval);
  const months = (FREQUENCY_MONTHS[frequency] ?? 1) * interval;
  return addMonthsUTC(from, months);
}

/**
 * Gera os lancamentos pendentes de todas as recorrencias ativas cuja proxima
 * data ja chegou. Idempotente: avanca nextRunAt a cada geracao.
 */
export async function runRecurrences(companyId: string, reference = startOfToday()) {
  const recurrences = await prisma.recurrence.findMany({
    where: { companyId, isActive: true, nextRunAt: { lte: reference } },
  });

  let generated = 0;

  for (const recurrence of recurrences) {
    let cursor = recurrence.nextRunAt;
    let count = recurrence.generatedCount;
    // Trava de seguranca contra loops em recorrencias muito antigas.
    let guard = 0;

    while (cursor.getTime() <= reference.getTime() && guard < 240) {
      guard += 1;
      if (recurrence.endDate && cursor.getTime() > recurrence.endDate.getTime()) break;
      if (recurrence.occurrences && count >= recurrence.occurrences) break;

      await createEntries({
        companyId,
        kind: recurrence.kind as EntryKind,
        description: recurrence.description,
        amount: recurrence.amount,
        dueDate: cursor,
        competenceDate: cursor,
        contactId: recurrence.contactId,
        categoryId: recurrence.categoryId,
        costCenterId: recurrence.costCenterId,
        bankAccountId: recurrence.bankAccountId,
        recurrenceId: recurrence.id,
      });

      generated += 1;
      count += 1;
      cursor = nextRecurrenceDate(cursor, recurrence.frequency, recurrence.interval);
    }

    const finished =
      (recurrence.occurrences != null && count >= recurrence.occurrences) ||
      (recurrence.endDate != null && cursor.getTime() > recurrence.endDate.getTime());

    await prisma.recurrence.update({
      where: { id: recurrence.id },
      data: { nextRunAt: cursor, generatedCount: count, isActive: !finished },
    });
  }

  return generated;
}
