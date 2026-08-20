'use client';

import { useEffect, useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { settleManyAction } from '@/app/actions/finance';
import { toDateInput } from '@/lib/utils';

/**
 * Barra de baixa em lote. Fica dentro do <form> da listagem e observa os
 * checkboxes "ids" para so aparecer quando houver selecao.
 */
export function BulkSettleBar({
  accounts,
  label,
}: {
  accounts: Array<{ id: string; name: string }>;
  label: string;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => {
      const checked = document.querySelectorAll<HTMLInputElement>('input[name="ids"]:checked');
      setCount(checked.length);
    };
    document.addEventListener('change', update);
    return () => document.removeEventListener('change', update);
  }, []);

  if (accounts.length === 0) return null;

  return (
    <div
      className={cnBar(count > 0)}
      aria-hidden={count === 0}
    >
      <p className="text-sm font-medium text-ink-800">
        {count} lancamento{count === 1 ? '' : 's'} selecionado{count === 1 ? '' : 's'}
      </p>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="bulk-date">
          Data da baixa
        </label>
        <input
          id="bulk-date"
          type="date"
          name="paidAt"
          defaultValue={toDateInput(new Date())}
          className="input w-auto"
        />
        <label className="sr-only" htmlFor="bulk-account">
          Conta
        </label>
        <select id="bulk-account" name="bankAccountId" className="input w-auto" required>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
        <button type="submit" formAction={settleManyAction} className="btn-primary" disabled={count === 0}>
          <CheckCheck size={16} /> {label} selecionados
        </button>
      </div>
    </div>
  );
}

function cnBar(visible: boolean) {
  return [
    'flex flex-wrap items-center gap-3 border-t border-ink-200 bg-brand-50/60 px-4 py-3 transition no-print',
    visible ? 'opacity-100' : 'pointer-events-none hidden',
  ].join(' ');
}
