import Link from 'next/link';
import { Plus, Users } from 'lucide-react';
import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { formatCurrency, formatDocument, formatPhone, onlyDigits } from '@/lib/utils';
import { CONTACT_KINDS } from '@/lib/constants';
import { Card, EmptyState, PageHeader, Pill } from '@/components/ui/primitives';
import { FilterBar, Pagination, SearchInput, SelectFilter } from '@/components/ui/filters';

export const metadata = { title: 'Clientes e fornecedores' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

export default async function ContactsPage({
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
  const kind = get('kind');
  const active = get('active');
  const page = Math.max(1, Number(get('page') ?? '1') || 1);

  const where = {
    companyId: ctx.company.id,
    ...(kind ? (kind === 'CUSTOMER' || kind === 'SUPPLIER'
      ? { kind: { in: [kind, 'BOTH'] } }
      : { kind }) : {}),
    ...(active === 'inactive' ? { isActive: false } : active === 'all' ? {} : { isActive: true }),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { tradeName: { contains: q } },
            { email: { contains: q } },
            { document: { contains: onlyDigits(q) || q } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      include: { _count: { select: { entries: true, orders: true } } },
      orderBy: { name: 'asc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.contact.count({ where }),
  ]);

  const kindLabel = (value: string) => CONTACT_KINDS.find((k) => k.value === value)?.label ?? value;

  return (
    <>
      <PageHeader
        title="Clientes e fornecedores"
        description="Cadastro unico de pessoas e empresas com quem voce compra e vende."
      >
        {ctx.can('catalog.write') && (
          <Link href="/contatos/novo" className="btn-primary">
            <Plus size={16} /> Novo contato
          </Link>
        )}
      </PageHeader>

      <FilterBar>
        <SearchInput placeholder="Buscar por nome, documento, e-mail ou telefone..." />
        <SelectFilter
          name="kind"
          label="Tipo"
          allLabel="Todos os tipos"
          options={CONTACT_KINDS.map((k) => ({ value: k.value, label: k.label }))}
        />
        <SelectFilter
          name="active"
          label="Situacao"
          allLabel="Somente ativos"
          options={[
            { value: 'inactive', label: 'Somente inativos' },
            { value: 'all', label: 'Ativos e inativos' },
          ]}
        />
      </FilterBar>

      <Card bodyClassName="p-0">
        {contacts.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Users size={28} />}
              title="Nenhum contato encontrado"
              description="Cadastre clientes e fornecedores para vincular aos lancamentos e pedidos."
              action={
                ctx.can('catalog.write') ? (
                  <Link href="/contatos/novo" className="btn-primary btn-sm">
                    <Plus size={14} /> Novo contato
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
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>CPF / CNPJ</th>
                  <th>Contato</th>
                  <th>Cidade</th>
                  <th className="num">Lancamentos</th>
                  <th className="num">Limite</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={contact.id} className={contact.isActive ? undefined : 'opacity-60'}>
                    <td>
                      <Link href={`/contatos/${contact.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                        {contact.name}
                      </Link>
                      {contact.tradeName && <span className="block text-xs text-ink-500">{contact.tradeName}</span>}
                      {!contact.isActive && <span className="mt-1 inline-block"><Pill>Inativo</Pill></span>}
                    </td>
                    <td><Pill tone={contact.kind === 'SUPPLIER' ? 'warning' : 'brand'}>{kindLabel(contact.kind)}</Pill></td>
                    <td className="tabular-nums text-ink-600">{formatDocument(contact.document) || '-'}</td>
                    <td className="text-xs text-ink-600">
                      {contact.email && <span className="block">{contact.email}</span>}
                      {contact.phone && <span className="block">{formatPhone(contact.phone)}</span>}
                      {!contact.email && !contact.phone && '-'}
                    </td>
                    <td className="text-ink-600">
                      {contact.city ? `${contact.city}${contact.state ? `/${contact.state}` : ''}` : '-'}
                    </td>
                    <td className="num">{contact._count.entries}</td>
                    <td className="num">{contact.creditLimit > 0 ? formatCurrency(contact.creditLimit) : '-'}</td>
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
