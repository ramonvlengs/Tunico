'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useState, useEffect, useTransition } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Escreve/remove parametros na URL preservando os demais. */
export function useQueryState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') params.delete(key);
        else params.set(key, value);
      }
      // Qualquer mudanca de filtro volta para a primeira pagina.
      if (!('page' in updates)) params.delete('page');
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  return { params: searchParams, setParams, isPending };
}

export function SearchInput({ placeholder = 'Buscar...' }: { placeholder?: string }) {
  const { params, setParams } = useQueryState();
  const [value, setValue] = useState(params.get('q') ?? '');

  useEffect(() => {
    setValue(params.get('q') ?? '');
  }, [params]);

  // Debounce para nao disparar uma navegacao por tecla digitada.
  useEffect(() => {
    const current = params.get('q') ?? '';
    if (value === current) return;
    const timer = setTimeout(() => setParams({ q: value || null }), 350);
    return () => clearTimeout(timer);
  }, [value, params, setParams]);

  return (
    <div className="relative min-w-[200px] flex-1">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="input pl-9 pr-8"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-400 hover:bg-ink-100"
          aria-label="Limpar busca"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

export function SelectFilter({
  name,
  label,
  options,
  allLabel = 'Todos',
  className,
}: {
  name: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  allLabel?: string;
  className?: string;
}) {
  const { params, setParams } = useQueryState();
  const value = params.get(name) ?? '';

  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => setParams({ [name]: event.target.value || null })}
      className={cn('input w-auto min-w-[150px]', value && 'border-brand-400 bg-brand-50/50', className)}
    >
      <option value="">{allLabel}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function DateRangeFilter({ fromKey = 'from', toKey = 'to' }: { fromKey?: string; toKey?: string }) {
  const { params, setParams } = useQueryState();
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="date"
        aria-label="Data inicial"
        value={params.get(fromKey) ?? ''}
        onChange={(event) => setParams({ [fromKey]: event.target.value || null })}
        className="input w-auto"
      />
      <span className="text-xs text-ink-400">ate</span>
      <input
        type="date"
        aria-label="Data final"
        value={params.get(toKey) ?? ''}
        onChange={(event) => setParams({ [toKey]: event.target.value || null })}
        className="input w-auto"
      />
    </div>
  );
}

export function FilterBar({ children }: { children: React.ReactNode }) {
  const { params, setParams, isPending } = useQueryState();
  const active = Array.from(params.keys()).filter((key) => key !== 'page').length;

  return (
    <div className={cn('mb-4 flex flex-wrap items-center gap-2 no-print', isPending && 'opacity-60')}>
      <SlidersHorizontal size={16} className="hidden text-ink-400 sm:block" />
      {children}
      {active > 0 && (
        <button
          type="button"
          onClick={() =>
            setParams(Object.fromEntries(Array.from(params.keys()).map((key) => [key, null])))
          }
          className="btn-ghost btn-sm"
        >
          <X size={13} /> Limpar filtros ({active})
        </button>
      )}
    </div>
  );
}

export function Pagination({ page, pageCount, total }: { page: number; pageCount: number; total: number }) {
  const { setParams } = useQueryState();
  if (pageCount <= 1) {
    return (
      <p className="px-1 py-3 text-xs text-ink-500">
        {total} registro{total === 1 ? '' : 's'}
      </p>
    );
  }

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 px-1 py-3 no-print" aria-label="Paginacao">
      <p className="text-xs text-ink-500">
        Pagina {page} de {pageCount} &middot; {total} registros
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="btn-secondary btn-sm"
          disabled={page <= 1}
          onClick={() => setParams({ page: String(page - 1) })}
        >
          Anterior
        </button>
        <button
          type="button"
          className="btn-secondary btn-sm"
          disabled={page >= pageCount}
          onClick={() => setParams({ page: String(page + 1) })}
        >
          Proxima
        </button>
      </div>
    </nav>
  );
}
