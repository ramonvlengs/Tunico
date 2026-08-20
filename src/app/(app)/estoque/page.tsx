import Link from 'next/link';
import { AlertTriangle, Boxes, Package } from 'lucide-react';
import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { formatCurrency, formatDateTime, round2 } from '@/lib/utils';
import { Card, EmptyState, PageHeader, Pill } from '@/components/ui/primitives';
import { StockAdjustForm } from './stock-adjust-form';

export const metadata = { title: 'Estoque' };
export const dynamic = 'force-dynamic';

export default async function StockPage() {
  const ctx = await requireContext();
  const companyId = ctx.company.id;

  const [products, movements] = await Promise.all([
    prisma.product.findMany({
      where: { companyId, isActive: true, trackStock: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, sku: true, stock: true, minStock: true, unit: true, costPrice: true, salePrice: true, group: true },
    }),
    prisma.stockMovement.findMany({
      where: { companyId },
      include: { product: { select: { id: true, name: true, unit: true } }, user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 40,
    }),
  ]);

  const lowStock = products.filter((product) => product.stock <= product.minStock);
  const totalCost = round2(products.reduce((sum, p) => sum + p.stock * p.costPrice, 0));
  const totalValue = round2(products.reduce((sum, p) => sum + p.stock * p.salePrice, 0));

  return (
    <>
      <PageHeader
        title="Estoque"
        description="Saldo por produto, alertas de reposicao e historico de movimentacoes."
      >
        <Link href="/produtos" className="btn-secondary"><Package size={16} /> Ver catalogo</Link>
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-500">Produtos controlados</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-ink-900">{products.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-500">Custo total</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-ink-900">{formatCurrency(totalCost)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-500">Valor a preco de venda</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-600">{formatCurrency(totalValue)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-500">Precisam de reposicao</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-amber-600">{lowStock.length}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {lowStock.length > 0 && (
            <Card
              title="Reposicao necessaria"
              description="Produtos no estoque minimo ou abaixo dele."
              bodyClassName="p-0"
            >
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Grupo</th>
                      <th className="num">Estoque</th>
                      <th className="num">Minimo</th>
                      <th className="num">Repor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStock.slice(0, 15).map((product) => (
                      <tr key={product.id}>
                        <td>
                          <Link href={`/produtos/${product.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                            {product.name}
                          </Link>
                          <span className="block text-xs text-ink-500">{product.sku ?? 'Sem SKU'}</span>
                        </td>
                        <td className="text-ink-600">{product.group ?? '-'}</td>
                        <td className="num font-medium text-amber-600">
                          <AlertTriangle size={12} className="mr-1 inline" />
                          {product.stock}
                        </td>
                        <td className="num text-ink-600">{product.minStock}</td>
                        <td className="num">{Math.max(0, round2(product.minStock - product.stock + 1))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card title="Historico de movimentacoes" bodyClassName={movements.length ? 'p-0' : 'p-5'}>
            {movements.length === 0 ? (
              <EmptyState icon={<Boxes size={26} />} title="Nenhuma movimentacao registrada" />
            ) : (
              <div className="table-wrap">
                <table className="table min-w-[760px]">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Produto</th>
                      <th>Tipo</th>
                      <th>Motivo</th>
                      <th className="num">Quantidade</th>
                      <th className="num">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((movement) => (
                      <tr key={movement.id}>
                        <td className="whitespace-nowrap text-xs">{formatDateTime(movement.createdAt)}</td>
                        <td>
                          <Link href={`/produtos/${movement.product.id}`} className="link">
                            {movement.product.name}
                          </Link>
                        </td>
                        <td>
                          <Pill tone={movement.type === 'IN' ? 'positive' : movement.type === 'OUT' ? 'negative' : 'neutral'}>
                            {movement.type === 'IN' ? 'Entrada' : movement.type === 'OUT' ? 'Saida' : 'Ajuste'}
                          </Pill>
                        </td>
                        <td className="text-xs text-ink-600">{movement.reason ?? '-'}</td>
                        <td className="num tabular-nums">
                          {movement.quantity > 0 ? '+' : ''}{movement.quantity} {movement.product.unit}
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

        <div>
          {ctx.can('stock.write') && products.length > 0 && (
            <Card title="Nova movimentacao">
              <StockAdjustForm products={products} />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
