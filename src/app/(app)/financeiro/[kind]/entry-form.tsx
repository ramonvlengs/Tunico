'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Save } from 'lucide-react';
import { saveEntryAction, type FormState } from '@/app/actions/finance';
import { Alert, Card, Field } from '@/components/ui/primitives';
import { formatCurrency, toDateInput, addMonthsUTC, addDaysUTC, round2 } from '@/lib/utils';
import type { KindConfig } from './kind';

export type EntryFormOptions = {
  categories: Array<{ id: string; name: string; type: string; code: string | null; parentId: string | null }>;
  contacts: Array<{ id: string; name: string; kind: string }>;
  costCenters: Array<{ id: string; name: string }>;
  bankAccounts: Array<{ id: string; name: string }>;
};

export type EntryFormValues = {
  id?: string;
  description?: string;
  amount?: number;
  dueDate?: Date;
  issueDate?: Date;
  competenceDate?: Date;
  contactId?: string | null;
  categoryId?: string | null;
  costCenterId?: string | null;
  bankAccountId?: string | null;
  documentNumber?: string | null;
  notes?: string | null;
  tags?: string | null;
};

function Submit({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      <Save size={16} />
      {pending ? 'Salvando...' : editing ? 'Salvar alteracoes' : 'Criar lancamento'}
    </button>
  );
}

