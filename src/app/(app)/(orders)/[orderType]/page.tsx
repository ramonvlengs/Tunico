import Link from 'next/link';
import { Plus, ShoppingCart } from 'lucide-react';
import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { formatCurrency, formatDate, parseDateInput, round2 } from '@/lib/utils';
import { SALES_CHANNELS } from '@/lib/constants';
import { Card, EmptyState, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { DateRangeFilter, FilterBar, Pagination, SearchInput, SelectFilter } from '@/components/ui/filters';
import { resolveOrderType } from './order-type';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

type Props = {
  params: Promise<{ orderType: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
  const { orderType } = await params;
  return { title: resolveOrderType(orderType).title };
}

export default async function OrdersPage({ params, searchParams }: Props) {
  const { orderType } = await params;
  const config = resolveOrderType(orderType);
  const search = await searchParams;
  const get = (key: string) => {
    const value = search[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const ctx = await requireContext();
  const page = Math.max(1, Number(get('page') ?? '1') || 1);
  const from = parseDateInput(get('from'));
  const to = parseDateInput(get('to'));
  const status = get('status');
  const channel = get('channel');
  const q = get('q');

  const where = {
    companyId: ctx.company.id,
    type: config.type,
    ...(status ? { status } : {}),
    ...(channel ? { channel } : {}),
    ...(from || to
      ? { issueDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: new Date(to.getTime() + 86399999) } : {}) } }
      : {}),
    ...(q
      ? {
          OR: [
            { notes: { contains: q } },
            { contact: { name: { contains: q } } },
            ...(Number(q) ? [{ number: Number(q) }] : []),
          ],
        }
      : {}),
  };

  const [orders, total, aggregate] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        contact: { select: { id: true, name: true } },
        paymentMethod: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { issueDate: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.order.count({ where }),
    prisma.order.aggregate({ where, _sum: { total: true } }),
  ]);

  const sum = round2(aggregate._sum.total ?? 0);

  return (
    <>
      <PageHeader title={config.title} description={config.description}>
        {ctx.can('sales.write') && (
          <Link href={`/${config.slug}/novo`} className="btn-primary">
            <Plus size={16} /> {config.newLabel}
          </Link>
        )}
      </PageHeader>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-500">Pedidos filtrados</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-ink-900">{total}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-500">Valor total</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-brand-700">{formatCurrency(sum)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-500">Ticket medio</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-ink-900">
            {formatCurrency(total > 0 ? sum / total : 0)}
          </p>
        </div>
      </div>

      <FilterBar>
        <SearchInput placeholder="Buscar por numero, contato ou observacao..." />
        <SelectFilter
          name="status"
          label="Situacao"
          allLabel="Todas as situacoes"
          options={[
            { value: 'DRAFT', label: 'Rascunho' },
            { value: 'OPEN', label: 'Aberto' },
            { value: 'APPROVED', label: 'Aprovado' },
            { value: 'BILLED', label: 'Faturado' },
            { value: 'CANCELED', label: 'Cancelado' },
          ]}
        />
        {config.type === 'SALE' && (
          <SelectFilter
            name="channel"
            label="Canal"
            allLabel="Todos os canais"
            options={SALES_CHANNELS.map((c) => ({ value: c, label: c }))}
          />
        )}
        <DateRangeFilter />
      </FilterBar>

      <Card bodyClassName="p-0">
        {orders.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<ShoppingCart size={28} />}
              title={`Nenhum pedido de ${config.title.toLowerCase()} encontrado`}
              action={
                ctx.can('sales.write') ? (
                  <Link href={`/${config.slug}/novo`} className="btn-primary btn-sm">
                    <Plus size={14} /> {config.newLabel}
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[860px]">
              <thead>
                <tr>
                  <th>Numero</th>
                  <th>Data</th>
                  <th>{config.contactLabel}</th>
                  {config.type === 'SALE' && <th>Canal</th>}
                  <th>Pagamento</th>
                  <th>Situacao</th>
                  <th className="num">Itens</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className={order.status === 'CANCELED' ? 'opacity-55' : undefined}>
                    <td>
                      <Link href={`/${config.slug}/${order.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                        #{String(order.number).padStart(4, '0')}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap">{formatDate(order.issueDate)}</td>
                    <td className="text-ink-700">{order.contact?.name ?? 'Consumidor final'}</td>
                    {config.type === 'SALE' && <td className="text-xs text-ink-600">{order.channel ?? '-'}</td>}
                    <td className="text-xs text-ink-600">
                      {order.paymentMethod?.name ?? '-'}
                      {order.installments > 1 && ` (${order.installments}x)`}
                    </td>
                    <td><StatusBadge status={order.status} /></td>
                    <td className="num">{order._count.items}</td>
                    <td className="num font-medium">{formatCurrency(order.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-ink-100 px-4">
          <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} total={total} />
        </div>
      </Card>
    </>
  );
}
