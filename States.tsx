import type { ReactNode } from 'react';
import { AlertTriangle, RefreshCw, KeyRound } from 'lucide-react';

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-portal-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="glass-card flex flex-col items-center gap-3 p-8 text-center">
      <AlertTriangle className="h-10 w-10 text-portal-warning" />
      <p className="max-w-md text-sm text-portal-muted">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary">
          <RefreshCw className="h-4 w-4" /> إعادة المحاولة / Retry
        </button>
      )}
    </div>
  );
}

/** Shown when Firebase env vars are missing — honest state, no fake auth. */
export function FirebaseConfigNotice() {
  return (
    <div className="glass-card flex flex-col items-center gap-4 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-portal-warning/15">
        <KeyRound className="h-7 w-7 text-portal-warning" />
      </div>
      <div>
        <h2 className="text-lg font-bold">Firebase غير مهيأ / Firebase is not configured</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-portal-muted">
          هذا المشروع يستخدم Firebase Authentication الحقيقي — بدون بيانات وهمية.
          لتفعيل التسجيل: انسخ <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">.env.example</code> إلى
          <code className="mx-1 rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">.env</code> وأضف مفاتيح
          <code className="mx-1 rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">VITE_FIREBASE_*</code> من Firebase Console.
        </p>
        <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-portal-muted/80">
          This app uses REAL Firebase Authentication — never mocked. To enable sign-in, copy
          <code className="mx-1 rounded bg-white/10 px-1 font-mono">.env.example</code> to
          <code className="mx-1 rounded bg-white/10 px-1 font-mono">.env</code> and add the
          <code className="mx-1 rounded bg-white/10 px-1 font-mono">VITE_FIREBASE_*</code> keys from your Firebase Console.
        </p>
      </div>
      <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="btn-secondary">
        Firebase Console →
      </a>
    </div>
  );
}
