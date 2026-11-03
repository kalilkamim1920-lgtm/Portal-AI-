/**
 * Login page — rebuilt as part of the auth fix.
 *
 * Loop-safety notes:
 * - This component NEVER redirects: after a successful sign-in the auth
 *   observer updates the user, and PublicOnlyRoute performs exactly one
 *   redirect to ?next= or /dashboard.
 * - It never renders while authLoading (the guard shows a LoadingScreen).
 */
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Mail, Lock, LogIn, CheckCircle2 } from 'lucide-react';
import { AuthLayout } from '../layouts/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../i18n/LanguageContext';
import { mapFirebaseError } from '../utils/helpers';
import { Spinner } from '../components/LoadingScreen';
import { FirebaseConfigNotice } from '../components/States';

export default function Login() {
  const { login, loginWithGoogle, firebaseReady } = useAuth();
  const { t, lang } = useLang();
  const [params] = useSearchParams();
  const next = params.get('next') || '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError(t.auth.requiredFields);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      // Do NOT navigate here — the route guard owns redirect decisions.
      setSucceeded(true);
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      const msg = (err as Error)?.message === 'NO_CONFIG'
        ? t.auth.configMissingDesc
        : mapFirebaseError(code, lang);
      setError(msg);
      setSubmitting(false);
    }
  };

  const onGoogle = async () => {
    setError(null);
    try {
      await loginWithGoogle();
      setSucceeded(true);
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError(mapFirebaseError(code, lang));
      }
    }
  };

  if (!firebaseReady) {
    return (
      <AuthLayout title={t.auth.loginTitle} subtitle={t.auth.loginSubtitle}>
        <FirebaseConfigNotice />
        <p className="mt-4 text-center text-sm text-portal-muted">
          {t.auth.noAccount}{' '}
          <Link to="/register" className="font-semibold text-portal-cyan hover:underline">{t.nav.register}</Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t.auth.loginTitle} subtitle={t.auth.loginSubtitle}>
      {succeeded ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center animate-fade-in" role="status">
          <CheckCircle2 className="h-14 w-14 text-portal-success" />
          <p className="font-semibold text-portal-text">{t.auth.welcomeBack}</p>
          <Spinner className="h-5 w-5 text-portal-violet" />
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">{t.auth.email}</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-portal-muted" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                dir="ltr"
                className="input-glass !ps-10"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium">{t.auth.password}</label>
              <Link to={`/forgot-password${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-xs text-portal-cyan hover:underline">
                {t.auth.forgotLink}
              </Link>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-portal-muted" />
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                dir="ltr"
                className="input-glass !ps-10"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? <Spinner /> : <LogIn className="h-4 w-4" />}
            {t.auth.loginBtn}
          </button>

          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-portal-muted">{t.auth.or}</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <button type="button" onClick={onGoogle} className="btn-secondary w-full" disabled={submitting}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path fill="#EA4335" d="M12 5.04c1.7 0 3.22.59 4.42 1.73l3.29-3.29C17.73 1.63 15.11.5 12 .5 7.53.5 3.68 3.07 1.8 6.87l3.84 2.98C6.57 7.09 9.03 5.04 12 5.04z" />
              <path fill="#4285F4" d="M23.5 12.27c0-.79-.07-1.55-.2-2.27H12v4.51h6.45c-.28 1.48-1.12 2.73-2.39 3.58l3.72 2.89c2.17-2 3.72-4.96 3.72-8.71z" />
              <path fill="#FBBC05" d="M5.64 14.15a7.2 7.2 0 010-4.3L1.8 6.87a11.5 11.5 0 000 10.26l3.84-2.98z" />
              <path fill="#34A853" d="M12 23.5c3.11 0 5.73-1.03 7.64-2.79l-3.72-2.89c-1.03.7-2.36 1.11-3.92 1.11-2.97 0-5.43-2.05-6.36-4.78l-3.84 2.98C3.68 20.93 7.53 23.5 12 23.5z" />
            </svg>
            {t.auth.googleBtn}
          </button>

          <p className="text-center text-sm text-portal-muted">
            {t.auth.noAccount}{' '}
            <Link to={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-portal-cyan hover:underline">
              {t.nav.register}
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
