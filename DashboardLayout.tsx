/**
 * App shell for authenticated pages: collapsible glass sidebar + topbar.
 * Sidebar state persists per session; on mobile it overlays with a backdrop.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, Wrench, Image as ImageIcon, CreditCard, User,
  Settings, Bell, Shield, LogOut, Menu, X, Languages, Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../i18n/LanguageContext';
import { cn, initials } from '../utils/helpers';
import { Logo } from '../components/Logo';

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, profile, isAdmin, logout, usage } = useAuth();
  const { t, lang, setLang } = useLang();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('portal-ai-sidebar') === 'collapsed');
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem('portal-ai-sidebar', collapsed ? 'collapsed' : 'open');
  }, [collapsed]);

  // Close the mobile drawer on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const items = [
    { to: '/dashboard', icon: LayoutDashboard, label: t.nav.dashboard },
    { to: '/chat', icon: MessageSquare, label: t.nav.chat },
    { to: '/tools', icon: Wrench, label: t.nav.tools },
    { to: '/image-generator', icon: ImageIcon, label: t.nav.images },
    { to: '/subscription', icon: CreditCard, label: t.nav.subscription },
    { to: '/notifications', icon: Bell, label: t.nav.notifications },
    { to: '/profile', icon: User, label: t.nav.profile },
    { to: '/settings', icon: Settings, label: t.nav.settings },
    ...(isAdmin ? [{ to: '/admin', icon: Shield, label: t.nav.admin }] : []),
  ];

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-16 items-center border-b border-white/10 px-4', collapsed ? 'justify-center' : 'justify-between')}>
        {!collapsed && <Link to="/" aria-label="PORTAL AI"><Logo compact /></Link>}
        <button
          className="btn-ghost !min-h-0 !p-1.5 max-lg:hidden"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="App navigation">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                collapsed && 'justify-center px-0',
                isActive
                  ? 'bg-gradient-to-r from-portal-violet/25 to-portal-blue/15 text-portal-text shadow-glow-sm border border-portal-violet/30'
                  : 'text-portal-muted hover:bg-white/[0.06] hover:text-portal-text border border-transparent'
              )
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Plan mini-card */}
      {!collapsed && usage && (
        <div className="mx-3 mb-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-portal-text">{t.pricing.title.replace('الاشتراك', '').trim() || 'Plan'}: {usage.planName}</span>
            <span className="text-portal-muted">{usage.remaining.messages} ← {t.dashboard.messagesLeft}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-portal-violet to-portal-cyan transition-all"
              style={{ width: `${Math.min(100, (usage.used.messages / Math.max(1, usage.limits.messages)) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className={cn('border-t border-white/10 p-3', collapsed && 'flex flex-col items-center')}>
        {!collapsed && (
          <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="btn-ghost mb-1 w-full justify-start !px-3 !py-2 text-sm">
            <Languages className="h-4 w-4" /> {lang === 'ar' ? 'English' : 'العربية'}
          </button>
        )}
        <button
          onClick={async () => {
            await logout();
            navigate('/login', { replace: true });
          }}
          className={cn('btn-ghost w-full justify-start !px-3 !py-2 text-sm text-red-300 hover:text-red-200', collapsed && 'justify-center !px-0')}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && t.nav.logout}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'glass sticky top-0 hidden h-screen shrink-0 border-y-0 border-e border-s-0 transition-all duration-300 lg:block',
          collapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="glass-strong absolute inset-y-0 start-0 w-72 animate-fade-in !bg-portal-surface/95">
            <button className="absolute end-3 top-4 btn-ghost !min-h-0 !p-1.5" onClick={() => setMobileOpen(false)} aria-label="Close menu">
              <X className="h-4 w-4" />
            </button>
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="glass sticky top-0 z-40 border-x-0 border-t-0">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex items-center gap-2">
              <button className="btn-ghost !min-h-0 !p-2 lg:hidden" onClick={() => setMobileOpen(true)} aria-label={t.common.menu}>
                <Menu className="h-5 w-5" />
              </button>
              <span className="lg:hidden"><Logo compact /></span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {usage && (
                <span className="badge hidden border-portal-violet/30 bg-portal-violet/10 text-portal-violet-light sm:inline-flex">
                  <Zap className="h-3 w-3" />
                  {usage.planName} · {usage.remaining.messages}
                </span>
              )}
              <NavLink to="/notifications" className="btn-ghost relative !min-h-0 !p-2" aria-label={t.nav.notifications}>
                <Bell className="h-5 w-5" />
              </NavLink>
              <NavLink to="/profile" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-2 py-1.5 hover:bg-white/[0.09] transition-colors">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-portal-violet to-portal-blue text-xs font-bold text-white">
                  {initials(profile?.displayName, user?.email)}
                </span>
                <span className="hidden max-w-28 truncate text-xs font-medium sm:block">
                  {profile?.displayName || user?.email}
                </span>
              </NavLink>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 pb-safe sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
