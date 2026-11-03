/**
 * Reset Password page — consumes the Firebase oobCode from the email link.
 * Link format: <actionUrl>?oobCode=XXX&mode=resetPassword
 * Configure the "Password reset" action URL to point here in Firebase Console.
 */
import { useState, type FormEvent, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, KeyRound, CheckCircle2, AlertTriangle } from 'lucide-react';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { AuthLayout } from '../layouts/AuthLayout';
import { firebaseAuth } from '../services/firebase';
import { useLang } from '../i18n/LanguageContext';
import { mapFirebaseError } from '../utils/helpers';
import { Spinner } from '../components/LoadingScreen';

export default function ResetPassword() {
  const { t, lang } = useLang();
  const [params] = useSearchParams();
  const oobCode = params.get('oobCode');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeState, setCodeState] = useState<'checking' | 'valid' | 'invalid'>(oobCode ? 'checking' : 'invalid');

  // Verify the reset code on load
  useEffect(() => {
    if (!oobCode || !firebaseAuth) {
      setCodeState('invalid');
      return;
    }
    verifyPasswordResetCode(firebaseAuth, oobCode)
      .then(() => setCodeState('valid'))
      .catch(() => setCodeState('invalid'));
  }, [oobCode]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return setError(t.auth.passwordShort);
    if (password !== confirm) return setError(t.auth.passwordMismatch);
    setError(null);
    setSubmitting(true);
    try {
      if (!firebaseAuth || !oobCode) throw new Error('missing code');
      await confirmPasswordReset(firebaseAuth, oobCode, password);
      setDone(true);
    } catch (err) {
      setError(mapFirebaseError((err as { code?: string })?.code, lang));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title={t.auth.resetTitle} subtitle={t.auth.resetSubtitle}>
      {codeState === 'checking' ? (
        <div className="flex justify-center py-6"><Spinner className="h-8 w-8 text-portal-violet" /></div>
      ) : codeState === 'invalid' ? (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <AlertTriangle className="h-12 w-12 text-portal-warning" />
          <p className="text-sm leading-7 text-portal-muted">
            رابط إعادة التعيين غير صالح أو منتهي. / This reset link is invalid or expired.
          </p>
          <Link to="/forgot-password" className="btn-secondary">{t.auth.forgotTitle}</Link>
        </div>
      ) : done ? (
        <div className="flex flex-col items-center gap-4 py-4 text-center animate-fade-in">
          <CheckCircle2 className="h-14 w-14 text-portal-success" />
          <p className="text-sm text-portal-text">{t.auth.resetDone}</p>
          <Link to="/login" className="btn-primary">{t.nav.login}</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="newpass" className="mb-1.5 block text-sm font-medium">{t.auth.newPassword}</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-portal-muted" />
              <input id="newpass" type="password" autoComplete="new-password" dir="ltr" className="input-glass !ps-10"
                placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
          </div>
          <div>
            <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium">{t.auth.confirmPassword}</label>
            <input id="confirm" type="password" autoComplete="new-password" dir="ltr" className="input-glass"
              placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? <Spinner /> : <KeyRound className="h-4 w-4" />}
            {t.auth.resetBtn}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
