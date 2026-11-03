import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Mail, Lock, User as UserIcon, UserPlus, CheckCircle2 } from 'lucide-react';
import { AuthLayout } from '../layouts/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../i18n/LanguageContext';
import { mapFirebaseError } from '../utils/helpers';
import { Spinner } from '../components/LoadingScreen';
import { FirebaseConfigNotice } from '../components/States';

export default function Register() {
  const { register, firebaseReady } = useAuth();
  const { t, lang } = useLang();
  const [params] = useSearchParams();
  const next = params.get('next') || '';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return setError(t.auth.requiredFields);
    if (password.length < 6) return setError(t.auth.passwordShort);
    if (password !== confirm) return setError(t.auth.passwordMismatch);

    setError(null);
    setSubmitting(true);
    try {
      await register(name.trim(), email.trim(), password);
      setSucceeded(true); // guard redirects when the observer fires
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      setError(mapFirebaseError(code, lang));
      setSubmitting(false);
    }
  };

  if (!firebaseReady) {
    return (
      <AuthLayout title={t.auth.registerTitle} subtitle={t.auth.registerSubtitle}>
        <FirebaseConfigNotice />
        <p className="mt-4 text-center text-sm text-portal-muted">
          {t.auth.hasAccount}{' '}
          <Link to="/login" className="font-semibold text-portal-cyan hover:underline">{t.nav.login}</Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t.auth.registerTitle} subtitle={t.auth.registerSubtitle}>
      {succeeded ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center animate-fade-in" role="status">
          <CheckCircle2 className="h-14 w-14 text-portal-success" />
          <p className="font-semibold text-portal-text">{t.auth.verifySent}</p>
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
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium">{t.auth.displayName}</label>
            <div className="relative">
              <UserIcon className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-portal-muted" />
              <input id="name" type="text" autoComplete="name" className="input-glass !ps-10" value={name}
                onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={60} />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">{t.auth.email}</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-portal-muted" />
              <input id="email" type="email" autoComplete="email" dir="ltr" className="input-glass !ps-10"
                placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium">{t.auth.password}</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-portal-muted" />
                <input id="password" type="password" autoComplete="new-password" dir="ltr" className="input-glass !ps-10"
                  placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </div>
            </div>
            <div>
              <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium">{t.auth.confirmPassword}</label>
              <input id="confirm" type="password" autoComplete="new-password" dir="ltr" className="input-glass"
                placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
            </div>
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? <Spinner /> : <UserPlus className="h-4 w-4" />}
            {t.auth.registerBtn}
          </button>

          <p className="text-center text-sm text-portal-muted">
            {t.auth.hasAccount}{' '}
            <Link to={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-portal-cyan hover:underline">
              {t.nav.login}
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
