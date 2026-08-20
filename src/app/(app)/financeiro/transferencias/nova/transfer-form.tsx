'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { ArrowLeftRight } from 'lucide-react';
import { saveTransferAction, type FormState } from '@/app/actions/finance';
import { Alert, Card, Field } from '@/components/ui/primitives';
import { formatCurrency, toDateInput } from '@/lib/utils';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      <ArrowLeftRight size={16} /> {pending ? 'Transferindo...' : 'Registrar transferencia'}
    </button>
  );
}

export function TransferForm({
  accounts,
}: {
  accounts: Array<{ id: string; name: string; balance: number }>;
}) {
  const [state, action] = useActionState<FormState, FormData>(saveTransferAction, undefined);
  const [from, setFrom] = useState(accounts[0]?.id ?? '');
  const [to, setTo] = useState(accounts[1]?.id ?? '');
  const fromAccount = accounts.find((a) => a.id === from);

  return (
    <form action={action} className="space-y-5">
      {state?.error && <Alert tone="danger">{state.error}</Alert>}

      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Conta de origem"
            htmlFor="fromAccountId"
            required
            hint={fromAccount ? `Saldo atual: ${formatCurrency(fromAccount.balance)}` : undefined}
          >
            <select
              id="fromAccountId"
              name="fromAccountId"
              required
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="input"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Conta de destino" htmlFor="toAccountId" required>
            <select
              id="toAccountId"
              name="toAccountId"
              required
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="input"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id} disabled={account.id === from}>
                  {account.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Valor" htmlFor="amount" required>
            <input id="amount" name="amount" required inputMode="decimal" className="input" placeholder="0,00" />
          </Field>

          <Field label="Data" htmlFor="date" required>
            <input id="date" name="date" type="date" required defaultValue={toDateInput(new Date())} className="input" />
          </Field>

          <Field label="Tarifa cobrada" htmlFor="fee" hint="Debitada da conta de origem, alem do valor.">
            <input id="fee" name="fee" inputMode="decimal" className="input" placeholder="0,00" />
          </Field>

          <Field label="Descricao" htmlFor="description">
            <input id="description" name="description" className="input" placeholder="Repasse do Mercado Pago" />
          </Field>
        </div>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Link href="/financeiro/transferencias" className="btn-secondary">Cancelar</Link>
        <Submit />
      </div>
    </form>
  );
}
