'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Plus, Save, UserMinus, X } from 'lucide-react';
import { removeMembershipAction, saveUserAction, type UserState } from '@/app/actions/company';
import { Alert, Card, Field, Pill } from '@/components/ui/primitives';
import { ROLE_LABELS, ROLES, type Role } from '@/lib/permissions';
import { formatDateTime, initials } from '@/lib/utils';

type Member = {
  userId: string; name: string; email: string; phone: string | null;
  isActive: boolean; lastLoginAt: Date | null; role: Role;
};

function Submit({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      <Save size={16} /> {pending ? 'Salvando...' : editing ? 'Salvar usuario' : 'Criar usuario'}
    </button>
  );
}

export function UsersManager({
  members,
  currentUserId,
  currentRole,
  canManage,
}: {
  members: Member[];
  currentUserId: string;
  currentRole: Role;
  canManage: boolean;
}) {
  const [state, action] = useActionState<UserState, FormData>(saveUserAction, undefined);
  const [editing, setEditing] = useState<Member | null>(null);
  const [open, setOpen] = useState(false);

  const assignableRoles = ROLES.filter((role) => role !== 'OWNER' || currentRole === 'OWNER');

  return (
    <div className="space-y-5">
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}

      {canManage && !open && (
        <button type="button" onClick={() => { setEditing(null); setOpen(true); }} className="btn-primary">
          <Plus size={16} /> Novo usuario
        </button>
      )}

      {open && canManage && (
        <Card
          title={editing ? `Editar ${editing.name}` : 'Novo usuario'}
          description={
            editing
              ? 'Deixe a senha em branco para manter a atual.'
              : 'Se o e-mail ja existir no sistema, o usuario apenas ganha acesso a esta empresa.'
          }
          actions={
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm" aria-label="Fechar">
              <X size={15} />
            </button>
          }
        >
          <form action={action} className="space-y-4" key={editing?.userId ?? 'new'}>
            {editing && <input type="hidden" name="userId" value={editing.userId} />}

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome completo" htmlFor="name" required>
                <input id="name" name="name" required defaultValue={editing?.name} className="input" />
              </Field>

              <Field label="E-mail" htmlFor="email" required>
                <input id="email" name="email" type="email" required defaultValue={editing?.email} className="input" />
              </Field>

              <Field label="Telefone" htmlFor="phone">
                <input id="phone" name="phone" defaultValue={editing?.phone ?? ''} className="input" />
              </Field>

              <Field label="Papel nesta empresa" htmlFor="role" required>
                <select id="role" name="role" required defaultValue={editing?.role ?? 'VIEWER'} className="input">
                  {assignableRoles.map((role) => (
                    <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                  ))}
                </select>
              </Field>

              <Field
                label={editing ? 'Nova senha' : 'Senha inicial'}
                htmlFor="password"
                required={!editing}
                hint="Minimo de 8 caracteres."
              >
                <input
                  id="password"
                  name="password"
                  type="password"
                  required={!editing}
                  minLength={editing ? 0 : 8}
                  className="input"
                  placeholder={editing ? 'Deixe em branco para manter' : '••••••••'}
                />
              </Field>
            </div>

            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={editing?.isActive ?? true}
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="font-medium text-ink-800">Usuario ativo (pode fazer login)</span>
            </label>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancelar</button>
              <Submit editing={Boolean(editing)} />
            </div>
          </form>
        </Card>
      )}

      <Card bodyClassName="p-0">
        <div className="table-wrap">
          <table className="table min-w-[720px]">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Papel</th>
                <th>Ultimo acesso</th>
                <th>Situacao</th>
                {canManage && <th className="w-32" aria-label="Acoes" />}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.userId} className={member.isActive ? undefined : 'opacity-60'}>
                  <td>
                    <span className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                        {initials(member.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink-900">
                          {member.name}
                          {member.userId === currentUserId && (
                            <span className="ml-1.5 text-xs font-normal text-ink-400">(voce)</span>
                          )}
                        </span>
                        <span className="block truncate text-xs text-ink-500">{member.email}</span>
                      </span>
                    </span>
                  </td>
                  <td><Pill tone={member.role === 'OWNER' ? 'brand' : 'neutral'}>{ROLE_LABELS[member.role]}</Pill></td>
                  <td className="text-xs text-ink-600">
                    {member.lastLoginAt ? formatDateTime(member.lastLoginAt) : 'Nunca acessou'}
                  </td>
                  <td>
                    <Pill tone={member.isActive ? 'positive' : 'negative'}>
                      {member.isActive ? 'Ativo' : 'Inativo'}
                    </Pill>
                  </td>
                  {canManage && (
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => { setEditing(member); setOpen(true); }}
                          className="btn-ghost btn-sm"
                        >
                          Editar
                        </button>
                        {member.userId !== currentUserId && (
                          <form action={removeMembershipAction}>
                            <input type="hidden" name="userId" value={member.userId} />
                            <button
                              type="submit"
                              className="btn-ghost btn-sm text-red-600"
                              title="Remover acesso a esta empresa"
                              aria-label="Remover acesso"
                            >
                              <UserMinus size={14} />
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
