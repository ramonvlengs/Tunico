import Link from 'next/link';
import { Search } from 'lucide-react';
import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { displayStatus, startOfToday } from '@/server/finance';
import { formatCurrency, formatDate, formatDocument, onlyDigits } from '@/lib/utils';
import { Card, EmptyState, PageHeader, Pill, StatusBadge } from '@/components/ui/primitives';

export const metadata = { title: 'Busca' };
export const dynamic = 'force-dynamic';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await searchParams;
  const raw = Array.isArray(search.q) ? search.q[0] : search.q;
  const q = (raw ?? '').trim();

  const ctx = await requireContext();

  if (q.length < 2) {
    return (
      <>
        <PageHeader title="Busca" description="Encontre contatos, lancamentos, produtos e pedidos." />
        <Card>
          <EmptyState
            icon={<Search size={28} />}
            title="Digite ao menos 2 caracteres"
            description="Use a barra de busca no topo da tela para pesquisar em toda a empresa ativa."
          />
        </Card>
      </>
    );
  }

  const companyId = ctx.company.id;
  const digits = onlyDigits(q);
  const today = startOfToday();

  const [contacts, entries, products, orders] = await Promise.all([
    prisma.contact.findMany({
      where: {
        companyId,
        OR: [
          { name: { contains: q } },
          { tradeName: { contains: q } },
          { email: { contains: q } },
          ...(digits ? [{ document: { contains: digits } }, { phone: { contains: digits } }] : []),
        ],
      },
      take: 10,
      orderBy: { name: 'asc' },
    }),
    prisma.financialEntry.findMany({
      where: {
        companyId,
        OR: [
          { description: { contains: q } },
          { documentNumber: { contains: q } },
          { notes: { contains: q } },
        ],
      },
      include: { contact: { select: { name: true } } },
      take: 10,
      orderBy: { dueDate: 'desc' },
    }),
    prisma.product.findMany({
      where: {
        companyId,
        OR: [
          { name: { contains: q } },
          { sku: { contains: q } },
          { tcgSet: { contains: q } },
          { barcode: { contains: q } },
        ],
      },
      take: 10,
      orderBy: { name: 'asc' },
    }),
    prisma.order.findMany({
      where: {
        companyId,
        OR: [
          { notes: { contains: q } },
          { contact: { name: { contains: q } } },
          ...(Number(q) ? [{ number: Number(q) }] : []),
        ],
      },
      include: { contact: { select: { name: true } } },
      take: 10,
      orderBy: { issueDate: 'desc' },
    }),
  ]);

  const totalResults = contacts.length + entries.length + products.length + orders.length;

  return (
    <>
      <PageHeader
        title={`Resultados para "${q}"`}
        description={`${totalResults} resultado(s) em ${ctx.company.tradeName}.`}
      />

      {totalResults === 0 ? (
        <Card>
          <EmptyState
            icon={<Search size={28} />}
            title="Nada encontrado"
            description="Tente outro termo, ou verifique se o registro pertence a outra empresa do grupo."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {contacts.length > 0 && (
            <Card title={`Contatos (${contacts.length})`} bodyClassName="p-0">
              <ul className="divide-y divide-ink-100">
                {contacts.map((contact) => (
                  <li key={contact.id}>
                    <Link href={`/contatos/${contact.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-brand-50/40">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink-900">{contact.name}</span>
                        <span className="block truncate text-xs text-ink-500">
                          {formatDocument(contact.document) || contact.email || 'Sem documento'}
                        </span>
                      </span>
                      <Pill tone={contact.kind === 'SUPPLIER' ? 'warning' : 'brand'}>
                        {contact.kind === 'SUPPLIER' ? 'Fornecedor' : 'Cliente'}
                      </Pill>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {entries.length > 0 && (
            <Card title={`Lancamentos financeiros (${entries.length})`} bodyClassName="p-0">
              <ul className="divide-y divide-ink-100">
                {entries.map((entry) => (
                  <li key={entry.id}>
                    <Link
                      href={`/financeiro/${entry.kind === 'RECEIVABLE' ? 'receber' : 'pagar'}/${entry.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-brand-50/40"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink-900">{entry.description}</span>
                        <span className="block truncate text-xs text-ink-500">
                          Vence {formatDate(entry.dueDate)}
                          {entry.contact && ` · ${entry.contact.name}`}
                        </span>
                      </span>
                      <StatusBadge status={displayStatus(entry, today)} />
                      <span className="w-28 shrink-0 text-right font-medium tabular-nums text-ink-900">
                        {formatCurrency(entry.amount)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {products.length > 0 && (
            <Card title={`Produtos (${products.length})`} bodyClassName="p-0">
              <ul className="divide-y divide-ink-100">
                {products.map((product) => (
                  <li key={product.id}>
                    <Link href={`/produtos/${product.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-brand-50/40">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink-900">{product.name}</span>
                        <span className="block truncate text-xs text-ink-500">
                          {product.sku ?? 'Sem SKU'}
                          {product.tcgSet && ` · ${product.tcgSet}`}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-ink-500">
                        {product.trackStock ? `${product.stock} ${product.unit}` : 'Servico'}
                      </span>
                      <span className="w-24 shrink-0 text-right font-medium tabular-nums text-ink-900">
                        {formatCurrency(product.salePrice)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {orders.length > 0 && (
            <Card title={`Pedidos (${orders.length})`} bodyClassName="p-0">
              <ul className="divide-y divide-ink-100">
                {orders.map((order) => (
                  <li key={order.id}>
                    <Link
                      href={`/${order.type === 'SALE' ? 'vendas' : 'compras'}/${order.id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-brand-50/40"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink-900">
                          {order.type === 'SALE' ? 'Venda' : 'Compra'} #{String(order.number).padStart(4, '0')}
                        </span>
                        <span className="block truncate text-xs text-ink-500">
                          {formatDate(order.issueDate)}
                          {order.contact && ` · ${order.contact.name}`}
                        </span>
                      </span>
                      <StatusBadge status={order.status} />
                      <span className="w-28 shrink-0 text-right font-medium tabular-nums text-ink-900">
                        {formatCurrency(order.total)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
