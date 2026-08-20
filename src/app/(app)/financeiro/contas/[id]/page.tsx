import { notFound } from 'next/navigation';
import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/primitives';
import { AccountForm } from '../account-form';

export const metadata = { title: 'Editar conta' };
export const dynamic = 'force-dynamic';

export default async function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();

  const account = await prisma.bankAccount.findFirst({
    where: { id, companyId: ctx.company.id },
    include: { _count: { select: { settlements: true, bankTransactions: true } } },
  });
  if (!account) notFound();

  const canDelete = ctx.can('finance.write');

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={account.name}
        description="Alterar o saldo inicial recalcula automaticamente o saldo atual da conta."
      />
      <AccountForm account={account} canDelete={canDelete} />
    </div>
  );
}
