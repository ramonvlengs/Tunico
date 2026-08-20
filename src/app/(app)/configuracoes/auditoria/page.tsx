import { requirePermission } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { formatDateTime } from '@/lib/utils';
import { Card, EmptyState, PageHeader, Pill } from '@/components/ui/primitives';
import { FilterBar, Pagination, SearchInput, SelectFilter } from '@/components/ui/filters';

export const metadata = { title: 'Auditoria' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Criacao',
  UPDATE: 'Alteracao',
  DELETE: 'Exclusao',
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  IMPORT: 'Importacao',
  SETTLE: 'Baixa',
  RECONCILE: 'Conciliacao',
};

const ACTION_TONES: Record<string, 'neutral' | 'brand' | 'positive' | 'negative' | 'warning'> = {
  CREATE: 'positive',
  UPDATE: 'brand',
  DELETE: 'negative',
  IMPORT: 'warning',
  SETTLE: 'positive',
  RECONCILE: 'brand',
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await searchParams;
  const get = (key: string) => {
    const value = search[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const ctx = await requirePermission('audit.read');
  const page = Math.max(1, Number(get('page') ?? '1') || 1);
  const action = get('action');
  const q = get('q');

  const where = {
    companyId: ctx.company.id,
    ...(action ? { action } : {}),
    ...(q ? { OR: [{ summary: { contains: q } }, { entity: { contains: q } }] } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return (
    <>
      <PageHeader
        title="Auditoria"
        description="Registro das acoes realizadas nesta empresa: quem fez, o que fez e quando."
      />

      <FilterBar>
        <SearchInput placeholder="Buscar por descricao ou entidade..." />
        <SelectFilter
          name="action"
          label="Acao"
          allLabel="Todas as acoes"
          options={Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </FilterBar>

      <Card bodyClassName="p-0">
        {logs.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Nenhum registro encontrado"
              description="As acoes realizadas no sistema aparecem aqui automaticamente."
            />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[720px]">
              <thead>
                <tr>
                  <th>Data e hora</th>
                  <th>Usuario</th>
                  <th>Acao</th>
                  <th>Entidade</th>
                  <th>Descricao</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap text-xs tabular-nums text-ink-600">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="text-ink-700">{log.user?.name ?? 'Sistema'}</td>
                    <td>
                      <Pill tone={ACTION_TONES[log.action] ?? 'neutral'}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </Pill>
                    </td>
                    <td className="text-xs text-ink-500">{log.entity}</td>
                    <td className="text-ink-800">{log.summary ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-ink-100 px-4">
          <Pagination page={page} pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))} total={total} />
        </div>
      </Card>
    </>
  );
}
