import { cn } from '@/lib/utils';

/**
 * Marca do sistema. O arquivo /brand/logo.svg reproduz a identidade da
 * Tunico TCG; para usar a arte oficial em bitmap basta substituir esse SVG
 * (ou apontar para /brand/logo.png) mantendo a proporcao 1:1.
 */
export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/logo.svg"
      alt="TunicoTCG Control"
      width={size}
      height={size}
      className={cn('shrink-0 rounded-full', className)}
    />
  );
}

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/icon.svg"
      alt=""
      width={size}
      height={size}
      className={cn('shrink-0 rounded-lg', className)}
    />
  );
}

export function Wordmark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoMark size={compact ? 28 : 34} />
      {!compact && (
        <span className="leading-none">
          <span className="block text-[15px] font-bold tracking-tight text-white">
            TunicoTCG <span className="text-brand-300">Control</span>
          </span>
          <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.18em] text-brand-200/70">
            Gestao financeira
          </span>
        </span>
      )}
    </span>
  );
}
