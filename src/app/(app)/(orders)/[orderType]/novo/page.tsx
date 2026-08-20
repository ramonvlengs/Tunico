import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/primitives';
import { resolveOrderType } from '../order-type';
import { OrderForm } from '../order-form';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ orderType: string }> };

export async function generateMetadata({ params }: Props) {
  const { orderType } = await params;
  return { title: resolveOrderType(orderType).newLabel };
}

export default async function NewOrderPage({ params }: Props) {
  const { orderType } = await params;
  const config = resolveOrderType(orderType);
  const ctx = await requireContext();

  const [contacts, products, paymentMethods] = await Promise.all([
    prisma.contact.findMany({
      where: { companyId: ctx.company.id, isActive: true },
      select: { id: true, name: true, kind: true },
      orderBy: { name: 'asc' },
    }),
    prisma.product.findMany({
      where: { companyId: ctx.company.id, isActive: true },
      select: { id: true, name: true, sku: true, salePrice: true, costPrice: true, stock: true, unit: true },
      orderBy: { name: 'asc' },
    }),
    prisma.paymentMethod.findMany({
      where: { companyId: ctx.company.id, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <>
      <PageHeader
        title={config.newLabel}
        description="Ao faturar, o sistema gera as parcelas no financeiro e movimenta o estoque dos itens cadastrados."
      />
      <OrderForm config={config} options={{ contacts, products, paymentMethods }} />
    </>
  );
}
