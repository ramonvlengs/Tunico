import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { requireContext } from '@/lib/tenant';
import { getAging } from '@/server/reports';
import { formatCurrency, formatDate, formatPhone } from '@/lib/utils';
import { Card, EmptyState, PageHeader, Pill } from '@/components/ui/primitives';
import { AgingChart } from '@/components/charts';
import { PrintClient } from '@/components/ui/print-button';
import { FilterBar, SelectFilter } from '@/components/ui/filters';

export const metadata = { title: 'Inadimplencia' };
export const dynamic = 'force-dynamic';

export default async function AgingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await searchParams;
  const kindParam = Array.isArray(search.kind) ? search.kind[0] : search.kind;
  const kind = kindParam === 'PAYABLE' ? 'PAYABLE' : 'RECEIVABLE';

  const ctx = await requireContext();
  const aging = await getAging(ctx.company.id, kind);
  const slug = kind === 'RECEIVABLE' ? 'receber' : 'pagar';

  return (
    <>
      <PageHeader
        title={kind === 'RECEIVABLE' ? 'Inadimplencia de clientes' : 'Contas em atraso'}
        description="Titulos vencidos e ainda em aberto, agrupados por faixa de dias de atraso (aging)."
      >
        <PrintClient />
      </PageHeader>

      <FilterBar>
        <SelectFilter
          name="kind"
          label="Tipo"
          allLabel="A receber (clientes)"
          options={[{ value: 'PAYABLE', label: 'A pagar (fornecedores)' }]}
        />
      </FilterBar>

      {aging.count === 0 ? (
        <Card>
          <EmptyState
            title="Nenhum titulo vencido"
            description={
              kind === 'RECEIVABLE'
                ? 'Nao ha contas a receber em atraso. Otimo sinal para o caixa.'
                : 'Nao ha contas a pagar em atraso.'
            }
          />
        </Card>
      ) : (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <div className="card border-red-200 bg-red-50 p-4">
              <p className="text-xs uppercase tracking-wide text-red-700">Total em atraso</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-red-700">{formatCurrency(aging.total)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs uppercase tracking-wide text-ink-500">Titulos vencidos</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-ink-900">{aging.count}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs uppercase tracking-wide text-ink-500">
                {kind === 'RECEIVABLE' ? 'Clientes envolvidos' : 'Fornecedores envolvidos'}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-ink-900">{aging.contacts.length}</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Distribuicao por faixa de atraso">
              <AgingChart data={aging.buckets.map((bucket) => ({ label: bucket.label, amount: bucket.amount }))} />
              <ul className="mt-3 space-y-1.5 text-xs">
                {aging.buckets.map((bucket) => (
                  <li key={bucket.key} className="flex items-center justify-between">
                    <span className="text-ink-600">{bucket.label}</span>
                    <span className="tabular-nums text-ink-500">{bucket.count} titulo(s)</span>
                    <span className="w-28 text-right font-medium tabular-nums text-ink-900">
                      {formatCurrency(bucket.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card
              title={kind === 'RECEIVABLE' ? 'Clientes com maior atraso' : 'Fornecedores com maior atraso'}
              bodyClassName="p-0"
            >
              <div className="table-wrap">
                <table className="table min-w-0">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th className="num">Titulos</th>
                      <th className="num">Dias</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aging.contacts.slice(0, 12).map((contact) => (
                      <tr key={contact.id ?? contact.name}>
                        <td>
                          {contact.id ? (
                            <Link href={`/contatos/${contact.id}`} className="link">{contact.name}</Link>
                          ) : (
                            contact.name
                          )}
                          {contact.phone && (
                            <span className="block text-[11px] text-ink-500">{formatPhone(contact.phone)}</span>
                          )}
                        </td>
                        <td className="num">{contact.count}</td>
                        <td className="num">
                          <Pill tone={contact.oldestDays > 60 ? 'negative' : contact.oldestDays > 30 ? 'warning' : 'neutral'}>
                            {contact.oldestDays}d
                          </Pill>
                        </td>
                        <td className="num font-medium text-red-600">{formatCurrency(contact.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          <div className="mt-6">
            <Card title="Titulos vencidos" bodyClassName="p-0">
              <div className="table-wrap">
                <table className="table min-w-[820px]">
                  <thead>
                    <tr>
                      <th>Vencimento</th>
                      <th>Atraso</th>
                      <th>Descricao</th>
                      <th>{kind === 'RECEIVABLE' ? 'Cliente' : 'Fornecedor'}</th>
                      <th className="num">Valor</th>
                      <th className="num">Em aberto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aging.entries.slice(0, 100).map((entry) => {
                      const days = Math.floor((Date.now() - entry.dueDate.getTime()) / 86400000);
                      return (
                        <tr key={entry.id}>
                          <td className="whitespace-nowrap font-medium text-red-600">{formatDate(entry.dueDate)}</td>
                          <td>
                            <span className="inline-flex items-center gap-1 text-xs text-ink-600">
                              <AlertTriangle size={12} className="text-amber-500" />
                              {days} dia(s)
                            </span>
                          </td>
                          <td>
                            <Link href={`/financeiro/${slug}/${entry.id}`} className="link">{entry.description}</Link>
                          </td>
                          <td className="text-ink-600">{entry.contact?.name ?? '-'}</td>
                          <td className="num">{formatCurrency(entry.amount)}</td>
                          <td className="num font-medium">{formatCurrency(entry.amount - entry.paidAmount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
