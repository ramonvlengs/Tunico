import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { getFormOptions } from '@/server/entry-query';
import { Alert, PageHeader } from '@/components/ui/primitives';
import { RulesManager } from './rules-manager';

export const metadata = { title: 'Regras de conciliacao' };
export const dynamic = 'force-dynamic';

export default async function RulesPage() {
  const ctx = await requireContext();
  const [rules, options] = await Promise.all([
    prisma.reconciliationRule.findMany({
      where: { companyId: ctx.company.id },
      include: { category: { select: { name: true } }, contact: { select: { name: true } } },
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    }),
    getFormOptions(ctx.company.id),
  ]);

  return (
    <>
      <PageHeader
        title="Regras de conciliacao"
        description="Classifique automaticamente lancamentos recorrentes do extrato: tarifas, taxas de maquininha, impostos e repasses."
      />

      <div className="mb-5">
        <Alert tone="info" title="Como as regras sao aplicadas">
          Quando uma movimentacao do extrato contem o texto da regra (ignorando acentos e maiusculas) e respeita o tipo
          e a faixa de valores, a categoria e o contato indicados sao sugeridos ao criar o lancamento. A regra de maior
          prioridade vence.
        </Alert>
      </div>

      <RulesManager
        rules={rules.map((rule) => ({
          ...rule,
          categoryName: rule.category?.name ?? null,
          contactName: rule.contact?.name ?? null,
        }))}
        options={options}
        canManage={ctx.can('reconciliation.manage')}
      />
    </>
  );
}
