/**
 * Notifications — user + broadcast notifications with read marks.
 */
import { Bell, CheckCheck, Info, CheckCircle2, AlertTriangle, XCircle, Megaphone } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useLang } from '../i18n/LanguageContext';
import { api } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { useToast } from '../components/Toast';
import { PageHeader, ErrorState } from '../components/States';
import { cn, formatDateTime } from '../utils/helpers';
import type { NotificationItem } from '../types';

const TYPE_ICON = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle };
const TYPE_COLOR = {
  info: 'text-portal-cyan bg-portal-cyan/10 border-portal-cyan/30',
  success: 'text-portal-success bg-portal-success/10 border-portal-success/30',
  warning: 'text-portal-warning bg-portal-warning/10 border-portal-warning/30',
  danger: 'text-red-300 bg-red-500/10 border-red-500/30',
};

export default function Notifications() {
  const { t, lang } = useLang();
  const { toast } = useToast();
  const { data, loading, error, refresh } = useAsync<{ notifications: NotificationItem[]; unread: number }>(
    async () => api.get('/notifications'),
    []
  );

  const markAll = async () => {
    try {
      await api.post('/notifications/read-all');
      refresh();
    } catch (e) {
      toast('error', (e as Error).message);
    }
  };

  const markOne = async (id: string) => {
    try {
      await api.post(`/notifications/${id}/read`);
      refresh();
    } catch { /* ignore */ }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title={t.notifications.title}
          subtitle={data ? `${data.unread} ${t.notifications.unread}` : undefined}
          action={
            data && data.unread > 0 ? (
              <button onClick={markAll} className="btn-secondary !py-2.5">
                <CheckCheck className="h-4 w-4" /> {t.notifications.markAll}
              </button>
            ) : undefined
          }
        />

        {error && !data && <ErrorState message={t.common.serverError} onRetry={refresh} />}

        {loading && !data ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-20 w-full" />)}
          </div>
        ) : data && data.notifications.length > 0 ? (
          <ul className="space-y-3">
            {data.notifications.map((n) => {
              const Icon = TYPE_ICON[n.type] || Info;
              return (
                <li key={n.id}>
                  <article
                    className={cn(
                      'glass-card flex items-start gap-3.5 p-4',
                      !n.read && 'border-portal-violet/30 bg-gradient-to-r from-portal-violet/[0.08] to-transparent'
                    )}
                  >
                    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', TYPE_COLOR[n.type])}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{n.title}</h3>
                        {n.broadcast && (
                          <span className="badge border-white/10 bg-white/[0.06] text-portal-muted">
                            <Megaphone className="h-3 w-3" /> {t.notifications.broadcast}
                          </span>
                        )}
                        {!n.read && <span className="h-2 w-2 rounded-full bg-portal-violet shadow-glow-sm" />}
                      </div>
                      <p className="mt-1 text-sm leading-6 text-portal-muted">{n.body}</p>
                      <div className="mt-2 flex items-center gap-3">
                        <span className="text-[11px] text-portal-muted/70">{formatDateTime(n.createdAt, lang)}</span>
                        {!n.read && (
                          <button onClick={() => markOne(n.id)} className="text-[11px] text-portal-cyan hover:underline">
                            ✓ {lang === 'ar' ? 'تعليم كمقروء' : 'Mark as read'}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="glass-card flex flex-col items-center gap-2 p-10 text-center text-sm text-portal-muted">
            <Bell className="h-8 w-8 text-portal-muted/40" />
            {t.notifications.empty}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
