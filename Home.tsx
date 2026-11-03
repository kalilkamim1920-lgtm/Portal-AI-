import { Link } from 'react-router-dom';
import {
  MessageSquare, Wrench, ImageIcon, ShieldCheck, Palette, Layers,
  Sparkles, ArrowLeft, ArrowRight, Check,
} from 'lucide-react';
import { PublicLayout } from '../layouts/PublicLayout';
import { useLang } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;

  const features = [
    { icon: MessageSquare, title: t.home.f1Title, desc: t.home.f1Desc },
    { icon: Wrench, title: t.home.f2Title, desc: t.home.f2Desc },
    { icon: ImageIcon, title: t.home.f3Title, desc: t.home.f3Desc },
    { icon: ShieldCheck, title: t.home.f4Title, desc: t.home.f4Desc },
    { icon: Palette, title: t.home.f5Title, desc: t.home.f5Desc },
    { icon: Layers, title: t.home.f6Title, desc: t.home.f6Desc },
  ];

  const stats = [
    { value: '+2,500', label: t.home.statUsers },
    { value: '1000', label: t.home.statMessages },
    { value: '8', label: t.home.statTools },
    { value: '99.9%', label: t.home.statUptime },
  ];

  return (
    <PublicLayout>
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute start-1/3 top-0 h-96 w-96 rounded-full bg-portal-violet/20 blur-3xl animate-glow-pulse" />
          <div className="absolute end-1/4 top-32 h-72 w-72 rounded-full bg-portal-cyan/10 blur-3xl animate-float" />
        </div>

        <div className="relative mx-auto max-w-5xl text-center">
          <span className="badge mx-auto border-portal-violet/30 bg-portal-violet/10 text-portal-violet-light animate-fade-in">
            <Sparkles className="h-3.5 w-3.5" />
            {t.home.heroBadge}
          </span>

          <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl animate-slide-up">
            {t.home.heroTitle1}{' '}
            <span className="gradient-text">{t.home.heroTitle2}</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-portal-muted sm:text-lg animate-slide-up" style={{ animationDelay: '0.1s' }}>
            {t.home.heroDesc}
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <Link to={user ? '/dashboard' : '/register'} className="btn-primary w-full sm:w-auto">
              {user ? t.nav.dashboard : t.home.ctaStart}
              <Arrow className="h-4 w-4" />
            </Link>
            <Link to="/pricing" className="btn-secondary w-full sm:w-auto">
              {t.home.ctaPricing}
            </Link>
          </div>

          {/* Stats */}
          <div className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((s, i) => (
              <div key={s.label} className="glass-card glass-card-hover p-4 animate-fade-in" style={{ animationDelay: `${0.3 + i * 0.08}s` }}>
                <p className="text-2xl font-extrabold gradient-text sm:text-3xl">{s.value}</p>
                <p className="mt-1 text-xs text-portal-muted">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section className="px-4 py-16 sm:px-6" id="features">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="section-title">{t.home.featuresTitle}</h2>
            <p className="mt-3 text-portal-muted">{t.home.featuresDesc}</p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, desc }, i) => (
              <article key={title} className="glass-card glass-card-hover group p-6 animate-fade-in" style={{ animationDelay: `${i * 0.07}s` }}>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-portal-violet/25 to-portal-blue/20 text-portal-violet-light transition-transform duration-300 group-hover:scale-110">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-7 text-portal-muted">{desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="px-4 pb-20 pt-8 sm:px-6">
        <div className="glass-strong relative mx-auto max-w-4xl overflow-hidden rounded-3xl p-10 text-center shadow-card">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute -top-20 start-1/4 h-56 w-56 rounded-full bg-portal-violet/25 blur-3xl" />
            <div className="absolute -bottom-20 end-1/4 h-56 w-56 rounded-full bg-portal-blue/20 blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="text-2xl font-bold sm:text-3xl">{t.home.ctaTitle}</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-portal-muted">{t.home.ctaDesc}</p>
            <Link to="/register" className="btn-primary mt-8">
              {t.home.ctaButton}
              <Arrow className="h-4 w-4" />
            </Link>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-portal-muted">
              <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5 text-portal-success" /> 10 {t.pricing.messagesPerDay}</span>
              <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5 text-portal-success" /> {t.common.free}</span>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
