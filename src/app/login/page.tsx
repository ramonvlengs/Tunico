import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { readSession } from '@/lib/auth';
import { Logo } from '@/components/ui/logo';
import { LoginForm } from './login-form';

export const metadata = { title: 'Entrar' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.proximo) ? params.proximo[0] : params.proximo;
  const next = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : undefined;

  const session = await readSession();
  if (session) redirect('/dashboard');

  const userCount = await prisma.user.count();

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Painel de marca */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-900 p-12 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-600/40 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-accent-500/20 blur-3xl"
        />

        <div className="relative flex items-center gap-4">
          <Logo size={64} />
          <div>
            <p className="text-xl font-bold tracking-tight">
              TunicoTCG <span className="text-brand-300">Control</span>
            </p>
            <p className="text-xs uppercase tracking-[0.2em] text-brand-200/80">Gestao financeira</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">
            O controle financeiro completo da sua loja de card game.
          </h2>
          <ul className="mt-8 space-y-4 text-sm text-brand-100">
            {[
              ['Multi-CNPJ', 'Gerencie todas as empresas do grupo em um unico login, com dados totalmente separados.'],
              ['Conciliacao bancaria', 'Importe OFX, Excel, CSV ou PDF e concilie o extrato com sugestoes automaticas.'],
              ['Contas a pagar e receber', 'Parcelamento, recorrencia, baixa parcial, juros, multa e desconto.'],
              ['DRE e fluxo de caixa', 'Resultado por competencia e projecao de caixa realizada + prevista.'],
            ].map(([title, text]) => (
              <li key={title} className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-300" />
                <span>
                  <strong className="font-semibold text-white">{title}.</strong> {text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-brand-200/60">
          &copy; {new Date().getFullYear()} Tunico TCG. Todos os direitos reservados.
        </p>
      </div>

      {/* Formulario */}
      <div className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo size={48} />
            <div>
              <p className="text-lg font-bold tracking-tight text-ink-900">
                TunicoTCG <span className="text-brand-600">Control</span>
              </p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-ink-400">Gestao financeira</p>
            </div>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
            {userCount === 0 ? 'Criar acesso de administrador' : 'Acessar o sistema'}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {userCount === 0
              ? 'Nenhum usuario cadastrado ainda. Crie a conta principal para comecar.'
              : 'Informe suas credenciais para continuar.'}
          </p>

          <div className="mt-8">
            <LoginForm allowSignup={userCount === 0} next={next} />
          </div>
        </div>
      </div>
    </main>
  );
}
