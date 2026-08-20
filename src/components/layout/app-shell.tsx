'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, LogOut, Menu, X, Search, Bell, Building2, Check } from 'lucide-react';
import { cn, formatDocument, initials } from '@/lib/utils';
import { Wordmark } from '@/components/ui/logo';
import { NAV_GROUPS } from './nav-config';
import { ROLE_LABELS, type Role } from '@/lib/permissions';
import { logoutAction, switchCompanyAction } from '@/app/actions/auth';

export type ShellCompany = {
  id: string;
  tradeName: string;
  corporateName: string;
  cnpj: string;
  role: Role;
};

export type ShellBadges = {
  overdueReceivable: number;
  overduePayable: number;
  pendingReconciliation: number;
};

export function AppShell({
  user,
  company,
  companies,
  allowed,
  badges,
  children,
}: {
  user: { name: string; email: string };
  company: ShellCompany;
  companies: ShellCompany[];
  /** hrefs que o papel atual pode acessar - calculado no servidor. */
  allowed: string[];
  badges: ShellBadges;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  // Fecha o menu lateral ao navegar no mobile.
  useEffect(() => {
    setMobileOpen(false);
    setCompanyOpen(false);
    setUserOpen(false);
  }, [pathname]);

  const allowedSet = new Set(allowed);

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const sidebar = (
    <div className="flex h-full flex-col bg-ink-950 text-ink-200">
      <div className="flex h-16 shrink-0 items-center justify-between px-4">
        <Link href="/dashboard" aria-label="Ir para o painel">
          <Wordmark />
        </Link>
        <button
          type="button"
          className="rounded-lg p-1.5 text-ink-400 hover:bg-white/10 hover:text-white lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Fechar menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* Seletor de empresa (multi-CNPJ) */}
      <div className="relative px-3 pb-3">
        <button
          type="button"
          onClick={() => setCompanyOpen((v) => !v)}
          className="flex w-full items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-left transition hover:bg-white/10"
          aria-expanded={companyOpen}
          aria-haspopup="listbox"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-500/20 text-xs font-bold text-brand-300">
            {initials(company.tradeName)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-white">{company.tradeName}</span>
            <span className="block truncate text-[11px] text-ink-400">{formatDocument(company.cnpj)}</span>
          </span>
          <ChevronDown size={15} className={cn('shrink-0 text-ink-400 transition', companyOpen && 'rotate-180')} />
        </button>

        {companyOpen && (
          <div
            role="listbox"
            className="absolute inset-x-3 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-lg border border-ink-700 bg-ink-900 p-1.5 shadow-pop animate-fade-in"
          >
            <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              Empresas do grupo ({companies.length})
            </p>
            {companies.map((item) => (
              <form key={item.id} action={switchCompanyAction}>
                <input type="hidden" name="companyId" value={item.id} />
                <button
                  type="submit"
                  role="option"
                  aria-selected={item.id === company.id}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition',
                    item.id === company.id ? 'bg-brand-500/15 text-white' : 'text-ink-300 hover:bg-white/5',
                  )}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-white/10 text-[10px] font-bold">
                    {initials(item.tradeName)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{item.tradeName}</span>
                    <span className="block truncate text-[10px] text-ink-500">
                      {formatDocument(item.cnpj)} &middot; {ROLE_LABELS[item.role]}
                    </span>
                  </span>
                  {item.id === company.id && <Check size={14} className="shrink-0 text-brand-400" />}
                </button>
              </form>
            ))}
            <Link
              href="/configuracoes/empresas"
              className="mt-1 flex items-center gap-2 rounded-md border-t border-ink-700 px-2 py-2 text-[13px] text-ink-300 hover:bg-white/5"
            >
              <Building2 size={14} />
              Gerenciar empresas
            </Link>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => allowedSet.has(item.href));
          if (items.length === 0) return null;
          return (
            <div key={group.label}>
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = isActive(item.href);
                  const count = item.badge ? badges[item.badge] : 0;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition',
                          active
                            ? 'bg-brand-600 font-medium text-white shadow-sm'
                            : 'text-ink-300 hover:bg-white/5 hover:text-white',
                        )}
                      >
                        <item.icon size={16} className="shrink-0" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {count > 0 && (
                          <span
                            className={cn(
                              'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                              active ? 'bg-white/25 text-white' : 'bg-red-500/20 text-red-300',
                            )}
                          >
                            {count > 99 ? '99+' : count}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </div>
  );

  return (
    <div className="min-h-screen bg-ink-50">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block no-print">{sidebar}</aside>

      {/* Sidebar mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden no-print">
          <button
            type="button"
            className="absolute inset-0 bg-ink-950/60"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          />
          <aside className="absolute inset-y-0 left-0 w-72 animate-fade-in">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Barra superior */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink-200 bg-white/90 px-4 backdrop-blur lg:px-8 no-print">
          <button
            type="button"
            className="btn-ghost -ml-1 p-2 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>

          <form action="/busca" className="relative hidden max-w-md flex-1 md:block">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              name="q"
              className="input pl-9"
              placeholder="Buscar cliente, lancamento, produto..."
              aria-label="Buscar"
            />
          </form>

          <div className="ml-auto flex items-center gap-1.5">
            {/* No mobile a barra de busca da toolbar some; este atalho a substitui. */}
            <Link href="/busca" className="btn-ghost p-2 md:hidden" aria-label="Buscar">
              <Search size={18} />
            </Link>

            <Link
              href="/conciliacao"
              className="btn-ghost relative p-2"
              aria-label={`${badges.pendingReconciliation} lancamentos a conciliar`}
              title="Lancamentos bancarios a conciliar"
            >
              <Bell size={18} />
              {badges.pendingReconciliation > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {badges.pendingReconciliation > 99 ? '99+' : badges.pendingReconciliation}
                </span>
              )}
            </Link>

            <div className="relative">
              <button
                type="button"
                onClick={() => setUserOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg p-1.5 pr-2 transition hover:bg-ink-100"
                aria-expanded={userOpen}
                aria-haspopup="menu"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                  {initials(user.name)}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block max-w-[140px] truncate text-[13px] font-medium leading-tight text-ink-900">
                    {user.name}
                  </span>
                  <span className="block text-[10px] leading-tight text-ink-500">{ROLE_LABELS[company.role]}</span>
                </span>
                <ChevronDown size={14} className={cn('text-ink-400 transition', userOpen && 'rotate-180')} />
              </button>

              {userOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-40 mt-1 w-60 rounded-lg border border-ink-200 bg-white p-1.5 shadow-pop animate-fade-in"
                >
                  <div className="border-b border-ink-100 px-2.5 py-2">
                    <p className="truncate text-sm font-medium text-ink-900">{user.name}</p>
                    <p className="truncate text-xs text-ink-500">{user.email}</p>
                  </div>
                  <Link href="/configuracoes/perfil" className="block rounded-md px-2.5 py-2 text-sm text-ink-700 hover:bg-ink-100">
                    Meu perfil
                  </Link>
                  <Link href="/configuracoes/empresas" className="block rounded-md px-2.5 py-2 text-sm text-ink-700 hover:bg-ink-100">
                    Empresas do grupo
                  </Link>
                  <form action={logoutAction} className="border-t border-ink-100 pt-1">
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut size={15} />
                      Sair
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
