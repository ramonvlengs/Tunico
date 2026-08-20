'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireApiContext } from '@/lib/tenant';
import { audit } from '@/lib/audit';
import { round2 } from '@/lib/utils';
import {
  ignoreTransaction, importStatement, reconcileCreatingEntry, reconcileWithEntry,
  ReconciliationError, undoReconciliation, autoReconcileImport,
} from '@/server/reconciliation';
import { StatementParseError, ACCEPTED_EXTENSIONS, MAX_UPLOAD_BYTES } from '@/server/parsers';

export type ImportState =
  | undefined
  | { error: string }
  | {
      success: string;
      detail: {
        fileType: string;
        parsed: number;
        imported: number;
        duplicates: number;
        autoMatched: number;
        warnings: string[];
      };
    };

/** Recebe o arquivo de extrato, importa e devolve o resumo para a tela. */
export async function importStatementAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const auth = await requireApiContext();
  if (!auth.ok) return { error: auth.error };
  const { ctx } = auth;
  if (!ctx.can('reconciliation.manage')) {
    return { error: 'Voce nao tem permissao para importar extratos.' };
  }

  const bankAccountId = String(formData.get('bankAccountId') ?? '');
  const file = formData.get('file');

  if (!bankAccountId) return { error: 'Selecione a conta bancaria do extrato.' };
  if (!(file instanceof File) || file.size === 0) return { error: 'Selecione um arquivo para importar.' };
  if (file.size > MAX_UPLOAD_BYTES) return { error: 'O arquivo excede o limite de 20 MB.' };

  const lower = file.name.toLowerCase();
  if (!ACCEPTED_EXTENSIONS.some((extension) => lower.endsWith(extension))) {
    return { error: `Formato nao suportado. Aceitamos: ${ACCEPTED_EXTENSIONS.join(', ')}.` };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importStatement({
      companyId: ctx.company.id,
      bankAccountId,
      userId: ctx.user.id,
      fileName: file.name,
      buffer,
      autoReconcile: formData.get('autoReconcile') !== null,
    });

    await audit({
      companyId: ctx.company.id, userId: ctx.user.id, action: 'IMPORT',
      entity: 'BankImport', entityId: result.importId,
      summary: `Extrato ${result.fileType} "${file.name}": ${result.imported} novo(s), ${result.duplicates} duplicado(s)`,
    });

    revalidatePath('/conciliacao');
    revalidatePath('/conciliacao/importacoes');
    revalidatePath('/dashboard');

    return {
      success:
        result.imported === 0
          ? 'Arquivo lido com sucesso, mas todos os lancamentos ja haviam sido importados.'
          : `${result.imported} lancamento(s) importado(s) com sucesso.`,
      detail: {
        fileType: result.fileType,
        parsed: result.parsed,
        imported: result.imported,
        duplicates: result.duplicates,
        autoMatched: result.autoMatched,
        warnings: result.warnings,
      },
    };
  } catch (error) {
    if (error instanceof StatementParseError) return { error: error.message };
    console.error('[importStatement]', error);
    return { error: 'Nao foi possivel processar o arquivo. Verifique o formato e tente novamente.' };
  }
}

// ---------------------------------------------------------------------------
// Acoes da tela de conciliacao
// ---------------------------------------------------------------------------

export async function reconcileAction(formData: FormData) {
  const auth = await requireApiContext();
  if (!auth.ok || !auth.ctx.can('reconciliation.manage')) return;
  const { ctx } = auth;

  const bankTransactionId = String(formData.get('bankTransactionId') ?? '');
  const entryId = String(formData.get('entryId') ?? '');
  const score = Number(formData.get('score') ?? '0');

  try {
    await reconcileWithEntry({
      companyId: ctx.company.id,
      bankTransactionId,
      entryId,
      method: 'MANUAL',
      score: Number.isFinite(score) ? score : 0,
    });
    await audit({
      companyId: ctx.company.id, userId: ctx.user.id, action: 'RECONCILE',
      entity: 'BankTransaction', entityId: bankTransactionId, summary: 'Transacao conciliada com lancamento existente',
    });
  } catch (error) {
    if (!(error instanceof ReconciliationError)) console.error(error);
  }

  revalidatePath('/conciliacao');
  revalidatePath('/dashboard');
}

export async function createAndReconcileAction(formData: FormData) {
  const auth = await requireApiContext();
  if (!auth.ok || !auth.ctx.can('reconciliation.manage')) return;
  const { ctx } = auth;

  const bankTransactionId = String(formData.get('bankTransactionId') ?? '');
  try {
    await reconcileCreatingEntry({
      companyId: ctx.company.id,
      bankTransactionId,
      description: String(formData.get('description') ?? '').trim(),
      categoryId: String(formData.get('categoryId') ?? '') || null,
      contactId: String(formData.get('contactId') ?? '') || null,
      costCenterId: String(formData.get('costCenterId') ?? '') || null,
    });
    await audit({
      companyId: ctx.company.id, userId: ctx.user.id, action: 'RECONCILE',
      entity: 'BankTransaction', entityId: bankTransactionId,
      summary: 'Lancamento criado e conciliado a partir do extrato',
    });
  } catch (error) {
    if (!(error instanceof ReconciliationError)) console.error(error);
  }

  revalidatePath('/conciliacao');
  revalidatePath('/dashboard');
}

