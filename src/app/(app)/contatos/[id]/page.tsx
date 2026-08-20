import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Mail, Pencil, Phone, MapPin, Power, Trash2 } from 'lucide-react';
import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { deleteContactAction, toggleContactAction } from '@/app/actions/registry';
import { displayStatus, startOfToday } from '@/server/finance';
import { formatCurrency, formatDate, formatDocument, formatPhone, round2 } from '@/lib/utils';
import { CONTACT_KINDS } from '@/lib/constants';
import { Card, EmptyState, PageHeader, Pill, StatusBadge } from '@/components/ui/primitives';

export const dynamic = 'force-dynamic';

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();

  const contact = await prisma.contact.findFirst({
    where: { id, companyId: ctx.company.id },
    include: {
      entries: {
        include: { category: { select: { name: true } } },
        orderBy: { dueDate: 'desc' },
        take: 25,
      },
      orders: { orderBy: { issueDate: 'desc' }, take: 10 },
    },
  });
  if (!contact) notFound();

  const [receivable, payable] = await Promise.all([
    prisma.financialEntry.findMany({
      where: { contactId: id, companyId: ctx.company.id, kind: 'RECEIVABLE', status: { in: ['OPEN', 'PARTIAL'] } },
      select: { amount: true, paidAmount: true },
    }),
    prisma.financialEntry.findMany({
      where: { contactId: id, companyId: ctx.company.id, kind: 'PAYABLE', status: { in: ['OPEN', 'PARTIAL'] } },
      select: { amount: true, paidAmount: true },
    }),
  ]);

  const openReceivable = round2(receivable.reduce((sum, e) => sum + e.amount - e.paidAmount, 0));
  const openPayable = round2(payable.reduce((sum, e) => sum + e.amount - e.paidAmount, 0));
  const totalPurchased = round2(contact.orders.filter((o) => o.type === 'SALE').reduce((s, o) => s + o.total, 0));
  const today = startOfToday();
  const kindLabel = CONTACT_KINDS.find((k) => k.value === contact.kind)?.label ?? contact.kind;

  return (
    <>
      <div className="mb-4 no-print">
        <Link href="/contatos" className="btn-ghost btn-sm -ml-2">
          <ArrowLeft size={14} /> Voltar para contatos
        </Link>
      </div>

      <PageHeader title={contact.name} description={`${kindLabel}${contact.tradeName ? ` · ${contact.tradeName}` : ''}`}>
        {ctx.can('catalog.write') && (
          <>
            <Link href={`/contatos/${contact.id}/editar`} className="btn-secondary">
              <Pencil size={16} /> Editar
            </Link>
            <form action={toggleContactAction}>
              <input type="hidden" name="id" value={contact.id} />
              <button type="submit" className="btn-secondary">
                <Power size={16} /> {contact.isActive ? 'Inativar' : 'Reativar'}
              </button>
            </form>
            <form action={deleteContactAction}>
              <input type="hidden" name="id" value={contact.id} />
              <button type="submit" className="btn-danger">
                <Trash2 size={16} /> Excluir
              </button>
            </form>
          </>
        )}
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-500">A receber em aberto</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-600">{formatCurrency(openReceivable)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-500">A pagar em aberto</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-red-600">{formatCurrency(openPayable)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-500">Limite de credito</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-ink-900">
            {contact.creditLimit > 0 ? formatCurrency(contact.creditLimit) : 'Nao definido'}
          </p>
          {contact.creditLimit > 0 && openReceivable > contact.creditLimit && (
            <p className="mt-1 text-xs font-medium text-red-600">Limite excedido em {formatCurrency(openReceivable - contact.creditLimit)}</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Lancamentos financeiros" bodyClassName={contact.entries.length ? 'p-0' : 'p-5'}>
            {contact.entries.length === 0 ? (
              <EmptyState title="Nenhum lancamento vinculado a este contato" />
            ) : (
              <div className="table-wrap">
                <table className="table min-w-[720px]">
                  <thead>
                    <tr>
                      <th>Vencimento</th>
                      <th>Descricao</th>
                      <th>Tipo</th>
                      <th>Situacao</th>
                      <th className="num">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contact.entries.map((entry) => (
                      <tr key={entry.id}>
                        <td className="whitespace-nowrap">{formatDate(entry.dueDate)}</td>
                        <td>
                          <Link
                            href={`/financeiro/${entry.kind === 'RECEIVABLE' ? 'receber' : 'pagar'}/${entry.id}`}
                            className="link"
                          >
                            {entry.description}
                          </Link>
                          {entry.category && <span className="block text-xs text-ink-500">{entry.category.name}</span>}
                        </td>
                        <td>
                          <Pill tone={entry.kind === 'RECEIVABLE' ? 'positive' : 'negative'}>
                            {entry.kind === 'RECEIVABLE' ? 'Receber' : 'Pagar'}
                          </Pill>
                        </td>
                        <td><StatusBadge status={displayStatus(entry, today)} /></td>
                        <td className="num">{formatCurrency(entry.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {contact.orders.length > 0 && (
            <Card title="Ultimos pedidos" bodyClassName="p-0">
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Numero</th>
                      <th>Data</th>
                      <th>Tipo</th>
                      <th>Situacao</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contact.orders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <Link href={`/${order.type === 'SALE' ? 'vendas' : 'compras'}/${order.id}`} className="link">
                            #{order.number}
                          </Link>
                        </td>
                        <td>{formatDate(order.issueDate)}</td>
                        <td>{order.type === 'SALE' ? 'Venda' : 'Compra'}</td>
                        <td><StatusBadge status={order.status} /></td>
                        <td className="num">{formatCurrency(order.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Dados cadastrais">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-ink-500">{contact.personType === 'PJ' ? 'CNPJ' : 'CPF'}</dt>
                <dd className="tabular-nums text-ink-900">{formatDocument(contact.document) || '-'}</dd>
              </div>
              {contact.stateReg && (
                <div>
                  <dt className="text-xs text-ink-500">Inscricao estadual</dt>
                  <dd className="text-ink-900">{contact.stateReg}</dd>
                </div>
              )}
              {contact.email && (
                <div>
                  <dt className="text-xs text-ink-500">E-mail</dt>
                  <dd>
                    <a href={`mailto:${contact.email}`} className="link inline-flex items-center gap-1.5">
                      <Mail size={13} /> {contact.email}
                    </a>
                  </dd>
                </div>
              )}
              {contact.phone && (
                <div>
                  <dt className="text-xs text-ink-500">Telefone</dt>
                  <dd>
                    <a href={`tel:${contact.phone}`} className="link inline-flex items-center gap-1.5">
                      <Phone size={13} /> {formatPhone(contact.phone)}
                    </a>
                  </dd>
                </div>
              )}
              {contact.whatsapp && (
                <div>
                  <dt className="text-xs text-ink-500">WhatsApp</dt>
                  <dd className="text-ink-900">{formatPhone(contact.whatsapp)}</dd>
                </div>
              )}
              {(contact.street || contact.city) && (
                <div>
                  <dt className="text-xs text-ink-500">Endereco</dt>
                  <dd className="flex gap-1.5 text-ink-900">
                    <MapPin size={13} className="mt-0.5 shrink-0 text-ink-400" />
                    <span>
                      {[contact.street, contact.number].filter(Boolean).join(', ')}
                      {contact.complement && ` - ${contact.complement}`}
                      {contact.district && <span className="block">{contact.district}</span>}
                      {(contact.city || contact.zipCode) && (
                        <span className="block">
                          {contact.city}
                          {contact.state && `/${contact.state}`}
                          {contact.zipCode && ` - ${contact.zipCode}`}
                        </span>
                      )}
                    </span>
                  </dd>
                </div>
              )}
              {contact.notes && (
                <div>
                  <dt className="text-xs text-ink-500">Observacoes</dt>
                  <dd className="whitespace-pre-line text-ink-800">{contact.notes}</dd>
                </div>
              )}
            </dl>
          </Card>

          {ctx.can('finance.write') && (
            <Card title="Acoes rapidas">
              <div className="flex flex-col gap-2">
                <Link href={`/financeiro/receber/novo?contactId=${contact.id}`} className="btn-secondary justify-start">
                  Lancar conta a receber
                </Link>
                <Link href={`/financeiro/pagar/novo?contactId=${contact.id}`} className="btn-secondary justify-start">
                  Lancar conta a pagar
                </Link>
                <Link href={`/financeiro/receber?contactId=${contact.id}`} className="btn-ghost justify-start">
                  Ver todos os titulos
                </Link>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
