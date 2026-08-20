'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authenticate, createSession, destroySession, hashPassword, readSession, setActiveCompany } from '@/lib/auth';
import { switchCompany } from '@/lib/tenant';
import { audit } from '@/lib/audit';
import { isValidCNPJ } from '@/lib/validators';
import { onlyDigits } from '@/lib/utils';
import { seedCompanyDefaults } from '@/server/defaults';

export type ActionState = { error?: string; success?: string } | undefined;

const loginSchema = z.object({
  email: z.string().email('Informe um e-mail valido.'),
  password: z.string().min(1, 'Informe a senha.'),
});

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) {
    return { error: 'E-mail ou senha invalidos.' };
  }

  await createSession({ sub: user.id, email: user.email, name: user.name });
  await audit({ userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id, summary: 'Login realizado' });

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, company: { isActive: true } },
    orderBy: { createdAt: 'asc' },
  });
  if (membership) await setActiveCompany(membership.companyId);

  redirect('/dashboard');
}

export async function logoutAction() {
  const session = await readSession();
  if (session) {
    await audit({ userId: session.sub, action: 'LOGOUT', entity: 'User', entityId: session.sub });
  }
  await destroySession();
  redirect('/login');
}

export async function switchCompanyAction(formData: FormData) {
  const companyId = String(formData.get('companyId') ?? '');
  if (!companyId) return;
  const ok = await switchCompany(companyId);
  if (!ok) return;
  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

// ---------------------------------------------------------------------------
// Primeiro acesso: cria a primeira empresa do usuario
// ---------------------------------------------------------------------------

const onboardingSchema = z.object({
  corporateName: z.string().min(3, 'Informe a razao social.'),
  tradeName: z.string().min(2, 'Informe o nome fantasia.'),
  cnpj: z.string().refine((v) => isValidCNPJ(v), 'CNPJ invalido.'),
  taxRegime: z.string().default('SIMPLES_NACIONAL'),
});

export async function createFirstCompanyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await readSession();
  if (!session) redirect('/login');

  const parsed = onboardingSchema.safeParse({
    corporateName: String(formData.get('corporateName') ?? ''),
    tradeName: String(formData.get('tradeName') ?? ''),
    cnpj: String(formData.get('cnpj') ?? ''),
    taxRegime: String(formData.get('taxRegime') ?? 'SIMPLES_NACIONAL'),
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const cnpj = onlyDigits(parsed.data.cnpj);
  const existing = await prisma.company.findUnique({ where: { cnpj } });
  if (existing) return { error: 'Ja existe uma empresa cadastrada com este CNPJ.' };

  const company = await prisma.company.create({
    data: {
      corporateName: parsed.data.corporateName,
      tradeName: parsed.data.tradeName,
      cnpj,
      taxRegime: parsed.data.taxRegime,
      memberships: { create: { userId: session.sub, role: 'OWNER' } },
    },
  });

  await seedCompanyDefaults(company.id);
  await setActiveCompany(company.id);
  await audit({
    companyId: company.id,
    userId: session.sub,
    action: 'CREATE',
    entity: 'Company',
    entityId: company.id,
    summary: `Empresa ${company.tradeName} criada`,
  });

  redirect('/dashboard');
}

/** Cadastro publico - habilitado apenas enquanto nao existe nenhum usuario. */
const signupSchema = z
  .object({
    name: z.string().min(3, 'Informe seu nome completo.'),
    email: z.string().email('Informe um e-mail valido.'),
    password: z.string().min(8, 'A senha deve ter no minimo 8 caracteres.'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: 'As senhas nao conferem.', path: ['confirm'] });

export async function signupAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    return { error: 'O cadastro publico esta desabilitado. Peca a um administrador para criar seu acesso.' };
  }

  const parsed = signupSchema.safeParse({
    name: String(formData.get('name') ?? ''),
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
    confirm: String(formData.get('confirm') ?? ''),
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      passwordHash: await hashPassword(parsed.data.password),
      isSuperAdmin: true,
    },
  });

  await createSession({ sub: user.id, email: user.email, name: user.name });
  redirect('/onboarding');
}
