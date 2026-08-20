import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { Alert, PageHeader } from '@/components/ui/primitives';
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES, type Role } from '@/lib/permissions';
import { UsersManager } from './users-manager';

export const metadata = { title: 'Usuarios e permissoes' };
export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const ctx = await requireContext();

  const memberships = await prisma.membership.findMany({
    where: { companyId: ctx.company.id },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <>
      <PageHeader
        title="Usuarios e permissoes"
        description={`Quem tem acesso a ${ctx.company.tradeName} e o que cada um pode fazer.`}
      />

      <div className="mb-5">
        <Alert tone="info" title="Papeis por empresa">
          A permissao vale por CNPJ: o mesmo usuario pode ser Financeiro em uma empresa e apenas Consulta em outra.
        </Alert>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {ROLES.map((role) => (
          <div key={role} className="card p-4">
            <p className="text-sm font-semibold text-ink-900">{ROLE_LABELS[role]}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">{ROLE_DESCRIPTIONS[role]}</p>
          </div>
        ))}
      </div>

      <UsersManager
        members={memberships.map((membership) => ({
          userId: membership.user.id,
          name: membership.user.name,
          email: membership.user.email,
          phone: membership.user.phone,
          isActive: membership.user.isActive,
          lastLoginAt: membership.user.lastLoginAt,
          role: membership.role as Role,
        }))}
        currentUserId={ctx.user.id}
        currentRole={ctx.role}
        canManage={ctx.can('users.manage')}
      />
    </>
  );
}
