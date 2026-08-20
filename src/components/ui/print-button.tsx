'use client';

import { Printer } from 'lucide-react';

/** Aciona a impressao do navegador (o CSS de impressao oculta a navegacao). */
export function PrintClient({ label = 'Imprimir' }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-secondary no-print">
      <Printer size={16} /> {label}
    </button>
  );
}
