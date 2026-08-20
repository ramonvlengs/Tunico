'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { CheckCircle2 } from 'lucide-react';
import { settleEntryAction, type FormState } from '@/app/actions/finance';
import { Alert, Field } from '@/components/ui/primitives';
import { formatCurrency, round2, toDateInput } from '@/lib/utils';

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      <CheckCircle2 size={16} />
      {pending ? 'Registrando...' : label}
    </button>
  );
}

/** Formulario de baixa com calculo ao vivo do valor liquido. */
export function SettlePanel({
  entryId,
  openAmount,
  defaultBankAccountId,
  accounts,
  methods,
  label,
}: {
  entryId: string;
  openAmount: number;
  defaultBankAccountId: string | null;
  accounts: Array<{ id: string; name: string }>;
  methods: Array<{ id: string; name: string; bankAccountId: string | null }>;
  label: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(settleEntryAction, undefined);
  const [amount, setAmount] = useState(String(openAmount.toFixed(2)).replace('.', ','));
  const [discount, setDiscount] = useState('');
  const [interest, setInterest] = useState('');
  const [fine, setFine] = useState('');
  const [fee, setFee] = useState('');

  const toNumber = (value: string) => {
    const parsed = Number(value.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const summary = useMemo(() => {
    const paid = toNumber(amount);
    const principal = round2(paid + toNumber(discount) - toNumber(interest) - toNumber(fine));
    return {
      principal,
      remaining: round2(openAmount - principal),
      cash: round2(paid - toNumber(fee)),
    };
  }, [amount, discount, interest, fine, fee, openAmount]);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="entryId" value={entryId} />

      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}

      <Field label="Valor" htmlFor="settle-amount" required>
        <input
          id="settle-amount"
          name="amount"
          required
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="input"
        />
      </Field>

      <Field label="Data" htmlFor="settle-date" required>
        <input id="settle-date" name="paidAt" type="date" required defaultValue={toDateInput(new Date())} className="input" />
      </Field>

      <Field label="Conta" htmlFor="settle-account" required>
        <select id="settle-account" name="bankAccountId" required defaultValue={defaultBankAccountId ?? ''} className="input">
          <option value="">Selecione a conta</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Forma de pagamento" htmlFor="settle-method">
        <select id="settle-method" name="paymentMethodId" className="input">
          <option value="">Nao informada</option>
          {methods.map((method) => (
            <option key={method.id} value={method.id}>
              {method.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Desconto" htmlFor="settle-discount">
          <input
            id="settle-discount"
            name="discount"
            inputMode="decimal"
            value={discount}
            onChange={(event) => setDiscount(event.target.value)}
            className="input"
            placeholder="0,00"
          />
        </Field>
        <Field label="Juros" htmlFor="settle-interest">
          <input
            id="settle-interest"
            name="interest"
            inputMode="decimal"
            value={interest}
            onChange={(event) => setInterest(event.target.value)}
            className="input"
            placeholder="0,00"
          />
        </Field>
        <Field label="Multa" htmlFor="settle-fine">
          <input
            id="settle-fine"
            name="fine"
            inputMode="decimal"
            value={fine}
            onChange={(event) => setFine(event.target.value)}
            className="input"
            placeholder="0,00"
          />
        </Field>
        <Field label="Taxa/tarifa" htmlFor="settle-fee" hint="Nao abate o titulo.">
          <input
            id="settle-fee"
            name="fee"
            inputMode="decimal"
            value={fee}
            onChange={(event) => setFee(event.target.value)}
            className="input"
            placeholder="0,00"
          />
        </Field>
      </div>

      <dl className="space-y-1 rounded-lg bg-ink-50 p-3 text-xs">
        <div className="flex justify-between">
          <dt className="text-ink-600">Abate do titulo</dt>
          <dd className="font-medium tabular-nums text-ink-900">{formatCurrency(summary.principal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-600">Restara em aberto</dt>
          <dd
            className={`font-medium tabular-nums ${summary.remaining > 0.004 ? 'text-amber-600' : summary.remaining < -0.004 ? 'text-red-600' : 'text-emerald-600'}`}
          >
            {formatCurrency(Math.max(0, summary.remaining))}
            {summary.remaining < -0.004 && ' (excede o saldo)'}
          </dd>
        </div>
        <div className="flex justify-between border-t border-ink-200 pt-1">
          <dt className="text-ink-600">Impacto no caixa</dt>
          <dd className="font-semibold tabular-nums text-ink-900">{formatCurrency(summary.cash)}</dd>
        </div>
      </dl>

      <Field label="Observacao" htmlFor="settle-notes">
        <input id="settle-notes" name="notes" className="input" placeholder="Opcional" />
      </Field>

      <Submit label={`Registrar ${label.toLowerCase()}`} />
    </form>
  );
}
