import Link from 'next/link';
import { Building2, Check, Plus, Power } from 'lucide-react';
import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { switchCompanyAction } from '@/app/actions/auth';
import { deactivateCompanyAction, reactivateCompanyAction } from '@/app/actions/company';
import { formatDocument, initials } from '@/lib/utils';
import { ROLE_LABELS, type Role } from '@/lib/permissions';
import { TAX_REGIMES } from '@/lib/constants';
import { Alert, Card, PageHeader, Pill } from '@/components/ui/primitives';

export const metadata = { title: 'Empresas' };
export const dynamic = 'force-dynamic';

export default async function CompaniesPage() {
  const ctx = await requireContext();

  const memberships = await prisma.membership.findMany({
    where: { userId: ctx.user.id },
    include: {
      company: {
        include: {
          _count: { select: { contacts: true, entries: true, bankAccounts: true, memberships: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const regimeLabel = (value: string) => TAX_REGIMES.find((r) => r.value === value)?.label ?? value;

  return (
    <>
      <PageHeader
        title="Empresas do grupo"
        description="O TunicoTCG Control opera varios CNPJs no mesmo login. Cada empresa tem plano de contas, contas bancarias, estoque e financeiro totalmente separados."
      >
        <Link href="/configuracoes/empresas/nova" className="btn-primary">
          <Plus size={16} /> Nova empresa
        </Link>
      </PageHeader>

      <div className="mb-5">
        <Alert tone="info" title="Isolamento de dados">
          Nenhuma consulta cruza empresas: todo lancamento, produto e extrato pertence a um unico CNPJ. Use o seletor
          no topo do menu lateral para alternar.
        </Alert>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {memberships.map(({ company, role }) => {
          const isCurrent = company.id === ctx.company.id;
          return (
            <div
              key={company.id}
              className={`card overflow-hidden ${isCurrent ? 'ring-2 ring-brand-500' : ''} ${company.isActive ? '' : 'opacity-60'}`}
            >
              <div className="h-1.5" style={{ background: company.color }} />
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                    style={{ background: company.color }}
                  >
                    {initials(company.tradeName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-ink-900">{company.tradeName}</h3>
                    <p className="truncate text-xs text-ink-500">{company.corporateName}</p>
                    <p className="mt-0.5 text-xs tabular-nums text-ink-600">{formatDocument(company.cnpj)}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {isCurrent && <Pill tone="brand"><Check size={11} /> Empresa ativa</Pill>}
                  {!company.isActive && <Pill tone="negative">Desativada</Pill>}
                  <Pill>{ROLE_LABELS[role as Role]}</Pill>
                  <Pill>{regimeLabel(company.taxRegime)}</Pill>
                </div>

                <dl className="mt-4 grid grid-cols-4 gap-2 border-t border-ink-100 pt-3 text-center text-xs">
                  <div>
                    <dt className="text-ink-500">Contatos</dt>
                    <dd className="font-semibold tabular-nums text-ink-900">{company._count.contacts}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-500">Lancam.</dt>
                    <dd className="font-semibold tabular-nums text-ink-900">{company._count.entries}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-500">Contas</dt>
                    <dd className="font-semibold tabular-nums text-ink-900">{company._count.bankAccounts}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-500">Usuarios</dt>
                    <dd className="font-semibold tabular-nums text-ink-900">{company._count.memberships}</dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap gap-2">
                  {!isCurrent && company.isActive && (
                    <form action={switchCompanyAction}>
                      <input type="hidden" name="companyId" value={company.id} />
                      <button type="submit" className="btn-primary btn-sm">
                        <Building2 size={13} /> Acessar
                      </button>
                    </form>
                  )}
                  {(role === 'OWNER' || role === 'ADMIN') && (
                    <Link href={`/configuracoes/empresas/${company.id}`} className="btn-secondary btn-sm">
                      Editar
                    </Link>
                  )}
                  {role === 'OWNER' && (
                    <form action={company.isActive ? deactivateCompanyAction : reactivateCompanyAction} className="ml-auto">
                      <input type="hidden" name="id" value={company.id} />
                      <button type="submit" className="btn-ghost btn-sm">
                        <Power size={13} /> {company.isActive ? 'Desativar' : 'Reativar'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
