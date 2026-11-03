import { Link } from 'react-router-dom';
import { Languages, ArrowLeft } from 'lucide-react';
import { useLang } from '../i18n/LanguageContext';
import { Logo } from '../components/Logo';

/** Centered glass card layout for auth pages (login/register/forgot/reset). */
export function AuthLayout({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  const { lang, setLang } = useLang();

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      {/* ambient glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-24 start-1/4 h-72 w-72 rounded-full bg-portal-violet/20 blur-3xl animate-float" />
        <div className="absolute bottom-0 end-1/4 h-72 w-72 rounded-full bg-portal-blue/15 blur-3xl animate-float" style={{ animationDelay: '2s' }} />
      </div>

      <div className="absolute top-4 z-10 flex w-full items-center justify-between px-4 sm:px-6">
        <Link to="/" className="btn-ghost !min-h-0 !px-3 !py-2 text-sm">
          <ArrowLeft className={lang === 'ar' ? 'rotate-180' : ''} size={16} />
          <span className="hidden sm:inline">PORTAL AI</span>
        </Link>
        <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="btn-ghost !min-h-0 !px-3 !py-2 text-sm">
          <Languages size={16} />
          {lang === 'ar' ? 'EN' : 'عربي'}
        </button>
      </div>

      <div className="w-full max-w-md animate-slide-up">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Link to="/" aria-label="PORTAL AI"><Logo size="lg" /></Link>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-portal-muted">{subtitle}</p>
        </div>
        <div className="glass-strong rounded-2xl p-6 shadow-card sm:p-8">{children}</div>
      </div>
    </div>
  );
}
