/**
 * Shared utilities.
 */

/** Tailwind-friendly className combiner. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Sanitize the ?next= redirect target to prevent open redirects and
 * login↔dashboard redirect loops.
 * - must be a relative path starting with a single '/'
 * - must not be an auth page (would create a loop)
 */
const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password'];

export function sanitizeNext(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next) return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('://')) return fallback;
  const pathOnly = next.split('?')[0];
  if (AUTH_PAGES.includes(pathOnly)) return fallback;
  return next;
}

/**
 * Map Firebase error codes to clear bilingual messages.
 * (server also returns messages; these cover client-side auth errors)
 */
const FIREBASE_ERROR_MAP: Record<string, { ar: string; en: string }> = {
  'auth/invalid-email': { ar: 'البريد الإلكتروني غير صالح', en: 'Invalid email address' },
  'auth/user-disabled': { ar: 'تم تعطيل هذا الحساب', en: 'This account has been disabled' },
  'auth/user-not-found': { ar: 'لا يوجد حساب بهذا البريد الإلكتروني', en: 'No account found with this email' },
  'auth/wrong-password': { ar: 'كلمة المرور غير صحيحة', en: 'Incorrect password' },
  'auth/invalid-credential': { ar: 'البريد الإلكتروني أو كلمة المرور غير صحيحة', en: 'Incorrect email or password' },
  'auth/email-already-in-use': { ar: 'هذا البريد الإلكتروني مستخدم بالفعل', en: 'This email is already registered' },
  'auth/weak-password': { ar: 'كلمة المرور ضعيفة — استخدم 6 أحرف على الأقل', en: 'Weak password — use at least 6 characters' },
  'auth/too-many-requests': { ar: 'محاولات كثيرة جدًا، حاول لاحقًا', en: 'Too many attempts, please try again later' },
  'auth/network-request-failed': { ar: 'فشل الاتصال بالشبكة', en: 'Network connection failed' },
  'auth/popup-closed-by-user': { ar: 'تم إغلاق نافذة تسجيل الدخول', en: 'Sign-in popup was closed' },
  'auth/operation-not-allowed': { ar: 'طريقة تسجيل الدخول غير مفعّلة في إعدادات Firebase', en: 'Sign-in method not enabled in Firebase settings' },
  'auth/requires-recent-login': { ar: 'يرجى تسجيل الدخول مجددًا ثم المحاولة', en: 'Please sign in again and retry' },
  'auth/missing-password': { ar: 'أدخل كلمة المرور', en: 'Please enter your password' },
};

export function mapFirebaseError(code: string | undefined, lang: 'ar' | 'en' = 'ar'): string {
  if (!code) return lang === 'ar' ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred';
  const entry = FIREBASE_ERROR_MAP[code];
  if (entry) return lang === 'ar' ? entry.ar : entry.en;
  const clean = code.replace('auth/', '').replace(/-/g, ' ');
  return lang === 'ar' ? `تعذر إكمال العملية (${clean})` : `Could not complete the operation (${clean})`;
}

/** Quota error message from the server (429 responses). */
export function quotaMessage(message: string, lang: 'ar' | 'en'): string {
  if (lang === 'ar') return `تم استهلاك الحصة اليومية. ${message}`;
  return `Daily quota exceeded. ${message}`;
}

export function formatDate(iso: string | null | undefined, lang: 'ar' | 'en'): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export function formatDateTime(iso: string | null | undefined, lang: 'ar' | 'en'): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function initials(name: string | null | undefined, email: string | null | undefined): string {
  const src = name || email || 'U';
  const parts = src.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}
