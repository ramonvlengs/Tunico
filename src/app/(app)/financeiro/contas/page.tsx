import Link from 'next/link';
import { Plus, ArrowLeftRight, FileSpreadsheet, Upload } from 'lucide-react';
import { requireContext } from '@/lib/tenant';
import { getAccountBalances } from '@/server/finance';
import { prisma } from '@/lib/prisma';
import { formatCurrency } from '@/lib/utils';
import { BANK_ACCOUNT_TYPES } from '@/lib/constants';
import { Card, EmptyState, Money, PageHeader, Pill } from '@/components/ui/primitives';

export const metadata = { title: 'Contas e caixas' };
export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const ctx = await requireContext();
  const [balances, accounts] = await Promise.all([
    getAccountBalances(ctx.company.id),
    prisma.bankAccount.findMany({
      where: { companyId: ctx.company.id },
      include: {
        _count: { select: { settlements: true, bankTransactions: true } },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    }),
  ]);

  const balanceMap = new Map(balances.map((b) => [b.id, b.balance]));
  const totalCash = balances.filter((b) => b.includeInCash).reduce((sum, b) => sum + b.balance, 0);
  const typeLabel = (value: string) => BANK_ACCOUNT_TYPES.find((t) => t.value === value)?.label ?? value;

  return (
    <>
      <PageHeader
        title="Contas e caixas"
        description="Bancos, carteiras digitais e caixa da loja. O saldo e calculado a partir do saldo inicial mais as baixas e transferencias."
      >
        <Link href="/financeiro/transferencias/nova" className="btn-secondary">
          <ArrowLeftRight size={16} /> Transferir
        </Link>
        <Link href="/conciliacao/importar" className="btn-secondary">
          <Upload size={16} /> Importar extrato
        </Link>
        {ctx.can('finance.write') && (
          <Link href="/financeiro/contas/nova" className="btn-primary">
            <Plus size={16} /> Nova conta
          </Link>
        )}
      </PageHeader>

      <div className="mb-6 card bg-gradient-to-br from-brand-700 to-brand-900 p-6 text-white">
        <p className="text-xs font-medium uppercase tracking-wider text-brand-200">Saldo total em caixa</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">{formatCurrency(totalCash)}</p>
        <p className="mt-1 text-xs text-brand-200">
          Soma das contas marcadas para compor o caixa disponivel.
        </p>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhuma conta cadastrada"
            description="Cadastre a conta corrente, a carteira digital e o caixa da loja para acompanhar os saldos."
            action={
              <Link href="/financeiro/contas/nova" className="btn-primary btn-sm">
                <Plus size={14} /> Cadastrar conta
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => {
            const balance = balanceMap.get(account.id) ?? account.initialBalance;
            return (
              <div key={account.id} className={`card overflow-hidden ${!account.isActive ? 'opacity-60' : ''}`}>
                <div className="h-1.5" style={{ background: account.color }} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-ink-900">{account.name}</h3>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {typeLabel(account.type)}
                        {account.bankName && ` · ${account.bankName}`}
                      </p>
                      {account.accountNumber && (
                        <p className="mt-0.5 text-xs text-ink-400">
                          Ag. {account.agency ?? '-'} / Conta {account.accountNumber}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {!account.isActive && <Pill>Inativa</Pill>}
                      {!account.includeInCash && <Pill tone="warning">Fora do caixa</Pill>}
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-ink-500">Saldo atual</p>
                  <Money value={balance} signed className="text-2xl font-semibold" />

                  <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-ink-100 pt-3 text-xs">
                    <div>
                      <dt className="text-ink-500">Saldo inicial</dt>
                      <dd className="tabular-nums text-ink-800">{formatCurrency(account.initialBalance)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-500">Movimentos</dt>
                      <dd className="tabular-nums text-ink-800">{account._count.settlements}</dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/financeiro/extrato?bankAccountId=${account.id}`} className="btn-secondary btn-sm">
                      <FileSpreadsheet size={13} /> Extrato
                    </Link>
                    {account._count.bankTransactions > 0 && (
                      <Link href={`/conciliacao?bankAccountId=${account.id}`} className="btn-secondary btn-sm">
                        Conciliar
                      </Link>
                    )}
                    {ctx.can('finance.write') && (
                      <Link href={`/financeiro/contas/${account.id}`} className="btn-ghost btn-sm ml-auto">
                        Editar
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
