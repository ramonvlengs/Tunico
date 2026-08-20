import Link from 'next/link';
import { Upload } from 'lucide-react';
import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { getAccountStatement } from '@/server/reports';
import { endOfMonthUTC, formatCurrency, formatDate, parseDateInput, startOfMonthUTC } from '@/lib/utils';
import { Card, EmptyState, Money, PageHeader } from '@/components/ui/primitives';
import { FilterBar, SelectFilter, DateRangeFilter } from '@/components/ui/filters';
import { PrintClient } from '@/components/ui/print-button';

export const metadata = { title: 'Extrato' };
export const dynamic = 'force-dynamic';

export default async function StatementPage({
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
  const accounts = await prisma.bankAccount.findMany({
    where: { companyId: ctx.company.id, isActive: true },
    orderBy: { name: 'asc' },
  });

  if (accounts.length === 0) {
    return (
      <>
        <PageHeader title="Extrato" description="Movimentacao consolidada de uma conta." />
        <Card>
          <EmptyState
            title="Cadastre uma conta primeiro"
            description="O extrato mostra as baixas e transferencias de cada conta."
            action={<Link href="/financeiro/contas/nova" className="btn-primary btn-sm">Cadastrar conta</Link>}
          />
        </Card>
      </>
    );
  }

  const bankAccountId = get('bankAccountId') ?? accounts[0].id;
  const start = parseDateInput(get('from')) ?? startOfMonthUTC();
  const endInput = parseDateInput(get('to'));
  const end = endInput ? new Date(endInput.getTime() + 86399999) : endOfMonthUTC();

  const statement = await getAccountStatement(ctx.company.id, bankAccountId, start, end);

  return (
    <>
      <PageHeader
        title="Extrato"
        description="Movimentacao consolidada da conta: baixas de contas a pagar/receber e transferencias, com saldo corrido."
      >
        <Link href="/conciliacao/importar" className="btn-secondary">
          <Upload size={16} /> Importar extrato bancario
        </Link>
        <PrintClient />
      </PageHeader>

      <FilterBar>
        <SelectFilter
          name="bankAccountId"
          label="Conta"
          allLabel={accounts[0].name}
          options={accounts.map((account) => ({ value: account.id, label: account.name }))}
        />
        <DateRangeFilter />
      </FilterBar>

      {!statement ? (
        <Card><EmptyState title="Conta nao encontrada" /></Card>
      ) : (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-4">
            <div className="card p-4">
              <p className="text-xs uppercase tracking-wide text-ink-500">Saldo anterior</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-ink-900">
                {formatCurrency(statement.openingBalance)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs uppercase tracking-wide text-ink-500">Entradas</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-600">
                {formatCurrency(statement.totalIn)}
              </p>
            </div>
            <div className="card p-4">
              <p className="text-xs uppercase tracking-wide text-ink-500">Saidas</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-red-600">
                {formatCurrency(statement.totalOut)}
              </p>
            </div>
            <div className="card border-brand-300 bg-brand-50 p-4">
              <p className="text-xs uppercase tracking-wide text-brand-700">Saldo final</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-brand-900">
                {formatCurrency(statement.closingBalance)}
              </p>
            </div>
          </div>

          <Card
            title={statement.account.name}
            description={`Periodo de ${formatDate(start)} a ${formatDate(end)}`}
            bodyClassName="p-0"
          >
            {statement.lines.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="Sem movimentacao no periodo"
                  description="Registre baixas de contas a pagar/receber ou transferencias para ver o extrato."
                />
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table min-w-[760px]">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Historico</th>
                      <th>Referencia</th>
                      <th className="num">Valor</th>
                      <th className="num">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-ink-50/60">
                      <td colSpan={4} className="text-xs font-medium uppercase tracking-wide text-ink-500">
                        Saldo anterior
                      </td>
                      <td className="num font-medium">{formatCurrency(statement.openingBalance)}</td>
                    </tr>
                    {statement.lines.map((line) => (
                      <tr key={`${line.kind}-${line.id}`}>
                        <td className="whitespace-nowrap">{formatDate(line.date)}</td>
                        <td>
                          {line.entryId ? (
                            <Link
                              href={`/financeiro/${line.amount >= 0 ? 'receber' : 'pagar'}/${line.entryId}`}
                              className="font-medium text-ink-900 hover:text-brand-700"
                            >
                              {line.description}
                            </Link>
                          ) : (
                            <span className="font-medium text-ink-900">{line.description}</span>
                          )}
                        </td>
                        <td className="text-xs text-ink-500">{line.reference ?? '-'}</td>
                        <td className="num"><Money value={line.amount} signed /></td>
                        <td className="num tabular-nums text-ink-700">{formatCurrency(line.balance)}</td>
                      </tr>
                    ))}
                    <tr className="bg-brand-50/70">
                      <td colSpan={4} className="text-xs font-semibold uppercase tracking-wide text-brand-800">
                        Saldo final
                      </td>
                      <td className="num font-semibold text-brand-900">{formatCurrency(statement.closingBalance)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}

