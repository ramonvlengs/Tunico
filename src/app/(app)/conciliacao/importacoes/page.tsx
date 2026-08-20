import Link from 'next/link';
import { Upload, Trash2, FileText, FileSpreadsheet, FileType } from 'lucide-react';
import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { deleteImportAction } from '@/app/actions/reconciliation';
import { formatDate, formatDateTime } from '@/lib/utils';
import { Card, EmptyState, PageHeader, Pill, StatusBadge } from '@/components/ui/primitives';

export const metadata = { title: 'Importacoes' };
export const dynamic = 'force-dynamic';

const ICONS: Record<string, typeof FileText> = {
  OFX: FileText,
  XLSX: FileSpreadsheet,
  CSV: FileSpreadsheet,
  PDF: FileType,
};

export default async function ImportsPage() {
  const ctx = await requireContext();
  const imports = await prisma.bankImport.findMany({
    where: { companyId: ctx.company.id },
    include: {
      bankAccount: { select: { name: true, color: true } },
      user: { select: { name: true } },
      _count: { select: { bankTransactions: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const reconciledCounts = await prisma.bankTransaction.groupBy({
    by: ['importId'],
    where: { companyId: ctx.company.id, status: 'RECONCILED' },
    _count: true,
  });
  const reconciledMap = new Map(reconciledCounts.map((row) => [row.importId, row._count]));

  return (
    <>
      <PageHeader
        title="Historico de importacoes"
        description="Todos os extratos ja enviados, com o resultado da leitura de cada arquivo."
      >
        <Link href="/conciliacao/importar" className="btn-primary">
          <Upload size={16} /> Importar extrato
        </Link>
      </PageHeader>

      <Card bodyClassName={imports.length ? 'p-0' : 'p-5'}>
        {imports.length === 0 ? (
          <EmptyState
            title="Nenhuma importacao realizada"
            description="Assim que voce importar um extrato, ele aparece aqui com o resumo da leitura."
            action={<Link href="/conciliacao/importar" className="btn-primary btn-sm">Importar extrato</Link>}
          />
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[980px]">
              <thead>
                <tr>
                  <th>Arquivo</th>
                  <th>Conta</th>
                  <th>Periodo</th>
                  <th className="num">Lidos</th>
                  <th className="num">Importados</th>
                  <th className="num">Duplicados</th>
                  <th className="num">Conciliados</th>
                  <th>Enviado por</th>
                  {ctx.can('reconciliation.manage') && <th className="w-10" aria-label="Acoes" />}
                </tr>
              </thead>
              <tbody>
                {imports.map((item) => {
                  const Icon = ICONS[item.fileType] ?? FileText;
                  const reconciled = reconciledMap.get(item.id) ?? 0;
                  return (
                    <tr key={item.id}>
                      <td>
                        <span className="flex items-start gap-2">
                          <Icon size={16} className="mt-0.5 shrink-0 text-ink-400" />
                          <span className="min-w-0">
                            <span className="block max-w-[260px] truncate font-medium text-ink-900" title={item.fileName}>
                              {item.fileName}
                            </span>
                            <span className="block text-xs text-ink-500">
                              {item.fileType} · {(item.fileSize / 1024).toFixed(0)} KB · {formatDateTime(item.createdAt)}
                            </span>
                            {item.message && <span className="block text-xs text-amber-600">{item.message}</span>}
                          </span>
                        </span>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          <span className="h-2 w-2 rounded-full" style={{ background: item.bankAccount.color }} />
                          {item.bankAccount.name}
                        </span>
                      </td>
                      <td className="whitespace-nowrap text-xs text-ink-600">
                        {item.periodStart ? `${formatDate(item.periodStart)} a ${formatDate(item.periodEnd)}` : '-'}
                      </td>
                      <td className="num">{item.parsedCount}</td>
                      <td className="num font-medium text-emerald-600">{item.importedCount}</td>
                      <td className="num text-ink-500">{item.duplicateCount}</td>
                      <td className="num">
                        {reconciled}/{item._count.bankTransactions}
                      </td>
                      <td className="text-xs text-ink-600">{item.user?.name ?? '-'}</td>
                      {ctx.can('reconciliation.manage') && (
                        <td>
                          {reconciled === 0 ? (
                            <form action={deleteImportAction}>
                              <input type="hidden" name="id" value={item.id} />
                              <button
                                type="submit"
                                className="btn-ghost btn-sm text-red-600"
                                title="Remover esta importacao e seus lancamentos pendentes"
                                aria-label="Remover importacao"
                              >
                                <Trash2 size={14} />
                              </button>
                            </form>
                          ) : (
                            <span title="Ha lancamentos conciliados nesta importacao">
                              <Pill tone="positive">Em uso</Pill>
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
