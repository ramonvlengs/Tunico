'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiContext } from '@/lib/tenant';
import { audit } from '@/lib/audit';
import { parseDateInput, round2 } from '@/lib/utils';
import {
  createEntries, FinanceError, reverseSettlement, settleEntry, startOfToday, nextRecurrenceDate,
} from '@/server/finance';

export type FormState = { error?: string; success?: string; id?: string } | undefined;

function fail(message: string): FormState {
  return { error: message };
}

/** Aceita "1.234,56" e "1234.56". */
function parseAmount(value: FormDataEntryValue | null): number {
  if (value === null) return NaN;
  const raw = String(value).trim().replace(/[R$\s]/g, '');
  if (!raw) return NaN;
  const normalized =
    raw.includes(',') && raw.lastIndexOf(',') > raw.lastIndexOf('.')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '');
  return Number(normalized);
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function optional(formData: FormData, key: string): string | null {
  const value = str(formData, key);
  return value === '' ? null : value;
}

// ---------------------------------------------------------------------------
// Lancamentos
// ---------------------------------------------------------------------------

const entrySchema = z.object({
  kind: z.enum(['RECEIVABLE', 'PAYABLE']),
  description: z.string().min(2, 'Descreva o lancamento.'),
  amount: z.number().positive('O valor deve ser maior que zero.'),
  dueDate: z.date({ invalid_type_error: 'Informe a data de vencimento.' }),
  installments: z.number().int().min(1).max(120),
});

export async function saveEntryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await requireApiContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;
  if (!ctx.can('finance.write')) return fail('Voce nao tem permissao para lancar no financeiro.');

  const entryId = optional(formData, 'id');
  const parsed = entrySchema.safeParse({
    kind: str(formData, 'kind'),
    description: str(formData, 'description'),
    amount: parseAmount(formData.get('amount')),
    dueDate: parseDateInput(str(formData, 'dueDate')) ?? undefined,
    installments: Number(str(formData, 'installments') || '1'),
  });
  if (!parsed.success) return fail(parsed.error.errors[0].message);

  const shared = {
    description: parsed.data.description,
    contactId: optional(formData, 'contactId'),
    categoryId: optional(formData, 'categoryId'),
    costCenterId: optional(formData, 'costCenterId'),
    bankAccountId: optional(formData, 'bankAccountId'),
    documentNumber: optional(formData, 'documentNumber'),
    notes: optional(formData, 'notes'),
    tags: optional(formData, 'tags'),
    issueDate: parseDateInput(str(formData, 'issueDate')) ?? startOfToday(),
    competenceDate:
      parseDateInput(str(formData, 'competenceDate')) ??
      parseDateInput(str(formData, 'issueDate')) ??
      parsed.data.dueDate,
  };

  const path = parsed.data.kind === 'RECEIVABLE' ? '/financeiro/receber' : '/financeiro/pagar';

  try {
    if (entryId) {
      const existing = await prisma.financialEntry.findFirst({
        where: { id: entryId, companyId: ctx.company.id },
      });
      if (!existing) return fail('Lancamento nao encontrado.');
      if (existing.paidAmount > 0 && round2(parsed.data.amount) < existing.paidAmount) {
        return fail('O novo valor e menor do que o total ja baixado. Estorne as baixas antes de reduzir o valor.');
      }

      await prisma.financialEntry.update({
        where: { id: entryId },
        data: { ...shared, amount: round2(parsed.data.amount), dueDate: parsed.data.dueDate },
      });
      await audit({
        companyId: ctx.company.id, userId: ctx.user.id, action: 'UPDATE',
        entity: 'FinancialEntry', entityId: entryId, summary: `Lancamento "${shared.description}" alterado`,
      });
      revalidatePath(path);
      revalidatePath(`${path}/${entryId}`);
      redirect(`${path}/${entryId}`);
    }

    const created = await createEntries({
      companyId: ctx.company.id,
      kind: parsed.data.kind,
      amount: round2(parsed.data.amount),
      dueDate: parsed.data.dueDate,
      installments: parsed.data.installments,
      installmentMode: str(formData, 'installmentMode') === 'DAYS' ? 'DAYS' : 'MONTHLY',
      installmentIntervalDays: Number(str(formData, 'installmentIntervalDays') || '30'),
      ...shared,
    });

    await audit({
      companyId: ctx.company.id, userId: ctx.user.id, action: 'CREATE',
      entity: 'FinancialEntry', entityId: created[0]?.id,
      summary: `${parsed.data.installments > 1 ? `${parsed.data.installments} parcelas` : 'Lancamento'} de "${shared.description}"`,
    });

    revalidatePath(path);
  } catch (error) {
    if (error instanceof FinanceError) return fail(error.message);
    if (error && typeof error === 'object' && 'digest' in error) throw error; // redirect
    console.error(error);
    return fail('Nao foi possivel salvar o lancamento.');
  }

  redirect(path);
}

