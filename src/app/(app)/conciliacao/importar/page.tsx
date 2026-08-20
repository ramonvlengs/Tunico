import Link from 'next/link';
import { ArrowLeft, FileText, FileSpreadsheet, FileType, Info } from 'lucide-react';
import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { Alert, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { ImportForm } from './import-form';

export const metadata = { title: 'Importar extrato' };
export const dynamic = 'force-dynamic';

const FORMATS = [
  {
    icon: FileText,
    title: 'OFX / QFX',
    tone: 'text-emerald-600',
    badge: 'Recomendado',
    text: 'Formato oficial de troca bancaria. Traz um identificador unico por lancamento (FITID), o que elimina qualquer risco de duplicidade e garante os sinais corretos de entrada e saida.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Excel e CSV',
    tone: 'text-sky-600',
    text: 'Aceita .xlsx, .xls e .csv. O sistema localiza a linha de cabecalho e mapeia sozinho as colunas de data, historico, valor, documento e saldo - inclusive quando debito e credito vem em colunas separadas.',
  },
  {
    icon: FileType,
    title: 'PDF',
    tone: 'text-amber-600',
    badge: 'Requer conferencia',
    text: 'Le o texto do PDF e reconhece as linhas de lancamento. Como o PDF nao tem estrutura padronizada, o sinal (entrada ou saida) e deduzido pelo historico - confira antes de conciliar. PDFs escaneados (imagem) nao podem ser lidos.',
  },
];

export default async function ImportPage() {
  const ctx = await requireContext();
  const accounts = await prisma.bankAccount.findMany({
    where: { companyId: ctx.company.id, isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, bankName: true, color: true },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 no-print">
        <Link href="/conciliacao" className="btn-ghost btn-sm -ml-2">
          <ArrowLeft size={14} /> Voltar para a conciliacao
        </Link>
      </div>

      <PageHeader
        title="Importar extrato bancario"
        description="Envie o arquivo exportado do seu internet banking. Lancamentos ja importados sao detectados e ignorados automaticamente."
      />

      {accounts.length === 0 ? (
        <Card>
          <EmptyState
            title="Cadastre uma conta bancaria primeiro"
            description="A importacao precisa saber a qual conta o extrato pertence."
            action={<Link href="/financeiro/contas/nova" className="btn-primary btn-sm">Cadastrar conta</Link>}
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Card title="Arquivo do extrato">
              <ImportForm accounts={accounts} />
            </Card>
          </div>

          <div className="space-y-4 lg:col-span-2">
            <Card title="Formatos aceitos">
              <ul className="space-y-4">
                {FORMATS.map((format) => (
                  <li key={format.title} className="flex gap-3">
                    <format.icon size={20} className={`mt-0.5 shrink-0 ${format.tone}`} />
                    <div>
                      <p className="flex items-center gap-2 text-sm font-medium text-ink-900">
                        {format.title}
                        {format.badge && (
                          <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-600">
                            {format.badge}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{format.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <Alert tone="info" title="Sem risco de duplicar">
              Cada lancamento recebe uma assinatura calculada a partir da conta, data, valor e historico (ou do FITID,
              no OFX). Reimportar o mesmo periodo nao duplica nada.
            </Alert>
          </div>
        </div>
      )}
    </div>
  );
}
