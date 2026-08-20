'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { deleteCostCenterAction, saveCostCenterAction, type FormState } from '@/app/actions/registry';
import { Alert, Card, EmptyState, Field, Pill } from '@/components/ui/primitives';

type CostCenter = { id: string; code: string | null; name: string; isActive: boolean; entryCount: number };

function Submit({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      <Save size={16} /> {pending ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}
    </button>
  );
}

export function CostCentersManager({
  costCenters,
  canManage,
}: {
  costCenters: CostCenter[];
  canManage: boolean;
}) {
  const [state, action] = useActionState<FormState, FormData>(saveCostCenterAction, undefined);
  const [editing, setEditing] = useState<CostCenter | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-5">
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}

      {canManage && !open && (
        <button type="button" onClick={() => { setEditing(null); setOpen(true); }} className="btn-primary">
          <Plus size={16} /> Novo centro de custo
        </button>
      )}

      {open && canManage && (
        <Card
          title={editing ? `Editar "${editing.name}"` : 'Novo centro de custo'}
          actions={
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm" aria-label="Fechar">
              <X size={15} />
            </button>
          }
        >
          <form action={action} className="space-y-4" key={editing?.id ?? 'new'}>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Nome" htmlFor="name" required className="md:col-span-2">
                <input id="name" name="name" required defaultValue={editing?.name} className="input" placeholder="Loja fisica" />
              </Field>
              <Field label="Codigo" htmlFor="code">
                <input id="code" name="code" defaultValue={editing?.code ?? ''} className="input" placeholder="CC01" />
              </Field>
            </div>
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={editing?.isActive ?? true}
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="font-medium text-ink-800">Ativo</span>
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancelar</button>
              <Submit editing={Boolean(editing)} />
            </div>
          </form>
        </Card>
      )}

      <Card bodyClassName={costCenters.length ? 'p-0' : 'p-5'}>
        {costCenters.length === 0 ? (
          <EmptyState title="Nenhum centro de custo cadastrado" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Codigo</th>
                  <th>Nome</th>
                  <th className="num">Lancamentos</th>
                  {canManage && <th className="w-28" aria-label="Acoes" />}
                </tr>
              </thead>
              <tbody>
                {costCenters.map((costCenter) => (
                  <tr key={costCenter.id} className={costCenter.isActive ? undefined : 'opacity-60'}>
                    <td className="tabular-nums text-ink-500">{costCenter.code ?? '-'}</td>
                    <td className="font-medium text-ink-900">
                      {costCenter.name}
                      {!costCenter.isActive && <span className="ml-2"><Pill>Inativo</Pill></span>}
                    </td>
                    <td className="num">{costCenter.entryCount}</td>
                    {canManage && (
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => { setEditing(costCenter); setOpen(true); }}
                            className="btn-ghost btn-sm"
                          >
                            Editar
                          </button>
                          <form action={deleteCostCenterAction}>
                            <input type="hidden" name="id" value={costCenter.id} />
                            <button type="submit" className="btn-ghost btn-sm text-red-600" aria-label="Excluir">
                              <Trash2 size={13} />
                            </button>
                          </form>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
