import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Ban, Pencil, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { getFormOptions } from '@/server/entry-query';
import { displayStatus, openAmount, startOfToday } from '@/server/finance';
import { cancelEntryAction, deleteEntryAction, reverseSettlementAction } from '@/app/actions/finance';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { Alert, Card, EmptyState, PageHeader, Pill, StatusBadge } from '@/components/ui/primitives';
import { resolveKind } from '../kind';
import { SettlePanel } from './settle-panel';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ kind: string; id: string }> };

export async function generateMetadata({ params }: Props) {
  const { kind } = await params;
  return { title: resolveKind(kind).singular };
}

export default async function EntryDetailPage({ params }: Props) {
  const { kind: slug, id } = await params;
  const config = resolveKind(slug);
  const ctx = await requireContext();

  const entry = await prisma.financialEntry.findFirst({
    where: { id, companyId: ctx.company.id, kind: config.kind },
    include: {
      contact: true,
      category: true,
      costCenter: true,
      bankAccount: true,
      order: { select: { id: true, number: true, type: true } },
      recurrence: { select: { id: true, description: true } },
      settlements: {
        include: { bankAccount: { select: { name: true } }, paymentMethod: { select: { name: true } } },
        orderBy: { paidAt: 'desc' },
      },
      matches: {
        include: { bankTransaction: { select: { id: true, description: true, date: true, amount: true } } },
      },
    },
  });

  if (!entry) notFound();

  const options = await getFormOptions(ctx.company.id);
  const status = displayStatus(entry, startOfToday());
  const open = openAmount(entry);
  const siblings = entry.groupId
    ? await prisma.financialEntry.findMany({
        where: { groupId: entry.groupId, companyId: ctx.company.id },
        orderBy: { installment: 'asc' },
        select: { id: true, installment: true, installments: true, dueDate: true, amount: true, paidAmount: true, status: true },
      })
    : [];

  return (
    <>
      <div className="mb-4 no-print">
        <Link href={`/financeiro/${config.slug}`} className="btn-ghost btn-sm -ml-2">
          <ArrowLeft size={14} /> Voltar para {config.title.toLowerCase()}
        </Link>
      </div>

      <PageHeader
        title={entry.description}
        description={`${config.singular} · vencimento em ${formatDate(entry.dueDate)}`}
      >
        {ctx.can('finance.write') && (
          <>
            <Link href={`/financeiro/${config.slug}/${entry.id}/editar`} className="btn-secondary">
              <Pencil size={16} /> Editar
            </Link>
            <form action={cancelEntryAction}>
              <input type="hidden" name="id" value={entry.id} />
              <button type="submit" className="btn-secondary">
                {entry.status === 'CANCELED' ? (<><RotateCcw size={16} /> Reativar</>) : (<><Ban size={16} /> Cancelar</>)}
              </button>
            </form>
            <form action={deleteEntryAction}>
              <input type="hidden" name="id" value={entry.id} />
              <input type="hidden" name="scope" value="single" />
              <button type="submit" className="btn-danger">
                <Trash2 size={16} /> Excluir
              </button>
            </form>
          </>
        )}
      </PageHeader>

      {entry.status === 'CANCELED' && (
        <div className="mb-5">
          <Alert tone="warning" title="Lancamento cancelado">
            Ele continua no historico, mas nao entra em saldos, projecoes nem na DRE.
          </Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Resumo">
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-ink-500">Valor do titulo</dt>
                <dd className="mt-0.5 text-xl font-semibold tabular-nums text-ink-900">
                  {formatCurrency(entry.amount)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">{config.positive ? 'Recebido' : 'Pago'}</dt>
                <dd className="mt-0.5 text-xl font-semibold tabular-nums text-emerald-600">
                  {formatCurrency(entry.paidAmount)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">Em aberto</dt>
                <dd className="mt-0.5 text-xl font-semibold tabular-nums text-amber-600">{formatCurrency(open)}</dd>
              </div>

              <div>
                <dt className="text-xs text-ink-500">Situacao</dt>
                <dd className="mt-1"><StatusBadge status={status} /></dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">{config.contactLabel}</dt>
                <dd className="mt-0.5 text-sm text-ink-900">
                  {entry.contact ? (
                    <Link href={`/contatos/${entry.contact.id}`} className="link">{entry.contact.name}</Link>
                  ) : '-'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">Categoria</dt>
                <dd className="mt-0.5 text-sm text-ink-900">{entry.category?.name ?? '-'}</dd>
              </div>

              <div>
                <dt className="text-xs text-ink-500">Emissao</dt>
                <dd className="mt-0.5 text-sm text-ink-900">{formatDate(entry.issueDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">Competencia</dt>
                <dd className="mt-0.5 text-sm text-ink-900">{formatDate(entry.competenceDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">Centro de custo</dt>
                <dd className="mt-0.5 text-sm text-ink-900">{entry.costCenter?.name ?? '-'}</dd>
              </div>

              <div>
                <dt className="text-xs text-ink-500">Documento</dt>
                <dd className="mt-0.5 text-sm text-ink-900">{entry.documentNumber ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">Conta prevista</dt>
                <dd className="mt-0.5 text-sm text-ink-900">{entry.bankAccount?.name ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">Parcela</dt>
                <dd className="mt-0.5 text-sm text-ink-900">
                  {entry.installment}/{entry.installments}
                </dd>
              </div>

              {entry.notes && (
                <div className="sm:col-span-3">
                  <dt className="text-xs text-ink-500">Observacoes</dt>
                  <dd className="mt-0.5 whitespace-pre-line text-sm text-ink-800">{entry.notes}</dd>
                </div>
              )}

              {(entry.order || entry.recurrence || entry.tags) && (
                <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
                  {entry.order && (
                    <Link href={`/${entry.order.type === 'SALE' ? 'vendas' : 'compras'}/${entry.order.id}`}>
                      <Pill tone="brand">
                        {entry.order.type === 'SALE' ? 'Venda' : 'Compra'} #{entry.order.number}
                      </Pill>
                    </Link>
                  )}
                  {entry.recurrence && <Pill>Gerado por recorrencia</Pill>}
                  {entry.tags?.split(',').filter(Boolean).map((tag) => (
                    <Pill key={tag}>{tag.trim()}</Pill>
                  ))}
                </div>
              )}
            </dl>
          </Card>

          <Card
            title="Baixas registradas"
            description={`${entry.settlements.length} movimento(s) de ${config.positive ? 'recebimento' : 'pagamento'}.`}
            bodyClassName={entry.settlements.length ? 'p-0' : 'p-5'}
          >
            {entry.settlements.length === 0 ? (
              <EmptyState
                title="Nenhuma baixa registrada"
                description="Use o painel ao lado para registrar o pagamento total ou parcial."
              />
            ) : (
              <div className="table-wrap">
                <table className="table min-w-[720px]">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Conta</th>
                      <th>Forma</th>
                      <th className="num">Valor</th>
                      <th className="num">Desc./Juros/Multa</th>
                      <th className="num">Taxa</th>
                      {ctx.can('finance.settle') && <th className="w-10" aria-label="Acoes" />}
                    </tr>
                  </thead>
                  <tbody>
                    {entry.settlements.map((settlement) => (
                      <tr key={settlement.id}>
                        <td className="whitespace-nowrap">{formatDate(settlement.paidAt)}</td>
                        <td>{settlement.bankAccount.name}</td>
                        <td className="text-ink-600">{settlement.paymentMethod?.name ?? '-'}</td>
                        <td className="num font-medium">{formatCurrency(settlement.amount)}</td>
                        <td className="num text-xs text-ink-500">
                          {formatCurrency(settlement.discount)} / {formatCurrency(settlement.interest)} /{' '}
                          {formatCurrency(settlement.fine)}
                        </td>
                        <td className="num text-xs text-ink-500">{formatCurrency(settlement.fee)}</td>
                        {ctx.can('finance.settle') && (
                          <td>
                            <form action={reverseSettlementAction}>
                              <input type="hidden" name="settlementId" value={settlement.id} />
                              <input type="hidden" name="entryId" value={entry.id} />
                              <button
                                type="submit"
                                className="btn-ghost btn-sm text-red-600"
                                title="Estornar esta baixa"
                                aria-label="Estornar baixa"
                              >
                                <Undo2 size={14} />
                              </button>
                            </form>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {siblings.length > 1 && (
            <Card title="Parcelas do mesmo lancamento" bodyClassName="p-0">
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
                    {siblings.map((sibling) => (
                      <tr key={sibling.id} className={sibling.id === entry.id ? 'bg-brand-50/60' : undefined}>
                        <td>
                          <Link href={`/financeiro/${config.slug}/${sibling.id}`} className="link">
                            {sibling.installment}/{sibling.installments}
                          </Link>
                        </td>
                        <td>{formatDate(sibling.dueDate)}</td>
                        <td><StatusBadge status={displayStatus(sibling, startOfToday())} /></td>
                        <td className="num">{formatCurrency(sibling.amount)}</td>
                        <td className="num">{formatCurrency(sibling.amount - sibling.paidAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {ctx.can('finance.write') && (
                <div className="border-t border-ink-200 p-4 no-print">
                  <form action={deleteEntryAction}>
                    <input type="hidden" name="id" value={entry.id} />
                    <input type="hidden" name="scope" value="group" />
                    <button type="submit" className="btn-secondary btn-sm text-red-600">
                      <Trash2 size={14} /> Excluir todas as parcelas
                    </button>
                  </form>
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {ctx.can('finance.settle') && entry.status !== 'CANCELED' && open > 0 && (
            <Card title={`Registrar ${config.positive ? 'recebimento' : 'pagamento'}`}>
              <SettlePanel
                entryId={entry.id}
                openAmount={open}
                defaultBankAccountId={entry.bankAccountId}
                accounts={options.bankAccounts}
                methods={options.paymentMethods}
                label={config.settleLabel}
              />
            </Card>
          )}

          {open <= 0 && entry.status === 'PAID' && (
            <Card title="Titulo quitado">
              <p className="text-sm text-ink-600">
                Este lancamento foi totalmente {config.positive ? 'recebido' : 'pago'} em{' '}
                {formatDate(entry.settlements[0]?.paidAt)}.
              </p>
            </Card>
          )}

          {entry.matches.length > 0 && (
            <Card title="Conciliacao bancaria">
              <ul className="space-y-3">
                {entry.matches.map((match) => (
                  <li key={match.id} className="rounded-lg border border-ink-200 p-3">
                    <p className="text-sm font-medium text-ink-900">{match.bankTransaction.description}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {formatDate(match.bankTransaction.date)} &middot; {formatCurrency(match.bankTransaction.amount)}
                    </p>
                    <p className="mt-1 text-[11px] text-ink-400">
                      Vinculado por {match.method === 'AUTO' ? 'sugestao automatica' : match.method === 'CREATED' ? 'criacao a partir do extrato' : 'conciliacao manual'}
                      {match.score ? ` (${Math.round(match.score)} pts)` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Historico">
            <ul className="space-y-2 text-xs text-ink-600">
              <li>Criado em {formatDateTime(entry.createdAt)}</li>
              <li>Ultima alteracao em {formatDateTime(entry.updatedAt)}</li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
