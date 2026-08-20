import Link from 'next/link';
import { Building2, Tags, Wallet, CreditCard, UserCog, History, Settings } from 'lucide-react';
import { requireContext } from '@/lib/tenant';
import { PageHeader } from '@/components/ui/primitives';

export const metadata = { title: 'Configuracoes' };

const SECTIONS = [
  {
    href: '/configuracoes/empresas',
    icon: Building2,
    title: 'Empresas (CNPJ)',
    text: 'Cadastre e alterne entre os CNPJs do grupo. Cada empresa tem dados totalmente separados.',
    permission: 'company.manage' as const,
  },
  {
    href: '/configuracoes/categorias',
    icon: Tags,
    title: 'Plano de contas',
    text: 'Categorias de receita e despesa que alimentam a DRE e os relatorios.',
    permission: 'finance.read' as const,
  },
  {
    href: '/configuracoes/centros-de-custo',
    icon: Wallet,
    title: 'Centros de custo',
    text: 'Separe os resultados por area da operacao.',
    permission: 'finance.read' as const,
  },
  {
    href: '/configuracoes/formas-de-pagamento',
    icon: CreditCard,
    title: 'Formas de pagamento',
    text: 'Dinheiro, PIX, cartoes e gateways, com taxas e prazo de recebimento.',
    permission: 'finance.read' as const,
  },
  {
    href: '/configuracoes/usuarios',
    icon: UserCog,
    title: 'Usuarios e permissoes',
    text: 'Quem acessa cada empresa e com qual papel.',
    permission: 'users.manage' as const,
  },
  {
    href: '/configuracoes/auditoria',
    icon: History,
    title: 'Auditoria',
    text: 'Historico de acoes realizadas no sistema.',
    permission: 'audit.read' as const,
  },
  {
    href: '/configuracoes/perfil',
    icon: Settings,
    title: 'Meu perfil',
    text: 'Seus dados e senha de acesso.',
    permission: null,
  },
];

export default async function SettingsPage() {
  const ctx = await requireContext();
  const visible = SECTIONS.filter((section) => !section.permission || ctx.can(section.permission));

  return (
    <>
      <PageHeader title="Configuracoes" description={`Ajustes de ${ctx.company.tradeName} e da sua conta.`} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((section) => (
          <Link key={section.href} href={section.href} className="card p-5 transition hover:border-brand-300 hover:shadow-pop">
            <section.icon size={22} className="text-brand-600" />
            <h2 className="mt-3 font-semibold text-ink-900">{section.title}</h2>
            <p className="mt-1 text-sm text-ink-500">{section.text}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
