/**
 * Profile — view/update profile info, email verification, password change.
 */
import { useState } from 'react';
import { Mail, BadgeCheck, AlertCircle, Save, KeyRound, CalendarDays, ShieldCheck } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useLang } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { firebaseAuth } from '../services/firebase';
import {
  EmailAuthProvider, reauthenticateWithCredential, updatePassword,
} from 'firebase/auth';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import { PageHeader } from '../components/States';
import { Spinner } from '../components/LoadingScreen';
import { initials, formatDate, mapFirebaseError } from '../utils/helpers';

export default function Profile() {
  const { user, profile, refreshProfile, resendVerification } = useAuth();
  const { t, lang } = useLang();
  const { toast } = useToast();

  const [name, setName] = useState(profile?.displayName || '');
  const [saving, setSaving] = useState(false);
  const [verifySent, setVerifySent] = useState(false);

  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  const saveName = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.patch('/auth/profile', { displayName: name.trim() });
      await refreshProfile();
      toast('success', t.profile.saved);
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const doVerify = async () => {
    try {
      await resendVerification();
      setVerifySent(true);
      toast('success', t.profile.verifySent);
    } catch (e) {
      toast('error', mapFirebaseError((e as { code?: string })?.code, lang));
    }
  };

  const changePassword = async () => {
    if (newPass.length < 6) return toast('warning', t.auth.passwordShort);
    if (!firebaseAuth?.currentUser) return;
    setChangingPass(true);
    try {
      // Re-authenticate first (Firebase security requirement)
      const cred = EmailAuthProvider.credential(firebaseAuth.currentUser.email || '', currentPass);
      await reauthenticateWithCredential(firebaseAuth.currentUser, cred);
      await updatePassword(firebaseAuth.currentUser, newPass);
      setCurrentPass(''); setNewPass('');
      toast('success', t.profile.passwordUpdated);
    } catch (e) {
      toast('error', mapFirebaseError((e as { code?: string })?.code, lang));
    } finally {
      setChangingPass(false);
    }
  };

  const emailVerified = user?.emailVerified || profile?.emailVerified;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl">
        <PageHeader title={t.profile.title} />

        {/* Identity card */}
        <section className="glass-card p-6">
          <div className="flex flex-wrap items-center gap-5">
            <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-portal-violet to-portal-blue text-2xl font-extrabold text-white shadow-glow">
              {initials(profile?.displayName, user?.email)}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-bold">{profile?.displayName || user?.displayName || '—'}</h2>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-portal-muted">
                <Mail className="h-4 w-4" /> <span dir="ltr">{user?.email}</span>
                {emailVerified ? (
                  <span className="badge border-portal-success/30 bg-portal-success/10 text-portal-success">
                    <BadgeCheck className="h-3 w-3" /> {t.profile.verified}
                  </span>
                ) : (
                  <span className="badge border-portal-warning/30 bg-portal-warning/10 text-portal-warning">
                    <AlertCircle className="h-3 w-3" /> {t.profile.notVerified}
                  </span>
                )}
              </p>
              <p className="mt-1 flex items-center gap-2 text-xs text-portal-muted">
                <CalendarDays className="h-3.5 w-3.5" /> {t.profile.memberSince}: {formatDate(profile?.createdAt, lang)}
              </p>
            </div>
          </div>

          {!emailVerified && (
            <button onClick={doVerify} disabled={verifySent} className="btn-secondary mt-4 !py-2.5 !text-xs">
              <ShieldCheck className="h-4 w-4" /> {verifySent ? t.profile.verifySent : t.profile.verifyBtn}
            </button>
          )}
        </section>

        {/* Edit profile */}
        <section className="glass-card mt-5 p-6">
          <h2 className="text-lg font-bold">{t.profile.title}</h2>
          <div className="mt-4 max-w-md space-y-4">
            <div>
              <label htmlFor="dname" className="mb-1.5 block text-sm font-medium">{t.auth.displayName}</label>
              <div className="flex gap-2">
                <input id="dname" className="input-glass flex-1" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
                <button onClick={saveName} disabled={saving || !name.trim()} className="btn-primary !px-4">
                  {saving ? <Spinner /> : <Save className="h-4 w-4" />}
                  <span className="hidden sm:inline">{t.profile.save}</span>
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">{t.profile.email}</label>
              <input className="input-glass opacity-60" dir="ltr" value={user?.email || ''} disabled />
            </div>
          </div>
        </section>

        {/* Change password */}
        <section className="glass-card mt-5 p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <KeyRound className="h-5 w-5 text-portal-violet-light" />
            {t.profile.changePassword}
          </h2>
          <div className="mt-4 max-w-md space-y-4">
            <div>
              <label htmlFor="curpass" className="mb-1.5 block text-sm font-medium">{t.profile.currentPassword}</label>
              <input id="curpass" type="password" dir="ltr" className="input-glass" value={currentPass}
                onChange={(e) => setCurrentPass(e.target.value)} autoComplete="current-password" />
            </div>
            <div>
              <label htmlFor="newpass" className="mb-1.5 block text-sm font-medium">{t.profile.newPassword}</label>
              <input id="newpass" type="password" dir="ltr" className="input-glass" value={newPass}
                onChange={(e) => setNewPass(e.target.value)} autoComplete="new-password" />
            </div>
            <button onClick={changePassword} disabled={changingPass || !currentPass || !newPass} className="btn-primary">
              {changingPass ? <Spinner /> : <KeyRound className="h-4 w-4" />}
              {t.profile.updatePassword}
            </button>
          </div>
        </section>

        {/* Token cache note */}
        <p className="mt-4 text-center text-[11px] text-portal-muted">
          🔐 {lang === 'ar'
            ? 'لا يتم تخزين كلمات المرور كنص عادي — إدارتها تتم عبر Firebase Authentication.'
            : 'Passwords are never stored in plaintext — managed by Firebase Authentication.'}
        </p>
      </div>
    </DashboardLayout>
  );
}
