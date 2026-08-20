import 'server-only';
import { prisma } from '@/lib/prisma';

/**
 * Plano de contas padrao para lojas de card game / varejo, ja classificado nos
 * grupos usados pela DRE. Aplicado automaticamente a cada nova empresa.
 */
export const DEFAULT_CATEGORIES: Array<{
  code: string;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  dreGroup: string;
  color: string;
  children?: Array<{ code: string; name: string }>;
}> = [
  {
    code: '3.01',
    name: 'Receita de vendas',
    type: 'INCOME',
    dreGroup: 'RECEITA_BRUTA',
    color: '#16a34a',
    children: [
      { code: '3.01.01', name: 'Venda de singles' },
      { code: '3.01.02', name: 'Venda de produtos lacrados' },
      { code: '3.01.03', name: 'Venda de acessorios' },
      { code: '3.01.04', name: 'Vendas em marketplace' },
      { code: '3.01.05', name: 'Vendas em live / evento' },
    ],
  },
  {
    code: '3.02',
    name: 'Receita de servicos',
    type: 'INCOME',
    dreGroup: 'RECEITA_BRUTA',
    color: '#0ea5e9',
    children: [
      { code: '3.02.01', name: 'Inscricao em torneios' },
      { code: '3.02.02', name: 'Aluguel de mesa / espaco' },
      { code: '3.02.03', name: 'Avaliacao e grading' },
    ],
  },
  {
    code: '3.09',
    name: 'Outras receitas',
    type: 'INCOME',
    dreGroup: 'OUTRAS_RECEITAS',
    color: '#8b5cf6',
    children: [
      { code: '3.09.01', name: 'Rendimento de aplicacoes' },
      { code: '3.09.02', name: 'Estornos e devolucoes recebidas' },
    ],
  },
  {
    code: '4.01',
    name: 'Impostos sobre vendas',
    type: 'EXPENSE',
    dreGroup: 'DEDUCOES',
    color: '#f43f5e',
    children: [
      { code: '4.01.01', name: 'Simples Nacional (DAS)' },
      { code: '4.01.02', name: 'ICMS' },
      { code: '4.01.03', name: 'ISS' },
    ],
  },
  {
    code: '4.02',
    name: 'Custo das mercadorias vendidas',
    type: 'EXPENSE',
    dreGroup: 'CMV',
    color: '#f97316',
    children: [
      { code: '4.02.01', name: 'Compra de cartas e singles' },
      { code: '4.02.02', name: 'Compra de produtos lacrados' },
      { code: '4.02.03', name: 'Compra de acessorios' },
      { code: '4.02.04', name: 'Frete sobre compras' },
    ],
  },
  {
    code: '4.03',
    name: 'Despesas com pessoal',
    type: 'EXPENSE',
    dreGroup: 'DESPESA_OPERACIONAL',
    color: '#eab308',
    children: [
      { code: '4.03.01', name: 'Salarios e ordenados' },
      { code: '4.03.02', name: 'Pro-labore' },
      { code: '4.03.03', name: 'FGTS e INSS' },
      { code: '4.03.04', name: 'Vale transporte e alimentacao' },
      { code: '4.03.05', name: 'Ferias e 13o salario' },
    ],
  },
  {
    code: '4.04',
    name: 'Despesas administrativas',
    type: 'EXPENSE',
    dreGroup: 'DESPESA_ADMIN',
    color: '#64748b',
    children: [
      { code: '4.04.01', name: 'Aluguel e condominio' },
      { code: '4.04.02', name: 'Energia eletrica' },
      { code: '4.04.03', name: 'Agua' },
      { code: '4.04.04', name: 'Internet e telefone' },
      { code: '4.04.05', name: 'Contabilidade' },
      { code: '4.04.06', name: 'Material de escritorio e embalagens' },
      { code: '4.04.07', name: 'Software e assinaturas' },
      { code: '4.04.08', name: 'Manutencao e limpeza' },
    ],
  },
  {
    code: '4.05',
    name: 'Despesas comerciais',
    type: 'EXPENSE',
    dreGroup: 'DESPESA_OPERACIONAL',
    color: '#ec4899',
    children: [
      { code: '4.05.01', name: 'Marketing e anuncios' },
      { code: '4.05.02', name: 'Comissoes de marketplace' },
      { code: '4.05.03', name: 'Frete sobre vendas' },
      { code: '4.05.04', name: 'Premiacao de torneios' },
      { code: '4.05.05', name: 'Eventos e feiras' },
    ],
  },
  {
    code: '4.06',
    name: 'Despesas financeiras',
    type: 'EXPENSE',
    dreGroup: 'DESPESA_FINANCEIRA',
    color: '#dc2626',
    children: [
      { code: '4.06.01', name: 'Tarifas bancarias' },
      { code: '4.06.02', name: 'Taxas de maquininha / gateway' },
      { code: '4.06.03', name: 'Juros e multas pagos' },
      { code: '4.06.04', name: 'IOF' },
    ],
  },
  {
    code: '4.07',
    name: 'Investimentos',
    type: 'EXPENSE',
    dreGroup: 'INVESTIMENTO',
    color: '#0891b2',
    children: [
      { code: '4.07.01', name: 'Moveis e equipamentos' },
      { code: '4.07.02', name: 'Reformas' },
    ],
  },
  {
    code: '4.09',
    name: 'Retiradas dos socios',
    type: 'EXPENSE',
    dreGroup: 'INVESTIMENTO',
    color: '#7c3aed',
    children: [{ code: '4.09.01', name: 'Distribuicao de lucros' }],
  },
];

