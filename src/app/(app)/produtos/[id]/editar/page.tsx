import { notFound } from 'next/navigation';
import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/primitives';
import { ProductForm } from '../../product-form';

export const metadata = { title: 'Editar produto' };
export const dynamic = 'force-dynamic';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const product = await prisma.product.findFirst({ where: { id, companyId: ctx.company.id } });
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={`Editar ${product.name}`} />
      <ProductForm product={product} />
    </div>
  );
}
