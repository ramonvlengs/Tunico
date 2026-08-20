import { prisma } from '@/lib/prisma';
import { requireContext } from '@/lib/tenant';
import { can } from '@/lib/permissions';
import { startOfToday } from '@/server/finance';
import { NAV_GROUPS } from '@/components/layout/nav-config';
import { AppShell } from '@/components/layout/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  const today = startOfToday();

  const [overdueReceivable, overduePayable, pendingReconciliation] = await Promise.all([
    prisma.financialEntry.count({
      where: { companyId: ctx.company.id, kind: 'RECEIVABLE', status: { in: ['OPEN', 'PARTIAL'] }, dueDate: { lt: today } },
    }),
    prisma.financialEntry.count({
      where: { companyId: ctx.company.id, kind: 'PAYABLE', status: { in: ['OPEN', 'PARTIAL'] }, dueDate: { lt: today } },
    }),
    prisma.bankTransaction.count({ where: { companyId: ctx.company.id, status: 'PENDING' } }),
  ]);

  // O menu e filtrado no servidor: itens sem permissao nem chegam ao cliente.
  const allowed = NAV_GROUPS.flatMap((group) =>
    group.items.filter((item) => !item.permission || can(ctx.role, item.permission)).map((item) => item.href),
  );

  return (
    <AppShell
      user={{ name: ctx.user.name, email: ctx.user.email }}
      company={ctx.company}
      companies={ctx.companies}
      allowed={allowed}
      badges={{ overdueReceivable, overduePayable, pendingReconciliation }}
    >
      {children}
    </AppShell>
  );
}
