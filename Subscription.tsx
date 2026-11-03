/**
 * Subscription page — current plan, usage meters, invoices, cancel/resume.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Receipt, CalendarDays, XCircle, PlayCircle, Crown, AlertTriangle } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useLang } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/States';
import { cn, formatDate } from '../utils/helpers';
import type { SubscriptionInfo, Invoice } from '../types';

interface MeSub {
  subscription: SubscriptionInfo | null;
  activePlan: string;
  usage: {
    plan: string;
    planName: string;
    limits: { messages: number; images: number };
    used: { messages: number; images: number; toolCalls: number };
    remaining: { messages: number; images: number };
  };
  demoNotice: string;
}

export default function Subscription() {
  const { t, lang } = useLang();
  const { refreshProfile } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const { data, refresh, loading } = useAsync<MeSub>(async () => api.get<MeSub>('/subscriptions/me'), []);
  const { data: invoices, refresh: refreshInvoices } = useAsync<Invoice[]>(
    async () => (await api.get<{ invoices: Invoice[] }>('/subscriptions/invoices')).invoices ?? [],
    []
  );

  const cancel = async () => {
    if (!window.confirm(t.subscription.cancelConfirm)) return;
    setBusy(true);
    try {
      await api.post('/subscriptions/cancel');
      toast('success', t.subscription.canceled);
      refresh(); refreshInvoices(); refreshProfile();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const resume = async () => {
    setBusy(true);
    try {
      await api.post('/subscriptions/resume');
      toast('success', t.subscription.active);
      refresh(); refreshProfile();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="skeleton h-10 w-48" />
          <div className="skeleton h-48 w-full" />
          <div className="skeleton h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  const sub = data?.subscription;
  const usage = data?.usage;
  const isActive = sub?.status === 'active' && sub?.enabled !== false;

  const expiresSoon = sub?.endsAt ? new Date(sub.endsAt).getTime() - Date.now() < 3 * 24 * 3600 * 1000 : false;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title={t.subscription.title}
          subtitle={data?.demoNotice}
          action={<Link to="/pricing" className="btn-primary !py-2.5"><Crown className="h-4 w-4" /> {t.dashboard.upgrade}</Link>}
        />

        {/* Status card */}
        <section className="glass-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-portal-violet/30 to-portal-blue/20">
                <CreditCard className="h-7 w-7 text-portal-violet-light" />
              </span>
              <div>
                <h2 className="text-xl font-bold">{usage?.planName || data?.activePlan}</h2>
                <p className="mt-0.5 text-sm text-portal-muted">
                  {sub ? (
                    <span className={cn('font-semibold', isActive ? 'text-portal-success' : 'text-portal-warning')}>
                      {isActive ? '● ' : '○ '}{isActive ? t.subscription.active : t.subscription.canceled}
                    </span>
                  ) : (
                    t.subscription.freeNotice
                  )}
                </p>
              </div>
            </div>

            {sub && (
              <div className="flex flex-wrap gap-2">
                {isActive ? (
                  <button onClick={cancel} disabled={busy} className="btn-danger !py-2.5">
                    <XCircle className="h-4 w-4" /> {t.subscription.cancel}
                  </button>
                ) : sub.endsAt && new Date(sub.endsAt) > new Date() ? (
                  <button onClick={resume} disabled={busy} className="btn-primary !py-2.5">
                    <PlayCircle className="h-4 w-4" /> {t.subscription.resume}
                  </button>
                ) : (
                  <Link to="/pricing" className="btn-primary !py-2.5"><Crown className="h-4 w-4" /> {t.dashboard.upgrade}</Link>
                )}
              </div>
            )}
          </div>

          {sub && (
            <div className="mt-6 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-3">
              <div className="flex items-center gap-2.5 text-sm">
                <CalendarDays className="h-4 w-4 shrink-0 text-portal-muted" />
                <div>
                  <p className="text-xs text-portal-muted">{t.subscription.started}</p>
                  <p className="font-medium">{formatDate(sub.startedAt, lang)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <CalendarDays className="h-4 w-4 shrink-0 text-portal-muted" />
                <div>
                  <p className="text-xs text-portal-muted">{t.subscription.ends}</p>
                  <p className={cn('font-medium', expiresSoon && 'text-portal-warning')}>{formatDate(sub.endsAt, lang)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <Receipt className="h-4 w-4 shrink-0 text-portal-muted" />
                <div>
                  <p className="text-xs text-portal-muted">{t.subscription.demo}</p>
                  <p className="font-medium">${sub.amount} · {sub.currency}</p>
                </div>
              </div>
            </div>
          )}

          {sub && sub.status === 'canceled' && sub.endsAt && new Date(sub.endsAt) > new Date() && (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-portal-warning/30 bg-portal-warning/10 p-3 text-xs text-portal-warning">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {t.subscription.canceledNotice} {formatDate(sub.endsAt, lang)}
            </div>
          )}
        </section>

        {/* Usage */}
        {usage && (
          <section className="glass-card mt-5 p-6">
            <h2 className="text-lg font-bold">{t.subscription.usage}</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Meter
                label={`${usage.used.messages} / ${usage.limits.messages}`}
                pct={Math.min(100, (usage.used.messages / Math.max(1, usage.limits.messages)) * 100)}
                title={t.dashboard.usageTitle}
                hint={`${usage.remaining.messages} ${t.dashboard.messagesLeft}`}
              />
              <Meter
                label={`${usage.used.images} / ${usage.limits.images}`}
                pct={Math.min(100, (usage.used.images / Math.max(1, usage.limits.images)) * 100)}
                title={t.nav.images}
                hint={`${usage.remaining.images} ${t.dashboard.imagesLeft}`}
              />
            </div>
          </section>
        )}

        {/* Invoices */}
        <section className="glass-card mt-5 p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Receipt className="h-5 w-5 text-portal-cyan" />
            {t.subscription.invoices}
          </h2>

          {invoices && invoices.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-start text-xs uppercase tracking-wider text-portal-muted">
                    <th className="px-3 py-2 text-start">#</th>
                    <th className="px-3 py-2 text-start">{t.pricing.title}</th>
                    <th className="px-3 py-2 text-start">{t.checkout.title}</th>
                    <th className="px-3 py-2 text-start">{t.subscription.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-t border-white/10">
                      <td className="px-3 py-2.5 font-mono text-xs text-portal-muted">{inv.id.slice(0, 8)}…</td>
                      <td className="px-3 py-2.5">{inv.planName}</td>
                      <td className="px-3 py-2.5">${inv.amount} <span className="text-xs text-portal-muted">{formatDate(inv.createdAt, lang)}</span></td>
                      <td className="px-3 py-2.5">
                        <span className="badge border-portal-success/30 bg-portal-success/10 text-portal-success">
                          ✓ {inv.status}{inv.demo ? ' · DEMO' : ''}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-6 text-center text-sm text-portal-muted">{t.subscription.noInvoices}</p>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}

function Meter({ label, pct, title, hint }: { label: string; pct: number; title: string; hint: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-portal-muted">{label}</span>
      </div>
      <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-portal-violet to-portal-cyan transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-portal-muted">{hint}</p>
    </div>
  );
}
