'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireApiContext } from '@/lib/tenant';
import { readSession, setActiveCompany, hashPassword, verifyPassword } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { isValidCNPJ } from '@/lib/validators';
import { onlyDigits } from '@/lib/utils';
import { seedCompanyDefaults } from '@/server/defaults';
import { isRole, type Role } from '@/lib/permissions';

export type CompanyState = { error?: string; success?: string } | undefined;

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}
function optional(formData: FormData, key: string): string | null {
  const value = str(formData, key);
  return value === '' ? null : value;
}

const companySchema = z.object({
  corporateName: z.string().min(3, 'Informe a razao social.'),
  tradeName: z.string().min(2, 'Informe o nome fantasia.'),
  cnpj: z.string().refine((v) => isValidCNPJ(v), 'CNPJ invalido.'),
});

/** Cria ou atualiza uma empresa (CNPJ) do grupo. */
export async function saveCompanyAction(_prev: CompanyState, formData: FormData): Promise<CompanyState> {
  const auth = await requireApiContext();
  if (!auth.ok) return { error: auth.error };
  const { ctx } = auth;

  const id = optional(formData, 'id');

  // Editar exige permissao na empresa ativa; criar e liberado a qualquer
  // usuario autenticado, que se torna OWNER da nova empresa.
  if (id && !ctx.can('company.manage')) {
    return { error: 'Voce nao tem permissao para editar os dados da empresa.' };
  }

  const parsed = companySchema.safeParse({
    corporateName: str(formData, 'corporateName'),
    tradeName: str(formData, 'tradeName'),
    cnpj: str(formData, 'cnpj'),
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const cnpj = onlyDigits(parsed.data.cnpj);
  const conflict = await prisma.company.findFirst({ where: { cnpj, ...(id ? { NOT: { id } } : {}) } });
  if (conflict) return { error: 'Ja existe uma empresa cadastrada com este CNPJ.' };

  const data = {
    corporateName: parsed.data.corporateName,
    tradeName: parsed.data.tradeName,
    cnpj,
    stateReg: optional(formData, 'stateReg'),
    cityReg: optional(formData, 'cityReg'),
    taxRegime: str(formData, 'taxRegime') || 'SIMPLES_NACIONAL',
    email: optional(formData, 'email'),
    phone: optional(formData, 'phone'),
    website: optional(formData, 'website'),
    zipCode: optional(formData, 'zipCode'),
    street: optional(formData, 'street'),
    number: optional(formData, 'number'),
    complement: optional(formData, 'complement'),
    district: optional(formData, 'district'),
    city: optional(formData, 'city'),
    state: optional(formData, 'state'),
    color: str(formData, 'color') || '#16a34a',
    isActive: formData.get('isActive') !== null,
  };

  if (id) {
    const membership = await prisma.membership.findUnique({
      where: { userId_companyId: { userId: ctx.user.id, companyId: id } },
    });
    if (!membership) return { error: 'Voce nao tem acesso a esta empresa.' };

    await prisma.company.update({ where: { id }, data });
    await audit({
      companyId: id, userId: ctx.user.id, action: 'UPDATE',
      entity: 'Company', entityId: id, summary: `Empresa ${data.tradeName} atualizada`,
    });
  } else {
    const company = await prisma.company.create({
      data: { ...data, memberships: { create: { userId: ctx.user.id, role: 'OWNER' } } },
    });
    await seedCompanyDefaults(company.id);
    await setActiveCompany(company.id);
    await audit({
      companyId: company.id, userId: ctx.user.id, action: 'CREATE',
      entity: 'Company', entityId: company.id, summary: `Empresa ${company.tradeName} criada`,
    });
  }

  revalidatePath('/', 'layout');
  redirect('/configuracoes/empresas');
}

/** Desativa a empresa - os dados continuam preservados no banco. */
export async function deactivateCompanyAction(formData: FormData) {
  const auth = await requireApiContext();
  if (!auth.ok) return;
  const { ctx } = auth;

  const id = String(formData.get('id') ?? '');
  const membership = await prisma.membership.findUnique({
    where: { userId_companyId: { userId: ctx.user.id, companyId: id } },
  });
  if (!membership || membership.role !== 'OWNER') return;

  const active = await prisma.company.count({ where: { isActive: true } });
  if (active <= 1) return; // nunca deixa o sistema sem nenhuma empresa ativa

  await prisma.company.update({ where: { id }, data: { isActive: false } });
  await audit({
    companyId: id, userId: ctx.user.id, action: 'UPDATE',
    entity: 'Company', entityId: id, summary: 'Empresa desativada',
  });

  revalidatePath('/', 'layout');
  redirect('/configuracoes/empresas');
}

export async function reactivateCompanyAction(formData: FormData) {
  const auth = await requireApiContext();
  if (!auth.ok) return;
  const id = String(formData.get('id') ?? '');
  const membership = await prisma.membership.findUnique({
    where: { userId_companyId: { userId: auth.ctx.user.id, companyId: id } },
  });
  if (!membership || membership.role !== 'OWNER') return;
  await prisma.company.update({ where: { id }, data: { isActive: true } });
  revalidatePath('/', 'layout');
}

// ---------------------------------------------------------------------------
// Usuarios e permissoes
// ---------------------------------------------------------------------------

export type UserState = { error?: string; success?: string } | undefined;

export async function saveUserAction(_prev: UserState, formData: FormData): Promise<UserState> {
  const auth = await requireApiContext();
  if (!auth.ok) return { error: auth.error };
  const { ctx } = auth;
  if (!ctx.can('users.manage')) return { error: 'Sem permissao para gerenciar usuarios.' };

  const userId = String(formData.get('userId') ?? '') || null;
  const name = str(formData, 'name');
  const email = str(formData, 'email').toLowerCase();
  const role = str(formData, 'role');
  const password = str(formData, 'password');

  if (name.length < 3) return { error: 'Informe o nome completo.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Informe um e-mail valido.' };
  if (!isRole(role)) return { error: 'Selecione um papel valido.' };
  if (role === 'OWNER' && ctx.role !== 'OWNER') {
    return { error: 'Somente o proprietario pode conceder o papel de proprietario.' };
  }

  if (userId) {
    // So e possivel editar quem ja pertence a empresa ativa. Sem essa checagem,
    // um administrador poderia trocar a senha de um usuario de outra empresa.
    const membership = await prisma.membership.findUnique({
      where: { userId_companyId: { userId, companyId: ctx.company.id } },
      include: { user: true },
    });
    if (!membership) return { error: 'Usuario nao encontrado nesta empresa.' };
    if (membership.role === 'OWNER' && ctx.role !== 'OWNER') {
      return { error: 'Somente o proprietario pode editar outro proprietario.' };
    }

    // E-mail e unico no sistema inteiro, entao o conflito precisa de mensagem.
    if (email !== membership.user.email) {
      const taken = await prisma.user.findUnique({ where: { email } });
      if (taken) return { error: 'Ja existe outro usuario com este e-mail.' };
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        email,
        phone: optional(formData, 'phone'),
        isActive: formData.get('isActive') !== null,
        ...(password ? { passwordHash: await hashPassword(password) } : {}),
      },
    });
    await prisma.membership.update({
      where: { id: membership.id },
      data: { role },
    });
  } else {
    if (password.length < 8) return { error: 'A senha inicial deve ter no minimo 8 caracteres.' };
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      // Usuario ja existe no sistema: apenas vincula a esta empresa.
      await prisma.membership.upsert({
        where: { userId_companyId: { userId: existing.id, companyId: ctx.company.id } },
        create: { userId: existing.id, companyId: ctx.company.id, role },
        update: { role },
      });
    } else {
      await prisma.user.create({
        data: {
          name,
          email,
          phone: optional(formData, 'phone'),
          passwordHash: await hashPassword(password),
          memberships: { create: { companyId: ctx.company.id, role } },
        },
      });
    }
  }

  await audit({
    companyId: ctx.company.id, userId: ctx.user.id, action: userId ? 'UPDATE' : 'CREATE',
    entity: 'User', entityId: userId, summary: `Usuario ${name} (${role})`,
  });

  revalidatePath('/configuracoes/usuarios');
  return { success: userId ? 'Usuario atualizado.' : 'Usuario criado e vinculado a esta empresa.' };
}

