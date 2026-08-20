import Link from 'next/link';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { deleteTransferAction } from '@/app/actions/finance';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, EmptyState, PageHeader } from '@/components/ui/primitives';

export const metadata = { title: 'Transferencias' };
export const dynamic = 'force-dynamic';

export default async function TransfersPage() {
  const ctx = await requireContext();
  const transfers = await prisma.transfer.findMany({
    where: { companyId: ctx.company.id },
    include: { fromAccount: { select: { name: true, color: true } }, toAccount: { select: { name: true, color: true } } },
    orderBy: { date: 'desc' },
    take: 100,
  });

  return (
    <>
      <PageHeader
        title="Transferencias entre contas"
        description="Movimentacoes internas nao entram na DRE: apenas deslocam saldo de uma conta para outra."
      >
        {ctx.can('finance.write') && (
          <Link href="/financeiro/transferencias/nova" className="btn-primary">
            <Plus size={16} /> Nova transferencia
          </Link>
        )}
      </PageHeader>

      <Card bodyClassName={transfers.length ? 'p-0' : 'p-5'}>
        {transfers.length === 0 ? (
          <EmptyState
            title="Nenhuma transferencia registrada"
            description="Use esta tela para mover dinheiro entre o caixa, o banco e as carteiras digitais."
            action={
              ctx.can('finance.write') ? (
                <Link href="/financeiro/transferencias/nova" className="btn-primary btn-sm">
                  <Plus size={14} /> Nova transferencia
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[760px]">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Origem</th>
                  <th aria-label="Sentido" className="w-8" />
                  <th>Destino</th>
                  <th>Descricao</th>
                  <th className="num">Valor</th>
                  <th className="num">Tarifa</th>
                  {ctx.can('finance.write') && <th className="w-10" aria-label="Acoes" />}
                </tr>
              </thead>
              <tbody>
                {transfers.map((transfer) => (
                  <tr key={transfer.id}>
                    <td className="whitespace-nowrap">{formatDate(transfer.date)}</td>
                    <td>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: transfer.fromAccount.color }} />
                        {transfer.fromAccount.name}
                      </span>
                    </td>
                    <td className="text-ink-400"><ArrowRight size={14} /></td>
                    <td>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: transfer.toAccount.color }} />
                        {transfer.toAccount.name}
                      </span>
                    </td>
                    <td className="text-ink-600">{transfer.description ?? '-'}</td>
                    <td className="num font-medium">{formatCurrency(transfer.amount)}</td>
                    <td className="num text-xs text-ink-500">{formatCurrency(transfer.fee)}</td>
                    {ctx.can('finance.write') && (
                      <td>
                        <form action={deleteTransferAction}>
                          <input type="hidden" name="id" value={transfer.id} />
                          <button type="submit" className="btn-ghost btn-sm text-red-600" aria-label="Excluir transferencia">
                            <Trash2 size={14} />
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
    </>
  );
}
