import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'TunicoTCG Control',
    template: '%s | TunicoTCG Control',
  },
  description:
    'ERP financeiro da Tunico TCG: multi-CNPJ, contas a pagar e receber, fluxo de caixa, DRE e conciliacao bancaria por OFX, Excel e PDF.',
  applicationName: 'TunicoTCG Control',
  icons: { icon: '/brand/icon.svg', apple: '/brand/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#16a34a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