/** Remove o acesso do usuario a empresa ativa (nao apaga o usuario). */
export async function removeMembershipAction(formData: FormData) {
  const auth = await requireApiContext();
  if (!auth.ok || !auth.ctx.can('users.manage')) return;
  const { ctx } = auth;

  const userId = String(formData.get('userId') ?? '');
  if (userId === ctx.user.id) return; // nao se remove da propria empresa

  const target = await prisma.membership.findUnique({
    where: { userId_companyId: { userId, companyId: ctx.company.id } },
  });
  if (!target) return;
  if (target.role === 'OWNER' && ctx.role !== 'OWNER') return;

  const owners = await prisma.membership.count({ where: { companyId: ctx.company.id, role: 'OWNER' } });
  if (target.role === 'OWNER' && owners <= 1) return; // sempre resta um dono

  await prisma.membership.delete({ where: { id: target.id } });
  await audit({
    companyId: ctx.company.id, userId: ctx.user.id, action: 'DELETE',
    entity: 'Membership', entityId: userId, summary: 'Acesso removido da empresa',
  });
  revalidatePath('/configuracoes/usuarios');
}

// ---------------------------------------------------------------------------
// Perfil do proprio usuario
// ---------------------------------------------------------------------------

export async function updateProfileAction(_prev: UserState, formData: FormData): Promise<UserState> {
  const session = await readSession();
  if (!session) return { error: 'Sessao expirada.' };

  const name = str(formData, 'name');
  const phone = optional(formData, 'phone');
  if (name.length < 3) return { error: 'Informe seu nome completo.' };

  await prisma.user.update({ where: { id: session.sub }, data: { name, phone } });
  revalidatePath('/', 'layout');
  return { success: 'Perfil atualizado.' };
}

export async function changePasswordAction(_prev: UserState, formData: FormData): Promise<UserState> {
  const session = await readSession();
  if (!session) return { error: 'Sessao expirada.' };

  const current = str(formData, 'currentPassword');
  const next = str(formData, 'newPassword');
  const confirm = str(formData, 'confirmPassword');

  if (next.length < 8) return { error: 'A nova senha deve ter no minimo 8 caracteres.' };
  if (next !== confirm) return { error: 'A confirmacao nao confere com a nova senha.' };

  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) return { error: 'Usuario nao encontrado.' };

  const valid = await verifyPassword(current, user.passwordHash);
  if (!valid) return { error: 'A senha atual esta incorreta.' };

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  await audit({ userId: user.id, action: 'UPDATE', entity: 'User', entityId: user.id, summary: 'Senha alterada' });

  return { success: 'Senha alterada com sucesso.' };
}
