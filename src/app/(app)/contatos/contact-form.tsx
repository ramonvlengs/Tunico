'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Save } from 'lucide-react';
import { saveContactAction, type FormState } from '@/app/actions/registry';
import { Alert, Card, Field } from '@/components/ui/primitives';
import { CONTACT_KINDS, PERSON_TYPES, UFS } from '@/lib/constants';
import { formatDocument } from '@/lib/utils';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      <Save size={16} /> {pending ? 'Salvando...' : 'Salvar contato'}
    </button>
  );
}

export type ContactValues = {
  id: string; kind: string; personType: string; name: string; tradeName: string | null;
  document: string | null; stateReg: string | null; email: string | null; phone: string | null;
  whatsapp: string | null; zipCode: string | null; street: string | null; number: string | null;
  complement: string | null; district: string | null; city: string | null; state: string | null;
  notes: string | null; creditLimit: number; isActive: boolean;
};

export function ContactForm({ contact }: { contact?: ContactValues }) {
  const [state, action] = useActionState<FormState, FormData>(saveContactAction, undefined);
  const [personType, setPersonType] = useState(contact?.personType ?? 'PF');

  return (
    <form action={action} className="space-y-5">
      {contact && <input type="hidden" name="id" value={contact.id} />}
      {state?.error && <Alert tone="danger">{state.error}</Alert>}

      <Card title="Identificacao">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Tipo de cadastro" htmlFor="kind" required>
            <select id="kind" name="kind" defaultValue={contact?.kind ?? 'CUSTOMER'} className="input">
              {CONTACT_KINDS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Pessoa" htmlFor="personType" required>
            <select
              id="personType"
              name="personType"
              value={personType}
              onChange={(event) => setPersonType(event.target.value)}
              className="input"
            >
              {PERSON_TYPES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>

          <Field label={personType === 'PJ' ? 'Razao social' : 'Nome completo'} htmlFor="name" required className="md:col-span-2">
            <input id="name" name="name" required defaultValue={contact?.name} className="input" />
          </Field>

          {personType === 'PJ' && (
            <Field label="Nome fantasia" htmlFor="tradeName">
              <input id="tradeName" name="tradeName" defaultValue={contact?.tradeName ?? ''} className="input" />
            </Field>
          )}

          <Field
            label={personType === 'PJ' ? 'CNPJ' : 'CPF'}
            htmlFor="document"
            hint="Os digitos verificadores sao validados."
          >
            <input
              id="document"
              name="document"
              defaultValue={formatDocument(contact?.document)}
              className="input"
              inputMode="numeric"
              placeholder={personType === 'PJ' ? '00.000.000/0001-00' : '000.000.000-00'}
            />
          </Field>

          {personType === 'PJ' && (
            <Field label="Inscricao estadual" htmlFor="stateReg">
              <input id="stateReg" name="stateReg" defaultValue={contact?.stateReg ?? ''} className="input" />
            </Field>
          )}
        </div>
      </Card>

      <Card title="Contato">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="E-mail" htmlFor="email">
            <input id="email" name="email" type="email" defaultValue={contact?.email ?? ''} className="input" />
          </Field>
          <Field label="Telefone" htmlFor="phone">
            <input id="phone" name="phone" defaultValue={contact?.phone ?? ''} className="input" placeholder="(11) 99999-0000" />
          </Field>
          <Field label="WhatsApp" htmlFor="whatsapp">
            <input id="whatsapp" name="whatsapp" defaultValue={contact?.whatsapp ?? ''} className="input" />
          </Field>
        </div>
      </Card>

      <Card title="Endereco">
        <div className="grid gap-4 md:grid-cols-6">
          <Field label="CEP" htmlFor="zipCode" className="md:col-span-2">
            <input id="zipCode" name="zipCode" defaultValue={contact?.zipCode ?? ''} className="input" placeholder="00000-000" />
          </Field>
          <Field label="Logradouro" htmlFor="street" className="md:col-span-3">
            <input id="street" name="street" defaultValue={contact?.street ?? ''} className="input" />
          </Field>
          <Field label="Numero" htmlFor="number">
            <input id="number" name="number" defaultValue={contact?.number ?? ''} className="input" />
          </Field>
          <Field label="Complemento" htmlFor="complement" className="md:col-span-2">
            <input id="complement" name="complement" defaultValue={contact?.complement ?? ''} className="input" />
          </Field>
          <Field label="Bairro" htmlFor="district" className="md:col-span-2">
            <input id="district" name="district" defaultValue={contact?.district ?? ''} className="input" />
          </Field>
          <Field label="Cidade" htmlFor="city">
            <input id="city" name="city" defaultValue={contact?.city ?? ''} className="input" />
          </Field>
          <Field label="UF" htmlFor="state">
            <select id="state" name="state" defaultValue={contact?.state ?? ''} className="input">
              <option value="">-</option>
              {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </Field>
        </div>
      </Card>

      <Card title="Outras informacoes">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Limite de credito" htmlFor="creditLimit" hint="Apenas informativo, para consulta na venda.">
            <input
              id="creditLimit"
              name="creditLimit"
              inputMode="decimal"
              defaultValue={contact ? String(contact.creditLimit).replace('.', ',') : '0,00'}
              className="input"
            />
          </Field>
          <Field label="Observacoes" htmlFor="notes" className="md:col-span-2">
            <textarea id="notes" name="notes" rows={2} defaultValue={contact?.notes ?? ''} className="input" />
          </Field>
        </div>

        <label className="mt-4 flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={contact?.isActive ?? true}
            className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="font-medium text-ink-800">Contato ativo</span>
        </label>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Link href="/contatos" className="btn-secondary">Cancelar</Link>
        <Submit />
      </div>
    </form>
  );
}
