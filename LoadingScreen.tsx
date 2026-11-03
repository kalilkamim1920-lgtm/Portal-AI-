/**
 * Full-screen loading indicator shown while the auth session is being
 * resolved (the anti-login-loop gate) and during lazy loads.
 */
export function LoadingScreen({ label }: { label?: string }) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-portal-bg"
      role="status"
      aria-live="polite"
    >
      <div className="relative">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-portal-violet to-portal-blue shadow-glow animate-glow-pulse flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="h-8 w-8 text-white" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="absolute -inset-3 -z-10 rounded-3xl bg-portal-violet/20 blur-2xl" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      <p className="text-sm text-portal-muted">{label || 'جارٍ التحقق من الجلسة… / Checking session…'}</p>
    </div>
  );
}

/** Inline spinner for buttons and small areas. */
export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
