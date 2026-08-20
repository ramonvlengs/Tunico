import { requireContext } from '@/lib/tenant';
import { getDre } from '@/server/reports';
import { endOfMonthUTC, formatCurrency, formatDate, formatPercent, parseDateInput, startOfMonthUTC, addMonthsUTC } from '@/lib/utils';
import { Alert, Card, PageHeader } from '@/components/ui/primitives';
import { PeriodFilter } from '@/components/ui/period-filter';
import { PrintClient } from '@/components/ui/print-button';
import { cn } from '@/lib/utils';

export const metadata = { title: 'DRE' };
export const dynamic = 'force-dynamic';

export default async function DrePage({
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

  const dre = await getDre(ctx.company.id, start, end);

  const rows: Array<{ label: string; value: number; kind: 'total' | 'subtotal' | 'line'; percent?: number; hint?: string }> = [
    { label: 'Receita bruta', value: dre.revenue, kind: 'subtotal' },
    { label: '(-) Impostos e deducoes sobre vendas', value: -dre.deductions, kind: 'line' },
    { label: '= Receita liquida', value: dre.netRevenue, kind: 'subtotal', percent: dre.revenue ? (dre.netRevenue / dre.revenue) * 100 : 0 },
    { label: '(-) Custo das mercadorias vendidas (CMV)', value: -dre.costOfGoods, kind: 'line' },
    { label: '= Lucro bruto', value: dre.grossProfit, kind: 'subtotal', percent: dre.grossMargin, hint: 'Margem bruta' },
    { label: '(-) Despesas operacionais e administrativas', value: -dre.operatingExpenses, kind: 'line' },
    { label: '= Resultado operacional', value: dre.operatingResult, kind: 'subtotal', percent: dre.revenue ? (dre.operatingResult / dre.revenue) * 100 : 0 },
    { label: '(+/-) Resultado financeiro', value: dre.financialResult, kind: 'line' },
    { label: '(+/-) Outras receitas e investimentos', value: dre.otherResult, kind: 'line' },
    { label: '= Resultado liquido do periodo', value: dre.netResult, kind: 'total', percent: dre.netMargin, hint: 'Margem liquida' },
  ];

  return (
    <>
      <PageHeader
        title="DRE - Demonstrativo de Resultado"
        description="Regime de competencia: cada lancamento entra no mes a que pertence, independente de ter sido pago."
      >
        <PrintClient />
      </PageHeader>

      <PeriodFilter />

      <div className="mb-5">
        <Alert tone="info">
          Periodo analisado: <strong>{formatDate(start)}</strong> a <strong>{formatDate(end)}</strong>. Lancamentos
          cancelados sao desconsiderados.
        </Alert>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card title="Demonstrativo" bodyClassName="p-0">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Linha</th>
                    <th className="num">Valor</th>
                    <th className="num">% da receita</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.label}
                      className={cn(
                        row.kind === 'total' && 'bg-brand-50/70 font-semibold',
                        row.kind === 'subtotal' && 'bg-ink-50/60 font-medium',
                      )}
                    >
                      <td className={cn(row.kind === 'line' && 'pl-8 text-ink-600')}>{row.label}</td>
                      <td
                        className={cn(
                          'num tabular-nums',
                          row.kind === 'total' && (row.value >= 0 ? 'text-emerald-700' : 'text-red-700'),
                        )}
                      >
                        {formatCurrency(row.value)}
                      </td>
                      <td className="num text-xs text-ink-500">
                        {row.percent !== undefined ? formatPercent(row.percent) : ''}
                        {row.hint && <span className="ml-1 text-ink-400">({row.hint})</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card title="Detalhamento por categoria" bodyClassName="p-0">
            <div className="table-wrap">
              <table className="table min-w-0">
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th className="num">Valor</th>
                    <th className="num">%</th>
                  </tr>
                </thead>
                <tbody>
                  {dre.lines.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-sm text-ink-500">
                        Nenhum lancamento no periodo.
                      </td>
                    </tr>
                  )}
                  {dre.lines.map((line) => (
                    <tr key={`${line.categoryId ?? line.name}-${line.type}`}>
                      <td>
                        <span className="block truncate text-ink-900" title={line.name}>{line.name}</span>
                        <span className="text-[11px] text-ink-400">
                          {line.type === 'INCOME' ? 'Receita' : 'Despesa'}
                        </span>
                      </td>
                      <td className={cn('num tabular-nums', line.type === 'INCOME' ? 'text-emerald-600' : 'text-red-600')}>
                        {formatCurrency(line.amount)}
                      </td>
                      <td className="num text-xs text-ink-500">{formatPercent(line.percent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
