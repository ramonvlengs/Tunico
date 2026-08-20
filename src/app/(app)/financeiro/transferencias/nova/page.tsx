import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { getAccountBalances } from '@/server/finance';
import { PageHeader } from '@/components/ui/primitives';
import { TransferForm } from './transfer-form';

export const metadata = { title: 'Nova transferencia' };
export const dynamic = 'force-dynamic';

export default async function NewTransferPage() {
  const ctx = await requireContext();
  const balances = await getAccountBalances(ctx.company.id);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Nova transferencia"
        description="Mova saldo entre suas contas. O valor sai de uma e entra na outra na mesma data."
      />
      <TransferForm accounts={balances.map((b) => ({ id: b.id, name: b.name, balance: b.balance }))} />
    </div>
  );
}
