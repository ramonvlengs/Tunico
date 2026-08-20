import Link from 'next/link';
import { Package, Plus, AlertTriangle } from 'lucide-react';
import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { formatCurrency, formatPercent, round2 } from '@/lib/utils';
import { PRODUCT_GROUPS, TCG_GAMES } from '@/lib/constants';
import { Card, EmptyState, PageHeader, Pill } from '@/components/ui/primitives';
import { FilterBar, Pagination, SearchInput, SelectFilter } from '@/components/ui/filters';

export const metadata = { title: 'Produtos' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

export default async function ProductsPage({
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
  const q = get('q');
  const group = get('group');
  const game = get('game');
  const stock = get('stock');
  const page = Math.max(1, Number(get('page') ?? '1') || 1);

  const where = {
    companyId: ctx.company.id,
    isActive: true,
    ...(group ? { group } : {}),
    ...(game ? { tcgGame: game } : {}),
    ...(stock === 'zero' ? { stock: { lte: 0 }, trackStock: true } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { sku: { contains: q } },
            { tcgSet: { contains: q } },
            { barcode: { contains: q } },
          ],
        }
      : {}),
  };

  const [products, total, aggregate, lowStock] = await Promise.all([
    prisma.product.findMany({ where, orderBy: { name: 'asc' }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.product.count({ where }),
    prisma.product.findMany({
      where: { companyId: ctx.company.id, isActive: true, trackStock: true },
      select: { stock: true, costPrice: true, salePrice: true },
    }),
    prisma.product.count({
      where: { companyId: ctx.company.id, isActive: true, trackStock: true, stock: { lte: 0 } },
    }),
  ]);

  const stockCost = round2(aggregate.reduce((sum, p) => sum + p.stock * p.costPrice, 0));
  const stockValue = round2(aggregate.reduce((sum, p) => sum + p.stock * p.salePrice, 0));
  const units = round2(aggregate.reduce((sum, p) => sum + p.stock, 0));

  return (
    <>
      <PageHeader
        title="Produtos"
        description="Catalogo da loja: singles, produtos lacrados, acessorios e servicos."
      >
        <Link href="/estoque" className="btn-secondary">Movimentar estoque</Link>
        {ctx.can('catalog.write') && (
          <Link href="/produtos/novo" className="btn-primary">
            <Plus size={16} /> Novo produto
          </Link>
        )}
      </PageHeader>

      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-500">Itens em estoque</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-ink-900">{units}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-500">Custo do estoque</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-ink-900">{formatCurrency(stockCost)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-500">Valor de venda</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-600">{formatCurrency(stockValue)}</p>
        </div>
        <Link href="/produtos?stock=zero" className="card p-4 transition hover:border-amber-300">
          <p className="text-xs uppercase tracking-wide text-ink-500">Sem estoque</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-amber-600">{lowStock}</p>
        </Link>
      </div>

      <FilterBar>
        <SearchInput placeholder="Buscar por nome, SKU, colecao ou codigo de barras..." />
        <SelectFilter
          name="group"
          label="Grupo"
          allLabel="Todos os grupos"
          options={PRODUCT_GROUPS.map((g) => ({ value: g, label: g }))}
        />
        <SelectFilter
          name="game"
          label="Jogo"
          allLabel="Todos os jogos"
          options={TCG_GAMES.map((g) => ({ value: g, label: g }))}
        />
        <SelectFilter
          name="stock"
          label="Estoque"
          allLabel="Qualquer estoque"
          options={[{ value: 'zero', label: 'Somente zerados' }]}
        />
      </FilterBar>

      <Card bodyClassName="p-0">
        {products.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Package size={28} />}
              title="Nenhum produto encontrado"
              action={
                ctx.can('catalog.write') ? (
                  <Link href="/produtos/novo" className="btn-primary btn-sm"><Plus size={14} /> Novo produto</Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[900px]">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Grupo</th>
                  <th>Jogo / colecao</th>
                  <th className="num">Estoque</th>
                  <th className="num">Custo</th>
                  <th className="num">Venda</th>
                  <th className="num">Margem</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const margin = product.salePrice > 0
                    ? ((product.salePrice - product.costPrice) / product.salePrice) * 100
                    : 0;
                  const low = product.trackStock && product.stock <= product.minStock;
                  return (
                    <tr key={product.id}>
                      <td>
                        <Link href={`/produtos/${product.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                          {product.name}
                        </Link>
                        <span className="block text-xs text-ink-500">
                          {product.sku ?? 'Sem SKU'}
                          {product.tcgCondition && ` · ${product.tcgCondition}`}
                          {product.tcgFoil && ' · Foil'}
                        </span>
                      </td>
                      <td className="text-ink-600">{product.group ?? '-'}</td>
                      <td className="text-xs text-ink-600">
                        {product.tcgGame ?? '-'}
                        {product.tcgSet && <span className="block text-ink-400">{product.tcgSet}</span>}
                      </td>
                      <td className="num">
                        {product.trackStock ? (
                          <span className={low ? 'font-medium text-amber-600' : undefined}>
                            {low && <AlertTriangle size={12} className="mr-1 inline" />}
                            {product.stock} {product.unit}
                          </span>
                        ) : (
                          <span className="text-xs text-ink-400">Nao controla</span>
                        )}
                      </td>
                      <td className="num text-ink-600">{formatCurrency(product.costPrice)}</td>
                      <td className="num font-medium">{formatCurrency(product.salePrice)}</td>
                      <td className="num">
                        <span className={margin >= 30 ? 'text-emerald-600' : margin >= 15 ? 'text-amber-600' : 'text-red-600'}>
                          {formatPercent(margin)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
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
