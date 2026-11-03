import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, SendHorizonal, CheckCircle2 } from 'lucide-react';
import { AuthLayout } from '../layouts/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../i18n/LanguageContext';
import { mapFirebaseError } from '../utils/helpers';
import { Spinner } from '../components/LoadingScreen';
import { FirebaseConfigNotice } from '../components/States';

export default function ForgotPassword() {
  const { sendResetEmail, firebaseReady } = useAuth();
  const { t, lang } = useLang();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return setError(t.auth.requiredFields);
    setError(null);
    setSubmitting(true);
    try {
      await sendResetEmail(email.trim());
      setSent(true);
    } catch (err) {
      setError(mapFirebaseError((err as { code?: string })?.code, lang));
    } finally {
      setSubmitting(false);
    }
  };

  if (!firebaseReady) {
    return (
      <AuthLayout title={t.auth.forgotTitle} subtitle={t.auth.forgotSubtitle}>
        <FirebaseConfigNotice />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t.auth.forgotTitle} subtitle={t.auth.forgotSubtitle}>
      {sent ? (
        <div className="flex flex-col items-center gap-4 py-4 text-center animate-fade-in">
          <CheckCircle2 className="h-14 w-14 text-portal-success" />
          <p className="text-sm leading-7 text-portal-text">{t.auth.resetSent}</p>
          <Link to="/login" className="btn-secondary">{t.auth.backToLogin}</Link>
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
              <input id="email" type="email" autoComplete="email" dir="ltr" className="input-glass !ps-10"
                placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? <Spinner /> : <SendHorizonal className="h-4 w-4" />}
            {t.auth.forgotBtn}
          </button>
          <p className="text-center text-sm text-portal-muted">
            <Link to="/login" className="font-semibold text-portal-cyan hover:underline">{t.auth.backToLogin}</Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
