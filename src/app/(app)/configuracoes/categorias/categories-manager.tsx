'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ChevronRight, Plus, Save, Trash2, X } from 'lucide-react';
import { deleteCategoryAction, saveCategoryAction, type FormState } from '@/app/actions/registry';
import { Alert, Card, Field, Pill } from '@/components/ui/primitives';
import { DRE_GROUPS } from '@/lib/constants';
import { cn } from '@/lib/utils';

type Category = {
  id: string; parentId: string | null; code: string | null; name: string;
  type: string; dreGroup: string | null; color: string | null; isActive: boolean;
  entryCount: number; childCount: number;
};

function Submit({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      <Save size={16} /> {pending ? 'Salvando...' : editing ? 'Salvar' : 'Criar categoria'}
    </button>
  );
}

export function CategoriesManager({
  categories,
  canManage,
}: {
  categories: Category[];
  canManage: boolean;
}) {
  const [state, action] = useActionState<FormState, FormData>(saveCategoryAction, undefined);
  const [editing, setEditing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);
  const [defaultType, setDefaultType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');

  const tree = useMemo(() => {
    const parents = categories.filter((category) => !category.parentId);
    return parents.map((parent) => ({
      parent,
      children: categories.filter((category) => category.parentId === parent.id),
    }));
  }, [categories]);

  const groupLabel = (value: string | null) =>
    DRE_GROUPS.find((group) => group.value === value)?.label ?? 'Nao classificado';

  const startNew = (type: 'INCOME' | 'EXPENSE') => {
    setEditing(null);
    setDefaultType(type);
    setOpen(true);
  };

  const sections = [
    { type: 'INCOME' as const, title: 'Receitas', tone: 'text-emerald-700' },
    { type: 'EXPENSE' as const, title: 'Despesas', tone: 'text-red-700' },
  ];

  return (
    <div className="space-y-5">
      {state?.error && <Alert tone="danger">{state.error}</Alert>}
      {state?.success && <Alert tone="success">{state.success}</Alert>}

      {open && canManage && (
        <Card
          title={editing ? `Editar "${editing.name}"` : 'Nova categoria'}
          actions={
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm" aria-label="Fechar">
              <X size={15} />
            </button>
          }
        >
          <form action={action} className="space-y-4" key={editing?.id ?? `new-${defaultType}`}>
            {editing && <input type="hidden" name="id" value={editing.id} />}

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Nome" htmlFor="name" required className="md:col-span-2">
                <input id="name" name="name" required defaultValue={editing?.name} className="input" />
              </Field>

              <Field label="Codigo" htmlFor="code" hint="Ex.: 4.04.01">
                <input id="code" name="code" defaultValue={editing?.code ?? ''} className="input" />
              </Field>

              <Field label="Tipo" htmlFor="type" required>
                <select id="type" name="type" defaultValue={editing?.type ?? defaultType} className="input">
                  <option value="INCOME">Receita</option>
                  <option value="EXPENSE">Despesa</option>
                </select>
              </Field>

              <Field label="Grupo na DRE" htmlFor="dreGroup">
                <select id="dreGroup" name="dreGroup" defaultValue={editing?.dreGroup ?? ''} className="input">
                  <option value="">Nao classificado</option>
                  {DRE_GROUPS.map((group) => (
                    <option key={group.value} value={group.value}>{group.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Categoria pai" htmlFor="parentId" hint="Deixe vazio para criar um grupo.">
                <select id="parentId" name="parentId" defaultValue={editing?.parentId ?? ''} className="input">
                  <option value="">Nenhuma (categoria raiz)</option>
                  {categories
                    .filter((category) => !category.parentId && category.id !== editing?.id)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.code ? `${category.code} - ` : ''}{category.name}
                      </option>
                    ))}
                </select>
              </Field>

              <Field label="Cor" htmlFor="color">
                <input id="color" name="color" type="color" defaultValue={editing?.color ?? '#64748b'} className="input h-[38px] p-1" />
              </Field>
            </div>

            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={editing?.isActive ?? true}
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="font-medium text-ink-800">Categoria ativa</span>
            </label>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancelar</button>
              <Submit editing={Boolean(editing)} />
            </div>
          </form>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {sections.map((section) => (
          <Card
            key={section.type}
            title={section.title}
            actions={
              canManage ? (
                <button type="button" onClick={() => startNew(section.type)} className="btn-secondary btn-sm">
                  <Plus size={13} /> Nova
                </button>
              ) : undefined
            }
            bodyClassName="p-0"
          >
            <ul className="divide-y divide-ink-100">
              {tree
                .filter(({ parent }) => parent.type === section.type)
                .map(({ parent, children }) => (
                  <li key={parent.id}>
                    <div className={cn('flex items-center gap-2 px-5 py-2.5', !parent.isActive && 'opacity-55')}>
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ background: parent.color ?? '#94a3b8' }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink-900">
                          {parent.code && <span className="mr-1.5 text-xs tabular-nums text-ink-400">{parent.code}</span>}
                          {parent.name}
                        </span>
                        <span className="block text-[11px] text-ink-500">{groupLabel(parent.dreGroup)}</span>
                      </span>
                      {!parent.isActive && <Pill>Inativa</Pill>}
                      {canManage && (
                        <span className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => { setEditing(parent); setOpen(true); }}
                            className="btn-ghost btn-sm"
                          >
                            Editar
                          </button>
                          <form action={deleteCategoryAction}>
                            <input type="hidden" name="id" value={parent.id} />
                            <button
                              type="submit"
                              className="btn-ghost btn-sm text-red-600"
                              aria-label={`Excluir ${parent.name}`}
                              title={
                                parent.entryCount > 0 || parent.childCount > 0
                                  ? 'Categoria em uso: sera apenas inativada'
                                  : 'Excluir'
                              }
                            >
                              <Trash2 size={13} />
                            </button>
                          </form>
                        </span>
                      )}
                    </div>

                    {children.length > 0 && (
                      <ul className="bg-ink-50/40">
                        {children.map((child) => (
                          <li
                            key={child.id}
                            className={cn('flex items-center gap-2 px-5 py-2 pl-10', !child.isActive && 'opacity-55')}
                          >
                            <ChevronRight size={12} className="shrink-0 text-ink-300" />
                            <span className="min-w-0 flex-1 truncate text-[13px] text-ink-700">
                              {child.code && <span className="mr-1.5 text-xs tabular-nums text-ink-400">{child.code}</span>}
                              {child.name}
                            </span>
                            <span className="shrink-0 text-[11px] tabular-nums text-ink-400">
                              {child.entryCount} lanc.
                            </span>
                            {canManage && (
                              <span className="flex shrink-0 items-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => { setEditing(child); setOpen(true); }}
                                  className="btn-ghost btn-sm"
                                >
                                  Editar
                                </button>
                                <form action={deleteCategoryAction}>
                                  <input type="hidden" name="id" value={child.id} />
                                  <button
                                    type="submit"
                                    className="btn-ghost btn-sm text-red-600"
                                    aria-label={`Excluir ${child.name}`}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </form>
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
