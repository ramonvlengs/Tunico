import Link from 'next/link';
import { Plus, Download, Repeat } from 'lucide-react';
import { requireContext } from '@/lib/tenant';
import { getFormOptions, queryEntries, type EntryFilters } from '@/server/entry-query';
import { displayStatus, startOfToday } from '@/server/finance';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { DateRangeFilter, FilterBar, Pagination, SearchInput, SelectFilter } from '@/components/ui/filters';
import { resolveKind } from './kind';
import { BulkSettleBar } from './bulk-settle';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ kind: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
  const { kind } = await params;
  return { title: resolveKind(kind).title };
}

export default async function EntriesPage({ params, searchParams }: Props) {
  const { kind: slug } = await params;
  const config = resolveKind(slug);
  const search = await searchParams;
  const filters: EntryFilters = Object.fromEntries(
    Object.entries(search).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );

  const ctx = await requireContext();
  const today = startOfToday();

  const [{ entries, total, page, pageCount, totals }, options] = await Promise.all([
    queryEntries(ctx.company.id, config.kind, filters),
    getFormOptions(ctx.company.id),
  ]);

  const categoryOptions = options.categories
    .filter((category) => category.type === config.categoryType)
    .map((category) => ({ value: category.id, label: category.code ? `${category.code} ${category.name}` : category.name }));

  const contactOptions = options.contacts
    .filter((contact) => config.contactKinds.includes(contact.kind))
    .map((contact) => ({ value: contact.id, label: contact.name }));

  const exportHref = `/api/export/entries?kind=${config.kind}&${new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v) as [string, string][],
  ).toString()}`;

  return (
    <>
      <PageHeader title={config.title} description={config.description}>
        <Link href="/financeiro/recorrencias" className="btn-secondary">
          <Repeat size={16} /> Recorrencias
        </Link>
        <a href={exportHref} className="btn-secondary">
          <Download size={16} /> Exportar CSV
        </a>
        {ctx.can('finance.write') && (
          <Link href={`/financeiro/${config.slug}/novo`} className="btn-primary">
            <Plus size={16} /> {config.newLabel}
          </Link>
        )}
      </PageHeader>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Total filtrado</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-ink-900">{formatCurrency(totals.amount)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
            {config.positive ? 'Ja recebido' : 'Ja pago'}
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-600">{formatCurrency(totals.paid)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Em aberto</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-amber-600">{formatCurrency(totals.open)}</p>
        </div>
      </div>

      <FilterBar>
        <SearchInput placeholder="Buscar por descricao, documento ou contato..." />
        <SelectFilter
          name="status"
          label="Situacao"
          allLabel="Todas as situacoes"
          options={[
            { value: 'PENDING', label: 'Em aberto (todos)' },
            { value: 'OVERDUE', label: 'Vencidos' },
            { value: 'OPEN_TODAY', label: 'Vencem hoje' },
            { value: 'PARTIAL', label: 'Parcialmente baixados' },
            { value: 'PAID', label: 'Liquidados' },
            { value: 'CANCELED', label: 'Cancelados' },
          ]}
        />
        <SelectFilter name="categoryId" label="Categoria" allLabel="Todas as categorias" options={categoryOptions} />
        <SelectFilter name="contactId" label={config.contactLabel} allLabel={`Todos os ${config.contactLabel.toLowerCase()}s`} options={contactOptions} />
        <SelectFilter
          name="costCenterId"
          label="Centro de custo"
          allLabel="Todos os centros de custo"
          options={options.costCenters.map((c) => ({ value: c.id, label: c.name }))}
        />
        <SelectFilter
          name="dateField"
          label="Filtrar data por"
          allLabel="Por vencimento"
          options={[
            { value: 'issueDate', label: 'Por emissao' },
            { value: 'competenceDate', label: 'Por competencia' },
          ]}
        />
        <DateRangeFilter />
      </FilterBar>

      <Card bodyClassName="p-0">
        {entries.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Nenhum lancamento encontrado"
              description="Ajuste os filtros ou cadastre um novo lancamento."
              action={
                ctx.can('finance.write') ? (
                  <Link href={`/financeiro/${config.slug}/novo`} className="btn-primary btn-sm">
                    <Plus size={14} /> {config.newLabel}
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <form>
            <div className="table-wrap">
              <table className="table min-w-[900px]">
                <thead>
                  <tr>
                    {ctx.can('finance.settle') && <th className="w-10" aria-label="Selecionar" />}
                    <th>Vencimento</th>
                    <th>Descricao</th>
                    <th>{config.contactLabel}</th>
                    <th>Categoria</th>
                    <th>Situacao</th>
                    <th className="num">Valor</th>
                    <th className="num">Em aberto</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => {
                    const status = displayStatus(entry, today);
                    const open = entry.amount - entry.paidAmount;
                    return (
                      <tr key={entry.id} className={cn(status === 'CANCELED' && 'opacity-55')}>
                        {ctx.can('finance.settle') && (
                          <td>
                            {(entry.status === 'OPEN' || entry.status === 'PARTIAL') && (
                              <input
                                type="checkbox"
                                name="ids"
                                value={entry.id}
                                aria-label={`Selecionar ${entry.description}`}
                                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                              />
                            )}
                          </td>
                        )}
                        <td className={cn('whitespace-nowrap', status === 'OVERDUE' && 'font-medium text-red-600')}>
                          {formatDate(entry.dueDate)}
                        </td>
                        <td>
                          <Link
                            href={`/financeiro/${config.slug}/${entry.id}`}
                            className="font-medium text-ink-900 hover:text-brand-700"
                          >
                            {entry.description}
                          </Link>
                          {entry.documentNumber && (
                            <span className="block text-xs text-ink-500">Doc. {entry.documentNumber}</span>
                          )}
                        </td>
                        <td className="text-ink-600">{entry.contact?.name ?? '-'}</td>
                        <td>
                          {entry.category ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-ink-600">
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ background: entry.category.color ?? '#94a3b8' }}
                              />
                              {entry.category.name}
                            </span>
                          ) : (
                            <span className="text-xs text-ink-400">Sem categoria</span>
                          )}
                        </td>
                        <td>
                          <StatusBadge status={status} />
                        </td>
                        <td className="num tabular-nums">{formatCurrency(entry.amount)}</td>
                        <td className="num font-medium tabular-nums">
                          {open > 0 ? formatCurrency(open) : <span className="text-emerald-600">Quitado</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {ctx.can('finance.settle') && (
              <BulkSettleBar
                accounts={options.bankAccounts}
                label={config.settleLabel}
              />
            )}
          </form>
        )}

        <div className="border-t border-ink-100 px-4">
          <Pagination page={page} pageCount={pageCount} total={total} />
        </div>
      </Card>
    </>
  );
}
