import { notFound } from 'next/navigation';
import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/primitives';
import { resolveOrderType } from '../../order-type';
import { OrderForm } from '../../order-form';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ orderType: string; id: string }> };

export default async function EditOrderPage({ params }: Props) {
  const { orderType, id } = await params;
  const config = resolveOrderType(orderType);
  const ctx = await requireContext();

  const [order, contacts, products, paymentMethods] = await Promise.all([
    prisma.order.findFirst({
      where: { id, companyId: ctx.company.id, type: config.type },
      include: { items: true },
    }),
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
  if (!order) notFound();

  return (
    <>
      <PageHeader title={`Editar ${config.singular.toLowerCase()} #${String(order.number).padStart(4, '0')}`} />
      <OrderForm config={config} options={{ contacts, products, paymentMethods }} order={order} />
    </>
  );
}
