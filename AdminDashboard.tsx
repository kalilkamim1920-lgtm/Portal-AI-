/**
 * Admin Dashboard — stats, user management, plan limits, notifications,
 * activity log. Server-protected: /api/admin/* requires the admin claim/role.
 */
import { useState } from 'react';
import {
  Users, UserCheck, CreditCard, MessageSquare, Search,
  ShieldCheck, ShieldOff, Ban, CheckCircle2, Send, Activity, Loader2, TrendingUp,
} from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useLang } from '../i18n/LanguageContext';
import { api } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useToast } from '../components/Toast';
import { PageHeader, ErrorState } from '../components/States';
import { cn, formatDateTime } from '../utils/helpers';
import type { AdminStats, AdminUser, ActivityLog, Plan } from '../types';

type Tab = 'stats' | 'users' | 'plans' | 'notify' | 'activity';

export default function AdminDashboard() {
  const { t, lang } = useLang();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('stats');
  const [search, setSearch] = useState('');

  const stats = useAsync<AdminStats>(async () => api.get('/admin/stats'), []);
  const activity = useAsync<{ logs: ActivityLog[] }>(
    async () => api.get(`/admin/activity?limit=50`),
    [tab === 'activity']
  );
  const plans = useAsync<{ plans: Plan[] }>(async () => api.get('/admin/plans'), [tab === 'plans']);

  const usersQuery = useAsync<{ users: AdminUser[] }>(
    async () => api.get(`/admin/users?q=${encodeURIComponent(search)}`),
    [search, tab === 'users']
  );

  const toggleDisable = async (u: AdminUser) => {
    try {
      await api.patch(`/admin/users/${u.uid}`, { disabled: !u.disabled });
      toast('success', t.common.save);
      usersQuery.refresh();
      stats.refresh();
    } catch (e) {
      toast('error', (e as Error).message);
    }
  };

  const toggleAdmin = async (u: AdminUser) => {
    try {
      await api.post(`/admin/claims/${u.uid}`, { admin: u.role !== 'admin' });
      toast('success', t.common.save);
      usersQuery.refresh();
    } catch (e) {
      toast('error', (e as Error).message);
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl">
        <PageHeader title={t.admin.title} subtitle="PORTAL AI — Admin" />

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {([
            ['stats', t.admin.stats],
            ['users', t.admin.users],
            ['plans', t.admin.planLimits],
            ['notify', t.admin.sendNotification],
            ['activity', t.admin.activityLog],
          ] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'rounded-xl px-4 py-2 text-sm font-medium transition-all',
                tab === id
                  ? 'border border-portal-violet/40 bg-gradient-to-r from-portal-violet/25 to-portal-blue/15 text-portal-text shadow-glow-sm'
                  : 'glass text-portal-muted hover:text-portal-text'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ------------------------------ STATS ------------------------------ */}
        {tab === 'stats' && (
          <div className="mt-6">
            {stats.error && !stats.data ? (
              <ErrorState message={stats.error} onRetry={stats.refresh} />
            ) : !stats.data ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-28" />)}
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard icon={Users} label={t.admin.totalUsers} value={stats.data.users.total} color="text-portal-violet-light" />
                  <StatCard icon={UserCheck} label={t.admin.activeUsers} value={stats.data.users.activeLast7d} color="text-portal-success" />
                  <StatCard icon={CreditCard} label={t.admin.activeSubs} value={stats.data.subscriptions.active} color="text-portal-warning" />
                  <StatCard icon={MessageSquare} label={t.admin.messagesCount} value={stats.data.content.messages} color="text-portal-cyan" />
                </div>

                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                  {/* Plan distribution */}
                  <section className="glass-card p-6">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-portal-muted">{t.admin.planDistribution}</h2>
                    <div className="mt-4 space-y-3">
                      {Object.entries(stats.data.subscriptions.planDistribution).length === 0 ? (
                        <p className="text-sm text-portal-muted">—</p>
                      ) : (
                        Object.entries(stats.data.subscriptions.planDistribution).map(([plan, count]) => {
                          const total = Object.values(stats.data!.subscriptions.planDistribution).reduce((a, b) => a + b, 0) || 1;
                          return (
                            <div key={plan}>
                              <div className="flex justify-between text-sm">
                                <span className="font-medium capitalize">{plan}</span>
                                <span className="text-portal-muted">{count}</span>
                              </div>
                              <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                                <div className="h-full rounded-full bg-gradient-to-r from-portal-violet to-portal-cyan" style={{ width: `${(count / total) * 100}%` }} />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </section>

                  {/* Usage 7d */}
                  <section className="glass-card p-6">
                    <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-portal-muted">
                      <TrendingUp className="h-4 w-4" /> {t.admin.usage7d}
                    </h2>
                    <div className="mt-4 flex items-end justify-between gap-2" dir="ltr">
                      {stats.data.usageByDay.length === 0 ? (
                        <p className="text-sm text-portal-muted">—</p>
                      ) : (
                        stats.data.usageByDay.map((d) => {
                          const max = Math.max(...stats.data!.usageByDay.map((x) => x.messages), 1);
                          return (
                            <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
                              <span className="text-[10px] text-portal-muted">{d.messages}</span>
                              <div className="w-full rounded-t-md bg-gradient-to-t from-portal-violet/60 to-portal-cyan/60" style={{ height: `${Math.max(6, (d.messages / max) * 90)}px` }} />
                              <span className="text-[9px] text-portal-muted">{d.date.slice(5)}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </section>
                </div>
              </>
            )}
          </div>
        )}

        {/* ------------------------------ USERS ------------------------------ */}
        {tab === 'users' && (
          <div className="mt-6">
            <div className="relative max-w-md">
              <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-portal-muted" />
              <input
                className="input-glass !ps-10"
                placeholder={t.admin.searchUsers}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && usersQuery.refresh()}
              />
            </div>

            {usersQuery.loading && !usersQuery.data ? (
              <div className="mt-4 flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-portal-violet" /></div>
            ) : (
              <div className="glass-card mt-4 overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-portal-muted">
                      <th className="px-4 py-3 text-start">{t.profile.email}</th>
                      <th className="px-4 py-3 text-start">{t.admin.role}</th>
                      <th className="px-4 py-3 text-start">{t.admin.planCol}</th>
                      <th className="px-4 py-3 text-start">{t.admin.status}</th>
                      <th className="px-4 py-3 text-start">{t.admin.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(usersQuery.data?.users || []).map((u) => (
                      <tr key={u.uid} className="border-b border-white/5 hover:bg-white/[0.03]">
                        <td className="px-4 py-3">
                          <p className="font-medium">{u.displayName || '—'}</p>
                          <p className="text-xs text-portal-muted" dir="ltr">{u.email || u.uid.slice(0, 10) + '…'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('badge', u.role === 'admin' ? 'border-portal-violet/40 bg-portal-violet/10 text-portal-violet-light' : 'border-white/10 bg-white/[0.05] text-portal-muted')}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 capitalize">{u.plan}</td>
                        <td className="px-4 py-3">
                          <span className={cn('badge', u.disabled ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-portal-success/30 bg-portal-success/10 text-portal-success')}>
                            {u.disabled ? t.admin.disabled : t.admin.enabled}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            <button onClick={() => toggleDisable(u)} className="btn-ghost !min-h-0 !p-2 text-xs" title={u.disabled ? t.admin.enable : t.admin.disable}>
                              {u.disabled ? <CheckCircle2 className="h-4 w-4 text-portal-success" /> : <Ban className="h-4 w-4 text-portal-warning" />}
                            </button>
                            <button onClick={() => toggleAdmin(u)} className="btn-ghost !min-h-0 !p-2 text-xs" title={u.role === 'admin' ? t.admin.removeAdmin : t.admin.makeAdmin}>
                              {u.role === 'admin' ? <ShieldOff className="h-4 w-4 text-red-300" /> : <ShieldCheck className="h-4 w-4 text-portal-violet-light" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(usersQuery.data?.users || []).length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-portal-muted">—</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------ PLANS ------------------------------ */}
        {tab === 'plans' && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {(plans.data?.plans || []).map((p) => (
              <PlanEditor key={p.id} plan={p} t={t} onSaved={() => { plans.refresh(); toast('success', t.common.save); }} onError={(m) => toast('error', m)} />
            ))}
          </div>
        )}

        {/* ---------------------------- NOTIFY ---------------------------- */}
        {tab === 'notify' && <NotifyForm t={t} lang={lang} onSent={() => toast('success', t.common.save)} onError={(m) => toast('error', m)} />}

        {/* ---------------------------- ACTIVITY ---------------------------- */}
        {tab === 'activity' && (
          <div className="glass-card mt-6 max-h-[60vh] overflow-y-auto p-0">
            {activity.data?.logs?.length ? (
              <ul className="divide-y divide-white/5">
                {activity.data.logs.map((log) => (
                  <li key={log.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                    <Activity className="mt-0.5 h-4 w-4 shrink-0 text-portal-cyan" />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs text-portal-text" dir="ltr">{log.action}</p>
                      <p className="mt-0.5 truncate text-[11px] text-portal-muted" dir="ltr">
                        {log.uid ? `${log.uid.slice(0, 8)}…` : 'system'} · {JSON.stringify(log.meta || {}).slice(0, 90)}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] text-portal-muted">{formatDateTime(log.createdAt, lang)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-10 text-center text-sm text-portal-muted">{t.admin.noActivity}</p>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Users; label: string; value: number; color: string }) {
  return (
    <div className="glass-card glass-card-hover p-5">
      <div className="flex items-center justify-between">
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06]', color)}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-extrabold">{value}</p>
      <p className="mt-0.5 text-xs text-portal-muted">{label}</p>
    </div>
  );
}

function PlanEditor({ plan, t, onSaved, onError }: {
  plan: Plan;
  t: ReturnType<typeof useLang>['t'];
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [price, setPrice] = useState(plan.price);
  const [msgs, setMsgs] = useState(plan.dailyMessages);
  const [imgs, setImgs] = useState(plan.dailyImages);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/admin/plans/${plan.id}`, { price, dailyMessages: msgs, dailyImages: imgs });
      onSaved();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{plan.name}</h2>
        <span className="badge border-white/10 bg-white/[0.05] text-portal-muted capitalize">{plan.id}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <label className="text-xs text-portal-muted">
          {t.admin.price}
          <input type="number" min={0} className="input-glass mt-1 !px-3" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </label>
        <label className="text-xs text-portal-muted">
          {t.admin.dailyMessages}
          <input type="number" min={1} className="input-glass mt-1 !px-3" value={msgs} onChange={(e) => setMsgs(Number(e.target.value))} />
        </label>
        <label className="text-xs text-portal-muted">
          {t.admin.dailyImages}
          <input type="number" min={0} className="input-glass mt-1 !px-3" value={imgs} onChange={(e) => setImgs(Number(e.target.value))} />
        </label>
      </div>
      <button onClick={save} disabled={saving} className="btn-primary mt-4 !py-2.5 !text-xs">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 rotate-180" />} {t.admin.savePlan}
      </button>
    </div>
  );
}

function NotifyForm({ t, lang, onSent, onError }: {
  t: ReturnType<typeof useLang>['t'];
  lang: 'ar' | 'en';
  onSent: () => void;
  onError: (m: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [uid, setUid] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!title.trim() || !body.trim()) return onError(t.tools.needInput);
    setSending(true);
    try {
      await api.post('/admin/notifications', {
        title: title.trim(),
        body: body.trim(),
        type: 'info',
        ...(uid.trim() ? { uid: uid.trim() } : {}),
      });
      setTitle(''); setBody(''); setUid('');
      onSent();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="glass-card mt-6 max-w-2xl p-6">
      <h2 className="text-lg font-bold">{t.admin.sendNotification}</h2>
      <div className="mt-4 space-y-4">
        <input className="input-glass" placeholder={lang === 'ar' ? 'العنوان' : 'Title'} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        <textarea className="input-glass resize-y" rows={3} placeholder={lang === 'ar' ? 'النص' : 'Body'} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} />
        <div>
          <label className="mb-1.5 block text-xs text-portal-muted">{t.admin.notifyUser} — {lang === 'ar' ? 'اتركه فارغًا للإرسال للجميع' : 'leave empty to broadcast'}</label>
          <input className="input-glass" dir="ltr" placeholder={t.admin.notifyAll} value={uid} onChange={(e) => setUid(e.target.value)} />
        </div>
        <button onClick={send} disabled={sending} className="btn-primary">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t.admin.sendNotification}
        </button>
      </div>
    </div>
  );
}
