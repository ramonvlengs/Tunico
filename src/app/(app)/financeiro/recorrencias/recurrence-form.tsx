'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Save } from 'lucide-react';
import { saveRecurrenceAction, type FormState } from '@/app/actions/finance';
import { Alert, Card, Field } from '@/components/ui/primitives';
import { RECURRENCE_FREQUENCIES } from '@/lib/constants';
import { toDateInput } from '@/lib/utils';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      <Save size={16} /> {pending ? 'Salvando...' : 'Salvar recorrencia'}
    </button>
  );
}

export function RecurrenceForm({
  options,
  values,
}: {
  options: {
    categories: Array<{ id: string; name: string; type: string; code: string | null }>;
    contacts: Array<{ id: string; name: string }>;
    costCenters: Array<{ id: string; name: string }>;
    bankAccounts: Array<{ id: string; name: string }>;
  };
  values?: {
    id: string; kind: string; description: string; amount: number; frequency: string; interval: number;
    startDate: Date; endDate: Date | null; occurrences: number | null; isActive: boolean;
    contactId: string | null; categoryId: string | null; costCenterId: string | null; bankAccountId: string | null;
  };
}) {
  const [state, action] = useActionState<FormState, FormData>(saveRecurrenceAction, undefined);

  return (
    <form action={action} className="space-y-5">
      {values && <input type="hidden" name="id" value={values.id} />}
      {state?.error && <Alert tone="danger">{state.error}</Alert>}

      <Card title="O que se repete">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Tipo" htmlFor="kind" required>
            <select id="kind" name="kind" defaultValue={values?.kind ?? 'PAYABLE'} className="input">
              <option value="PAYABLE">Despesa recorrente (a pagar)</option>
              <option value="RECEIVABLE">Receita recorrente (a receber)</option>
            </select>
          </Field>

          <Field label="Valor" htmlFor="amount" required>
            <input
              id="amount"
              name="amount"
              required
              inputMode="decimal"
              defaultValue={values ? String(values.amount).replace('.', ',') : ''}
              className="input"
              placeholder="0,00"
            />
          </Field>

          <Field label="Descricao" htmlFor="description" required className="md:col-span-2">
            <input
              id="description"
              name="description"
              required
              defaultValue={values?.description}
              className="input"
              placeholder="Aluguel da loja"
            />
          </Field>

          <Field label="Contato" htmlFor="contactId">
            <select id="contactId" name="contactId" defaultValue={values?.contactId ?? ''} className="input">
              <option value="">Nao informado</option>
              {options.contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>{contact.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Categoria" htmlFor="categoryId">
            <select id="categoryId" name="categoryId" defaultValue={values?.categoryId ?? ''} className="input">
              <option value="">Sem categoria</option>
              {options.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.code ? `${category.code} - ` : ''}{category.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Centro de custo" htmlFor="costCenterId">
            <select id="costCenterId" name="costCenterId" defaultValue={values?.costCenterId ?? ''} className="input">
              <option value="">Nao informado</option>
              {options.costCenters.map((costCenter) => (
                <option key={costCenter.id} value={costCenter.id}>{costCenter.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Conta prevista" htmlFor="bankAccountId">
            <select id="bankAccountId" name="bankAccountId" defaultValue={values?.bankAccountId ?? ''} className="input">
              <option value="">Nao informada</option>
              {options.bankAccounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      <Card title="Quando se repete">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Frequencia" htmlFor="frequency" required>
            <select id="frequency" name="frequency" defaultValue={values?.frequency ?? 'MONTHLY'} className="input">
              {RECURRENCE_FREQUENCIES.map((frequency) => (
                <option key={frequency.value} value={frequency.value}>{frequency.label}</option>
              ))}
            </select>
          </Field>

          <Field label="A cada" htmlFor="interval" hint="1 = todo periodo; 2 = a cada dois periodos.">
            <input
              id="interval"
              name="interval"
              type="number"
              min={1}
              defaultValue={values?.interval ?? 1}
              className="input"
            />
          </Field>

          <Field label="Primeiro vencimento" htmlFor="startDate" required>
            <input
              id="startDate"
              name="startDate"
              type="date"
              required
              defaultValue={toDateInput(values?.startDate ?? new Date())}
              className="input"
            />
          </Field>

          <Field label="Encerrar em" htmlFor="endDate" hint="Deixe em branco para nao ter fim.">
            <input id="endDate" name="endDate" type="date" defaultValue={toDateInput(values?.endDate)} className="input" />
          </Field>

          <Field label="Numero de ocorrencias" htmlFor="occurrences" hint="Limite total de lancamentos gerados.">
            <input
              id="occurrences"
              name="occurrences"
              type="number"
              min={1}
              defaultValue={values?.occurrences ?? ''}
              className="input"
              placeholder="Ilimitado"
            />
          </Field>
        </div>

        <label className="mt-4 flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={values?.isActive ?? true}
            className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="font-medium text-ink-800">Recorrencia ativa</span>
        </label>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Link href="/financeiro/recorrencias" className="btn-secondary">Cancelar</Link>
        <Submit />
      </div>
    </form>
  );
}
