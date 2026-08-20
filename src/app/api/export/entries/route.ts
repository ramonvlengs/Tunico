import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireApiContext } from '@/lib/tenant';
import { buildEntryWhere, type EntryFilters } from '@/server/entry-query';
import { displayStatus, startOfToday } from '@/server/finance';
import { csvDate, csvNumber, csvResponse, toCsv } from '@/lib/csv';
import { ENTRY_STATUS_LABELS } from '@/server/finance';

export const dynamic = 'force-dynamic';

/** Exporta a listagem de contas a pagar/receber com os filtros da tela. */
export async function GET(request: NextRequest) {
  const auth = await requireApiContext();
  if (!auth.ok) return new Response(auth.error, { status: auth.status });
  const { ctx } = auth;
  if (!ctx.can('finance.read')) return new Response('Sem permissao', { status: 403 });

  const params = request.nextUrl.searchParams;
  const kind = params.get('kind') === 'PAYABLE' ? 'PAYABLE' : 'RECEIVABLE';

  const filters: EntryFilters = {
    q: params.get('q') ?? undefined,
    status: params.get('status') ?? undefined,
    categoryId: params.get('categoryId') ?? undefined,
    contactId: params.get('contactId') ?? undefined,
    costCenterId: params.get('costCenterId') ?? undefined,
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
    dateField: (params.get('dateField') as EntryFilters['dateField']) ?? undefined,
  };

  const entries = await prisma.financialEntry.findMany({
    where: buildEntryWhere(ctx.company.id, kind, filters),
    include: {
      contact: { select: { name: true, document: true } },
      category: { select: { name: true } },
      costCenter: { select: { name: true } },
      bankAccount: { select: { name: true } },
    },
    orderBy: { dueDate: 'asc' },
    take: 10000,
  });

  const today = startOfToday();
  const rows = entries.map((entry) => ({
    Vencimento: csvDate(entry.dueDate),
    Emissao: csvDate(entry.issueDate),
    Competencia: csvDate(entry.competenceDate),
    Descricao: entry.description,
    Contato: entry.contact?.name ?? '',
    'CPF/CNPJ': entry.contact?.document ?? '',
    Categoria: entry.category?.name ?? '',
    'Centro de custo': entry.costCenter?.name ?? '',
    Conta: entry.bankAccount?.name ?? '',
    Documento: entry.documentNumber ?? '',
    Parcela: `${entry.installment}/${entry.installments}`,
    Situacao: ENTRY_STATUS_LABELS[displayStatus(entry, today)] ?? entry.status,
    Valor: csvNumber(entry.amount),
    Baixado: csvNumber(entry.paidAmount),
    'Em aberto': csvNumber(entry.amount - entry.paidAmount),
    Observacoes: entry.notes ?? '',
  }));

  const fileName = `${kind === 'RECEIVABLE' ? 'contas-a-receber' : 'contas-a-pagar'}-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  return csvResponse(toCsv(rows), fileName);
}
