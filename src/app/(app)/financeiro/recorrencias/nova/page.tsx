import { requireContext } from '@/lib/tenant';
import { getFormOptions } from '@/server/entry-query';
import { PageHeader } from '@/components/ui/primitives';
import { RecurrenceForm } from '../recurrence-form';

export const metadata = { title: 'Nova recorrencia' };
export const dynamic = 'force-dynamic';

export default async function NewRecurrencePage() {
  const ctx = await requireContext();
  const options = await getFormOptions(ctx.company.id);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Nova recorrencia" description="Configure o modelo do lancamento que se repete." />
      <RecurrenceForm options={options} />
    </div>
  );
}
