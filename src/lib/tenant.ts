import 'server-only';
import { redirect } from 'next/navigation';
import { prisma } from './prisma';
import { readActiveCompanyId, readSession, setActiveCompany } from './auth';
import type { Role, Permission } from './permissions';
import { can } from './permissions';

export type CompanySummary = {
  id: string;
  tradeName: string;
  corporateName: string;
  cnpj: string;
  color: string;
  logoUrl: string | null;
  role: Role;
};

export type AppContext = {
  user: { id: string; name: string; email: string; isSuperAdmin: boolean; avatarUrl: string | null };
  company: CompanySummary;
  companies: CompanySummary[];
  role: Role;
  can: (permission: Permission) => boolean;
};

/**
 * Resolve usuario logado + empresa ativa. Redireciona para /login quando nao
 * ha sessao e para /onboarding quando o usuario nao tem nenhuma empresa.
 */
export async function requireContext(): Promise<AppContext> {
  const session = await readSession();
  if (!session) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: {
      memberships: {
        include: { company: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!user || !user.isActive) redirect('/login');

  const active = user.memberships.filter((m) => m.company.isActive);
  if (active.length === 0) redirect('/onboarding');

  const companies: CompanySummary[] = active.map((m) => ({
    id: m.company.id,
    tradeName: m.company.tradeName,
    corporateName: m.company.corporateName,
    cnpj: m.company.cnpj,
    color: m.company.color,
    logoUrl: m.company.logoUrl,
    role: m.role as Role,
  }));

  const cookieCompanyId = await readActiveCompanyId();
  const company = companies.find((c) => c.id === cookieCompanyId) ?? companies[0];

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      avatarUrl: user.avatarUrl,
    },
    company,
    companies,
    role: company.role,
    can: (permission: Permission) => can(company.role, permission),
  };
}

/**
 * Igual a requireContext, mas exige uma permissao. Sem ela, o usuario e levado
 * para a tela de acesso negado - impede que alguem alcance uma pagina sensivel
 * digitando a URL, mesmo com o item de menu escondido.
 */
export async function requirePermission(permission: Permission): Promise<AppContext> {
  const ctx = await requireContext();
  if (!ctx.can(permission)) {
    redirect(`/sem-permissao?de=${encodeURIComponent(permission)}`);
  }
  return ctx;
}

/** Versao para rotas de API: lanca erro em vez de redirecionar. */
export async function requireApiContext(): Promise<
  { ok: true; ctx: AppContext } | { ok: false; status: number; error: string }
> {
  const session = await readSession();
  if (!session) return { ok: false, status: 401, error: 'Nao autenticado' };

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: { memberships: { include: { company: true }, orderBy: { createdAt: 'asc' } } },
  });
  if (!user || !user.isActive) return { ok: false, status: 401, error: 'Nao autenticado' };

  const active = user.memberships.filter((m) => m.company.isActive);
  if (active.length === 0) return { ok: false, status: 403, error: 'Usuario sem empresa vinculada' };

  const companies: CompanySummary[] = active.map((m) => ({
    id: m.company.id,
    tradeName: m.company.tradeName,
    corporateName: m.company.corporateName,
    cnpj: m.company.cnpj,
    color: m.company.color,
    logoUrl: m.company.logoUrl,
    role: m.role as Role,
  }));

  const cookieCompanyId = await readActiveCompanyId();
  const company = companies.find((c) => c.id === cookieCompanyId) ?? companies[0];

  return {
    ok: true,
    ctx: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isSuperAdmin: user.isSuperAdmin,
        avatarUrl: user.avatarUrl,
      },
      company,
      companies,
      role: company.role,
      can: (permission: Permission) => can(company.role, permission),
    },
  };
}

/** Garante que o usuario tem acesso a empresa antes de troca-la. */
export async function switchCompany(companyId: string): Promise<boolean> {
  const session = await readSession();
  if (!session) return false;
  const membership = await prisma.membership.findUnique({
    where: { userId_companyId: { userId: session.sub, companyId } },
  });
  if (!membership) return false;
  await setActiveCompany(companyId);
  return true;
}
