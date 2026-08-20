import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/primitives';
import { CostCentersManager } from './cost-centers-manager';

export const metadata = { title: 'Centros de custo' };
export const dynamic = 'force-dynamic';

export default async function CostCentersPage() {
  const ctx = await requireContext();
  const costCenters = await prisma.costCenter.findMany({
    where: { companyId: ctx.company.id },
    include: { _count: { select: { entries: true } } },
    orderBy: [{ code: 'asc' }, { name: 'asc' }],
  });

  return (
    <>
      <PageHeader
        title="Centros de custo"
        description="Separe os resultados por area: loja fisica, vendas online, eventos e administrativo."
      />
      <CostCentersManager
        costCenters={costCenters.map((c) => ({ ...c, entryCount: c._count.entries }))}
        canManage={ctx.can('finance.write')}
      />
    </>
  );
}
