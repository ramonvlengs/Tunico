import Link from 'next/link';
import { requireContext } from '@/lib/tenant';
import { getTopCategories } from '@/server/reports';
import { addMonthsUTC, endOfMonthUTC, formatCurrency, formatDate, formatPercent, parseDateInput, startOfMonthUTC, round2 } from '@/lib/utils';
import { Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { CategoryDonut } from '@/components/charts';
import { PeriodFilter } from '@/components/ui/period-filter';
import { PrintClient } from '@/components/ui/print-button';

export const metadata = { title: 'Relatorio por categoria' };
export const dynamic = 'force-dynamic';

export default async function CategoriesReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await searchParams;
  const get = (key: string) => {
    const value = search[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const ctx = await requireContext();
  const start = parseDateInput(get('from')) ?? startOfMonthUTC(addMonthsUTC(new Date(), -2));
  const endInput = parseDateInput(get('to'));
  const end = endInput ? new Date(endInput.getTime() + 86399999) : endOfMonthUTC();

  const [income, expense] = await Promise.all([
    getTopCategories(ctx.company.id, start, end, 'INCOME', 30),
    getTopCategories(ctx.company.id, start, end, 'EXPENSE', 30),
  ]);

  const incomeTotal = round2(income.reduce((sum, item) => sum + item.amount, 0));
  const expenseTotal = round2(expense.reduce((sum, item) => sum + item.amount, 0));
  const result = round2(incomeTotal - expenseTotal);

  const sections = [
    { key: 'income', title: 'Receitas por categoria', data: income, total: incomeTotal, tone: 'text-emerald-600' },
    { key: 'expense', title: 'Despesas por categoria', data: expense, total: expenseTotal, tone: 'text-red-600' },
  ] as const;

  return (
    <>
      <PageHeader
        title="Resultado por categoria"
        description="Quanto cada categoria do plano de contas representou no periodo (regime de competencia)."
      >
        <PrintClient />
      </PageHeader>

      <PeriodFilter />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-500">Receitas</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-600">{formatCurrency(incomeTotal)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-500">Despesas</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-red-600">{formatCurrency(expenseTotal)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-500">Resultado</p>
          <p className={`mt-1 text-xl font-semibold tabular-nums ${result >= 0 ? 'text-brand-700' : 'text-red-600'}`}>
            {formatCurrency(result)}
          </p>
          <p className="mt-0.5 text-xs text-ink-500">{formatDate(start)} a {formatDate(end)}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.key} title={section.title}>
            {section.data.length === 0 ? (
              <EmptyState title="Sem lancamentos no periodo" />
            ) : (
              <>
                <CategoryDonut data={section.data.slice(0, 8)} />
                <div className="mt-4 table-wrap">
                  <table className="table min-w-0">
                    <thead>
                      <tr>
                        <th>Categoria</th>
                        <th className="num">Valor</th>
                        <th className="num">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.data.map((item) => (
                        <tr key={item.name}>
                          <td>
                            <span className="inline-flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ background: item.color ?? '#94a3b8' }}
                              />
                              {item.id ? (
                                <Link
                                  href={`/financeiro/${section.key === 'income' ? 'receber' : 'pagar'}?categoryId=${item.id}`}
                                  className="link"
                                >
                                  {item.name}
                                </Link>
                              ) : (
                                item.name
                              )}
                            </span>
                          </td>
                          <td className={`num font-medium tabular-nums ${section.tone}`}>
                            {formatCurrency(item.amount)}
                          </td>
                          <td className="num text-xs text-ink-500">{formatPercent(item.percent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
