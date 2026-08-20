import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { requireContext } from '@/lib/tenant';
import { ROLE_LABELS } from '@/lib/permissions';
import { Card, PageHeader } from '@/components/ui/primitives';

export const metadata = { title: 'Acesso negado' };
export const dynamic = 'force-dynamic';

export default async function ForbiddenPage() {
  const ctx = await requireContext();

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Acesso negado" />
      <Card>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <ShieldAlert size={40} className="text-amber-500" />
          <div>
            <p className="text-sm font-medium text-ink-900">
              Voce nao tem permissao para acessar esta area.
            </p>
            <p className="mt-1.5 text-sm text-ink-500">
              Seu papel em <strong>{ctx.company.tradeName}</strong> e{' '}
              <strong>{ROLE_LABELS[ctx.role]}</strong>. Peca a um administrador da empresa para ajustar suas
              permissoes em Configuracoes &rsaquo; Usuarios.
            </p>
          </div>
          <Link href="/dashboard" className="btn-primary">Voltar ao painel</Link>
        </div>
      </Card>
    </div>
  );
}
