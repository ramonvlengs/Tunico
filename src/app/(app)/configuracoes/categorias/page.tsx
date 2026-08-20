import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { Alert, PageHeader } from '@/components/ui/primitives';
import { CategoriesManager } from './categories-manager';

export const metadata = { title: 'Plano de contas' };
export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  const ctx = await requireContext();

  const categories = await prisma.category.findMany({
    where: { companyId: ctx.company.id },
    include: { _count: { select: { entries: true, children: true } } },
    orderBy: [{ code: 'asc' }, { name: 'asc' }],
  });

  return (
    <>
      <PageHeader
        title="Plano de contas"
        description="Categorias de receita e despesa que alimentam a DRE e os relatorios por categoria."
      />

      <div className="mb-5">
        <Alert tone="info" title="Grupo na DRE">
          O grupo define onde a categoria aparece no demonstrativo: deducoes e CMV reduzem o lucro bruto, despesas
          operacionais reduzem o resultado operacional, e investimentos ficam fora da operacao.
        </Alert>
      </div>

      <CategoriesManager
        categories={categories.map((category) => ({
          id: category.id,
          parentId: category.parentId,
          code: category.code,
          name: category.name,
          type: category.type,
          dreGroup: category.dreGroup,
          color: category.color,
          isActive: category.isActive,
          entryCount: category._count.entries,
          childCount: category._count.children,
        }))}
        canManage={ctx.can('finance.write')}
      />
    </>
  );
}
