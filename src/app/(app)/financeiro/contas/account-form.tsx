'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Save, Trash2 } from 'lucide-react';
import { deleteBankAccountAction, saveBankAccountAction, type FormState } from '@/app/actions/registry';
import { Alert, Card, Field } from '@/components/ui/primitives';
import { BANK_ACCOUNT_TYPES, BRAZILIAN_BANKS } from '@/lib/constants';
import { toDateInput } from '@/lib/utils';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      <Save size={16} /> {pending ? 'Salvando...' : 'Salvar conta'}
    </button>
  );
}

export function AccountForm({
  account,
  canDelete,
}: {
  account?: {
    id: string; name: string; type: string; bankCode: string | null; bankName: string | null;
    agency: string | null; accountNumber: string | null; pixKey: string | null;
    initialBalance: number; openingDate: Date | null; color: string;
    includeInCash: boolean; isActive: boolean;
  };
  canDelete?: boolean;
}) {
  const [state, action] = useActionState<FormState, FormData>(saveBankAccountAction, undefined);
  const [type, setType] = useState(account?.type ?? 'CHECKING');
  const [bankCode, setBankCode] = useState(account?.bankCode ?? '');
  const needsBank = !['CASH'].includes(type);

  return (
    <form action={action} className="space-y-5">
      {account && <input type="hidden" name="id" value={account.id} />}
      {state?.error && <Alert tone="danger">{state.error}</Alert>}

      <Card title="Identificacao">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome da conta" htmlFor="name" required hint="Como voce quer ver essa conta nas listagens.">
            <input id="name" name="name" required defaultValue={account?.name} className="input" placeholder="Itau - Conta corrente" />
          </Field>

          <Field label="Tipo" htmlFor="type" required>
            <select id="type" name="type" value={type} onChange={(e) => setType(e.target.value)} className="input">
              {BANK_ACCOUNT_TYPES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>

          {needsBank && (
            <>
              <Field label="Banco" htmlFor="bankCode">
                <select
                  id="bankCode"
                  name="bankCode"
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value)}
                  className="input"
                >
                  <option value="">Selecione o banco</option>
                  {BRAZILIAN_BANKS.map((bank) => (
                    <option key={bank.code} value={bank.code}>{bank.code} - {bank.name}</option>
                  ))}
                </select>
                <input
                  type="hidden"
                  name="bankName"
                  value={BRAZILIAN_BANKS.find((b) => b.code === bankCode)?.name ?? account?.bankName ?? ''}
                />
              </Field>

              <Field label="Chave PIX" htmlFor="pixKey">
                <input id="pixKey" name="pixKey" defaultValue={account?.pixKey ?? ''} className="input" placeholder="cnpj@empresa.com.br" />
              </Field>

              <Field label="Agencia" htmlFor="agency">
                <input id="agency" name="agency" defaultValue={account?.agency ?? ''} className="input" placeholder="1234" />
              </Field>

              <Field label="Conta" htmlFor="accountNumber">
                <input id="accountNumber" name="accountNumber" defaultValue={account?.accountNumber ?? ''} className="input" placeholder="56789-0" />
              </Field>
            </>
          )}
        </div>
      </Card>

      <Card title="Saldo e comportamento">
        <div className="grid gap-4 md:grid-cols-3">
          <Field
            label="Saldo inicial"
            htmlFor="initialBalance"
            hint="Saldo da conta na data de abertura no sistema."
          >
            <input
              id="initialBalance"
              name="initialBalance"
              inputMode="decimal"
              defaultValue={account ? String(account.initialBalance).replace('.', ',') : '0,00'}
              className="input"
            />
          </Field>

          <Field label="Data de abertura" htmlFor="openingDate">
            <input
              id="openingDate"
              name="openingDate"
              type="date"
              defaultValue={toDateInput(account?.openingDate ?? new Date())}
              className="input"
            />
          </Field>

          <Field label="Cor de identificacao" htmlFor="color">
            <input id="color" name="color" type="color" defaultValue={account?.color ?? '#16a34a'} className="input h-[38px] p-1" />
          </Field>
        </div>

        <div className="mt-4 space-y-2.5">
          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              name="includeInCash"
              defaultChecked={account?.includeInCash ?? true}
              className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            <span>
              <span className="font-medium text-ink-800">Somar no saldo em caixa</span>
              <span className="block text-xs text-ink-500">
                Desmarque para contas de investimento ou cartao de credito, que nao devem entrar no caixa disponivel.
              </span>
            </span>
          </label>

          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={account?.isActive ?? true}
              className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="font-medium text-ink-800">Conta ativa</span>
          </label>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {account && canDelete && (
          <form action={deleteBankAccountAction} className="mr-auto">
            <input type="hidden" name="id" value={account.id} />
            <button type="submit" className="btn-secondary text-red-600">
              <Trash2 size={16} /> Excluir conta
            </button>
          </form>
        )}
        <Link href="/financeiro/contas" className="btn-secondary">Cancelar</Link>
        <Submit />
      </div>
    </form>
  );
}
