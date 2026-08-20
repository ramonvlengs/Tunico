import { PageHeader } from '@/components/ui/primitives';
import { requireContext } from '@/lib/tenant';
import { AccountForm } from '../account-form';

export const metadata = { title: 'Nova conta' };

export default async function NewAccountPage() {
  await requireContext();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Nova conta"
        description="Cadastre um banco, uma carteira digital ou o caixa fisico da loja."
      />
      <AccountForm />
    </div>
  );
}
