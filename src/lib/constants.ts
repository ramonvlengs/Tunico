export const TAX_REGIMES = [
  { value: 'MEI', label: 'MEI - Microempreendedor Individual' },
  { value: 'SIMPLES_NACIONAL', label: 'Simples Nacional' },
  { value: 'LUCRO_PRESUMIDO', label: 'Lucro Presumido' },
  { value: 'LUCRO_REAL', label: 'Lucro Real' },
] as const;

export const CONTACT_KINDS = [
  { value: 'CUSTOMER', label: 'Cliente' },
  { value: 'SUPPLIER', label: 'Fornecedor' },
  { value: 'BOTH', label: 'Cliente e fornecedor' },
  { value: 'EMPLOYEE', label: 'Colaborador' },
] as const;

export const PERSON_TYPES = [
  { value: 'PF', label: 'Pessoa fisica' },
  { value: 'PJ', label: 'Pessoa juridica' },
  { value: 'FOREIGN', label: 'Estrangeiro' },
] as const;

export const BANK_ACCOUNT_TYPES = [
  { value: 'CHECKING', label: 'Conta corrente' },
  { value: 'SAVINGS', label: 'Conta poupanca' },
  { value: 'CASH', label: 'Caixa / dinheiro' },
  { value: 'DIGITAL', label: 'Conta digital / carteira' },
  { value: 'CREDIT_CARD', label: 'Cartao de credito' },
  { value: 'INVESTMENT', label: 'Investimento' },
] as const;

export const PAYMENT_METHOD_TYPES = [
  { value: 'CASH', label: 'Dinheiro' },
  { value: 'PIX', label: 'PIX' },
  { value: 'CREDIT_CARD', label: 'Cartao de credito' },
  { value: 'DEBIT_CARD', label: 'Cartao de debito' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'TRANSFER', label: 'Transferencia / TED' },
  { value: 'CHECK', label: 'Cheque' },
  { value: 'OTHER', label: 'Outro' },
] as const;

export const DRE_GROUPS = [
  { value: 'RECEITA_BRUTA', label: 'Receita bruta' },
  { value: 'DEDUCOES', label: 'Deducoes e impostos sobre vendas' },
  { value: 'CMV', label: 'Custo das mercadorias vendidas' },
  { value: 'DESPESA_OPERACIONAL', label: 'Despesa operacional' },
  { value: 'DESPESA_ADMIN', label: 'Despesa administrativa' },
  { value: 'DESPESA_FINANCEIRA', label: 'Despesa financeira' },
  { value: 'RECEITA_FINANCEIRA', label: 'Receita financeira' },
  { value: 'OUTRAS_RECEITAS', label: 'Outras receitas' },
  { value: 'INVESTIMENTO', label: 'Investimento / nao operacional' },
] as const;

export const RECURRENCE_FREQUENCIES = [
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'BIWEEKLY', label: 'Quinzenal' },
  { value: 'MONTHLY', label: 'Mensal' },
  { value: 'BIMONTHLY', label: 'Bimestral' },
  { value: 'QUARTERLY', label: 'Trimestral' },
  { value: 'SEMIANNUAL', label: 'Semestral' },
  { value: 'YEARLY', label: 'Anual' },
] as const;

export const PRODUCT_GROUPS = [
  'Singles',
  'Booster / Pack',
  'Booster Box',
  'Deck / Starter',
  'Colecao especial',
  'Acessorios',
  'Sleeves',
  'Playmat',
  'Selado diverso',
  'Servico',
] as const;

export const TCG_GAMES = [
  'Pokemon',
  'Magic: The Gathering',
  'Yu-Gi-Oh!',
  'One Piece',
  'Digimon',
  'Dragon Ball',
  'Flesh and Blood',
  'Lorcana',
  'Outro',
] as const;

export const TCG_CONDITIONS = [
  { value: 'NM', label: 'NM - Near Mint' },
  { value: 'SP', label: 'SP - Slightly Played' },
  { value: 'MP', label: 'MP - Moderately Played' },
  { value: 'HP', label: 'HP - Heavily Played' },
  { value: 'DMG', label: 'DMG - Damaged' },
] as const;

export const SALES_CHANNELS = [
  'Loja fisica',
  'WhatsApp',
  'Instagram',
  'Live',
  'Ligamagic',
  'Mercado Livre',
  'Shopee',
  'Evento / torneio',
  'Outro',
] as const;

export const BRAZILIAN_BANKS = [
  { code: '001', name: 'Banco do Brasil' },
  { code: '033', name: 'Santander' },
  { code: '041', name: 'Banrisul' },
  { code: '077', name: 'Banco Inter' },
  { code: '104', name: 'Caixa Economica Federal' },
  { code: '208', name: 'BTG Pactual' },
  { code: '212', name: 'Banco Original' },
  { code: '237', name: 'Bradesco' },
  { code: '260', name: 'Nu Pagamentos (Nubank)' },
  { code: '290', name: 'PagBank / PagSeguro' },
  { code: '323', name: 'Mercado Pago' },
  { code: '336', name: 'Banco C6' },
  { code: '341', name: 'Itau Unibanco' },
  { code: '380', name: 'PicPay' },
  { code: '422', name: 'Banco Safra' },
  { code: '655', name: 'Banco Votorantim / Neon' },
  { code: '748', name: 'Sicredi' },
  { code: '756', name: 'Sicoob' },
] as const;

export const UFS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
] as const;

/** Paleta usada nos graficos, na ordem de aplicacao. */
export const CHART_COLORS = [
  '#16a34a', '#0ea5e9', '#f97316', '#8b5cf6', '#ec4899',
  '#eab308', '#14b8a6', '#ef4444', '#6366f1', '#64748b',
];
