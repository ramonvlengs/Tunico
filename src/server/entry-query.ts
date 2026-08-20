import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { parseDateInput, round2 } from '@/lib/utils';
import { startOfToday } from './finance';

export type EntryFilters = {
  q?: string;
  status?: string;
  categoryId?: string;
  contactId?: string;
  costCenterId?: string;
  bankAccountId?: string;
  from?: string;
  to?: string;
  dateField?: 'dueDate' | 'issueDate' | 'competenceDate';
  page?: string;
};

export const PAGE_SIZE = 25;

/**
 * Monta o filtro do Prisma para as telas de contas a pagar/receber.
 * O status OVERDUE nao existe no banco: e derivado de OPEN/PARTIAL vencidos.
 */
export function buildEntryWhere(
  companyId: string,
  kind: 'RECEIVABLE' | 'PAYABLE',
  filters: EntryFilters,
): Prisma.FinancialEntryWhereInput {
  const where: Prisma.FinancialEntryWhereInput = { companyId, kind };
  const today = startOfToday();

  if (filters.q) {
    where.OR = [
      { description: { contains: filters.q } },
      { documentNumber: { contains: filters.q } },
      { notes: { contains: filters.q } },
      { contact: { name: { contains: filters.q } } },
    ];
  }

  switch (filters.status) {
    case 'OVERDUE':
      where.status = { in: ['OPEN', 'PARTIAL'] };
      where.dueDate = { lt: today };
      break;
    case 'OPEN_TODAY':
      where.status = { in: ['OPEN', 'PARTIAL'] };
      where.dueDate = { gte: today, lt: new Date(today.getTime() + 86400000) };
      break;
    case 'PENDING':
      where.status = { in: ['OPEN', 'PARTIAL'] };
      break;
    case 'OPEN':
    case 'PARTIAL':
    case 'PAID':
    case 'CANCELED':
      where.status = filters.status;
      break;
    default:
      break;
  }

  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.contactId) where.contactId = filters.contactId;
  if (filters.costCenterId) where.costCenterId = filters.costCenterId;
  if (filters.bankAccountId) where.bankAccountId = filters.bankAccountId;

  const field = filters.dateField ?? 'dueDate';
  const from = parseDateInput(filters.from);
  const to = parseDateInput(filters.to);
  if (from || to) {
    const range: Prisma.DateTimeFilter = {};
    if (from) range.gte = from;
    if (to) range.lte = new Date(to.getTime() + 86399999);
    // Nao sobrescreve o intervalo ja definido pelo status OVERDUE/OPEN_TODAY.
    if (!where.dueDate || field !== 'dueDate') where[field] = range;
  }

  return where;
}

export async function queryEntries(
  companyId: string,
  kind: 'RECEIVABLE' | 'PAYABLE',
  filters: EntryFilters,
) {
  const where = buildEntryWhere(companyId, kind, filters);
  const page = Math.max(1, Number(filters.page ?? '1') || 1);

  const [entries, total, aggregate] = await Promise.all([
    prisma.financialEntry.findMany({
      where,
      include: {
        contact: { select: { id: true, name: true } },
        category: { select: { id: true, name: true, color: true } },
        costCenter: { select: { name: true } },
        bankAccount: { select: { name: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.financialEntry.count({ where }),
    prisma.financialEntry.aggregate({ where, _sum: { amount: true, paidAmount: true } }),
  ]);

  const totalAmount = round2(aggregate._sum.amount ?? 0);
  const totalPaid = round2(aggregate._sum.paidAmount ?? 0);

  return {
    entries,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    totals: { amount: totalAmount, paid: totalPaid, open: round2(totalAmount - totalPaid) },
  };
}

/** Listas auxiliares usadas nos filtros e formularios. */
export async function getFormOptions(companyId: string) {
  const [categories, contacts, costCenters, bankAccounts, paymentMethods] = await Promise.all([
    prisma.category.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true, type: true, parentId: true, code: true },
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
    }),
    prisma.contact.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true, kind: true },
      orderBy: { name: 'asc' },
    }),
    prisma.costCenter.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.bankAccount.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true, type: true },
      orderBy: { name: 'asc' },
    }),
    prisma.paymentMethod.findMany({
      where: { companyId, isActive: true },
      select: { id: true, name: true, bankAccountId: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return { categories, contacts, costCenters, bankAccounts, paymentMethods };
}