export async function deleteEntryAction(formData: FormData) {
  const auth = await requireApiContext();
  if (!auth.ok) return;
  const { ctx } = auth;
  if (!ctx.can('finance.write')) return;

  const id = String(formData.get('id') ?? '');
  const scope = String(formData.get('scope') ?? 'single');

  const entry = await prisma.financialEntry.findFirst({ where: { id, companyId: ctx.company.id } });
  if (!entry) return;

  const target =
    scope === 'group' && entry.groupId
      ? { companyId: ctx.company.id, groupId: entry.groupId }
      : { id: entry.id };

  await prisma.financialEntry.deleteMany({ where: target });
  await audit({
    companyId: ctx.company.id, userId: ctx.user.id, action: 'DELETE',
    entity: 'FinancialEntry', entityId: id,
    summary: `Lancamento "${entry.description}" excluido${scope === 'group' ? ' (todas as parcelas)' : ''}`,
  });

  const path = entry.kind === 'RECEIVABLE' ? '/financeiro/receber' : '/financeiro/pagar';
  revalidatePath(path);
  redirect(path);
}

export async function cancelEntryAction(formData: FormData) {
  const auth = await requireApiContext();
  if (!auth.ok) return;
  const { ctx } = auth;
  if (!ctx.can('finance.write')) return;

  const id = String(formData.get('id') ?? '');
  const entry = await prisma.financialEntry.findFirst({ where: { id, companyId: ctx.company.id } });
  if (!entry) return;

  const nextStatus = entry.status === 'CANCELED' ? (entry.paidAmount > 0 ? 'PARTIAL' : 'OPEN') : 'CANCELED';
  await prisma.financialEntry.update({ where: { id }, data: { status: nextStatus } });
  await audit({
    companyId: ctx.company.id, userId: ctx.user.id, action: 'UPDATE',
    entity: 'FinancialEntry', entityId: id,
    summary: nextStatus === 'CANCELED' ? 'Lancamento cancelado' : 'Cancelamento revertido',
  });

  const path = entry.kind === 'RECEIVABLE' ? '/financeiro/receber' : '/financeiro/pagar';
  revalidatePath(path);
  revalidatePath(`${path}/${id}`);
}

// ---------------------------------------------------------------------------
// Baixas
// ---------------------------------------------------------------------------

export async function settleEntryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await requireApiContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;
  if (!ctx.can('finance.settle')) return fail('Voce nao tem permissao para dar baixa em lancamentos.');

  const entryId = str(formData, 'entryId');
  const bankAccountId = str(formData, 'bankAccountId');
  const paidAt = parseDateInput(str(formData, 'paidAt')) ?? startOfToday();
  const amount = parseAmount(formData.get('amount'));

  if (!bankAccountId) return fail('Selecione a conta que recebeu ou pagou o valor.');
  if (!Number.isFinite(amount) || amount <= 0) return fail('Informe um valor de baixa valido.');

  try {
    await settleEntry({
      companyId: ctx.company.id,
      entryId,
      bankAccountId,
      paidAt,
      amount: round2(amount),
      discount: round2(parseAmount(formData.get('discount')) || 0),
      interest: round2(parseAmount(formData.get('interest')) || 0),
      fine: round2(parseAmount(formData.get('fine')) || 0),
      fee: round2(parseAmount(formData.get('fee')) || 0),
      paymentMethodId: optional(formData, 'paymentMethodId'),
      notes: optional(formData, 'notes'),
    });
  } catch (error) {
    if (error instanceof FinanceError) return fail(error.message);
    console.error(error);
    return fail('Nao foi possivel registrar a baixa.');
  }

  const entry = await prisma.financialEntry.findUnique({ where: { id: entryId } });
  await audit({
    companyId: ctx.company.id, userId: ctx.user.id, action: 'SETTLE',
    entity: 'FinancialEntry', entityId: entryId,
    summary: `Baixa de ${round2(amount)} em "${entry?.description ?? entryId}"`,
  });

  const path = entry?.kind === 'RECEIVABLE' ? '/financeiro/receber' : '/financeiro/pagar';
  revalidatePath(path);
  revalidatePath(`${path}/${entryId}`);
  revalidatePath('/dashboard');
  return { success: 'Baixa registrada com sucesso.' };
}

