/**
 * Route guards — complementary by construction (no redirect loops):
 *
 *  ProtectedRoute : user must exist  → else /login?next=<current>
 *  PublicOnlyRoute: user must NOT exist → else /dashboard (or sanitized ?next)
 *  AdminRoute     : user must exist AND be admin → else /dashboard
 *
 * All guards render <LoadingScreen/> while authLoading — they NEVER redirect
 * before the session is known (this is the anti-loop core).
 */
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sanitizeNext } from '../utils/helpers';
import { LoadingScreen } from '../components/LoadingScreen';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, authLoading } = useAuth();
  const location = useLocation();

  if (authLoading) return <LoadingScreen />;

  if (!user) {
    // Save the page the user wanted (rule: "أعد المستخدم إلى Login مع حفظ
    // الصفحة التي كان يريد فتحها") — sanitized to prevent open redirects.
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return <>{children}</>;
}

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { user, authLoading } = useAuth();
  const location = useLocation();

  if (authLoading) return <LoadingScreen />;

  if (user) {
    // Signed-in user opened /login → send to Dashboard AFTER auth is resolved.
    const params = new URLSearchParams(location.search);
    const next = sanitizeNext(params.get('next'));
    return <Navigate to={next} replace />;
  }

  return <>{children}</>;
}

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, authLoading, isAdmin, profileReady } = useAuth();
  const location = useLocation();

  if (authLoading) return <LoadingScreen />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  // Wait for the server-side admin verdict (GET /api/auth/me) before deciding.
  // profileReady flips false→true around the fetch for the CURRENT user, so a
  // hard refresh on /admin never bounces while the verdict is in flight.
  // Fail-closed: if the fetch fails, profileReady=true with isAdmin=false.
  if (!profileReady) return <LoadingScreen />;
  // Non-admins bounce to dashboard.
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