export async function ignoreTransactionAction(formData: FormData) {
  const auth = await requireApiContext();
  if (!auth.ok || !auth.ctx.can('reconciliation.manage')) return;
  await ignoreTransaction(
    auth.ctx.company.id,
    String(formData.get('bankTransactionId') ?? ''),
    String(formData.get('notes') ?? '') || undefined,
  );
  revalidatePath('/conciliacao');
}

export async function undoReconciliationAction(formData: FormData) {
  const auth = await requireApiContext();
  if (!auth.ok || !auth.ctx.can('reconciliation.manage')) return;
  try {
    await undoReconciliation(auth.ctx.company.id, String(formData.get('bankTransactionId') ?? ''));
  } catch (error) {
    if (!(error instanceof ReconciliationError)) console.error(error);
  }
  revalidatePath('/conciliacao');
  revalidatePath('/dashboard');
}

export async function restoreIgnoredAction(formData: FormData) {
  const auth = await requireApiContext();
  if (!auth.ok || !auth.ctx.can('reconciliation.manage')) return;
  await prisma.bankTransaction.updateMany({
    where: { id: String(formData.get('bankTransactionId') ?? ''), companyId: auth.ctx.company.id, status: 'IGNORED' },
    data: { status: 'PENDING', notes: null },
  });
  revalidatePath('/conciliacao');
}

/** Roda o motor automatico sobre tudo o que ainda esta pendente. */
export async function autoReconcileAllAction(formData: FormData) {
  const auth = await requireApiContext();
  if (!auth.ok || !auth.ctx.can('reconciliation.manage')) return;
  const { ctx } = auth;

  const bankAccountId = String(formData.get('bankAccountId') ?? '');
  const imports = await prisma.bankImport.findMany({
    where: {
      companyId: ctx.company.id,
      ...(bankAccountId ? { bankAccountId } : {}),
      bankTransactions: { some: { status: 'PENDING' } },
    },
    select: { id: true },
  });

  let matched = 0;
  for (const bankImport of imports) {
    matched += await autoReconcileImport(ctx.company.id, bankImport.id);
  }

  await audit({
    companyId: ctx.company.id, userId: ctx.user.id, action: 'RECONCILE',
    entity: 'BankTransaction', summary: `Conciliacao automatica: ${matched} vinculo(s) criado(s)`,
  });

  revalidatePath('/conciliacao');
  revalidatePath('/dashboard');
}

export async function deleteImportAction(formData: FormData) {
  const auth = await requireApiContext();
  if (!auth.ok || !auth.ctx.can('reconciliation.manage')) return;
  const { ctx } = auth;
  const id = String(formData.get('id') ?? '');

  const bankImport = await prisma.bankImport.findFirst({ where: { id, companyId: ctx.company.id } });
  if (!bankImport) return;

  // Transacoes ja conciliadas nao sao removidas: desfazer a conciliacao e um
  // passo explicito do usuario, para nao apagar baixas sem querer.
  const reconciled = await prisma.bankTransaction.count({ where: { importId: id, status: 'RECONCILED' } });
  if (reconciled > 0) return;

  await prisma.bankTransaction.deleteMany({ where: { importId: id, companyId: ctx.company.id } });
  await prisma.bankImport.delete({ where: { id } });

  await audit({
    companyId: ctx.company.id, userId: ctx.user.id, action: 'DELETE',
    entity: 'BankImport', entityId: id, summary: `Importacao "${bankImport.fileName}" removida`,
  });

  revalidatePath('/conciliacao');
  revalidatePath('/conciliacao/importacoes');
}

// ---------------------------------------------------------------------------
// Regras
// ---------------------------------------------------------------------------

export type RuleState = { error?: string; success?: string } | undefined;

export async function saveRuleAction(_prev: RuleState, formData: FormData): Promise<RuleState> {
  const auth = await requireApiContext();
  if (!auth.ok) return { error: auth.error };
  const { ctx } = auth;
  if (!ctx.can('reconciliation.manage')) return { error: 'Sem permissao.' };

  const id = String(formData.get('id') ?? '') || null;
  const name = String(formData.get('name') ?? '').trim();
  const pattern = String(formData.get('pattern') ?? '').trim();

  if (name.length < 2) return { error: 'Informe um nome para a regra.' };
  if (pattern.length < 2) return { error: 'Informe o texto que deve aparecer no historico do extrato.' };

  const parseOptionalNumber = (key: string) => {
    const raw = String(formData.get(key) ?? '').replace(',', '.').trim();
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? round2(parsed) : null;
  };

  const data = {
    companyId: ctx.company.id,
    name,
    pattern,
    direction: String(formData.get('direction') ?? '') || null,
    minAmount: parseOptionalNumber('minAmount'),
    maxAmount: parseOptionalNumber('maxAmount'),
    categoryId: String(formData.get('categoryId') ?? '') || null,
    contactId: String(formData.get('contactId') ?? '') || null,
    priority: Number(String(formData.get('priority') ?? '0')) || 0,
    isActive: formData.get('isActive') !== null,
  };

  if (id) await prisma.reconciliationRule.updateMany({ where: { id, companyId: ctx.company.id }, data });
  else await prisma.reconciliationRule.create({ data });

  revalidatePath('/conciliacao/regras');
  return { success: 'Regra salva.' };
}

export async function deleteRuleAction(formData: FormData) {
  const auth = await requireApiContext();
  if (!auth.ok || !auth.ctx.can('reconciliation.manage')) return;
  await prisma.reconciliationRule.deleteMany({
    where: { id: String(formData.get('id') ?? ''), companyId: auth.ctx.company.id },
  });
  revalidatePath('/conciliacao/regras');
}
