'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownLeft, ArrowUpRight, Check, ChevronDown, EyeOff, Link2, Plus, RotateCcw, Sparkles,
} from 'lucide-react';
import {
  createAndReconcileAction, ignoreTransactionAction, reconcileAction,
  restoreIgnoredAction, undoReconciliationAction,
} from '@/app/actions/reconciliation';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { Money, Pill, StatusBadge } from '@/components/ui/primitives';

type Suggestion = {
  entryId: string;
  score: number;
  reasons: string[];
  entry: {
    id: string;
    description: string;
    dueDate: Date;
    amount: number;
    paidAmount: number;
    kind: string;
    contactName: string | null;
    categoryName: string | null;
  };
};

export type ReconTransaction = {
  id: string;
  date: Date;
  amount: number;
  direction: string;
  description: string;
  memo: string | null;
  status: string;
  notes: string | null;
  accountName: string;
  accountColor: string;
  matches: Array<{
    id: string;
    method: string;
    entryId: string;
    entryKind: string;
    entryDescription: string;
  }>;
};

/**
 * Linha da tela de conciliacao. Mostra a movimentacao do extrato e, ao lado,
 * as sugestoes de lancamento com a pontuacao de aderencia. Tres caminhos:
 * vincular a um lancamento existente, criar um novo ja quitado, ou ignorar.
 */
