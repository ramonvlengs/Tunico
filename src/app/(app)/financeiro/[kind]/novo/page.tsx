import { requireContext } from '@/lib/tenant';
import { getFormOptions } from '@/server/entry-query';
import { PageHeader } from '@/components/ui/primitives';
import { resolveKind } from '../kind';
import { EntryForm } from '../entry-form';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ kind: string }> };

export async function generateMetadata({ params }: Props) {
  const { kind } = await params;
  return { title: resolveKind(kind).newLabel };
}

export default async function NewEntryPage({ params }: Props) {
  const { kind } = await params;
  const config = resolveKind(kind);
  const ctx = await requireContext();
  const options = await getFormOptions(ctx.company.id);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={config.newLabel}
        description="Preencha os dados do titulo. Voce pode parcelar e as parcelas serao criadas automaticamente."
      />
      <EntryForm config={config} options={options} />
    </div>
  );
}
