import { notFound } from 'next/navigation';

export type EntryKindSlug = 'receber' | 'pagar';

export type KindConfig = {
  slug: EntryKindSlug;
  kind: 'RECEIVABLE' | 'PAYABLE';
  title: string;
  singular: string;
  description: string;
  contactLabel: string;
  contactKinds: string[];
  categoryType: 'INCOME' | 'EXPENSE';
  settleLabel: string;
  newLabel: string;
  positive: boolean;
};

const CONFIG: Record<EntryKindSlug, KindConfig> = {
  receber: {
    slug: 'receber',
    kind: 'RECEIVABLE',
    title: 'Contas a receber',
    singular: 'Conta a receber',
    description: 'Titulos a receber de clientes, vendas e outras entradas.',
    contactLabel: 'Cliente',
    contactKinds: ['CUSTOMER', 'BOTH'],
    categoryType: 'INCOME',
    settleLabel: 'Receber',
    newLabel: 'Nova conta a receber',
    positive: true,
  },
  pagar: {
    slug: 'pagar',
    kind: 'PAYABLE',
    title: 'Contas a pagar',
    singular: 'Conta a pagar',
    description: 'Compromissos com fornecedores, impostos e despesas da operacao.',
    contactLabel: 'Fornecedor',
    contactKinds: ['SUPPLIER', 'BOTH', 'EMPLOYEE'],
    categoryType: 'EXPENSE',
    settleLabel: 'Pagar',
    newLabel: 'Nova conta a pagar',
    positive: false,
  },
};

export function resolveKind(slug: string): KindConfig {
  const config = CONFIG[slug as EntryKindSlug];
  if (!config) notFound();
  return config;
}
