import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Ban, FileCheck2, Pencil, Trash2 } from 'lucide-react';
import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { billOrderAction, cancelOrderAction, deleteOrderAction } from '@/app/actions/orders';
import { displayStatus, startOfToday } from '@/server/finance';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Alert, Card, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { PrintClient } from '@/components/ui/print-button';
import { resolveOrderType } from '../order-type';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ orderType: string; id: string }> };

export default async function OrderDetailPage({ params }: Props) {
  const { orderType, id } = await params;
  const config = resolveOrderType(orderType);
  const ctx = await requireContext();

  const order = await prisma.order.findFirst({
    where: { id, companyId: ctx.company.id, type: config.type },
    include: {
      contact: true,
      paymentMethod: { select: { name: true } },
      items: { include: { product: { select: { id: true, name: true, unit: true } } } },
      entries: { include: { settlements: { select: { id: true } } }, orderBy: { installment: 'asc' } },
    },
  });
  if (!order) notFound();

  const today = startOfToday();
  const hasSettlements = order.entries.some((entry) => entry.settlements.length > 0);
  const canEdit = ctx.can('sales.write') && order.status !== 'CANCELED' && !hasSettlements;

  return (
    <>
      <div className="mb-4 no-print">
        <Link href={`/${config.slug}`} className="btn-ghost btn-sm -ml-2">
          <ArrowLeft size={14} /> Voltar para {config.title.toLowerCase()}
        </Link>
      </div>

      <PageHeader
        title={`${config.singular} #${String(order.number).padStart(4, '0')}`}
        description={`${formatDate(order.issueDate)} · ${order.contact?.name ?? 'Consumidor final'}${order.channel ? ` · ${order.channel}` : ''}`}
      >
        <PrintClient />
        {canEdit && (
          <>
            <Link href={`/${config.slug}/${order.id}/editar`} className="btn-secondary">
              <Pencil size={16} /> Editar
            </Link>
            {order.status !== 'BILLED' && (
              <form action={billOrderAction}>
                <input type="hidden" name="id" value={order.id} />
                <button type="submit" className="btn-primary"><FileCheck2 size={16} /> Faturar</button>
              </form>
            )}
            <form action={cancelOrderAction}>
              <input type="hidden" name="id" value={order.id} />
              <button type="submit" className="btn-secondary text-red-600"><Ban size={16} /> Cancelar</button>
            </form>
            <form action={deleteOrderAction}>
              <input type="hidden" name="id" value={order.id} />
              <button type="submit" className="btn-danger"><Trash2 size={16} /> Excluir</button>
            </form>
          </>
        )}
      </PageHeader>

      {hasSettlements && (
        <div className="mb-5">
          <Alert tone="info" title="Pedido com baixas registradas">
            Ha titulos deste pedido ja liquidados. Para alterar ou cancelar, estorne as baixas primeiro no financeiro.
          </Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Itens" bodyClassName="p-0">
            <div className="table-wrap">
              <table className="table min-w-[640px]">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="num">Qtde</th>
                    <th className="num">Preco unit.</th>
                    <th className="num">Desconto</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.product ? (
                          <Link href={`/produtos/${item.product.id}`} className="link">{item.description}</Link>
                        ) : (
                          item.description
                        )}
                      </td>
                      <td className="num">{item.quantity} {item.product?.unit ?? ''}</td>
                      <td className="num">{formatCurrency(item.unitPrice)}</td>
                      <td className="num text-red-600">{item.discount ? `-${formatCurrency(item.discount)}` : '-'}</td>
                      <td className="num font-medium">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {order.entries.length > 0 && (
            <Card title="Financeiro gerado" bodyClassName="p-0">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Parcela</th>
                      <th>Vencimento</th>
                      <th>Situacao</th>
                      <th className="num">Valor</th>
                      <th className="num">Em aberto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.entries.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <Link href={`/financeiro/${config.entrySlug}/${entry.id}`} className="link">
                            {entry.installment}/{entry.installments}
                          </Link>
                        </td>
                        <td>{formatDate(entry.dueDate)}</td>
                        <td><StatusBadge status={displayStatus(entry, today)} /></td>
                        <td className="num">{formatCurrency(entry.amount)}</td>
                        <td className="num">{formatCurrency(entry.amount - entry.paidAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Resumo">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-600">Situacao</dt>
                <dd><StatusBadge status={order.status} /></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-600">Subtotal</dt>
                <dd className="tabular-nums">{formatCurrency(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-600">Desconto</dt>
                <dd className="tabular-nums text-red-600">-{formatCurrency(order.discount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-600">Frete</dt>
                <dd className="tabular-nums">{formatCurrency(order.shipping)}</dd>
              </div>
              <div className="flex justify-between border-t border-ink-200 pt-2">
                <dt className="font-semibold text-ink-900">Total</dt>
                <dd className="text-lg font-semibold tabular-nums text-brand-700">{formatCurrency(order.total)}</dd>
              </div>
              <div className="flex justify-between border-t border-ink-200 pt-2">
                <dt className="text-ink-600">Pagamento</dt>
                <dd className="text-right text-ink-900">
                  {order.paymentMethod?.name ?? '-'}
                  {order.installments > 1 && <span className="block text-xs text-ink-500">{order.installments}x</span>}
                </dd>
              </div>
            </dl>
          </Card>

          {order.contact && (
            <Card title={config.contactLabel}>
              <Link href={`/contatos/${order.contact.id}`} className="link font-medium">
                {order.contact.name}
              </Link>
              {order.contact.email && <p className="mt-1 text-xs text-ink-500">{order.contact.email}</p>}
              {order.contact.phone && <p className="text-xs text-ink-500">{order.contact.phone}</p>}
            </Card>
          )}

          {order.notes && (
            <Card title="Observacoes">
              <p className="whitespace-pre-line text-sm text-ink-800">{order.notes}</p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