export function TransactionRow({
  transaction,
  suggestions,
  options,
  canManage,
}: {
  transaction: ReconTransaction;
  suggestions: Suggestion[];
  options: {
    categories: Array<{ id: string; name: string; type: string; code: string | null }>;
    contacts: Array<{ id: string; name: string; kind: string }>;
    costCenters: Array<{ id: string; name: string }>;
  };
  canManage: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isIn = transaction.direction === 'IN';
  const categoryType = isIn ? 'INCOME' : 'EXPENSE';
  const visibleSuggestions = expanded ? suggestions : suggestions.slice(0, 2);

  return (
    <article
      className={cn(
        'card overflow-hidden transition',
        transaction.status === 'RECONCILED' && 'border-emerald-200 bg-emerald-50/30',
        transaction.status === 'IGNORED' && 'opacity-70',
      )}
    >
      <div className="flex flex-col gap-4 p-4 lg:flex-row">
        {/* Lado esquerdo: a movimentacao do banco */}
        <div className="flex min-w-0 flex-1 items-start gap-3 lg:max-w-sm">
          <span
            className={cn(
              'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
              isIn ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
            )}
            aria-hidden
          >
            {isIn ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-ink-900" title={transaction.description}>
              {transaction.description}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-500">
              <span>{formatDate(transaction.date)}</span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: transaction.accountColor }} />
                {transaction.accountName}
              </span>
            </p>
            {transaction.memo && <p className="mt-1 truncate text-xs text-ink-400">{transaction.memo}</p>}
            <Money value={transaction.amount} signed className="mt-1.5 block text-lg font-semibold" />
          </div>
        </div>

        {/* Lado direito: acoes */}
        <div className="min-w-0 flex-1 border-t border-ink-100 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          {transaction.status === 'RECONCILED' ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                <Check size={16} /> Conciliado
              </span>
              {transaction.matches.map((match) => (
                <Link
                  key={match.id}
                  href={`/financeiro/${match.entryKind === 'RECEIVABLE' ? 'receber' : 'pagar'}/${match.entryId}`}
                  className="link truncate text-sm"
                >
                  {match.entryDescription}
                </Link>
              ))}
              {transaction.matches[0]?.method === 'AUTO' && <Pill tone="brand">Sugestao automatica</Pill>}
              {transaction.matches[0]?.method === 'CREATED' && <Pill>Lancamento criado aqui</Pill>}
              {canManage && (
                <form action={undoReconciliationAction} className="ml-auto">
                  <input type="hidden" name="bankTransactionId" value={transaction.id} />
                  <button type="submit" className="btn-ghost btn-sm text-red-600">
                    <RotateCcw size={13} /> Desfazer
                  </button>
                </form>
              )}
            </div>
          ) : transaction.status === 'IGNORED' ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5 text-sm text-ink-600">
                <EyeOff size={16} /> Ignorado{transaction.notes ? `: ${transaction.notes}` : ''}
              </span>
              {canManage && (
                <form action={restoreIgnoredAction} className="ml-auto">
                  <input type="hidden" name="bankTransactionId" value={transaction.id} />
                  <button type="submit" className="btn-ghost btn-sm">
                    <RotateCcw size={13} /> Voltar para pendentes
                  </button>
                </form>
              )}
            </div>
          ) : creating ? (
            <CreateEntryForm
              transaction={transaction}
              options={options}
              categoryType={categoryType}
              onCancel={() => setCreating(false)}
            />
          ) : (
            <div className="space-y-2">
              {suggestions.length > 0 ? (
                <>
                  <p className="flex items-center gap-1.5 text-xs font-medium text-ink-600">
                    <Sparkles size={13} className="text-brand-600" />
                    {suggestions.length} sugestao(oes) de vinculo
                  </p>
                  <ul className="space-y-1.5">
                    {visibleSuggestions.map((suggestion) => (
                      <li
                        key={suggestion.entryId}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2"
                      >
                        <span className="min-w-0 flex-1">
                          <Link
                            href={`/financeiro/${suggestion.entry.kind === 'RECEIVABLE' ? 'receber' : 'pagar'}/${suggestion.entry.id}`}
                            className="block truncate text-sm font-medium text-ink-900 hover:text-brand-700"
                          >
                            {suggestion.entry.description}
                          </Link>
                          <span className="block truncate text-xs text-ink-500">
                            Vence {formatDate(suggestion.entry.dueDate)} ·{' '}
                            {formatCurrency(suggestion.entry.amount - suggestion.entry.paidAmount)} em aberto
                            {suggestion.entry.contactName && ` · ${suggestion.entry.contactName}`}
                          </span>
                          {suggestion.reasons.length > 0 && (
                            <span className="mt-1 flex flex-wrap gap-1">
                              {suggestion.reasons.map((reason) => (
                                <span key={reason} className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-600">
                                  {reason}
                                </span>
                              ))}
                            </span>
                          )}
                        </span>

                        <ScoreBadge score={suggestion.score} />

                        {canManage && (
                          <form action={reconcileAction}>
                            <input type="hidden" name="bankTransactionId" value={transaction.id} />
                            <input type="hidden" name="entryId" value={suggestion.entryId} />
                            <input type="hidden" name="score" value={suggestion.score} />
                            <button type="submit" className="btn-primary btn-sm">
                              <Link2 size={13} /> Vincular
                            </button>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                  {suggestions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setExpanded((value) => !value)}
                      className="btn-ghost btn-sm"
                    >
                      <ChevronDown size={13} className={cn('transition', expanded && 'rotate-180')} />
                      {expanded ? 'Mostrar menos' : `Ver mais ${suggestions.length - 2} sugestao(oes)`}
                    </button>
                  )}
                </>
              ) : (
                <p className="text-xs text-ink-500">
                  Nenhum lancamento em aberto compativel com esta movimentacao.
                </p>
              )}

              {canManage && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button type="button" onClick={() => setCreating(true)} className="btn-secondary btn-sm">
                    <Plus size={13} /> Criar lancamento
                  </button>
                  <form action={ignoreTransactionAction}>
                    <input type="hidden" name="bankTransactionId" value={transaction.id} />
                    <button type="submit" className="btn-ghost btn-sm">
                      <EyeOff size={13} /> Ignorar
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 85 ? 'bg-emerald-100 text-emerald-700'
    : score >= 65 ? 'bg-amber-100 text-amber-700'
    : 'bg-ink-100 text-ink-600';
  return (
    <span className={cn('badge shrink-0 tabular-nums', tone)} title="Aderencia calculada por valor, data e historico">
      {Math.round(score)}%
    </span>
  );
}

function CreateEntryForm({
  transaction,
  options,
  categoryType,
  onCancel,
}: {
  transaction: ReconTransaction;
  options: {
    categories: Array<{ id: string; name: string; type: string; code: string | null }>;
    contacts: Array<{ id: string; name: string; kind: string }>;
    costCenters: Array<{ id: string; name: string }>;
  };
  categoryType: 'INCOME' | 'EXPENSE';
  onCancel: () => void;
}) {
  const categories = options.categories.filter((category) => category.type === categoryType);

  return (
    <form action={createAndReconcileAction} className="space-y-2.5">
      <input type="hidden" name="bankTransactionId" value={transaction.id} />
      <p className="text-xs font-medium text-ink-600">
        Cria um lancamento de {formatCurrency(Math.abs(transaction.amount))} ja quitado em{' '}
        {formatDate(transaction.date)} e vincula a esta movimentacao.
      </p>

      <div>
        <label className="label" htmlFor={`desc-${transaction.id}`}>Descricao</label>
        <input
          id={`desc-${transaction.id}`}
          name="description"
          defaultValue={transaction.description}
          required
          className="input"
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor={`cat-${transaction.id}`}>Categoria</label>
          <select id={`cat-${transaction.id}`} name="categoryId" className="input">
            <option value="">Sem categoria</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.code ? `${category.code} - ` : ''}{category.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`con-${transaction.id}`}>Contato</label>
          <select id={`con-${transaction.id}`} name="contactId" className="input">
            <option value="">Nao informado</option>
            {options.contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>{contact.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`cc-${transaction.id}`}>Centro de custo</label>
          <select id={`cc-${transaction.id}`} name="costCenterId" className="input">
            <option value="">Nao informado</option>
            {options.costCenters.map((costCenter) => (
              <option key={costCenter.id} value={costCenter.id}>{costCenter.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button type="submit" className="btn-primary btn-sm">
          <Check size={13} /> Criar e conciliar
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost btn-sm">
          Cancelar
        </button>
      </div>
    </form>
  );
}
