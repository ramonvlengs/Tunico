import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { getFormOptions } from '@/server/entry-query';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, PageHeader, StatusBadge } from '@/components/ui/primitives';
import { RecurrenceForm } from '../recurrence-form';

export const metadata = { title: 'Editar recorrencia' };
export const dynamic = 'force-dynamic';

export default async function EditRecurrencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();

  const [recurrence, options] = await Promise.all([
    prisma.recurrence.findFirst({
      where: { id, companyId: ctx.company.id },
      include: { entries: { orderBy: { dueDate: 'desc' }, take: 12 } },
    }),
    getFormOptions(ctx.company.id),
  ]);
  if (!recurrence) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={recurrence.description} description="Editar modelo da recorrencia." />
      <RecurrenceForm options={options} values={recurrence} />

      {recurrence.entries.length > 0 && (
        <div className="mt-6">
          <Card title="Lancamentos ja gerados" bodyClassName="p-0">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Vencimento</th>
                    <th>Descricao</th>
                    <th>Situacao</th>
                    <th className="num">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {recurrence.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatDate(entry.dueDate)}</td>
                      <td>
                        <Link
                          href={`/financeiro/${entry.kind === 'RECEIVABLE' ? 'receber' : 'pagar'}/${entry.id}`}
                          className="link"
                        >
                          {entry.description}
                        </Link>
                      </td>
                      <td><StatusBadge status={entry.status} /></td>
                      <td className="num">{formatCurrency(entry.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
