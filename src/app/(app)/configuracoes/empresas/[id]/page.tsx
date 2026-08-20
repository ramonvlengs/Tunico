import { notFound } from 'next/navigation';
import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/primitives';
import { CompanyForm } from '../company-form';

export const metadata = { title: 'Editar empresa' };
export const dynamic = 'force-dynamic';

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();

  const membership = await prisma.membership.findUnique({
    where: { userId_companyId: { userId: ctx.user.id, companyId: id } },
    include: { company: true },
  });
  if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={membership.company.tradeName} description="Dados cadastrais da empresa." />
      <CompanyForm company={membership.company} />
    </div>
  );
}
