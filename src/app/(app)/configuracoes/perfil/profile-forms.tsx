'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { KeyRound, Save } from 'lucide-react';
import { changePasswordAction, updateProfileAction, type UserState } from '@/app/actions/company';
import { Alert, Card, Field } from '@/components/ui/primitives';

function Submit({ label, icon }: { label: string; icon: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {icon} {pending ? 'Salvando...' : label}
    </button>
  );
}

export function ProfileForms({
  name,
  email,
  phone,
}: {
  name: string;
  email: string;
  phone: string | null;
}) {
  const [profileState, profileAction] = useActionState<UserState, FormData>(updateProfileAction, undefined);
  const [passwordState, passwordAction] = useActionState<UserState, FormData>(changePasswordAction, undefined);

  return (
    <>
      <Card title="Dados pessoais">
        <form action={profileAction} className="space-y-4">
          {profileState?.error && <Alert tone="danger">{profileState.error}</Alert>}
          {profileState?.success && <Alert tone="success">{profileState.success}</Alert>}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome completo" htmlFor="name" required>
              <input id="name" name="name" required defaultValue={name} className="input" />
            </Field>
            <Field label="Telefone" htmlFor="phone">
              <input id="phone" name="phone" defaultValue={phone ?? ''} className="input" />
            </Field>
            <Field label="E-mail" htmlFor="email-readonly" hint="Peca a um administrador para alterar o e-mail de acesso.">
              <input id="email-readonly" value={email} readOnly disabled className="input" />
            </Field>
          </div>

          <div className="flex justify-end">
            <Submit label="Salvar dados" icon={<Save size={16} />} />
          </div>
        </form>
      </Card>

      <Card title="Alterar senha" description="Use uma senha exclusiva para este sistema.">
        <form action={passwordAction} className="space-y-4">
          {passwordState?.error && <Alert tone="danger">{passwordState.error}</Alert>}
          {passwordState?.success && <Alert tone="success">{passwordState.success}</Alert>}

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Senha atual" htmlFor="currentPassword" required>
              <input id="currentPassword" name="currentPassword" type="password" required className="input" />
            </Field>
            <Field label="Nova senha" htmlFor="newPassword" required hint="Minimo de 8 caracteres.">
              <input id="newPassword" name="newPassword" type="password" required minLength={8} className="input" />
            </Field>
            <Field label="Confirmar nova senha" htmlFor="confirmPassword" required>
              <input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} className="input" />
            </Field>
          </div>

          <div className="flex justify-end">
            <Submit label="Alterar senha" icon={<KeyRound size={16} />} />
          </div>
        </form>
      </Card>
    </>
  );
}
