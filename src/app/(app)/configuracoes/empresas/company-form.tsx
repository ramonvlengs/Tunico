'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Save } from 'lucide-react';
import { saveCompanyAction, type CompanyState } from '@/app/actions/company';
import { Alert, Card, Field } from '@/components/ui/primitives';
import { TAX_REGIMES, UFS } from '@/lib/constants';
import { formatDocument } from '@/lib/utils';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      <Save size={16} /> {pending ? 'Salvando...' : 'Salvar empresa'}
    </button>
  );
}

export type CompanyValues = {
  id: string; corporateName: string; tradeName: string; cnpj: string;
  stateReg: string | null; cityReg: string | null; taxRegime: string;
  email: string | null; phone: string | null; website: string | null;
  zipCode: string | null; street: string | null; number: string | null;
  complement: string | null; district: string | null; city: string | null;
  state: string | null; color: string; isActive: boolean;
};

export function CompanyForm({ company }: { company?: CompanyValues }) {
  const [state, action] = useActionState<CompanyState, FormData>(saveCompanyAction, undefined);

  return (
    <form action={action} className="space-y-5">
      {company && <input type="hidden" name="id" value={company.id} />}
      {state?.error && <Alert tone="danger">{state.error}</Alert>}

      <Card title="Dados cadastrais">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Razao social" htmlFor="corporateName" required className="md:col-span-2">
            <input
              id="corporateName"
              name="corporateName"
              required
              defaultValue={company?.corporateName}
              className="input"
              placeholder="Tunico TCG Comercio de Cards LTDA"
            />
          </Field>

          <Field label="Nome fantasia" htmlFor="tradeName" required hint="Nome exibido no seletor de empresas.">
            <input id="tradeName" name="tradeName" required defaultValue={company?.tradeName} className="input" />
          </Field>

          <Field label="CNPJ" htmlFor="cnpj" required>
            <input
              id="cnpj"
              name="cnpj"
              required
              defaultValue={formatDocument(company?.cnpj)}
              className="input"
              inputMode="numeric"
              placeholder="00.000.000/0001-00"
            />
          </Field>

          <Field label="Inscricao estadual" htmlFor="stateReg">
            <input id="stateReg" name="stateReg" defaultValue={company?.stateReg ?? ''} className="input" />
          </Field>

          <Field label="Inscricao municipal" htmlFor="cityReg">
            <input id="cityReg" name="cityReg" defaultValue={company?.cityReg ?? ''} className="input" />
          </Field>

          <Field label="Regime tributario" htmlFor="taxRegime">
            <select id="taxRegime" name="taxRegime" defaultValue={company?.taxRegime ?? 'SIMPLES_NACIONAL'} className="input">
              {TAX_REGIMES.map((regime) => (
                <option key={regime.value} value={regime.value}>{regime.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Cor de identificacao" htmlFor="color" hint="Usada nos indicadores desta empresa.">
            <input id="color" name="color" type="color" defaultValue={company?.color ?? '#16a34a'} className="input h-[38px] p-1" />
          </Field>
        </div>
      </Card>

      <Card title="Contato">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="E-mail" htmlFor="email">
            <input id="email" name="email" type="email" defaultValue={company?.email ?? ''} className="input" />
          </Field>
          <Field label="Telefone" htmlFor="phone">
            <input id="phone" name="phone" defaultValue={company?.phone ?? ''} className="input" />
          </Field>
          <Field label="Site" htmlFor="website">
            <input id="website" name="website" defaultValue={company?.website ?? ''} className="input" placeholder="https://" />
          </Field>
        </div>
      </Card>

      <Card title="Endereco">
        <div className="grid gap-4 md:grid-cols-6">
          <Field label="CEP" htmlFor="zipCode" className="md:col-span-2">
            <input id="zipCode" name="zipCode" defaultValue={company?.zipCode ?? ''} className="input" />
          </Field>
          <Field label="Logradouro" htmlFor="street" className="md:col-span-3">
            <input id="street" name="street" defaultValue={company?.street ?? ''} className="input" />
          </Field>
          <Field label="Numero" htmlFor="number">
            <input id="number" name="number" defaultValue={company?.number ?? ''} className="input" />
          </Field>
          <Field label="Complemento" htmlFor="complement" className="md:col-span-2">
            <input id="complement" name="complement" defaultValue={company?.complement ?? ''} className="input" />
          </Field>
          <Field label="Bairro" htmlFor="district" className="md:col-span-2">
            <input id="district" name="district" defaultValue={company?.district ?? ''} className="input" />
          </Field>
          <Field label="Cidade" htmlFor="city">
            <input id="city" name="city" defaultValue={company?.city ?? ''} className="input" />
          </Field>
          <Field label="UF" htmlFor="state">
            <select id="state" name="state" defaultValue={company?.state ?? ''} className="input">
              <option value="">-</option>
              {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </Field>
        </div>

        <label className="mt-4 flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={company?.isActive ?? true}
            className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="font-medium text-ink-800">Empresa ativa</span>
        </label>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Link href="/configuracoes/empresas" className="btn-secondary">Cancelar</Link>
        <Submit />
      </div>
    </form>
  );
}
