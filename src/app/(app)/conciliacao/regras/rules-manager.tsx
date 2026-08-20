'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { deleteRuleAction, saveRuleAction, type RuleState } from '@/app/actions/reconciliation';
import { Alert, Card, EmptyState, Field, Pill } from '@/components/ui/primitives';
import { formatCurrency } from '@/lib/utils';

type Rule = {
  id: string;
  name: string;
  pattern: string;
  direction: string | null;
  minAmount: number | null;
  maxAmount: number | null;
  categoryId: string | null;
  contactId: string | null;
  categoryName: string | null;
  contactName: string | null;
  priority: number;
  isActive: boolean;
};

function Submit({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      <Save size={16} /> {pending ? 'Salvando...' : editing ? 'Salvar regra' : 'Criar regra'}
    </button>
  );
}

export function RulesManager({
  rules,
  options,
  canManage,
}: {
  rules: Rule[];
  options: {
    categories: Array<{ id: string; name: string; type: string; code: string | null }>;
    contacts: Array<{ id: string; name: string }>;
  };
  canManage: boolean;
}) {
  const [state, action] = useActionState<RuleState, FormData>(saveRuleAction, undefined);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [open, setOpen] = useState(false);

  const startEdit = (rule: Rule) => {
    setEditing(rule);
    setOpen(true);
  };
  const startNew = () => {
    setEditing(null);
    setOpen(true);
  };

  return (
    <div className="space-y-5">
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}

      {canManage && !open && (
        <button type="button" onClick={startNew} className="btn-primary">
          <Plus size={16} /> Nova regra
        </button>
      )}

      {open && canManage && (
        <Card
          title={editing ? `Editar regra "${editing.name}"` : 'Nova regra'}
          actions={
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm" aria-label="Fechar">
              <X size={15} />
            </button>
          }
        >
          <form action={action} className="space-y-4" key={editing?.id ?? 'new'}>
            {editing && <input type="hidden" name="id" value={editing.id} />}

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome da regra" htmlFor="name" required>
                <input id="name" name="name" required defaultValue={editing?.name} className="input" placeholder="Tarifas bancarias" />
              </Field>

              <Field
                label="Texto no historico"
                htmlFor="pattern"
                required
                hint="Basta um trecho: 'tarifa' casa com 'TARIFA PACOTE DE SERVICOS'."
              >
                <input id="pattern" name="pattern" required defaultValue={editing?.pattern} className="input" placeholder="tarifa" />
              </Field>

              <Field label="Aplicar em" htmlFor="direction">
                <select id="direction" name="direction" defaultValue={editing?.direction ?? ''} className="input">
                  <option value="">Entradas e saidas</option>
                  <option value="IN">Somente entradas</option>
                  <option value="OUT">Somente saidas</option>
                </select>
              </Field>

              <Field label="Prioridade" htmlFor="priority" hint="Maior numero e avaliado primeiro.">
                <input id="priority" name="priority" type="number" defaultValue={editing?.priority ?? 0} className="input" />
              </Field>

              <Field label="Valor minimo" htmlFor="minAmount">
                <input
                  id="minAmount"
                  name="minAmount"
                  inputMode="decimal"
                  defaultValue={editing?.minAmount ?? ''}
                  className="input"
                  placeholder="Sem minimo"
                />
              </Field>

              <Field label="Valor maximo" htmlFor="maxAmount">
                <input
                  id="maxAmount"
                  name="maxAmount"
                  inputMode="decimal"
                  defaultValue={editing?.maxAmount ?? ''}
                  className="input"
                  placeholder="Sem maximo"
                />
              </Field>

              <Field label="Categoria sugerida" htmlFor="categoryId">
                <select id="categoryId" name="categoryId" defaultValue={editing?.categoryId ?? ''} className="input">
                  <option value="">Nenhuma</option>
                  {options.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.code ? `${category.code} - ` : ''}{category.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Contato sugerido" htmlFor="contactId">
                <select id="contactId" name="contactId" defaultValue={editing?.contactId ?? ''} className="input">
                  <option value="">Nenhum</option>
                  {options.contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>{contact.name}</option>
                  ))}
                </select>
              </Field>
            </div>

            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={editing?.isActive ?? true}
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="font-medium text-ink-800">Regra ativa</span>
            </label>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancelar</button>
              <Submit editing={Boolean(editing)} />
            </div>
          </form>
        </Card>
      )}

      <Card bodyClassName={rules.length ? 'p-0' : 'p-5'}>
        {rules.length === 0 ? (
          <EmptyState
            title="Nenhuma regra cadastrada"
            description="Crie regras para os lancamentos que se repetem todo mes no extrato."
            action={canManage ? <button type="button" onClick={startNew} className="btn-primary btn-sm"><Plus size={14} /> Nova regra</button> : undefined}
          />
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[860px]">
              <thead>
                <tr>
                  <th>Regra</th>
                  <th>Texto procurado</th>
                  <th>Aplica em</th>
                  <th>Faixa de valor</th>
                  <th>Sugere</th>
                  <th className="num">Prioridade</th>
                  {canManage && <th className="w-20" aria-label="Acoes" />}
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} className={rule.isActive ? undefined : 'opacity-60'}>
                    <td className="font-medium text-ink-900">
                      {rule.name}
                      {!rule.isActive && <span className="ml-2"><Pill>Inativa</Pill></span>}
                    </td>
                    <td><code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs">{rule.pattern}</code></td>
                    <td className="text-ink-600">
                      {rule.direction === 'IN' ? 'Entradas' : rule.direction === 'OUT' ? 'Saidas' : 'Ambos'}
                    </td>
                    <td className="text-xs text-ink-600">
                      {rule.minAmount == null && rule.maxAmount == null
                        ? 'Qualquer valor'
                        : `${rule.minAmount != null ? formatCurrency(rule.minAmount) : '-'} a ${rule.maxAmount != null ? formatCurrency(rule.maxAmount) : '-'}`}
                    </td>
                    <td className="text-xs text-ink-600">
                      {rule.categoryName ?? '-'}
                      {rule.contactName && <span className="block">{rule.contactName}</span>}
                    </td>
                    <td className="num">{rule.priority}</td>
                    {canManage && (
                      <td>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => startEdit(rule)} className="btn-ghost btn-sm">
                            Editar
                          </button>
                          <form action={deleteRuleAction}>
                            <input type="hidden" name="id" value={rule.id} />
                            <button type="submit" className="btn-ghost btn-sm text-red-600" aria-label="Excluir regra">
                              <Trash2 size={14} />
                            </button>
                          </form>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
