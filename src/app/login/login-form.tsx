'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';
import { loginAction, signupAction, type ActionState } from '@/app/actions/auth';
import { Alert, Field } from '@/components/ui/primitives';

function SubmitButton({ label, icon }: { label: string; icon: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? 'Aguarde...' : (<>{icon}{label}</>)}
    </button>
  );
}

export function LoginForm({ allowSignup, next }: { allowSignup: boolean; next?: string }) {
  const [mode, setMode] = useState<'login' | 'signup'>(allowSignup ? 'signup' : 'login');
  const [showPassword, setShowPassword] = useState(false);

  const [loginState, doLogin] = useActionState<ActionState, FormData>(loginAction, undefined);
  const [signupState, doSignup] = useActionState<ActionState, FormData>(signupAction, undefined);

  const state = mode === 'login' ? loginState : signupState;

  return (
    <div className="space-y-4">
      {state?.error && <Alert tone="danger">{state.error}</Alert>}

      {mode === 'login' ? (
        <form action={doLogin} className="space-y-4">
          {next && <input type="hidden" name="proximo" value={next} />}

          <Field label="E-mail" htmlFor="email" required>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              className="input"
              placeholder="voce@tunicotcg.com.br"
            />
          </Field>

          <Field label="Senha" htmlFor="password" required>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                className="input pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-400 hover:text-ink-700"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>

          <SubmitButton label="Entrar" icon={<LogIn size={16} />} />
        </form>
      ) : (
        <form action={doSignup} className="space-y-4">
          <Field label="Nome completo" htmlFor="name" required>
            <input id="name" name="name" required className="input" placeholder="Seu nome" />
          </Field>
          <Field label="E-mail" htmlFor="signup-email" required>
            <input
              id="signup-email"
              name="email"
              type="email"
              required
              className="input"
              placeholder="voce@tunicotcg.com.br"
            />
          </Field>
          <Field label="Senha" htmlFor="signup-password" required hint="Minimo de 8 caracteres.">
            <input
              id="signup-password"
              name="password"
              type="password"
              required
              minLength={8}
              className="input"
              placeholder="••••••••"
            />
          </Field>
          <Field label="Confirmar senha" htmlFor="confirm" required>
            <input id="confirm" name="confirm" type="password" required className="input" placeholder="••••••••" />
          </Field>
          <SubmitButton label="Criar acesso" icon={<UserPlus size={16} />} />
        </form>
      )}

      {allowSignup && (
        <p className="text-center text-xs text-ink-500">
          {mode === 'login' ? 'Ainda nao tem acesso?' : 'Ja possui uma conta?'}{' '}
          <button
            type="button"
            className="link font-medium"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
          >
            {mode === 'login' ? 'Criar o primeiro acesso' : 'Fazer login'}
          </button>
        </p>
      )}
    </div>
  );
}
