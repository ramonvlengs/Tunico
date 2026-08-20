import { requireContext } from '@/lib/tenant';
import { Alert, PageHeader } from '@/components/ui/primitives';
import { CompanyForm } from '../company-form';

export const metadata = { title: 'Nova empresa' };

export default async function NewCompanyPage() {
  await requireContext();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Nova empresa"
        description="Adicione outro CNPJ ao grupo. Voce sera o proprietario da nova empresa."
      />
      <div className="mb-5">
        <Alert tone="info">
          O plano de contas padrao, os centros de custo, as formas de pagamento e um caixa inicial serao criados
          automaticamente para a nova empresa.
        </Alert>
      </div>
      <CompanyForm />
    </div>
  );
}
