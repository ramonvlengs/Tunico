import Link from 'next/link';
import {
  Wallet, TrendingUp, TrendingDown, AlertTriangle, Scale, ShoppingCart,
  ArrowDownCircle, ArrowUpCircle, PiggyBank, Plus, Landmark,
} from 'lucide-react';
import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { getCashFlow, getDashboard } from '@/server/reports';
import { displayStatus, startOfToday } from '@/server/finance';
import { formatCurrency, formatDate, addDaysUTC } from '@/lib/utils';
import { Card, EmptyState, Money, PageHeader, StatCard, StatusBadge } from '@/components/ui/primitives';
import { CashFlowChart, CategoryDonut } from '@/components/charts';

export const metadata = { title: 'Painel' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const ctx = await requireContext();
  const companyId = ctx.company.id;
  const today = startOfToday();

  const [data, cashFlow, upcoming, recentTransactions] = await Promise.all([
    getDashboard(companyId),
    getCashFlow(companyId, 12),
    prisma.financialEntry.findMany({
      where: {
        companyId,
        status: { in: ['OPEN', 'PARTIAL'] },
        dueDate: { lte: addDaysUTC(today, 15) },
      },
      include: { contact: { select: { name: true } }, category: { select: { name: true } } },
      orderBy: { dueDate: 'asc' },
      take: 8,
    }),
    prisma.bankTransaction.findMany({
      where: { companyId, status: 'PENDING' },
      include: { bankAccount: { select: { name: true } } },
      orderBy: { date: 'desc' },
      take: 6,
    }),
  ]);

  return (
    <>
      <PageHeader
        title={`Ola, ${ctx.user.name.split(' ')[0]}`}
        description={`Situacao financeira de ${ctx.company.tradeName} em ${formatDate(new Date())}.`}
      >
        {ctx.can('finance.write') && (
          <>
            <Link href="/financeiro/receber/novo" className="btn-secondary">
              <ArrowDownCircle size={16} /> Nova receita
            </Link>
            <Link href="/financeiro/pagar/novo" className="btn-primary">
              <Plus size={16} /> Nova despesa
            </Link>
          </>
        )}
      </PageHeader>

      {/* Indicadores principais */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Saldo em caixa"
          value={formatCurrency(data.cash)}
          hint={`${data.balances.filter((b) => b.includeInCash).length} conta(s) somada(s)`}
          tone={data.cash >= 0 ? 'brand' : 'negative'}
          icon={<Wallet size={18} />}
          href="/financeiro/contas"
        />
        <StatCard
          label={`Recebido em ${data.month.label}`}
          value={formatCurrency(data.month.received)}
          hint={`Resultado do mes: ${formatCurrency(data.month.result)}`}
          tone="positive"
          icon={<TrendingUp size={18} />}
          href="/financeiro/receber"
        />
        <StatCard
          label={`Pago em ${data.month.label}`}
          value={formatCurrency(data.month.paid)}
          hint={`${formatCurrency(data.payable.next7)} vencem em 7 dias`}
          tone="negative"
          icon={<TrendingDown size={18} />}
          href="/financeiro/pagar"
        />
        <StatCard
          label="Projecao para 30 dias"
          value={formatCurrency(data.projected30)}
          hint="Saldo atual + a receber - a pagar"
          tone={data.projected30 >= 0 ? 'brand' : 'negative'}
          icon={<PiggyBank size={18} />}
          href="/relatorios/fluxo-de-caixa"
        />
      </div>

      {/* Alertas operacionais */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="A receber em aberto"
          value={formatCurrency(data.receivable.open)}
          hint={data.receivable.overdue > 0 ? `${formatCurrency(data.receivable.overdue)} vencidos` : 'Nenhum vencido'}
          tone={data.receivable.overdue > 0 ? 'warning' : 'neutral'}
          icon={<ArrowDownCircle size={18} />}
          href="/financeiro/receber?status=OVERDUE"
        />
        <StatCard
          label="A pagar em aberto"
          value={formatCurrency(data.payable.open)}
          hint={data.payable.overdue > 0 ? `${formatCurrency(data.payable.overdue)} vencidos` : 'Nenhum vencido'}
          tone={data.payable.overdue > 0 ? 'warning' : 'neutral'}
          icon={<ArrowUpCircle size={18} />}
          href="/financeiro/pagar?status=OVERDUE"
        />
        <StatCard
          label="A conciliar"
          value={String(data.pendingReconciliation)}
          hint="Lancamentos do extrato sem vinculo"
          tone={data.pendingReconciliation > 0 ? 'warning' : 'neutral'}
          icon={<Scale size={18} />}
          href="/conciliacao"
        />
        <StatCard
          label={`Vendas em ${data.month.label}`}
          value={formatCurrency(data.sales.total)}
          hint={`${data.sales.count} pedido(s) no mes`}
          icon={<ShoppingCart size={18} />}
          href="/vendas"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="Fluxo de caixa"
          description="Meses anteriores pelo realizado; meses futuros pela previsao de vencimentos."
          actions={
            <Link href="/relatorios/fluxo-de-caixa" className="btn-ghost btn-sm">
              Ver relatorio
            </Link>
          }
        >
          <CashFlowChart data={cashFlow} />
        </Card>

        <Card
          title="Despesas por categoria"
          description={`Competencia de ${data.month.label}.`}
          actions={
            <Link href="/relatorios/categorias" className="btn-ghost btn-sm">
              Detalhar
            </Link>
          }
        >
          <CategoryDonut data={data.topExpenseCategories} />
          <ul className="mt-2 space-y-1.5">
            {data.topExpenseCategories.map((category, index) => (
              <li key={category.name} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: category.color ?? ['#16a34a', '#0ea5e9', '#f97316', '#8b5cf6', '#ec4899'][index % 5] }}
                />
                <span className="min-w-0 flex-1 truncate text-ink-700">{category.name}</span>
                <span className="tabular-nums text-ink-500">{category.percent.toFixed(1)}%</span>
                <span className="w-24 text-right font-medium tabular-nums text-ink-900">
                  {formatCurrency(category.amount)}
                </span>
              </li>
            ))}
            {data.topExpenseCategories.length === 0 && (
              <li className="py-2 text-center text-xs text-ink-500">Nenhuma despesa lancada no mes.</li>
            )}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card
          className="xl:col-span-2"
          title="Proximos vencimentos"
          description="Contas em aberto com vencimento nos proximos 15 dias (ou ja vencidas)."
        >
          {upcoming.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle size={28} />}
              title="Nenhuma conta a vencer nos proximos 15 dias"
              description="Assim que houver lancamentos em aberto, eles aparecem aqui em ordem de vencimento."
            />
          ) : (
            <div className="table-wrap -m-5">
              <table className="table">
                <thead>
                  <tr>
                    <th>Vencimento</th>
                    <th>Descricao</th>
                    <th>Contato</th>
                    <th>Status</th>
                    <th className="num">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((entry) => (
                    <tr key={entry.id}>
                      <td className="whitespace-nowrap">{formatDate(entry.dueDate)}</td>
                      <td>
                        <Link
                          href={`/financeiro/${entry.kind === 'RECEIVABLE' ? 'receber' : 'pagar'}/${entry.id}`}
                          className="font-medium text-ink-900 hover:text-brand-700"
                        >
                          {entry.description}
                        </Link>
                        {entry.category && (
                          <span className="block text-xs text-ink-500">{entry.category.name}</span>
                        )}
                      </td>
                      <td className="text-ink-600">{entry.contact?.name ?? '-'}</td>
                      <td>
                        <StatusBadge status={displayStatus(entry, today)} />
                      </td>
                      <td className="num font-medium">
                        <Money
                          value={entry.kind === 'RECEIVABLE' ? entry.amount - entry.paidAmount : -(entry.amount - entry.paidAmount)}
                          signed
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card
            title="Saldos por conta"
            actions={
              <Link href="/financeiro/contas" className="btn-ghost btn-sm">
                Gerenciar
              </Link>
            }
          >
            {data.balances.length === 0 ? (
              <EmptyState
                icon={<Landmark size={26} />}
                title="Nenhuma conta cadastrada"
                action={
                  <Link href="/financeiro/contas/nova" className="btn-primary btn-sm">
                    Cadastrar conta
                  </Link>
                }
              />
            ) : (
              <ul className="space-y-2.5">
                {data.balances.map((account) => (
                  <li key={account.id} className="flex items-center gap-3">
                    <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: account.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink-900">{account.name}</span>
                      <span className="block truncate text-xs text-ink-500">
                        {account.bankName ?? 'Recurso proprio'}
                        {!account.includeInCash && ' · fora do caixa'}
                      </span>
                    </span>
                    <Money value={account.balance} signed className="text-sm font-semibold" />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Extrato a conciliar"
            actions={
              <Link href="/conciliacao" className="btn-ghost btn-sm">
                Conciliar
              </Link>
            }
          >
            {recentTransactions.length === 0 ? (
              <EmptyState
                icon={<Scale size={26} />}
                title="Tudo conciliado"
                description="Importe um extrato OFX, Excel, CSV ou PDF para conferir os lancamentos."
                action={
                  <Link href="/conciliacao/importar" className="btn-primary btn-sm">
                    Importar extrato
                  </Link>
                }
              />
            ) : (
              <ul className="space-y-2.5">
                {recentTransactions.map((transaction) => (
                  <li key={transaction.id} className="flex items-start gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink-900">{transaction.description}</span>
                      <span className="block text-xs text-ink-500">
                        {formatDate(transaction.date)} · {transaction.bankAccount.name}
                      </span>
                    </span>
                    <Money value={transaction.amount} signed className="whitespace-nowrap text-sm font-medium" />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
