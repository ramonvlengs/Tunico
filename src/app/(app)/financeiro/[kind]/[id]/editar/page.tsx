import { notFound } from 'next/navigation';
import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { getFormOptions } from '@/server/entry-query';
import { PageHeader } from '@/components/ui/primitives';
import { resolveKind } from '../../kind';
import { EntryForm } from '../../entry-form';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ kind: string; id: string }> };

export default async function EditEntryPage({ params }: Props) {
  const { kind: slug, id } = await params;
  const config = resolveKind(slug);
  const ctx = await requireContext();

  const entry = await prisma.financialEntry.findFirst({
    where: { id, companyId: ctx.company.id, kind: config.kind },
  });
  if (!entry) notFound();

  const options = await getFormOptions(ctx.company.id);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Editar lancamento"
        description="Alteracoes de valor exigem que as baixas ja registradas caibam no novo total."
      />
      <EntryForm
        config={config}
        options={options}
        values={{
          id: entry.id,
          description: entry.description.replace(/\s\(\d+\/\d+\)$/, ''),
          amount: entry.amount,
          dueDate: entry.dueDate,
          issueDate: entry.issueDate,
          competenceDate: entry.competenceDate,
          contactId: entry.contactId,
          categoryId: entry.categoryId,
          costCenterId: entry.costCenterId,
          bankAccountId: entry.bankAccountId,
          documentNumber: entry.documentNumber,
          notes: entry.notes,
          tags: entry.tags,
        }}
      />
    </div>
  );
}
