import { requireContext } from '@/lib/tenant';
import { getCashFlow } from '@/server/reports';
import { getAccountBalances } from '@/server/finance';
import { cn, formatCurrency } from '@/lib/utils';
import { Alert, Card, PageHeader } from '@/components/ui/primitives';
import { CashFlowChart } from '@/components/charts';
import { PrintClient } from '@/components/ui/print-button';
import { FilterBar, SelectFilter } from '@/components/ui/filters';

export const metadata = { title: 'Fluxo de caixa' };
export const dynamic = 'force-dynamic';

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await searchParams;
  const monthsParam = Array.isArray(search.months) ? search.months[0] : search.months;
  const months = [6, 12, 18, 24].includes(Number(monthsParam)) ? Number(monthsParam) : 12;

  const ctx = await requireContext();
  const [points, balances] = await Promise.all([
    getCashFlow(ctx.company.id, months),
    getAccountBalances(ctx.company.id),
  ]);

  const cashToday = balances.filter((b) => b.includeInCash).reduce((sum, b) => sum + b.balance, 0);
  const totalIn = points.reduce((sum, p) => sum + p.realizedIn + p.forecastIn, 0);
  const totalOut = points.reduce((sum, p) => sum + p.realizedOut + p.forecastOut, 0);
  const lowest = points.reduce((min, p) => (p.accumulated < min.accumulated ? p : min), points[0]);

  return (
    <>
      <PageHeader
        title="Fluxo de caixa"
        description="Entradas e saidas mes a mes. Meses passados usam o realizado (baixas); meses futuros usam a previsao pelos vencimentos em aberto."
      >
        <PrintClient />
      </PageHeader>

      <FilterBar>
        <SelectFilter
          name="months"
          label="Periodo"
          allLabel="12 meses"
          options={[
            { value: '6', label: '6 meses' },
            { value: '18', label: '18 meses' },
            { value: '24', label: '24 meses' },
          ]}
        />
      </FilterBar>

      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-500">Saldo hoje</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-brand-700">{formatCurrency(cashToday)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-500">Entradas no periodo</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-600">{formatCurrency(totalIn)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-500">Saidas no periodo</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-red-600">{formatCurrency(totalOut)}</p>
        </div>
        <div className={cn('card p-4', lowest && lowest.accumulated < 0 && 'border-red-300 bg-red-50')}>
          <p className="text-xs uppercase tracking-wide text-ink-500">Menor saldo projetado</p>
          <p className={cn('mt-1 text-xl font-semibold tabular-nums', lowest && lowest.accumulated < 0 ? 'text-red-600' : 'text-ink-900')}>
            {formatCurrency(lowest?.accumulated ?? 0)}
          </p>
          {lowest && <p className="mt-0.5 text-xs text-ink-500">em {lowest.label}</p>}
        </div>
      </div>

      {lowest && lowest.accumulated < 0 && (
        <div className="mb-5">
          <Alert tone="warning" title="Atencao ao caixa">
            A projecao indica saldo negativo de {formatCurrency(lowest.accumulated)} em {lowest.label}. Considere
            antecipar recebimentos ou renegociar vencimentos.
          </Alert>
        </div>
      )}

      <Card title="Evolucao mensal" className="mb-6">
        <CashFlowChart data={points} />
      </Card>

      <Card title="Detalhamento" bodyClassName="p-0">
        <div className="table-wrap">
          <table className="table min-w-[860px]">
            <thead>
              <tr>
                <th>Mes</th>
                <th className="num">Entradas realizadas</th>
                <th className="num">Entradas previstas</th>
                <th className="num">Saidas realizadas</th>
                <th className="num">Saidas previstas</th>
                <th className="num">Resultado</th>
                <th className="num">Saldo acumulado</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.key}>
                  <td className="font-medium capitalize">{point.label}</td>
                  <td className="num text-emerald-600">{formatCurrency(point.realizedIn)}</td>
                  <td className="num text-emerald-500/80">{formatCurrency(point.forecastIn)}</td>
                  <td className="num text-red-600">{formatCurrency(point.realizedOut)}</td>
                  <td className="num text-red-500/80">{formatCurrency(point.forecastOut)}</td>
                  <td className={cn('num font-medium', point.net >= 0 ? 'text-emerald-700' : 'text-red-700')}>
                    {formatCurrency(point.net)}
                  </td>
                  <td className={cn('num font-semibold', point.accumulated >= 0 ? 'text-ink-900' : 'text-red-700')}>
                    {formatCurrency(point.accumulated)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
