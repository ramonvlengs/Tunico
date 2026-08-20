import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, ArrowDownCircle, ArrowUpCircle, Landmark, Repeat, ArrowLeftRight,
  Scale, Users, Package, ShoppingCart, Truck, Boxes, FileBarChart, TrendingUp,
  AlertTriangle, PieChart, Settings, Building2, Tags, Wallet, CreditCard, Target,
  UserCog, History, FileSpreadsheet,
} from 'lucide-react';
import type { Permission } from '@/lib/permissions';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: Permission;
  /** Chave do contador exibido a direita (ver AppShell). */
  badge?: 'overdueReceivable' | 'overduePayable' | 'pendingReconciliation';
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Visao geral',
    items: [{ href: '/dashboard', label: 'Painel', icon: LayoutDashboard }],
  },
  {
    label: 'Financeiro',
    items: [
      { href: '/financeiro/receber', label: 'Contas a receber', icon: ArrowDownCircle, permission: 'finance.read', badge: 'overdueReceivable' },
      { href: '/financeiro/pagar', label: 'Contas a pagar', icon: ArrowUpCircle, permission: 'finance.read', badge: 'overduePayable' },
      { href: '/financeiro/contas', label: 'Contas e caixas', icon: Landmark, permission: 'finance.read' },
      { href: '/financeiro/extrato', label: 'Extrato', icon: FileSpreadsheet, permission: 'finance.read' },
      { href: '/financeiro/transferencias', label: 'Transferencias', icon: ArrowLeftRight, permission: 'finance.read' },
      { href: '/financeiro/recorrencias', label: 'Recorrencias', icon: Repeat, permission: 'finance.read' },
    ],
  },
  {
    label: 'Conciliacao',
    items: [
      { href: '/conciliacao', label: 'Conciliar extrato', icon: Scale, permission: 'finance.read', badge: 'pendingReconciliation' },
      { href: '/conciliacao/importacoes', label: 'Importacoes', icon: FileSpreadsheet, permission: 'finance.read' },
      { href: '/conciliacao/regras', label: 'Regras', icon: Target, permission: 'reconciliation.manage' },
    ],
  },
  {
    label: 'Operacao',
    items: [
      { href: '/vendas', label: 'Vendas', icon: ShoppingCart, permission: 'sales.read' },
      { href: '/compras', label: 'Compras', icon: Truck, permission: 'sales.read' },
      { href: '/produtos', label: 'Produtos', icon: Package, permission: 'catalog.read' },
      { href: '/estoque', label: 'Estoque', icon: Boxes, permission: 'catalog.read' },
      { href: '/contatos', label: 'Clientes e fornecedores', icon: Users, permission: 'catalog.read' },
    ],
  },
  {
    label: 'Relatorios',
    items: [
      { href: '/relatorios/dre', label: 'DRE', icon: FileBarChart, permission: 'reports.read' },
      { href: '/relatorios/fluxo-de-caixa', label: 'Fluxo de caixa', icon: TrendingUp, permission: 'reports.read' },
      { href: '/relatorios/inadimplencia', label: 'Inadimplencia', icon: AlertTriangle, permission: 'reports.read' },
      { href: '/relatorios/curva-abc', label: 'Curva ABC', icon: PieChart, permission: 'reports.read' },
      { href: '/relatorios/categorias', label: 'Por categoria', icon: Tags, permission: 'reports.read' },
    ],
  },
  {
    label: 'Configuracoes',
    items: [
      { href: '/configuracoes/empresas', label: 'Empresas (CNPJ)', icon: Building2, permission: 'company.manage' },
      { href: '/configuracoes/categorias', label: 'Plano de contas', icon: Tags, permission: 'finance.read' },
      { href: '/configuracoes/centros-de-custo', label: 'Centros de custo', icon: Wallet, permission: 'finance.read' },
      { href: '/configuracoes/formas-de-pagamento', label: 'Formas de pagamento', icon: CreditCard, permission: 'finance.read' },
      { href: '/configuracoes/usuarios', label: 'Usuarios e permissoes', icon: UserCog, permission: 'users.manage' },
      { href: '/configuracoes/auditoria', label: 'Auditoria', icon: History, permission: 'audit.read' },
      { href: '/configuracoes/perfil', label: 'Meu perfil', icon: Settings },
    ],
  },
];
