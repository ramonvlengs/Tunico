'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Building2 } from 'lucide-react';
import { createFirstCompanyAction, type ActionState } from '@/app/actions/auth';
import { Alert, Field } from '@/components/ui/primitives';
import { TAX_REGIMES } from '@/lib/constants';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? 'Criando...' : (<><Building2 size={16} />Criar empresa e comecar</>)}
    </button>
  );
}

export function OnboardingForm() {
  const [state, action] = useActionState<ActionState, FormData>(createFirstCompanyAction, undefined);

  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert tone="danger">{state.error}</Alert>}

      <Field label="Razao social" htmlFor="corporateName" required>
        <input id="corporateName" name="corporateName" required className="input" placeholder="Tunico TCG Comercio de Cards LTDA" />
      </Field>

      <Field label="Nome fantasia" htmlFor="tradeName" required>
        <input id="tradeName" name="tradeName" required className="input" placeholder="Tunico TCG" />
      </Field>

      <Field label="CNPJ" htmlFor="cnpj" required hint="Somente numeros ou com pontuacao - validamos os digitos.">
        <input id="cnpj" name="cnpj" required className="input" placeholder="00.000.000/0001-00" inputMode="numeric" />
      </Field>

      <Field label="Regime tributario" htmlFor="taxRegime">
        <select id="taxRegime" name="taxRegime" className="input" defaultValue="SIMPLES_NACIONAL">
          {TAX_REGIMES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </Field>

      <Submit />
    </form>
  );
}
