import { notFound } from 'next/navigation';
import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/primitives';
import { ContactForm } from '../../contact-form';

export const metadata = { title: 'Editar contato' };
export const dynamic = 'force-dynamic';

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const contact = await prisma.contact.findFirst({ where: { id, companyId: ctx.company.id } });
  if (!contact) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={`Editar ${contact.name}`} />
      <ContactForm contact={contact} />
    </div>
  );
}
