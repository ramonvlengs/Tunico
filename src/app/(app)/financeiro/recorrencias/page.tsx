import Link from 'next/link';
import { Pause, Play, Plus, Trash2, Zap } from 'lucide-react';
import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { deleteRecurrenceAction, generateRecurrenceAction, toggleRecurrenceAction } from '@/app/actions/finance';
import { formatCurrency, formatDate } from '@/lib/utils';
import { RECURRENCE_FREQUENCIES } from '@/lib/constants';
import { Alert, Card, EmptyState, PageHeader, Pill } from '@/components/ui/primitives';

export const metadata = { title: 'Recorrencias' };
export const dynamic = 'force-dynamic';

export default async function RecurrencesPage() {
  const ctx = await requireContext();
  const recurrences = await prisma.recurrence.findMany({
    where: { companyId: ctx.company.id },
    include: {
      contact: { select: { name: true } },
      category: { select: { name: true } },
      _count: { select: { entries: true } },
    },
    orderBy: [{ isActive: 'desc' }, { nextRunAt: 'asc' }],
  });

  const label = (value: string) => RECURRENCE_FREQUENCIES.find((f) => f.value === value)?.label ?? value;

  return (
    <>
      <PageHeader
        title="Recorrencias"
        description="Modelos de lancamentos que se repetem: aluguel, salarios, assinaturas e mensalidades."
      >
        {ctx.can('finance.write') && (
          <Link href="/financeiro/recorrencias/nova" className="btn-primary">
            <Plus size={16} /> Nova recorrencia
          </Link>
        )}
      </PageHeader>

      <div className="mb-5">
        <Alert tone="info" title="Como funciona">
          A recorrencia guarda o modelo do lancamento. Use <strong>Gerar agora</strong> para criar a proxima parcela
          na data prevista - o sistema avanca a data automaticamente e o titulo aparece em contas a pagar ou a receber.
        </Alert>
      </div>

      <Card bodyClassName={recurrences.length ? 'p-0' : 'p-5'}>
        {recurrences.length === 0 ? (
          <EmptyState
            title="Nenhuma recorrencia cadastrada"
            description="Cadastre as despesas fixas da loja para nao precisar lanca-las todo mes."
            action={
              ctx.can('finance.write') ? (
                <Link href="/financeiro/recorrencias/nova" className="btn-primary btn-sm">
                  <Plus size={14} /> Nova recorrencia
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[900px]">
              <thead>
                <tr>
                  <th>Descricao</th>
                  <th>Tipo</th>
                  <th>Frequencia</th>
                  <th>Proxima geracao</th>
                  <th>Gerados</th>
                  <th className="num">Valor</th>
                  <th className="w-32" aria-label="Acoes" />
                </tr>
              </thead>
              <tbody>
                {recurrences.map((recurrence) => (
                  <tr key={recurrence.id} className={recurrence.isActive ? undefined : 'opacity-60'}>
                    <td>
                      <Link href={`/financeiro/recorrencias/${recurrence.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                        {recurrence.description}
                      </Link>
                      <span className="block text-xs text-ink-500">
                        {recurrence.contact?.name ?? 'Sem contato'}
                        {recurrence.category && ` · ${recurrence.category.name}`}
                      </span>
                    </td>
                    <td>
                      <Pill tone={recurrence.kind === 'RECEIVABLE' ? 'positive' : 'negative'}>
                        {recurrence.kind === 'RECEIVABLE' ? 'A receber' : 'A pagar'}
                      </Pill>
                    </td>
                    <td className="text-ink-600">
                      {label(recurrence.frequency)}
                      {recurrence.interval > 1 && ` (a cada ${recurrence.interval})`}
                    </td>
                    <td className="whitespace-nowrap">
                      {recurrence.isActive ? formatDate(recurrence.nextRunAt) : <Pill>Pausada</Pill>}
                    </td>
                    <td className="text-ink-600">
                      {recurrence._count.entries}
                      {recurrence.occurrences ? ` / ${recurrence.occurrences}` : ''}
                    </td>
                    <td className="num font-medium">{formatCurrency(recurrence.amount)}</td>
                    <td>
                      {ctx.can('finance.write') && (
                        <div className="flex items-center gap-1">
                          {recurrence.isActive && (
                            <form action={generateRecurrenceAction}>
                              <input type="hidden" name="id" value={recurrence.id} />
                              <button type="submit" className="btn-ghost btn-sm" title="Gerar a proxima ocorrencia">
                                <Zap size={14} />
                              </button>
                            </form>
                          )}
                          <form action={toggleRecurrenceAction}>
                            <input type="hidden" name="id" value={recurrence.id} />
                            <button
                              type="submit"
                              className="btn-ghost btn-sm"
                              title={recurrence.isActive ? 'Pausar' : 'Reativar'}
                            >
                              {recurrence.isActive ? <Pause size={14} /> : <Play size={14} />}
                            </button>
                          </form>
                          <form action={deleteRecurrenceAction}>
                            <input type="hidden" name="id" value={recurrence.id} />
                            <button type="submit" className="btn-ghost btn-sm text-red-600" title="Excluir">
                              <Trash2 size={14} />
                            </button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
