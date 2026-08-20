import { requireContext } from '@/lib/tenant';
import { getAbcCurve } from '@/server/reports';
import { addMonthsUTC, cn, endOfMonthUTC, formatCurrency, formatDate, formatPercent, parseDateInput, startOfMonthUTC } from '@/lib/utils';
import { Alert, Card, EmptyState, PageHeader, Pill } from '@/components/ui/primitives';
import { AbcChart } from '@/components/charts';
import { PeriodFilter } from '@/components/ui/period-filter';
import { FilterBar, SelectFilter } from '@/components/ui/filters';
import { PrintClient } from '@/components/ui/print-button';

export const metadata = { title: 'Curva ABC' };
export const dynamic = 'force-dynamic';

export default async function AbcPage({
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
  const dimension = get('dimension') === 'PRODUCT' ? 'PRODUCT' : 'CUSTOMER';
  const start = parseDateInput(get('from')) ?? startOfMonthUTC(addMonthsUTC(new Date(), -5));
  const endInput = parseDateInput(get('to'));
  const end = endInput ? new Date(endInput.getTime() + 86399999) : endOfMonthUTC();

  const abc = await getAbcCurve(ctx.company.id, start, end, dimension);
  const counts = {
    A: abc.rows.filter((row) => row.curve === 'A').length,
    B: abc.rows.filter((row) => row.curve === 'B').length,
    C: abc.rows.filter((row) => row.curve === 'C').length,
  };

  return (
    <>
      <PageHeader
        title="Curva ABC"
        description="Classificacao por participacao no faturamento: A ate 80% do total, B ate 95%, C o restante."
      >
        <PrintClient />
      </PageHeader>

      <FilterBar>
        <SelectFilter
          name="dimension"
          label="Analisar"
          allLabel="Por cliente"
          options={[{ value: 'PRODUCT', label: 'Por produto' }]}
        />
      </FilterBar>

      <PeriodFilter />

      {abc.rows.length === 0 ? (
        <Card>
          <EmptyState
            title="Sem vendas no periodo"
            description="Registre pedidos de venda aprovados ou faturados para gerar a curva ABC."
          />
        </Card>
      ) : (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-4">
            <div className="card p-4">
              <p className="text-xs uppercase tracking-wide text-ink-500">Faturamento analisado</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-brand-700">{formatCurrency(abc.total)}</p>
              <p className="mt-0.5 text-xs text-ink-500">{formatDate(start)} a {formatDate(end)}</p>
            </div>
            <div className="card border-emerald-200 p-4">
              <p className="text-xs uppercase tracking-wide text-emerald-700">Curva A</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-700">{counts.A}</p>
              <p className="mt-0.5 text-xs text-ink-500">Concentram ate 80% do faturamento</p>
            </div>
            <div className="card border-amber-200 p-4">
              <p className="text-xs uppercase tracking-wide text-amber-700">Curva B</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-amber-700">{counts.B}</p>
              <p className="mt-0.5 text-xs text-ink-500">De 80% a 95%</p>
            </div>
            <div className="card p-4">
              <p className="text-xs uppercase tracking-wide text-ink-500">Curva C</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-ink-600">{counts.C}</p>
              <p className="mt-0.5 text-xs text-ink-500">Cauda longa (ultimos 5%)</p>
            </div>
          </div>

          <div className="mb-5">
            <Alert tone="info">
              {dimension === 'CUSTOMER'
                ? 'Clientes da curva A merecem atencao no relacionamento: perde-los tem impacto desproporcional no faturamento.'
                : 'Produtos da curva A precisam de estoque garantido; os da curva C podem ter compra sob demanda.'}
            </Alert>
          </div>

          <Card title="Concentracao do faturamento" className="mb-6">
            <AbcChart data={abc.rows.slice(0, 20).map((row) => ({ ...row, name: row.name.slice(0, 22) }))} />
          </Card>

          <Card title="Detalhamento" bodyClassName="p-0">
            <div className="table-wrap">
              <table className="table min-w-[760px]">
                <thead>
                  <tr>
                    <th className="w-12">#</th>
                    <th>{dimension === 'CUSTOMER' ? 'Cliente' : 'Produto'}</th>
                    <th>Curva</th>
                    <th className="num">{dimension === 'CUSTOMER' ? 'Pedidos' : 'Unidades'}</th>
                    <th className="num">Faturamento</th>
                    <th className="num">Participacao</th>
                    <th className="num">Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {abc.rows.map((row, index) => (
                    <tr key={row.id}>
                      <td className="text-ink-400">{index + 1}</td>
                      <td className="font-medium text-ink-900">{row.name}</td>
                      <td>
                        <Pill tone={row.curve === 'A' ? 'positive' : row.curve === 'B' ? 'warning' : 'neutral'}>
                          {row.curve}
                        </Pill>
                      </td>
                      <td className="num">{row.quantity}</td>
                      <td className="num font-medium">{formatCurrency(row.amount)}</td>
                      <td className="num text-ink-600">{formatPercent(row.percent)}</td>
                      <td className={cn('num text-xs', row.accumulatedPercent <= 80 ? 'text-emerald-600' : 'text-ink-500')}>
                        {formatPercent(row.accumulatedPercent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
