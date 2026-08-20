import Link from 'next/link';
import { cn, formatCurrency } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Blocos de layout
// ---------------------------------------------------------------------------

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-500">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 no-print">{children}</div>}
    </div>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('card', className)}>
      {(title || actions) && (
        <header className="card-header">
          <div>
            {title && <h2 className="card-title">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-ink-500">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-ink-300 bg-ink-50/50 px-6 py-12 text-center">
      {icon && <div className="text-ink-400">{icon}</div>}
      <div>
        <p className="text-sm font-medium text-ink-800">{title}</p>
        {description && <p className="mt-1 max-w-md text-xs text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Indicadores
// ---------------------------------------------------------------------------

export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'positive' | 'negative' | 'warning' | 'brand';
  icon?: React.ReactNode;
  href?: string;
}) {
  const tones = {
    neutral: 'text-ink-900',
    positive: 'text-emerald-600',
    negative: 'text-red-600',
    warning: 'text-amber-600',
    brand: 'text-brand-700',
  } as const;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
        {icon && <span className="text-ink-300">{icon}</span>}
      </div>
      <p className={cn('mt-2 text-2xl font-semibold tabular-nums tracking-tight', tones[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="card block p-5 transition hover:border-brand-300 hover:shadow-pop">
        {body}
      </Link>
    );
  }
  return <div className="card p-5">{body}</div>;
}

export function Money({
  value,
  signed = false,
  className,
}: {
  value: number;
  signed?: boolean;
  className?: string;
}) {
  const tone = value > 0 ? 'text-emerald-600' : value < 0 ? 'text-red-600' : 'text-ink-500';
  return (
    <span className={cn('tabular-nums', signed && tone, className)}>{formatCurrency(value)}</span>
  );
}

// ---------------------------------------------------------------------------
// Badges de status
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-sky-100 text-sky-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  OVERDUE: 'bg-red-100 text-red-700',
  CANCELED: 'bg-ink-200 text-ink-600',
  PENDING: 'bg-amber-100 text-amber-700',
  RECONCILED: 'bg-emerald-100 text-emerald-700',
  IGNORED: 'bg-ink-200 text-ink-600',
  DRAFT: 'bg-ink-200 text-ink-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  BILLED: 'bg-brand-100 text-brand-800',
  DONE: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Em aberto',
  PARTIAL: 'Parcial',
  PAID: 'Liquidado',
  OVERDUE: 'Vencido',
  CANCELED: 'Cancelado',
  PENDING: 'Pendente',
  RECONCILED: 'Conciliado',
  IGNORED: 'Ignorado',
  DRAFT: 'Rascunho',
  APPROVED: 'Aprovado',
  BILLED: 'Faturado',
  DONE: 'Concluido',
  PARTIALIMPORT: 'Parcial',
  FAILED: 'Falhou',
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={cn('badge', STATUS_STYLES[status] ?? 'bg-ink-200 text-ink-700')}>
      {label ?? STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function Pill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'brand' | 'positive' | 'negative' | 'warning';
}) {
  const tones = {
    neutral: 'bg-ink-100 text-ink-700',
    brand: 'bg-brand-100 text-brand-800',
    positive: 'bg-emerald-100 text-emerald-700',
    negative: 'bg-red-100 text-red-700',
    warning: 'bg-amber-100 text-amber-700',
  } as const;
  return <span className={cn('badge', tones[tone])}>{children}</span>;
}

// ---------------------------------------------------------------------------
// Formularios
// ---------------------------------------------------------------------------

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children?: React.ReactNode;
}) {
  const tones = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-red-200 bg-red-50 text-red-900',
  } as const;
  return (
    <div className={cn('rounded-lg border px-4 py-3 text-sm', tones[tone])}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={cn('text-[13px]', title && 'mt-1')}>{children}</div>}
    </div>
  );
}
