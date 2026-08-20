import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { readSession } from '@/lib/auth';
import { Logo } from '@/components/ui/logo';
import { OnboardingForm } from './onboarding-form';

export const metadata = { title: 'Primeira empresa' };

export default async function OnboardingPage() {
  const session = await readSession();
  if (!session) redirect('/login');

  const memberships = await prisma.membership.count({ where: { userId: session.sub } });
  if (memberships > 0) redirect('/dashboard');

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={72} />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink-900">
            Bem-vindo ao TunicoTCG Control
          </h1>
          <p className="mt-2 max-w-md text-sm text-ink-500">
            Cadastre a primeira empresa do grupo. Voce podera adicionar quantos CNPJs quiser depois,
            em Configuracoes &rsaquo; Empresas.
          </p>
        </div>

        <div className="card p-6">
          <OnboardingForm />
        </div>

        <p className="mt-6 text-center text-xs text-ink-400">
          O plano de contas, os centros de custo e as formas de pagamento padrao serao criados
          automaticamente.
        </p>
      </div>
    </main>
  );
}
