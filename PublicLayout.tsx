import { useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, Languages, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../i18n/LanguageContext';
import { cn } from '../utils/helpers';
import { Logo } from '../components/Logo';

export function PublicLayout({ children }: { children: ReactNode }) {
  const { user, authLoading } = useAuth();
  const { t, lang, setLang } = useLang();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const links = [
    { to: '/', label: t.nav.home },
    { to: '/pricing', label: t.nav.pricing },
    { to: '/terms', label: t.nav.terms },
    { to: '/privacy', label: t.nav.privacy },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {/* Navbar */}
      <header className="glass sticky top-0 z-40 border-x-0 border-t-0">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="PORTAL AI home">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  cn('rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive ? 'text-portal-text bg-white/[0.07]' : 'text-portal-muted hover:text-portal-text hover:bg-white/[0.04]')
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <button
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="btn-ghost !min-h-0 !px-3 !py-2"
              aria-label="Switch language"
            >
              <Languages className="h-4 w-4" />
              {lang === 'ar' ? 'EN' : 'عربي'}
            </button>
            {!authLoading && user ? (
              <button onClick={() => navigate('/dashboard')} className="btn-primary !min-h-0 !px-4 !py-2">
                <Sparkles className="h-4 w-4" />
                {t.nav.dashboard}
              </button>
            ) : (
              <>
                <Link to="/login" className="btn-secondary !min-h-0 !px-4 !py-2">{t.nav.login}</Link>
                <Link to="/register" className="btn-primary !min-h-0 !px-4 !py-2">{t.nav.register}</Link>
              </>
            )}
          </div>

          <button
            className="btn-ghost !min-h-0 !p-2 md:hidden"
            onClick={() => setOpen(!open)}
            aria-label={t.common.menu}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <nav className="border-t border-white/10 bg-portal-surface/95 px-4 py-3 backdrop-blur-xl md:hidden animate-fade-in">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm text-portal-muted hover:bg-white/[0.06] hover:text-portal-text"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
              <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="btn-secondary flex-1 !min-h-0 !py-2">
                <Languages className="h-4 w-4" /> {lang === 'ar' ? 'EN' : 'عربي'}
              </button>
              {!authLoading && user ? (
                <button onClick={() => navigate('/dashboard')} className="btn-primary flex-1 !min-h-0 !py-2">{t.nav.dashboard}</button>
              ) : (
                <>
                  <Link to="/login" onClick={() => setOpen(false)} className="btn-secondary flex-1 !min-h-0 !py-2">{t.nav.login}</Link>
                  <Link to="/register" onClick={() => setOpen(false)} className="btn-primary flex-1 !min-h-0 !py-2">{t.nav.register}</Link>
                </>
              )}
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/10 bg-portal-surface/40">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 pb-safe sm:flex-row sm:px-6">
          <Logo compact />
          <p className="text-xs text-portal-muted">
            © {new Date().getFullYear()} PORTAL AI — {t.home.footerRights}. {t.home.footerDemo}
          </p>
          <div className="flex gap-4 text-xs text-portal-muted">
            <Link to="/terms" className="hover:text-portal-text">{t.nav.terms}</Link>
            <Link to="/privacy" className="hover:text-portal-text">{t.nav.privacy}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
