import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { Alert, PageHeader } from '@/components/ui/primitives';
import { PaymentMethodsManager } from './payment-methods-manager';

export const metadata = { title: 'Formas de pagamento' };
export const dynamic = 'force-dynamic';

export default async function PaymentMethodsPage() {
  const ctx = await requireContext();
  const [methods, accounts] = await Promise.all([
    prisma.paymentMethod.findMany({
      where: { companyId: ctx.company.id },
      include: { bankAccount: { select: { name: true } }, _count: { select: { settlements: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.bankAccount.findMany({
      where: { companyId: ctx.company.id, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Formas de pagamento"
        description="Como o dinheiro entra e sai: dinheiro, PIX, cartoes, boleto e gateways."
      />
      <div className="mb-5">
        <Alert tone="info" title="Taxas e prazo de recebimento">
          A taxa percentual e a taxa fixa sao usadas como sugestao no campo de tarifa da baixa; o prazo indica em
          quantos dias o valor costuma cair na conta.
        </Alert>
      </div>
      <PaymentMethodsManager
        methods={methods.map((method) => ({
          id: method.id,
          name: method.name,
          type: method.type,
          feePercent: method.feePercent,
          feeFixed: method.feeFixed,
          settlementDays: method.settlementDays,
          bankAccountId: method.bankAccountId,
          bankAccountName: method.bankAccount?.name ?? null,
          isActive: method.isActive,
          usageCount: method._count.settlements,
        }))}
        accounts={accounts}
        canManage={ctx.can('finance.write')}
      />
    </>
  );
}