const DEFAULT_PAYMENT_METHODS = [
  { name: 'Dinheiro', type: 'CASH', feePercent: 0, settlementDays: 0 },
  { name: 'PIX', type: 'PIX', feePercent: 0, settlementDays: 0 },
  { name: 'Cartao de debito', type: 'DEBIT_CARD', feePercent: 1.99, settlementDays: 1 },
  { name: 'Cartao de credito a vista', type: 'CREDIT_CARD', feePercent: 3.49, settlementDays: 30 },
  { name: 'Cartao de credito parcelado', type: 'CREDIT_CARD', feePercent: 4.99, settlementDays: 30 },
  { name: 'Boleto bancario', type: 'BOLETO', feeFixed: 2.5, settlementDays: 1 },
  { name: 'Transferencia / TED', type: 'TRANSFER', feePercent: 0, settlementDays: 0 },
];

const DEFAULT_COST_CENTERS = [
  { code: 'CC01', name: 'Loja fisica' },
  { code: 'CC02', name: 'Vendas online' },
  { code: 'CC03', name: 'Eventos e torneios' },
  { code: 'CC04', name: 'Administrativo' },
];

/**
 * Cria plano de contas, centros de custo, formas de pagamento e caixa padrao.
 * Idempotente: nao faz nada se a empresa ja tiver categorias.
 */
export async function seedCompanyDefaults(companyId: string): Promise<void> {
  const existing = await prisma.category.count({ where: { companyId } });
  if (existing > 0) return;

  for (const group of DEFAULT_CATEGORIES) {
    const parent = await prisma.category.create({
      data: {
        companyId,
        code: group.code,
        name: group.name,
        type: group.type,
        dreGroup: group.dreGroup,
        color: group.color,
      },
    });
    if (group.children?.length) {
      await prisma.category.createMany({
        data: group.children.map((child) => ({
          companyId,
          parentId: parent.id,
          code: child.code,
          name: child.name,
          type: group.type,
          dreGroup: group.dreGroup,
          color: group.color,
        })),
      });
    }
  }

  await prisma.costCenter.createMany({
    data: DEFAULT_COST_CENTERS.map((c) => ({ ...c, companyId })),
  });

  const cash = await prisma.bankAccount.create({
    data: {
      companyId,
      name: 'Caixa da loja',
      type: 'CASH',
      color: '#16a34a',
      initialBalance: 0,
    },
  });

  await prisma.paymentMethod.createMany({
    data: DEFAULT_PAYMENT_METHODS.map((m) => ({
      companyId,
      name: m.name,
      type: m.type,
      feePercent: m.feePercent ?? 0,
      feeFixed: m.feeFixed ?? 0,
      settlementDays: m.settlementDays,
      bankAccountId: m.type === 'CASH' ? cash.id : null,
    })),
  });

  await prisma.reconciliationRule.createMany({
    data: [
      { companyId, name: 'Tarifas bancarias', pattern: 'tarifa', direction: 'OUT', priority: 10 },
      { companyId, name: 'Taxa de maquininha', pattern: 'taxa', direction: 'OUT', priority: 9 },
      { companyId, name: 'Rendimento de aplicacao', pattern: 'rendimento', direction: 'IN', priority: 8 },
      { companyId, name: 'DAS - Simples Nacional', pattern: 'das', direction: 'OUT', priority: 8 },
    ],
  });
}
