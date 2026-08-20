import { notFound } from 'next/navigation';

export type OrderTypeSlug = 'vendas' | 'compras';

export type OrderTypeConfig = {
  slug: OrderTypeSlug;
  type: 'SALE' | 'PURCHASE';
  title: string;
  singular: string;
  description: string;
  contactLabel: string;
  contactKinds: string[];
  newLabel: string;
  entrySlug: 'receber' | 'pagar';
};

const CONFIG: Record<OrderTypeSlug, OrderTypeConfig> = {
  vendas: {
    slug: 'vendas',
    type: 'SALE',
    title: 'Vendas',
    singular: 'Venda',
    description: 'Pedidos de venda da loja fisica, live, marketplace e eventos.',
    contactLabel: 'Cliente',
    contactKinds: ['CUSTOMER', 'BOTH'],
    newLabel: 'Nova venda',
    entrySlug: 'receber',
  },
  compras: {
    slug: 'compras',
    type: 'PURCHASE',
    title: 'Compras',
    singular: 'Compra',
    description: 'Pedidos de compra de mercadoria e servicos de fornecedores.',
    contactLabel: 'Fornecedor',
    contactKinds: ['SUPPLIER', 'BOTH'],
    newLabel: 'Nova compra',
    entrySlug: 'pagar',
  },
};

export function resolveOrderType(slug: string): OrderTypeConfig {
  const config = CONFIG[slug as OrderTypeSlug];
  if (!config) notFound();
  return config;
}
