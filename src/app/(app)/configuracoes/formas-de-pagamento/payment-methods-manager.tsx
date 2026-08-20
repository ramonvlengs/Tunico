'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { deletePaymentMethodAction, savePaymentMethodAction, type FormState } from '@/app/actions/registry';
import { Alert, Card, EmptyState, Field, Pill } from '@/components/ui/primitives';
import { PAYMENT_METHOD_TYPES } from '@/lib/constants';
import { formatCurrency, formatPercent } from '@/lib/utils';

type Method = {
  id: string; name: string; type: string; feePercent: number; feeFixed: number;
  settlementDays: number; bankAccountId: string | null; bankAccountName: string | null;
  isActive: boolean; usageCount: number;
};

function Submit({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      <Save size={16} /> {pending ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}
    </button>
  );
}

export function PaymentMethodsManager({
  methods,
  accounts,
  canManage,
}: {
  methods: Method[];
  accounts: Array<{ id: string; name: string }>;
  canManage: boolean;
}) {
  const [state, action] = useActionState<FormState, FormData>(savePaymentMethodAction, undefined);
  const [editing, setEditing] = useState<Method | null>(null);
  const [open, setOpen] = useState(false);

  const typeLabel = (value: string) => PAYMENT_METHOD_TYPES.find((t) => t.value === value)?.label ?? value;

  return (
    <div className="space-y-5">
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}

      {canManage && !open && (
        <button type="button" onClick={() => { setEditing(null); setOpen(true); }} className="btn-primary">
          <Plus size={16} /> Nova forma de pagamento
        </button>
      )}

      {open && canManage && (
        <Card
          title={editing ? `Editar "${editing.name}"` : 'Nova forma de pagamento'}
          actions={
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm" aria-label="Fechar">
              <X size={15} />
            </button>
          }
        >
          <form action={action} className="space-y-4" key={editing?.id ?? 'new'}>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Nome" htmlFor="name" required>
                <input id="name" name="name" required defaultValue={editing?.name} className="input" placeholder="Cartao de credito" />
              </Field>

              <Field label="Tipo" htmlFor="type" required>
                <select id="type" name="type" defaultValue={editing?.type ?? 'PIX'} className="input">
                  {PAYMENT_METHOD_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Conta de destino" htmlFor="bankAccountId">
                <select id="bankAccountId" name="bankAccountId" defaultValue={editing?.bankAccountId ?? ''} className="input">
                  <option value="">Nao definida</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Taxa (%)" htmlFor="feePercent">
                <input
                  id="feePercent"
                  name="feePercent"
                  inputMode="decimal"
                  defaultValue={editing ? String(editing.feePercent).replace('.', ',') : '0'}
                  className="input"
                />
              </Field>

              <Field label="Taxa fixa (R$)" htmlFor="feeFixed">
                <input
                  id="feeFixed"
                  name="feeFixed"
                  inputMode="decimal"
                  defaultValue={editing ? String(editing.feeFixed).replace('.', ',') : '0'}
                  className="input"
                />
              </Field>

              <Field label="Prazo de recebimento (dias)" htmlFor="settlementDays">
                <input
                  id="settlementDays"
                  name="settlementDays"
                  type="number"
                  min={0}
                  defaultValue={editing?.settlementDays ?? 0}
                  className="input"
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
              <span className="font-medium text-ink-800">Ativa</span>
            </label>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancelar</button>
              <Submit editing={Boolean(editing)} />
            </div>
          </form>
        </Card>
      )}

      <Card bodyClassName={methods.length ? 'p-0' : 'p-5'}>
        {methods.length === 0 ? (
          <EmptyState title="Nenhuma forma de pagamento cadastrada" />
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[780px]">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Conta de destino</th>
                  <th className="num">Taxa</th>
                  <th className="num">Prazo</th>
                  <th className="num">Usos</th>
                  {canManage && <th className="w-28" aria-label="Acoes" />}
                </tr>
              </thead>
              <tbody>
                {methods.map((method) => (
                  <tr key={method.id} className={method.isActive ? undefined : 'opacity-60'}>
                    <td className="font-medium text-ink-900">
                      {method.name}
                      {!method.isActive && <span className="ml-2"><Pill>Inativa</Pill></span>}
                    </td>
                    <td className="text-ink-600">{typeLabel(method.type)}</td>
                    <td className="text-ink-600">{method.bankAccountName ?? '-'}</td>
                    <td className="num text-xs text-ink-600">
                      {method.feePercent > 0 && formatPercent(method.feePercent)}
                      {method.feePercent > 0 && method.feeFixed > 0 && ' + '}
                      {method.feeFixed > 0 && formatCurrency(method.feeFixed)}
                      {method.feePercent === 0 && method.feeFixed === 0 && 'Sem taxa'}
                    </td>
                    <td className="num text-ink-600">
                      {method.settlementDays === 0 ? 'Na hora' : `D+${method.settlementDays}`}
                    </td>
                    <td className="num">{method.usageCount}</td>
                    {canManage && (
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => { setEditing(method); setOpen(true); }}
                            className="btn-ghost btn-sm"
                          >
                            Editar
                          </button>
                          <form action={deletePaymentMethodAction}>
                            <input type="hidden" name="id" value={method.id} />
                            <button type="submit" className="btn-ghost btn-sm text-red-600" aria-label="Excluir">
                              <Trash2 size={13} />
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
