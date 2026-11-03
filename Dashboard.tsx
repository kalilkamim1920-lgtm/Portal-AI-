import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare, Wrench, ImageIcon, ArrowLeft, ArrowRight,
  TrendingUp, Zap, Crown, Clock,
} from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../i18n/LanguageContext';
import { api } from '../services/api';
import type { Conversation } from '../types';
import { useAsync } from '../hooks/useAsync';
import { formatDateTime } from '../utils/helpers';

export default function Dashboard() {
  const { user, profile, usage, plan } = useAuth();
  const { t, lang } = useLang();
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;

  const { data: conversations, loading } = useAsync<Conversation[]>(
    async () => (await api.get<{ conversations: Conversation[] }>('/chat/conversations')).conversations ?? [],
    []
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t.dashboard.greetingMorning;
    return t.dashboard.greeting;
  }, [t, lang]);

  const quotaPct = usage ? Math.min(100, Math.round((usage.used.messages / Math.max(1, usage.limits.messages)) * 100)) : 0;

  const quickActions = [
    { to: '/chat', icon: MessageSquare, label: t.dashboard.startChat, gradient: 'from-portal-violet/30 to-portal-violet/10' },
    { to: '/tools', icon: Wrench, label: t.dashboard.openTools, gradient: 'from-portal-cyan/30 to-portal-cyan/10' },
    { to: '/image-generator', icon: ImageIcon, label: t.dashboard.generateImage, gradient: 'from-portal-blue/30 to-portal-blue/10' },
  ];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl">
        {/* Greeting */}
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold sm:text-3xl">
            {greeting} {profile?.displayName || user?.email?.split('@')[0] || ''} 👋
          </h1>
          <p className="mt-1 text-sm text-portal-muted">{t.tagline} — {usage?.planName}</p>
        </div>

        {/* Quick actions */}
        <section className="mt-8">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-portal-muted">{t.dashboard.quickActions}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {quickActions.map(({ to, icon: Icon, label, gradient }) => (
              <Link
                key={to}
                to={to}
                className={`glass-card glass-card-hover flex items-center gap-4 bg-gradient-to-br p-5 ${gradient}`}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-portal-violet-light">
                  <Icon className="h-5.5 w-5.5 h-6 w-6" />
                </span>
                <span className="flex-1 text-sm font-semibold leading-6">{label}</span>
                <Arrow className="h-4 w-4 text-portal-muted" />
              </Link>
            ))}
          </div>
        </section>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {/* Usage card */}
          <section className="glass-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><TrendingUp className="h-4 w-4 text-portal-cyan" /> {t.dashboard.usageTitle}</h2>
              <span className="badge border-portal-violet/30 bg-portal-violet/10 text-portal-violet-light">
                <Zap className="h-3 w-3" /> {usage?.planName || plan}
              </span>
            </div>

            {usage ? (
              <>
                <div className="mt-5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-3xl font-extrabold gradient-text">{usage.remaining.messages}</span>
                    <span className="text-xs text-portal-muted">{t.dashboard.messagesLeft} · {usage.used.messages}/{usage.limits.messages}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-portal-violet to-portal-cyan transition-all duration-500" style={{ width: `${quotaPct}%` }} />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-portal-muted">
                  <span className="flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" /> {usage.remaining.images} {t.dashboard.imagesLeft}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {usage.date}</span>
                </div>

                <Link to="/pricing" className="btn-primary mt-5 w-full !py-2.5">
                  <Crown className="h-4 w-4" /> {t.dashboard.upgrade}
                </Link>
              </>
            ) : (
              <div className="mt-5 space-y-3">
                <div className="skeleton h-10 w-24" />
                <div className="skeleton h-2 w-full" />
                <div className="skeleton h-10 w-full" />
              </div>
            )}
          </section>

          {/* Recent chats */}
          <section className="glass-card p-6 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t.dashboard.recentChats}</h2>
              <Link to="/chat" className="text-xs font-medium text-portal-cyan hover:underline">{t.dashboard.viewAll}</Link>
            </div>

            {loading ? (
              <div className="mt-4 space-y-2">
                {[0, 1, 2].map((i) => <div key={i} className="skeleton h-12 w-full" />)}
              </div>
            ) : conversations && conversations.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {conversations.filter((c) => c.kind !== 'tool-history').slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <Link to={`/chat?c=${c.id}`} className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-colors hover:border-white/10 hover:bg-white/[0.05]">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-portal-violet/15 text-portal-violet-light">
                        <MessageSquare className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{c.title}</span>
                        <span className="block truncate text-xs text-portal-muted">{c.lastMessage || '—'}</span>
                      </span>
                      <span className="shrink-0 text-[11px] text-portal-muted">{formatDateTime(c.updatedAt, lang)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-8 flex flex-col items-center gap-2 text-center">
                <MessageSquare className="h-8 w-8 text-portal-muted/50" />
                <p className="text-sm text-portal-muted">{t.dashboard.noChats}</p>
                <Link to="/chat" className="btn-secondary mt-2 !py-2 !text-xs">{t.dashboard.startChat}</Link>
              </div>
            )}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