export function EntryForm({
  config,
  options,
  values,
}: {
  config: KindConfig;
  options: EntryFormOptions;
  values?: EntryFormValues;
}) {
  const [state, action] = useActionState<FormState, FormData>(saveEntryAction, undefined);
  const editing = Boolean(values?.id);

  const [amount, setAmount] = useState(values?.amount ? String(values.amount).replace('.', ',') : '');
  const [installments, setInstallments] = useState(1);
  const [mode, setMode] = useState<'MONTHLY' | 'DAYS'>('MONTHLY');
  const [intervalDays, setIntervalDays] = useState(30);
  const [dueDate, setDueDate] = useState(toDateInput(values?.dueDate ?? new Date()));

  const categories = useMemo(
    () => options.categories.filter((category) => category.type === config.categoryType),
    [options.categories, config.categoryType],
  );
  const contacts = useMemo(
    () => options.contacts.filter((contact) => config.contactKinds.includes(contact.kind)),
    [options.contacts, config.contactKinds],
  );

  // Previa das parcelas: mostra exatamente o que sera gravado.
  const preview = useMemo(() => {
    const total = Number(amount.replace(/\./g, '').replace(',', '.'));
    const base = dueDate ? new Date(`${dueDate}T00:00:00Z`) : null;
    if (!Number.isFinite(total) || total <= 0 || !base || installments < 2) return null;
    const per = round2(total / installments);
    return Array.from({ length: installments }, (_, index) => ({
      number: index + 1,
      amount: index === installments - 1 ? round2(total - per * (installments - 1)) : per,
      dueDate: mode === 'DAYS' ? addDaysUTC(base, intervalDays * index) : addMonthsUTC(base, index),
    }));
  }, [amount, dueDate, installments, mode, intervalDays]);

  return (
    <form action={action} className="space-y-5">
      {values?.id && <input type="hidden" name="id" value={values.id} />}
      <input type="hidden" name="kind" value={config.kind} />

      {state?.error && <Alert tone="danger">{state.error}</Alert>}

      <Card title="Dados do lancamento">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Descricao" htmlFor="description" required className="md:col-span-2">
            <input
              id="description"
              name="description"
              required
              defaultValue={values?.description}
              className="input"
              placeholder={config.kind === 'RECEIVABLE' ? 'Venda de singles - Lucas Andrade' : 'Aluguel da loja - agosto'}
            />
          </Field>

          <Field label="Valor total" htmlFor="amount" required hint="Use virgula para os centavos.">
            <input
              id="amount"
              name="amount"
              required
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="input"
              placeholder="0,00"
            />
          </Field>

          <Field label="Vencimento" htmlFor="dueDate" required>
            <input
              id="dueDate"
              name="dueDate"
              type="date"
              required
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="input"
            />
          </Field>

          <Field label={config.contactLabel} htmlFor="contactId">
            <select id="contactId" name="contactId" defaultValue={values?.contactId ?? ''} className="input">
              <option value="">Nao informado</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Categoria" htmlFor="categoryId" hint="Define o agrupamento na DRE e nos relatorios.">
            <select id="categoryId" name="categoryId" defaultValue={values?.categoryId ?? ''} className="input">
              <option value="">Sem categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.parentId ? '   ' : ''}
                  {category.code ? `${category.code} - ` : ''}
                  {category.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Centro de custo" htmlFor="costCenterId">
            <select id="costCenterId" name="costCenterId" defaultValue={values?.costCenterId ?? ''} className="input">
              <option value="">Nao informado</option>
              {options.costCenters.map((costCenter) => (
                <option key={costCenter.id} value={costCenter.id}>
                  {costCenter.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Conta prevista" htmlFor="bankAccountId" hint="Conta sugerida na hora da baixa.">
            <select id="bankAccountId" name="bankAccountId" defaultValue={values?.bankAccountId ?? ''} className="input">
              <option value="">Nao informada</option>
              {options.bankAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      {!editing && (
        <Card title="Parcelamento" description="Deixe em 1 para um lancamento unico.">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Numero de parcelas" htmlFor="installments">
              <input
                id="installments"
                name="installments"
                type="number"
                min={1}
                max={120}
                value={installments}
                onChange={(event) => setInstallments(Math.max(1, Number(event.target.value) || 1))}
                className="input"
              />
            </Field>

            <Field label="Intervalo" htmlFor="installmentMode">
              <select
                id="installmentMode"
                name="installmentMode"
                value={mode}
                onChange={(event) => setMode(event.target.value as 'MONTHLY' | 'DAYS')}
                className="input"
              >
                <option value="MONTHLY">Mensal (mesmo dia)</option>
                <option value="DAYS">A cada N dias</option>
              </select>
            </Field>

            {mode === 'DAYS' && (
              <Field label="Dias entre parcelas" htmlFor="installmentIntervalDays">
                <input
                  id="installmentIntervalDays"
                  name="installmentIntervalDays"
                  type="number"
                  min={1}
                  value={intervalDays}
                  onChange={(event) => setIntervalDays(Math.max(1, Number(event.target.value) || 30))}
                  className="input"
                />
              </Field>
            )}
          </div>

          {preview && (
            <div className="mt-4 rounded-lg border border-ink-200 bg-ink-50/60 p-3">
              <p className="mb-2 text-xs font-medium text-ink-600">
                Serao criadas {preview.length} parcelas:
              </p>
              <ul className="grid gap-1 text-xs text-ink-700 sm:grid-cols-2 lg:grid-cols-3">
                {preview.map((installment) => (
                  <li key={installment.number} className="flex justify-between gap-2 rounded bg-white px-2 py-1">
                    <span>
                      {installment.number}/{preview.length} &middot; {installment.dueDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                    </span>
                    <span className="font-medium tabular-nums">{formatCurrency(installment.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      <Card title="Informacoes complementares">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Numero do documento" htmlFor="documentNumber" hint="Nota fiscal, pedido ou boleto.">
            <input
              id="documentNumber"
              name="documentNumber"
              defaultValue={values?.documentNumber ?? ''}
              className="input"
              placeholder="NF-00123"
            />
          </Field>

          <Field label="Data de emissao" htmlFor="issueDate">
            <input
              id="issueDate"
              name="issueDate"
              type="date"
              defaultValue={toDateInput(values?.issueDate ?? new Date())}
              className="input"
            />
          </Field>

          <Field label="Competencia" htmlFor="competenceDate" hint="Mes em que a receita/despesa pertence na DRE.">
            <input
              id="competenceDate"
              name="competenceDate"
              type="date"
              defaultValue={toDateInput(values?.competenceDate ?? new Date())}
              className="input"
            />
          </Field>

          <Field label="Etiquetas" htmlFor="tags" className="md:col-span-1" hint="Separe por virgula.">
            <input id="tags" name="tags" defaultValue={values?.tags ?? ''} className="input" placeholder="live, pokemon" />
          </Field>

          <Field label="Observacoes" htmlFor="notes" className="md:col-span-2">
            <textarea id="notes" name="notes" rows={3} defaultValue={values?.notes ?? ''} className="input" />
          </Field>
        </div>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Link href={`/financeiro/${config.slug}`} className="btn-secondary">
          Cancelar
        </Link>
        <Submit editing={editing} />
      </div>
    </form>
  );
}
