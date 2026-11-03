/**
 * Settings — language, default model, notification prefs, appearance, danger zone.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Languages, Bell, Palette, Moon, AlertTriangle, Trash2, Save, Cpu } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useLang } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/States';
import { cn } from '../utils/helpers';
import { Spinner } from '../components/LoadingScreen';

export default function Settings() {
  const { t, lang, setLang } = useLang();
  const { user, profile, providers, refreshProfile, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [model, setModel] = useState(profile?.settings?.defaultModel || '');
  const [emailNotifs, setEmailNotifs] = useState(profile?.settings?.emailNotifications ?? true);
  const [pushNotifs, setPushNotifs] = useState(profile?.settings?.pushNotifications ?? true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch('/auth/profile', {
        settings: { defaultModel: model || undefined, emailNotifications: emailNotifs, pushNotifications: pushNotifs },
      });
      await refreshProfile();
      toast('success', t.profile.saved);
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async () => {
    if (!window.confirm(t.settings.deleteConfirm)) return;
    setDeleting(true);
    try {
      await api.del('/auth/account');
      toast('success', t.settings.accountDeleted);
      await logout();
      navigate('/', { replace: true });
    } catch (e) {
      toast('error', (e as Error).message);
      setDeleting(false);
    }
  };

  const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm hover:bg-white/[0.05]"
    >
      <span>{label}</span>
      <span className={cn('relative h-6 w-11 rounded-full transition-colors', checked ? 'bg-gradient-to-r from-portal-violet to-portal-blue' : 'bg-white/15')}>
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'start-[22px]' : 'start-0.5')} />
      </span>
    </button>
  );

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl">
        <PageHeader
          title={t.settings.title}
          action={
            <button onClick={save} disabled={saving} className="btn-primary !py-2.5">
              {saving ? <Spinner /> : <Save className="h-4 w-4" />} {t.common.save}
            </button>
          }
        />

        {/* Language */}
        <section className="glass-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Languages className="h-5 w-5 text-portal-cyan" /> {t.settings.language}</h2>
          <p className="mt-1 text-sm text-portal-muted">{t.settings.languageDesc}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {(['ar', 'en'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={cn(
                  'rounded-xl border p-4 text-start transition-all',
                  lang === l
                    ? 'border-portal-violet/50 bg-gradient-to-br from-portal-violet/20 to-portal-blue/10 shadow-glow-sm'
                    : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                )}
              >
                <span className="text-2xl">{l === 'ar' ? '🇸🇦' : '🇬🇧'}</span>
                <p className="mt-1.5 font-semibold">{l === 'ar' ? 'العربية (RTL)' : 'English (LTR)'}</p>
                <p className="text-xs text-portal-muted">{l === 'ar' ? 'الافتراضية' : 'Switch direction'}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Default model */}
        <section className="glass-card mt-5 p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Cpu className="h-5 w-5 text-portal-violet-light" /> {t.settings.defaultModel}</h2>
          <p className="mt-1 text-sm text-portal-muted">{t.settings.defaultModelDesc}</p>
          <select className="input-glass mt-4 max-w-md" value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="">Auto</option>
            {(providers?.models || []).map((m) => (
              <option key={m.id} value={m.id}>{m.name} ({m.badge})</option>
            ))}
          </select>
        </section>

        {/* Notifications */}
        <section className="glass-card mt-5 p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Bell className="h-5 w-5 text-portal-warning" /> {t.settings.notifications}</h2>
          <div className="mt-4 space-y-3">
            <Toggle checked={emailNotifs} onChange={setEmailNotifs} label={t.settings.emailNotifications} />
            <Toggle checked={pushNotifs} onChange={setPushNotifs} label={t.settings.pushNotifications} />
          </div>
        </section>

        {/* Appearance */}
        <section className="glass-card mt-5 p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Palette className="h-5 w-5 text-portal-blue" /> {t.settings.appearance}</h2>
          <div className="mt-4">
            <div className="flex items-center justify-between rounded-xl border border-portal-violet/30 bg-portal-violet/10 px-4 py-3 text-sm">
              <span className="flex items-center gap-2"><Moon className="h-4 w-4 text-portal-violet-light" /> {t.settings.darkMode}</span>
              <span className="badge border-portal-success/30 bg-portal-success/10 text-portal-success">✓ {lang === 'ar' ? 'مفعّل دائمًا' : 'Always on'}</span>
            </div>
            <p className="mt-2 text-xs text-portal-muted">{t.settings.darkModeDesc}</p>
          </div>
        </section>

        {/* Danger zone */}
        <section className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/[0.04] p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-red-300">
            <AlertTriangle className="h-5 w-5" /> {t.settings.dangerZone}
          </h2>
          <p className="mt-1 text-sm text-portal-muted">{user?.email}</p>
          <button onClick={deleteAccount} disabled={deleting} className="btn-danger mt-4">
            {deleting ? <Spinner /> : <Trash2 className="h-4 w-4" />} {t.settings.deleteAccount}
          </button>
        </section>
      </div>
    </DashboardLayout>
  );
}