/** Baixa varios lancamentos de uma vez, pelo valor total em aberto. */
export async function settleManyAction(formData: FormData) {
  const auth = await requireApiContext();
  if (!auth.ok) return;
  const { ctx } = auth;
  if (!ctx.can('finance.settle')) return;

  const ids = formData.getAll('ids').map(String).filter(Boolean);
  const bankAccountId = String(formData.get('bankAccountId') ?? '');
  const paidAt = parseDateInput(String(formData.get('paidAt') ?? '')) ?? startOfToday();
  if (ids.length === 0 || !bankAccountId) return;

  const entries = await prisma.financialEntry.findMany({
    where: { id: { in: ids }, companyId: ctx.company.id, status: { in: ['OPEN', 'PARTIAL'] } },
  });

  for (const entry of entries) {
    const open = round2(entry.amount - entry.paidAmount);
    if (open <= 0) continue;
    try {
      await settleEntry({ companyId: ctx.company.id, entryId: entry.id, bankAccountId, paidAt, amount: open });
    } catch (error) {
      console.error('[settleMany]', error);
    }
  }

  await audit({
    companyId: ctx.company.id, userId: ctx.user.id, action: 'SETTLE',
    entity: 'FinancialEntry', summary: `Baixa em lote de ${entries.length} lancamento(s)`,
  });

  revalidatePath('/financeiro/receber');
  revalidatePath('/financeiro/pagar');
  revalidatePath('/dashboard');
}

export async function reverseSettlementAction(formData: FormData) {
  const auth = await requireApiContext();
  if (!auth.ok) return;
  const { ctx } = auth;
  if (!ctx.can('finance.settle')) return;

  const settlementId = String(formData.get('settlementId') ?? '');
  const entryId = String(formData.get('entryId') ?? '');
  try {
    await reverseSettlement(ctx.company.id, settlementId);
    await audit({
      companyId: ctx.company.id, userId: ctx.user.id, action: 'UPDATE',
      entity: 'Settlement', entityId: settlementId, summary: 'Baixa estornada',
    });
  } catch (error) {
    console.error(error);
  }

  revalidatePath('/financeiro/receber');
  revalidatePath('/financeiro/pagar');
  revalidatePath(`/financeiro/receber/${entryId}`);
  revalidatePath(`/financeiro/pagar/${entryId}`);
  revalidatePath('/conciliacao');
}

// ---------------------------------------------------------------------------
// Transferencias entre contas
// ---------------------------------------------------------------------------

export async function saveTransferAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await requireApiContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;
  if (!ctx.can('finance.write')) return fail('Sem permissao para movimentar contas.');

  const fromAccountId = str(formData, 'fromAccountId');
  const toAccountId = str(formData, 'toAccountId');
  const amount = parseAmount(formData.get('amount'));
  const date = parseDateInput(str(formData, 'date')) ?? startOfToday();

  if (!fromAccountId || !toAccountId) return fail('Selecione a conta de origem e a de destino.');
  if (fromAccountId === toAccountId) return fail('A conta de origem e a de destino devem ser diferentes.');
  if (!Number.isFinite(amount) || amount <= 0) return fail('Informe um valor valido.');

  const accounts = await prisma.bankAccount.findMany({
    where: { id: { in: [fromAccountId, toAccountId] }, companyId: ctx.company.id },
  });
  if (accounts.length !== 2) return fail('Conta invalida para esta empresa.');

  await prisma.transfer.create({
    data: {
      companyId: ctx.company.id,
      fromAccountId,
      toAccountId,
      amount: round2(amount),
      fee: round2(parseAmount(formData.get('fee')) || 0),
      date,
      description: optional(formData, 'description'),
    },
  });

  await audit({
    companyId: ctx.company.id, userId: ctx.user.id, action: 'CREATE',
    entity: 'Transfer', summary: `Transferencia de ${round2(amount)} entre contas`,
  });

  revalidatePath('/financeiro/transferencias');
  revalidatePath('/financeiro/contas');
  revalidatePath('/dashboard');
  redirect('/financeiro/transferencias');
}

export async function deleteTransferAction(formData: FormData) {
  const auth = await requireApiContext();
  if (!auth.ok) return;
  const { ctx } = auth;
  if (!ctx.can('finance.write')) return;

  await prisma.transfer.deleteMany({
    where: { id: String(formData.get('id') ?? ''), companyId: ctx.company.id },
  });
  revalidatePath('/financeiro/transferencias');
  revalidatePath('/financeiro/contas');
}

