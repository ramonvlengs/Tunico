import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { deleteProductAction } from '@/app/actions/registry';
import { formatCurrency, formatDate, formatPercent, round2 } from '@/lib/utils';
import { Card, EmptyState, PageHeader, Pill } from '@/components/ui/primitives';
import { StockAdjustForm } from '@/app/(app)/estoque/stock-adjust-form';

export const dynamic = 'force-dynamic';

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();

  const product = await prisma.product.findFirst({
    where: { id, companyId: ctx.company.id },
    include: {
      movements: {
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      },
    },
  });
  if (!product) notFound();

  const soldItems = await prisma.orderItem.findMany({
    where: { productId: id, order: { type: 'SALE', status: { in: ['APPROVED', 'BILLED'] } } },
    select: { quantity: true, total: true },
  });
  const soldQuantity = round2(soldItems.reduce((sum, item) => sum + item.quantity, 0));
  const soldTotal = round2(soldItems.reduce((sum, item) => sum + item.total, 0));
  const margin = product.salePrice > 0 ? ((product.salePrice - product.costPrice) / product.salePrice) * 100 : 0;

  return (
    <>
      <div className="mb-4 no-print">
        <Link href="/produtos" className="btn-ghost btn-sm -ml-2">
          <ArrowLeft size={14} /> Voltar para produtos
        </Link>
      </div>

      <PageHeader
        title={product.name}
        description={[product.sku, product.group, product.tcgGame].filter(Boolean).join(' · ')}
      >
        {ctx.can('catalog.write') && (
          <>
            <Link href={`/produtos/${product.id}/editar`} className="btn-secondary">
              <Pencil size={16} /> Editar
            </Link>
            <form action={deleteProductAction}>
              <input type="hidden" name="id" value={product.id} />
              <button type="submit" className="btn-danger"><Trash2 size={16} /> Excluir</button>
            </form>
          </>
        )}
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-500">Estoque atual</p>
          <p className={`mt-1 text-xl font-semibold tabular-nums ${product.stock <= product.minStock ? 'text-amber-600' : 'text-ink-900'}`}>
            {product.trackStock ? `${product.stock} ${product.unit}` : 'Nao controla'}
          </p>
          {product.trackStock && product.minStock > 0 && (
            <p className="mt-0.5 text-xs text-ink-500">Minimo: {product.minStock}</p>
          )}
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-500">Custo / venda</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-ink-900">
            {formatCurrency(product.salePrice)}
          </p>
          <p className="mt-0.5 text-xs text-ink-500">
            Custo {formatCurrency(product.costPrice)} · margem {formatPercent(margin)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-500">Unidades vendidas</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-ink-900">{soldQuantity}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-500">Receita gerada</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-600">{formatCurrency(soldTotal)}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Movimentacoes de estoque" bodyClassName={product.movements.length ? 'p-0' : 'p-5'}>
            {product.movements.length === 0 ? (
              <EmptyState title="Nenhuma movimentacao registrada" />
            ) : (
              <div className="table-wrap">
                <table className="table min-w-[680px]">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Tipo</th>
                      <th>Motivo</th>
                      <th>Usuario</th>
                      <th className="num">Quantidade</th>
                      <th className="num">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.movements.map((movement) => (
                      <tr key={movement.id}>
                        <td className="whitespace-nowrap">{formatDate(movement.createdAt)}</td>
                        <td>
                          <Pill tone={movement.type === 'IN' ? 'positive' : movement.type === 'OUT' ? 'negative' : 'neutral'}>
                            {movement.type === 'IN' ? 'Entrada' : movement.type === 'OUT' ? 'Saida' : 'Ajuste'}
                          </Pill>
                        </td>
                        <td className="text-xs text-ink-600">{movement.reason ?? '-'}</td>
                        <td className="text-xs text-ink-600">{movement.user?.name ?? 'Sistema'}</td>
                        <td className="num tabular-nums">
                          {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                        </td>
                        <td className="num font-medium tabular-nums">{movement.balance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {ctx.can('stock.write') && product.trackStock && (
            <Card title="Movimentar estoque">
              <StockAdjustForm
                products={[{ id: product.id, name: product.name, stock: product.stock, unit: product.unit, costPrice: product.costPrice }]}
                fixedProductId={product.id}
              />
            </Card>
          )}

          {(product.tcgGame || product.description) && (
            <Card title="Detalhes">
              <dl className="space-y-3 text-sm">
                {product.description && (
                  <div>
                    <dt className="text-xs text-ink-500">Descricao</dt>
                    <dd className="whitespace-pre-line text-ink-800">{product.description}</dd>
                  </div>
                )}
                {product.tcgGame && (
                  <div>
                    <dt className="text-xs text-ink-500">Jogo</dt>
                    <dd className="text-ink-900">{product.tcgGame}</dd>
                  </div>
                )}
                {product.tcgSet && (
                  <div>
                    <dt className="text-xs text-ink-500">Colecao</dt>
                    <dd className="text-ink-900">{product.tcgSet} {product.tcgNumber && `· ${product.tcgNumber}`}</dd>
                  </div>
                )}
                {product.tcgRarity && (
                  <div>
                    <dt className="text-xs text-ink-500">Raridade</dt>
                    <dd className="text-ink-900">{product.tcgRarity}</dd>
                  </div>
                )}
                {product.tcgCondition && (
                  <div>
                    <dt className="text-xs text-ink-500">Conservacao</dt>
                    <dd className="text-ink-900">{product.tcgCondition}{product.tcgFoil && ' · Foil'}</dd>
                  </div>
                )}
                {product.barcode && (
                  <div>
                    <dt className="text-xs text-ink-500">Codigo de barras</dt>
                    <dd className="tabular-nums text-ink-900">{product.barcode}</dd>
                  </div>
                )}
              </dl>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
