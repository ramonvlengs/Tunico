import Link from 'next/link';
import { Upload, Wand2, Scale, CheckCircle2, Clock, EyeOff } from 'lucide-react';
import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { getReconciliationStats, suggestMatches } from '@/server/reconciliation';
import { getFormOptions } from '@/server/entry-query';
import { autoReconcileAllAction } from '@/app/actions/reconciliation';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Alert, Card, EmptyState, Money, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { FilterBar, SelectFilter } from '@/components/ui/filters';
import { TransactionRow } from './transaction-row';

export const metadata = { title: 'Conciliacao bancaria' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export default async function ReconciliationPage({
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
  const companyId = ctx.company.id;
  const bankAccountId = get('bankAccountId');
  const status = get('status') ?? 'PENDING';
  const direction = get('direction');

  const [accounts, stats, options] = await Promise.all([
    prisma.bankAccount.findMany({ where: { companyId, isActive: true }, orderBy: { name: 'asc' } }),
    getReconciliationStats(companyId, bankAccountId),
    getFormOptions(companyId),
  ]);

  const transactions = await prisma.bankTransaction.findMany({
    where: {
      companyId,
      ...(bankAccountId ? { bankAccountId } : {}),
      ...(status !== 'ALL' ? { status } : {}),
      ...(direction ? { direction } : {}),
    },
    include: {
      bankAccount: { select: { name: true, color: true } },
      matches: {
        include: { entry: { select: { id: true, description: true, kind: true, amount: true } } },
      },
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: PAGE_SIZE,
  });

  // Sugestoes so sao calculadas para o que esta pendente na pagina atual.
  const suggestions = await Promise.all(
    transactions.map(async (transaction) =>
      transaction.status === 'PENDING'
        ? { id: transaction.id, list: await suggestMatches(companyId, transaction.id, 4) }
        : { id: transaction.id, list: [] },
    ),
  );
  const suggestionMap = new Map(suggestions.map((item) => [item.id, item.list]));

  return (
    <>
      <PageHeader
        title="Conciliacao bancaria"
        description="Compare o extrato do banco com os lancamentos do sistema. Importe OFX, Excel, CSV ou PDF."
      >
        {ctx.can('reconciliation.manage') && stats.pending > 0 && (
          <form action={autoReconcileAllAction}>
            <input type="hidden" name="bankAccountId" value={bankAccountId ?? ''} />
            <button type="submit" className="btn-secondary">
              <Wand2 size={16} /> Conciliar automaticamente
            </button>
          </form>
        )}
        <Link href="/conciliacao/importar" className="btn-primary">
          <Upload size={16} /> Importar extrato
        </Link>
      </PageHeader>

      {/* Progresso */}
      <div className="mb-6 card p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Progresso da conciliacao</p>
            <p className="mt-1 text-2xl font-semibold text-ink-900">{stats.percent}%</p>
            <p className="mt-0.5 text-xs text-ink-500">
              {stats.reconciled} conciliado(s) e {stats.ignored} ignorado(s) de {stats.total} lancamento(s) do extrato.
            </p>
          </div>
          <dl className="flex flex-wrap gap-6 text-sm">
            <div>
              <dt className="text-xs text-ink-500">Pendentes</dt>
              <dd className="text-lg font-semibold tabular-nums text-amber-600">{stats.pending}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Entradas pendentes</dt>
              <dd className="text-lg font-semibold tabular-nums text-emerald-600">{formatCurrency(stats.pendingIn)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Saidas pendentes</dt>
              <dd className="text-lg font-semibold tabular-nums text-red-600">{formatCurrency(stats.pendingOut)}</dd>
            </div>
          </dl>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-200">
          <div
            className="h-full rounded-full bg-brand-500 transition-all"
            style={{ width: `${stats.percent}%` }}
            role="progressbar"
            aria-valuenow={stats.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso da conciliacao"
          />
        </div>
      </div>

      <FilterBar>
        <SelectFilter
          name="bankAccountId"
          label="Conta"
          allLabel="Todas as contas"
          options={accounts.map((account) => ({ value: account.id, label: account.name }))}
        />
        <SelectFilter
          name="status"
          label="Situacao"
          allLabel="Pendentes"
          options={[
            { value: 'RECONCILED', label: 'Conciliados' },
            { value: 'IGNORED', label: 'Ignorados' },
            { value: 'ALL', label: 'Todos' },
          ]}
        />
        <SelectFilter
          name="direction"
          label="Tipo"
          allLabel="Entradas e saidas"
          options={[
            { value: 'IN', label: 'Somente entradas' },
            { value: 'OUT', label: 'Somente saidas' },
          ]}
        />
      </FilterBar>

      {stats.total === 0 ? (
        <Card>
          <EmptyState
            icon={<Scale size={30} />}
            title="Nenhum extrato importado ainda"
            description="Exporte o extrato do seu internet banking em OFX (recomendado), Excel, CSV ou PDF e importe aqui para conferir os lancamentos."
            action={
              <Link href="/conciliacao/importar" className="btn-primary btn-sm">
                <Upload size={14} /> Importar primeiro extrato
              </Link>
            }
          />
        </Card>
      ) : transactions.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CheckCircle2 size={30} className="text-emerald-500" />}
            title={status === 'PENDING' ? 'Tudo conciliado!' : 'Nenhum lancamento nesta visao'}
            description={
              status === 'PENDING'
                ? 'Nao ha lancamentos do extrato aguardando conferencia nesta conta.'
                : 'Ajuste os filtros para ver outros lancamentos.'
            }
          />
        </Card>
      ) : (
        <>
          {status === 'PENDING' && stats.pending > PAGE_SIZE && (
            <div className="mb-4">
              <Alert tone="info">
                Mostrando os {PAGE_SIZE} lancamentos pendentes mais recentes de {stats.pending}. Conforme voce concilia,
                os proximos aparecem automaticamente.
              </Alert>
            </div>
          )}

          <div className="space-y-3">
            {transactions.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={{
                  id: transaction.id,
                  date: transaction.date,
                  amount: transaction.amount,
                  direction: transaction.direction,
                  description: transaction.description,
                  memo: transaction.memo,
                  status: transaction.status,
                  notes: transaction.notes,
                  accountName: transaction.bankAccount.name,
                  accountColor: transaction.bankAccount.color,
                  matches: transaction.matches.map((match) => ({
                    id: match.id,
                    method: match.method,
                    entryId: match.entry.id,
                    entryKind: match.entry.kind,
                    entryDescription: match.entry.description,
                  })),
                }}
                suggestions={suggestionMap.get(transaction.id) ?? []}
                options={{
                  categories: options.categories,
                  contacts: options.contacts,
                  costCenters: options.costCenters,
                }}
                canManage={ctx.can('reconciliation.manage')}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}
