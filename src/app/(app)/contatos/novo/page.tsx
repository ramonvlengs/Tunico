import { requireContext } from '@/lib/tenant';
import { PageHeader } from '@/components/ui/primitives';
import { ContactForm } from '../contact-form';

export const metadata = { title: 'Novo contato' };

export default async function NewContactPage() {
  await requireContext();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Novo contato" description="Cliente, fornecedor ou colaborador." />
      <ContactForm />
    </div>
  );
}