// ---------------------------------------------------------------------------
// Recorrencias
// ---------------------------------------------------------------------------

export async function saveRecurrenceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await requireApiContext();
  if (!auth.ok) return fail(auth.error);
  const { ctx } = auth;
  if (!ctx.can('finance.write')) return fail('Sem permissao.');

  const id = optional(formData, 'id');
  const description = str(formData, 'description');
  const amount = parseAmount(formData.get('amount'));
  const startDate = parseDateInput(str(formData, 'startDate'));
  const frequency = str(formData, 'frequency') || 'MONTHLY';

  if (description.length < 2) return fail('Descreva a recorrencia.');
  if (!Number.isFinite(amount) || amount <= 0) return fail('Informe um valor valido.');
  if (!startDate) return fail('Informe a data do primeiro vencimento.');

  const data = {
    companyId: ctx.company.id,
    kind: str(formData, 'kind') === 'RECEIVABLE' ? 'RECEIVABLE' : 'PAYABLE',
    description,
    amount: round2(amount),
    contactId: optional(formData, 'contactId'),
    categoryId: optional(formData, 'categoryId'),
    costCenterId: optional(formData, 'costCenterId'),
    bankAccountId: optional(formData, 'bankAccountId'),
    frequency,
    interval: Math.max(1, Number(str(formData, 'interval') || '1')),
    dayOfMonth: startDate.getUTCDate(),
    startDate,
    endDate: parseDateInput(str(formData, 'endDate')),
    occurrences: str(formData, 'occurrences') ? Number(str(formData, 'occurrences')) : null,
    isActive: formData.get('isActive') !== null,
  };

  if (id) {
    await prisma.recurrence.updateMany({ where: { id, companyId: ctx.company.id }, data });
  } else {
    await prisma.recurrence.create({ data: { ...data, nextRunAt: startDate } });
  }

  await audit({
    companyId: ctx.company.id, userId: ctx.user.id, action: id ? 'UPDATE' : 'CREATE',
    entity: 'Recurrence', entityId: id, summary: `Recorrencia "${description}"`,
  });

  revalidatePath('/financeiro/recorrencias');
  redirect('/financeiro/recorrencias');
}

export async function toggleRecurrenceAction(formData: FormData) {
  const auth = await requireApiContext();
  if (!auth.ok) return;
  const { ctx } = auth;
  if (!ctx.can('finance.write')) return;

  const id = String(formData.get('id') ?? '');
  const recurrence = await prisma.recurrence.findFirst({ where: { id, companyId: ctx.company.id } });
  if (!recurrence) return;
  await prisma.recurrence.update({ where: { id }, data: { isActive: !recurrence.isActive } });
  revalidatePath('/financeiro/recorrencias');
}

/** Gera manualmente a proxima ocorrencia de uma recorrencia. */
export async function generateRecurrenceAction(formData: FormData) {
  const auth = await requireApiContext();
  if (!auth.ok) return;
  const { ctx } = auth;
  if (!ctx.can('finance.write')) return;

  const id = String(formData.get('id') ?? '');
  const recurrence = await prisma.recurrence.findFirst({ where: { id, companyId: ctx.company.id } });
  if (!recurrence || !recurrence.isActive) return;

  await createEntries({
    companyId: ctx.company.id,
    kind: recurrence.kind as 'RECEIVABLE' | 'PAYABLE',
    description: recurrence.description,
    amount: recurrence.amount,
    dueDate: recurrence.nextRunAt,
    competenceDate: recurrence.nextRunAt,
    contactId: recurrence.contactId,
    categoryId: recurrence.categoryId,
    costCenterId: recurrence.costCenterId,
    bankAccountId: recurrence.bankAccountId,
    recurrenceId: recurrence.id,
  });

  await prisma.recurrence.update({
    where: { id },
    data: {
      nextRunAt: nextRecurrenceDate(recurrence.nextRunAt, recurrence.frequency, recurrence.interval),
      generatedCount: recurrence.generatedCount + 1,
    },
  });

  revalidatePath('/financeiro/recorrencias');
  revalidatePath('/financeiro/pagar');
  revalidatePath('/financeiro/receber');
}

export async function deleteRecurrenceAction(formData: FormData) {
  const auth = await requireApiContext();
  if (!auth.ok) return;
  const { ctx } = auth;
  if (!ctx.can('finance.write')) return;
  await prisma.recurrence.deleteMany({
    where: { id: String(formData.get('id') ?? ''), companyId: ctx.company.id },
  });
  revalidatePath('/financeiro/recorrencias');
}
