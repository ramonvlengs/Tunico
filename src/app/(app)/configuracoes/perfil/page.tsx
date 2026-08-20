import { requireContext } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { formatDateTime, formatDocument } from '@/lib/utils';
import { ROLE_LABELS } from '@/lib/permissions';
import { Card, PageHeader, Pill } from '@/components/ui/primitives';
import { ProfileForms } from './profile-forms';

export const metadata = { title: 'Meu perfil' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const ctx = await requireContext();
  const user = await prisma.user.findUnique({ where: { id: ctx.user.id } });
  if (!user) return null;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Meu perfil" description="Seus dados de acesso ao TunicoTCG Control." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ProfileForms name={user.name} email={user.email} phone={user.phone} />
        </div>

        <div className="space-y-6">
          <Card title="Suas empresas">
            <ul className="space-y-3">
              {ctx.companies.map((company) => (
                <li key={company.id} className="flex items-start gap-2.5">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: company.color }} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink-900">
                      {company.tradeName}
                      {company.id === ctx.company.id && (
                        <span className="ml-1.5 text-[11px] font-normal text-brand-600">(ativa)</span>
                      )}
                    </span>
                    <span className="block text-xs tabular-nums text-ink-500">{formatDocument(company.cnpj)}</span>
                    <span className="mt-1 inline-block"><Pill>{ROLE_LABELS[company.role]}</Pill></span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Conta">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-ink-500">E-mail de acesso</dt>
                <dd className="text-ink-900">{user.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">Ultimo acesso</dt>
                <dd className="text-ink-900">
                  {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Este e o primeiro'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">Cadastrado em</dt>
                <dd className="text-ink-900">{formatDateTime(user.createdAt)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
