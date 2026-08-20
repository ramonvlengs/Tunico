import 'server-only';
import { prisma } from '@/lib/prisma';
import { addMonthsUTC, endOfMonthUTC, monthLabel, round2, startOfMonthUTC } from '@/lib/utils';
import { getAccountBalances, startOfToday } from './finance';

// ---------------------------------------------------------------------------
// Painel inicial
// ---------------------------------------------------------------------------

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

export async function getDashboard(companyId: string, reference = new Date()) {
  const monthStart = startOfMonthUTC(reference);
  const monthEnd = endOfMonthUTC(reference);
  const today = startOfToday();
  const in7 = new Date(today.getTime() + 7 * 86400000);
  const in30 = new Date(today.getTime() + 30 * 86400000);

  const [
    balances,
    receivedMonth,
    paidMonth,
    openReceivable,
    openPayable,
    overdueReceivable,
    overduePayable,
    dueNext7Receivable,
    dueNext7Payable,
    salesMonth,
    pendingRecon,
    topCategories,
  ] = await Promise.all([
    getAccountBalances(companyId),
    prisma.settlement.aggregate({
      where: { companyId, paidAt: { gte: monthStart, lte: monthEnd }, entry: { kind: 'RECEIVABLE' } },
      _sum: { amount: true, interest: true, fine: true },
    }),
    prisma.settlement.aggregate({
      where: { companyId, paidAt: { gte: monthStart, lte: monthEnd }, entry: { kind: 'PAYABLE' } },
      _sum: { amount: true, interest: true, fine: true },
    }),
    openSum(companyId, 'RECEIVABLE'),
    openSum(companyId, 'PAYABLE'),
    openSum(companyId, 'RECEIVABLE', { lt: today }),
    openSum(companyId, 'PAYABLE', { lt: today }),
    openSum(companyId, 'RECEIVABLE', { gte: today, lte: in7 }),
    openSum(companyId, 'PAYABLE', { gte: today, lte: in7 }),
    prisma.order.aggregate({
      where: { companyId, type: 'SALE', status: { in: ['APPROVED', 'BILLED'] }, issueDate: { gte: monthStart, lte: monthEnd } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.bankTransaction.count({ where: { companyId, status: 'PENDING' } }),
    getTopCategories(companyId, monthStart, monthEnd, 'EXPENSE', 5),
  ]);

  const received = round2((receivedMonth._sum.amount ?? 0) + (receivedMonth._sum.interest ?? 0) + (receivedMonth._sum.fine ?? 0));
  const paid = round2((paidMonth._sum.amount ?? 0) + (paidMonth._sum.interest ?? 0) + (paidMonth._sum.fine ?? 0));

  return {
    cash: round2(balances.filter((b) => b.includeInCash).reduce((s, b) => s + b.balance, 0)),
    balances,
    month: {
      received,
      paid,
      result: round2(received - paid),
      label: monthLabel(monthStart),
    },
    receivable: {
      open: openReceivable,
      overdue: overdueReceivable,
      next7: dueNext7Receivable,
    },
    payable: {
      open: openPayable,
      overdue: overduePayable,
      next7: dueNext7Payable,
    },
    projected30: round2(
      balances.filter((b) => b.includeInCash).reduce((s, b) => s + b.balance, 0) +
        (await openSum(companyId, 'RECEIVABLE', { lte: in30 })) -
        (await openSum(companyId, 'PAYABLE', { lte: in30 })),
    ),
    sales: { total: round2(salesMonth._sum.total ?? 0), count: salesMonth._count },
    pendingReconciliation: pendingRecon,
    topExpenseCategories: topCategories,
  };
}

async function openSum(
  companyId: string,
  kind: 'RECEIVABLE' | 'PAYABLE',
  dueDate?: { lt?: Date; gte?: Date; lte?: Date },
): Promise<number> {
  const rows = await prisma.financialEntry.findMany({
    where: {
      companyId,
      kind,
      status: { in: ['OPEN', 'PARTIAL'] },
      ...(dueDate ? { dueDate } : {}),
    },
    select: { amount: true, paidAmount: true },
  });
  return round2(rows.reduce((sum, r) => sum + (r.amount - r.paidAmount), 0));
}

// ---------------------------------------------------------------------------
// Fluxo de caixa
// ---------------------------------------------------------------------------

export type CashFlowPoint = {
  key: string;
  label: string;
  realizedIn: number;
  realizedOut: number;
  forecastIn: number;
  forecastOut: number;
  net: number;
  accumulated: number;
};

/**
 * Fluxo de caixa mensal. Meses passados usam o realizado (baixas); meses
 * futuros usam o previsto (lancamentos em aberto pela data de vencimento).
 * O acumulado parte do saldo atual das contas.
 */
export async function getCashFlow(companyId: string, months = 12, reference = new Date()): Promise<CashFlowPoint[]> {
  const past = Math.floor(months / 2);
  const start = startOfMonthUTC(addMonthsUTC(reference, -past));
  const end = endOfMonthUTC(addMonthsUTC(reference, months - past - 1));
  const currentMonth = startOfMonthUTC(reference);

  const [settlements, openEntries, balances] = await Promise.all([
    prisma.settlement.findMany({
      where: { companyId, paidAt: { gte: start, lte: end } },
      select: { paidAt: true, amount: true, interest: true, fine: true, fee: true, entry: { select: { kind: true } } },
    }),
    prisma.financialEntry.findMany({
      where: { companyId, status: { in: ['OPEN', 'PARTIAL'] }, dueDate: { gte: start, lte: end } },
      select: { dueDate: true, amount: true, paidAmount: true, kind: true },
    }),
    getAccountBalances(companyId),
  ]);

  const buckets = new Map<string, CashFlowPoint>();
  for (let i = 0; i < months; i++) {
    const date = startOfMonthUTC(addMonthsUTC(start, i));
    const key = date.toISOString().slice(0, 7);
    buckets.set(key, {
      key,
      label: monthLabel(date),
      realizedIn: 0,
      realizedOut: 0,
      forecastIn: 0,
      forecastOut: 0,
      net: 0,
      accumulated: 0,
    });
  }

  for (const s of settlements) {
    const key = s.paidAt.toISOString().slice(0, 7);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const cash = s.amount + s.interest + s.fine - s.fee;
    if (s.entry.kind === 'RECEIVABLE') bucket.realizedIn = round2(bucket.realizedIn + cash);
    else bucket.realizedOut = round2(bucket.realizedOut + cash);
  }

  for (const e of openEntries) {
    const key = e.dueDate.toISOString().slice(0, 7);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const value = round2(e.amount - e.paidAmount);
    if (e.kind === 'RECEIVABLE') bucket.forecastIn = round2(bucket.forecastIn + value);
    else bucket.forecastOut = round2(bucket.forecastOut + value);
  }

  // O acumulado retroage a partir do saldo atual para os meses passados e
  // avanca com o previsto para os meses futuros.
  const cashToday = round2(balances.filter((b) => b.includeInCash).reduce((s, b) => s + b.balance, 0));
  const points = Array.from(buckets.values());
  const currentIndex = points.findIndex((p) => p.key === currentMonth.toISOString().slice(0, 7));

  points.forEach((p) => {
    p.net = round2(p.realizedIn + p.forecastIn - p.realizedOut - p.forecastOut);
  });

  if (currentIndex >= 0) {
    points[currentIndex].accumulated = cashToday;
    for (let i = currentIndex + 1; i < points.length; i++) {
      points[i].accumulated = round2(points[i - 1].accumulated + points[i].net);
    }
    for (let i = currentIndex - 1; i >= 0; i--) {
      points[i].accumulated = round2(points[i + 1].accumulated - points[i + 1].net);
    }
  } else {
    let running = cashToday;
    for (const p of points) {
      running = round2(running + p.net);
      p.accumulated = running;
    }
  }

  return points;
}

// ---------------------------------------------------------------------------
// DRE (regime de competencia)
// ---------------------------------------------------------------------------

export type DreLine = {
  categoryId: string | null;
  name: string;
  group: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  percent: number;
};

export type DreResult = {
  start: Date;
  end: Date;
  revenue: number;
  deductions: number;
  netRevenue: number;
  costOfGoods: number;
  grossProfit: number;
  grossMargin: number;
  operatingExpenses: number;
  operatingResult: number;
  financialResult: number;
  otherResult: number;
  netResult: number;
  netMargin: number;
  lines: DreLine[];
};

const DEDUCTION_GROUPS = new Set(['DEDUCOES', 'IMPOSTOS']);
const COGS_GROUPS = new Set(['CMV']);
const FINANCIAL_GROUPS = new Set(['DESPESA_FINANCEIRA', 'RECEITA_FINANCEIRA']);
const OTHER_GROUPS = new Set(['OUTRAS_RECEITAS', 'INVESTIMENTO']);

/**
 * DRE por competencia: usa competenceDate e considera o valor integral do
 * lancamento (pago ou nao), como manda o regime de competencia.
 * Lancamentos cancelados sao excluidos.
 */
export async function getDre(companyId: string, start: Date, end: Date): Promise<DreResult> {
  const entries = await prisma.financialEntry.findMany({
    where: {
      companyId,
      status: { not: 'CANCELED' },
      competenceDate: { gte: start, lte: end },
    },
    select: {
      amount: true,
      kind: true,
      categoryId: true,
      category: { select: { id: true, name: true, type: true, dreGroup: true } },
    },
  });

  const map = new Map<string, DreLine>();
  for (const entry of entries) {
    const key = entry.categoryId ?? `__sem__${entry.kind}`;
    const existing = map.get(key);
    const line: DreLine = existing ?? {
      categoryId: entry.categoryId,
      name: entry.category?.name ?? (entry.kind === 'RECEIVABLE' ? 'Receitas sem categoria' : 'Despesas sem categoria'),
      group: entry.category?.dreGroup ?? (entry.kind === 'RECEIVABLE' ? 'RECEITA_BRUTA' : 'DESPESA_OPERACIONAL'),
      type: entry.kind === 'RECEIVABLE' ? 'INCOME' : 'EXPENSE',
      amount: 0,
      percent: 0,
    };
    line.amount = round2(line.amount + entry.amount);
    map.set(key, line);
  }

  const lines = Array.from(map.values());
  const sumWhere = (predicate: (line: DreLine) => boolean) =>
    round2(lines.filter(predicate).reduce((s, l) => s + l.amount, 0));

  const revenue = sumWhere((l) => l.type === 'INCOME' && !OTHER_GROUPS.has(l.group) && !FINANCIAL_GROUPS.has(l.group));
  const deductions = sumWhere((l) => l.type === 'EXPENSE' && DEDUCTION_GROUPS.has(l.group));
  const costOfGoods = sumWhere((l) => l.type === 'EXPENSE' && COGS_GROUPS.has(l.group));
  const operatingExpenses = sumWhere(
    (l) => l.type === 'EXPENSE' && !DEDUCTION_GROUPS.has(l.group) && !COGS_GROUPS.has(l.group) && !FINANCIAL_GROUPS.has(l.group) && !OTHER_GROUPS.has(l.group),
  );
  const financialExpenses = sumWhere((l) => l.type === 'EXPENSE' && FINANCIAL_GROUPS.has(l.group));
  const financialIncome = sumWhere((l) => l.type === 'INCOME' && FINANCIAL_GROUPS.has(l.group));
  const otherIncome = sumWhere((l) => l.type === 'INCOME' && OTHER_GROUPS.has(l.group));
  const otherExpenses = sumWhere((l) => l.type === 'EXPENSE' && OTHER_GROUPS.has(l.group));

  const netRevenue = round2(revenue - deductions);
  const grossProfit = round2(netRevenue - costOfGoods);
  const operatingResult = round2(grossProfit - operatingExpenses);
  const financialResult = round2(financialIncome - financialExpenses);
  const otherResult = round2(otherIncome - otherExpenses);
  const netResult = round2(operatingResult + financialResult + otherResult);

  const base = revenue || 1;
  for (const line of lines) line.percent = round2((line.amount / base) * 100);
  lines.sort((a, b) => b.amount - a.amount);

  return {
    start,
    end,
    revenue,
    deductions,
    netRevenue,
    costOfGoods,
    grossProfit,
    grossMargin: revenue ? round2((grossProfit / revenue) * 100) : 0,
    operatingExpenses,
    operatingResult,
    financialResult,
    otherResult,
    netResult,
    netMargin: revenue ? round2((netResult / revenue) * 100) : 0,
    lines,
  };
}

// ---------------------------------------------------------------------------
// Outros relatorios
// ---------------------------------------------------------------------------

export async function getTopCategories(
  companyId: string,
  start: Date,
  end: Date,
  type: 'INCOME' | 'EXPENSE',
  limit = 8,
) {
  const kind = type === 'INCOME' ? 'RECEIVABLE' : 'PAYABLE';
  const entries = await prisma.financialEntry.findMany({
    where: { companyId, kind, status: { not: 'CANCELED' }, competenceDate: { gte: start, lte: end } },
    select: { amount: true, category: { select: { id: true, name: true, color: true } } },
  });

  const map = new Map<string, { id: string | null; name: string; color: string | null; amount: number }>();
  for (const e of entries) {
    const key = e.category?.id ?? '__none__';
    const current = map.get(key) ?? {
      id: e.category?.id ?? null,
      name: e.category?.name ?? 'Sem categoria',
      color: e.category?.color ?? null,
      amount: 0,
    };
    current.amount = round2(current.amount + e.amount);
    map.set(key, current);
  }

  const total = round2(Array.from(map.values()).reduce((s, c) => s + c.amount, 0)) || 1;
  return Array.from(map.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
    .map((c) => ({ ...c, percent: round2((c.amount / total) * 100) }));
}

/** Aging de inadimplencia: faixas de dias em atraso. */
export async function getAging(companyId: string, kind: 'RECEIVABLE' | 'PAYABLE' = 'RECEIVABLE') {
  const today = startOfToday();
  const entries = await prisma.financialEntry.findMany({
    where: { companyId, kind, status: { in: ['OPEN', 'PARTIAL'] }, dueDate: { lt: today } },
    include: { contact: { select: { id: true, name: true, phone: true, email: true } } },
    orderBy: { dueDate: 'asc' },
  });

  const buckets = [
    { key: '1-15', label: '1 a 15 dias', min: 1, max: 15, amount: 0, count: 0 },
    { key: '16-30', label: '16 a 30 dias', min: 16, max: 30, amount: 0, count: 0 },
    { key: '31-60', label: '31 a 60 dias', min: 31, max: 60, amount: 0, count: 0 },
    { key: '61-90', label: '61 a 90 dias', min: 61, max: 90, amount: 0, count: 0 },
    { key: '90+', label: 'Acima de 90 dias', min: 91, max: Infinity, amount: 0, count: 0 },
  ];

  const byContact = new Map<string, { id: string | null; name: string; phone: string | null; email: string | null; amount: number; count: number; oldestDays: number }>();

  for (const entry of entries) {
    const open = round2(entry.amount - entry.paidAmount);
    if (open <= 0) continue;
    const days = Math.floor((today.getTime() - entry.dueDate.getTime()) / 86400000);
    const bucket = buckets.find((b) => days >= b.min && days <= b.max);
    if (bucket) {
      bucket.amount = round2(bucket.amount + open);
      bucket.count += 1;
    }

    const key = entry.contact?.id ?? '__none__';
    const current = byContact.get(key) ?? {
      id: entry.contact?.id ?? null,
      name: entry.contact?.name ?? 'Sem contato vinculado',
      phone: entry.contact?.phone ?? null,
      email: entry.contact?.email ?? null,
      amount: 0,
      count: 0,
      oldestDays: 0,
    };
    current.amount = round2(current.amount + open);
    current.count += 1;
    current.oldestDays = Math.max(current.oldestDays, days);
    byContact.set(key, current);
  }

  return {
    buckets,
    total: round2(buckets.reduce((s, b) => s + b.amount, 0)),
    count: buckets.reduce((s, b) => s + b.count, 0),
    contacts: Array.from(byContact.values()).sort((a, b) => b.amount - a.amount),
    entries,
  };
}

/** Curva ABC de clientes ou produtos por faturamento no periodo. */
export async function getAbcCurve(
  companyId: string,
  start: Date,
  end: Date,
  dimension: 'CUSTOMER' | 'PRODUCT' = 'CUSTOMER',
) {
  type Row = { id: string; name: string; amount: number; quantity: number };
  const rows = new Map<string, Row>();

  if (dimension === 'CUSTOMER') {
    const orders = await prisma.order.findMany({
      where: { companyId, type: 'SALE', status: { in: ['APPROVED', 'BILLED'] }, issueDate: { gte: start, lte: end } },
      select: { total: true, contact: { select: { id: true, name: true } } },
    });
    for (const order of orders) {
      const key = order.contact?.id ?? '__none__';
      const current = rows.get(key) ?? { id: key, name: order.contact?.name ?? 'Consumidor final', amount: 0, quantity: 0 };
      current.amount = round2(current.amount + order.total);
      current.quantity += 1;
      rows.set(key, current);
    }
  } else {
    const items = await prisma.orderItem.findMany({
      where: {
        order: { companyId, type: 'SALE', status: { in: ['APPROVED', 'BILLED'] }, issueDate: { gte: start, lte: end } },
      },
      select: { total: true, quantity: true, description: true, product: { select: { id: true, name: true } } },
    });
    for (const item of items) {
      const key = item.product?.id ?? `desc:${item.description}`;
      const current = rows.get(key) ?? { id: key, name: item.product?.name ?? item.description, amount: 0, quantity: 0 };
      current.amount = round2(current.amount + item.total);
      current.quantity += item.quantity;
      rows.set(key, current);
    }
  }

  const sorted = Array.from(rows.values()).sort((a, b) => b.amount - a.amount);
  const total = round2(sorted.reduce((s, r) => s + r.amount, 0)) || 1;

  let accumulated = 0;
  return {
    total: round2(total),
    rows: sorted.map((row) => {
      accumulated = round2(accumulated + row.amount);
      const accPercent = round2((accumulated / total) * 100);
      const curve = accPercent <= 80 ? 'A' : accPercent <= 95 ? 'B' : 'C';
      return {
        ...row,
        percent: round2((row.amount / total) * 100),
        accumulatedPercent: accPercent,
        curve,
      };
    }),
  };
}

/** Extrato consolidado: baixas + transferencias de uma conta, com saldo corrido. */
export async function getAccountStatement(
  companyId: string,
  bankAccountId: string,
  start: Date,
  end: Date,
) {
  const [account, settlements, transfersOut, transfersIn] = await Promise.all([
    prisma.bankAccount.findFirst({ where: { id: bankAccountId, companyId } }),
    prisma.settlement.findMany({
      where: { companyId, bankAccountId, paidAt: { gte: start, lte: end } },
      include: {
        entry: { select: { id: true, kind: true, description: true, contact: { select: { name: true } }, category: { select: { name: true } } } },
      },
      orderBy: { paidAt: 'asc' },
    }),
    prisma.transfer.findMany({
      where: { companyId, fromAccountId: bankAccountId, date: { gte: start, lte: end } },
      include: { toAccount: { select: { name: true } } },
    }),
    prisma.transfer.findMany({
      where: { companyId, toAccountId: bankAccountId, date: { gte: start, lte: end } },
      include: { fromAccount: { select: { name: true } } },
    }),
  ]);

  if (!account) return null;

  const balances = await getAccountBalances(companyId, new Date(start.getTime() - 1));
  let running = balances.find((b) => b.id === bankAccountId)?.balance ?? account.initialBalance;
  const openingBalance = running;

  type Line = {
    id: string;
    date: Date;
    description: string;
    reference: string | null;
    amount: number;
    balance: number;
    entryId: string | null;
    kind: 'SETTLEMENT' | 'TRANSFER';
  };

  const lines: Line[] = [
    ...settlements.map((s) => ({
      id: s.id,
      date: s.paidAt,
      description: s.entry.description,
      reference: s.entry.contact?.name ?? s.entry.category?.name ?? null,
      amount: round2(
        (s.entry.kind === 'RECEIVABLE' ? 1 : -1) * (s.amount + s.interest + s.fine - s.fee),
      ),
      balance: 0,
      entryId: s.entry.id,
      kind: 'SETTLEMENT' as const,
    })),
    ...transfersOut.map((t) => ({
      id: t.id,
      date: t.date,
      description: `Transferencia para ${t.toAccount.name}`,
      reference: t.description,
      amount: round2(-(t.amount + t.fee)),
      balance: 0,
      entryId: null,
      kind: 'TRANSFER' as const,
    })),
    ...transfersIn.map((t) => ({
      id: t.id,
      date: t.date,
      description: `Transferencia de ${t.fromAccount.name}`,
      reference: t.description,
      amount: round2(t.amount),
      balance: 0,
      entryId: null,
      kind: 'TRANSFER' as const,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const line of lines) {
    running = round2(running + line.amount);
    line.balance = running;
  }

  return {
    account,
    openingBalance,
    closingBalance: running,
    totalIn: round2(lines.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0)),
    totalOut: round2(Math.abs(lines.filter((l) => l.amount < 0).reduce((s, l) => s + l.amount, 0))),
    lines,
  };
}
