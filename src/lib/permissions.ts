/**
 * Papeis do sistema, do mais para o menos permissivo.
 * OWNER    - dono da empresa: tudo, inclusive excluir a empresa
 * ADMIN    - administra cadastros, usuarios e financeiro
 * FINANCE  - opera o financeiro (lancamentos, baixas, conciliacao)
 * OPERATOR - opera vendas/compras/estoque, ve o financeiro
 * VIEWER   - somente leitura
 */
export const ROLES = ['OWNER', 'ADMIN', 'FINANCE', 'OPERATOR', 'VIEWER'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Proprietario',
  ADMIN: 'Administrador',
  FINANCE: 'Financeiro',
  OPERATOR: 'Operacional',
  VIEWER: 'Consulta',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  OWNER: 'Acesso total, incluindo exclusao da empresa e transferencia de propriedade.',
  ADMIN: 'Gerencia usuarios, cadastros, financeiro, vendas e configuracoes.',
  FINANCE: 'Lancamentos, baixas, conciliacao bancaria e relatorios.',
  OPERATOR: 'Vendas, compras, estoque e cadastros de clientes/produtos.',
  VIEWER: 'Somente leitura em todos os modulos.',
};

const RANK: Record<Role, number> = { OWNER: 5, ADMIN: 4, FINANCE: 3, OPERATOR: 2, VIEWER: 1 };

export type Permission =
  | 'company.manage'
  | 'company.delete'
  | 'users.manage'
  | 'finance.read'
  | 'finance.write'
  | 'finance.settle'
  | 'reconciliation.manage'
  | 'catalog.read'
  | 'catalog.write'
  | 'sales.read'
  | 'sales.write'
  | 'stock.write'
  | 'reports.read'
  | 'audit.read';

const MIN_ROLE: Record<Permission, Role> = {
  'company.manage': 'ADMIN',
  'company.delete': 'OWNER',
  'users.manage': 'ADMIN',
  'finance.read': 'VIEWER',
  'finance.write': 'FINANCE',
  'finance.settle': 'FINANCE',
  'reconciliation.manage': 'FINANCE',
  'catalog.read': 'VIEWER',
  'catalog.write': 'OPERATOR',
  'sales.read': 'VIEWER',
  'sales.write': 'OPERATOR',
  'stock.write': 'OPERATOR',
  'reports.read': 'VIEWER',
  'audit.read': 'ADMIN',
};

export function can(role: Role | string | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  const current = RANK[role as Role];
  if (!current) return false;
  return current >= RANK[MIN_ROLE[permission]];
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
