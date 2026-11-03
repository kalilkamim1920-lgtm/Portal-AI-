/**
 * ============================================================================
 * AuthContext — the single source of truth for authentication state.
 * ============================================================================
 *
 * Design rules (login-loop prevention — see README "Authentication design"):
 *
 *  1. ONE AuthContext only. Every component reads state from here.
 *  2. onAuthStateChanged is the ONLY place that decides the user state.
 *  3. `authLoading` stays true until Firebase fires the first event, so no
 *     redirect happens before the session is actually known.
 *  4. No component redirects while `authLoading` is true (guards render a
 *     LoadingScreen instead).
 *  5. No automatic signIn/signOut inside effects — the SDK restores the
 *     persisted session; logout is only user-triggered.
 *  6. ProtectedRoute & PublicOnlyRoute are complementary by construction:
 *     they can never fight each other (one waits, the other redirects to a
 *     sanitized target that is never an auth page — see sanitizeNext()).
 *  7. React Router v6 <Navigate replace> used correctly — no history spam.
 *  8. Login/Register pages never self-redirect: they simply render forms;
 *     after successful sign-in the observer updates the user and the route
 *     guard performs ONE redirect.
 *  9. Session persistence: browserLocalPersistence (IndexedDB) — refreshes
 *     keep the user signed in because Firebase restores it before first paint
 *     decision (authLoading gate).
 * 10. Firebase errors are mapped to clear bilingual messages.
 * 11. User state and profile (server data) state are SEPARATE: authLoading vs
 *     profileLoading — a slow /api/auth/me never blocks route rendering.
 * 12. ?next= targets are sanitized (sanitizeNext) to prevent open redirects
 *     and /login↔/dashboard loops.
 * ============================================================================
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile as firebaseUpdateProfile,
  type User,
} from 'firebase/auth';
import { firebaseAuth, firebaseConfigured } from '../services/firebase';
import { api, invalidateTokenCache } from '../services/api';
import type { MeResponse } from '../types';
import type { UserProfile } from '../types';

interface AuthContextValue {
  /** Firebase user or null (null !== "loading" — check authLoading). */
  user: User | null;
  /** True until the first onAuthStateChanged event arrives. */
  authLoading: boolean;
  /** Server-side profile (null while loading — does NOT block routes). */
  profile: UserProfile | null;
  profileLoading: boolean;
  /** False until the first profile fetch for the CURRENT user completes. */
  profileReady: boolean;
  isAdmin: boolean;
  plan: string | null;
  usage: MeResponse['usage'] | null;
  providers: MeResponse['providers'] | null;
  /** True when Firebase env config (or emulator) is present. */
  firebaseReady: boolean;
  /** Refresh /api/auth/me (profile, plan, usage). */
  refreshProfile: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (displayName: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  sendResetEmail: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(firebaseConfigured);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const [usage, setUsage] = useState<MeResponse['usage'] | null>(null);
  const [providers, setProviders] = useState<MeResponse['providers'] | null>(null);

  const mounted = useRef(true);

  /** Load (or reload) the server profile for the signed-in user. */
  const refreshProfile = useCallback(async () => {
    if (!firebaseAuth?.currentUser) {
      setProfile(null);
      setIsAdmin(false);
      setPlan(null);
      setUsage(null);
      setProfileReady(true); // nothing pending
      return;
    }
    setProfileLoading(true);
    try {
      const me = await api.get<MeResponse>('/auth/me');
      if (!mounted.current) return;
      setProfile(me.user);
      setIsAdmin(me.isAdmin);
      setPlan(me.plan);
      setUsage(me.usage);
      setProviders(me.providers);
    } catch (err) {
      // Profile fetch failures must NEVER invalidate the Firebase session
      // (rule 11): keep the user signed in, just surface empty profile data.
      if (!mounted.current) return;
      setProfile((prev) => prev);
      setUsage(null);
    } finally {
      if (mounted.current) {
        setProfileLoading(false);
        setProfileReady(true); // verdict known (admin or not)
      }
    }
  }, []);

  /* ------------------------------------------------------------------ */
  /* Rule 2+3: subscribe ONCE; the first callback resolves authLoading.  */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    mounted.current = true;
    if (!firebaseConfigured || !firebaseAuth) {
      // No Firebase config → auth is "resolved" (no user), pages can render
      setAuthLoading(false);
      return () => {
        mounted.current = false;
      };
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      // Rule 5: no sign-in/sign-out side effects here — state only.
      setUser(firebaseUser);
      invalidateTokenCache();
      setAuthLoading(false); // rule 3: first event ends the "checking" phase
      if (firebaseUser) {
        // New session (reload or account switch): admin verdict is unknown
        // until the profile fetch completes — batched with the same paint.
        setProfileReady(false);
      } else {
        setProfile(null);
        setIsAdmin(false);
        setPlan(null);
        setUsage(null);
        setProfileReady(true);
      }
    });

    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, []);

  /* Load server profile whenever the user becomes non-null. */
  useEffect(() => {
    if (user) {
      refreshProfile().catch(() => {});
    } else {
      setProfile(null);
      setIsAdmin(false);
      setPlan(null);
      setUsage(null);
    }
  }, [user, refreshProfile]);

  /* ---------------------------- actions ---------------------------- */

  const login = useCallback(async (email: string, password: string) => {
    if (!firebaseAuth) throw new Error('NO_CONFIG');
    // No navigation here (rule 8): PublicOnlyRoute redirects after the
    // observer fires. We only surface errors.
    await signInWithEmailAndPassword(firebaseAuth, email, password);
  }, []);

  const register = useCallback(async (displayName: string, email: string, password: string) => {
    if (!firebaseAuth) throw new Error('NO_CONFIG');
    const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
    if (displayName) {
      await firebaseUpdateProfile(cred.user, { displayName });
    }
    // Email verification (non-blocking failure)
    try {
      await sendEmailVerification(cred.user);
    } catch {
      /* ignore — user can resend from settings */
    }
    // Profile is refreshed by the observer effect; nothing else to do here.
  }, []);

  const loginWithGoogle = useCallback(async () => {
    if (!firebaseAuth) throw new Error('NO_CONFIG');
    const provider = new GoogleAuthProvider();
    await signInWithPopup(firebaseAuth, provider);
  }, []);

  const logout = useCallback(async () => {
    if (!firebaseAuth) return;
    await firebaseSignOut(firebaseAuth);
    setUser(null);
    setProfile(null);
    setIsAdmin(false);
    setPlan(null);
    setUsage(null);
    setProfileReady(true);
    invalidateTokenCache();
  }, []);

  const sendResetEmail = useCallback(async (email: string) => {
    if (!firebaseAuth) throw new Error('NO_CONFIG');
    await sendPasswordResetEmail(firebaseAuth, email);
  }, []);

  const resendVerification = useCallback(async () => {
    if (!firebaseAuth?.currentUser) throw new Error('NO_USER');
    await sendEmailVerification(firebaseAuth.currentUser);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      authLoading,
      profile,
      profileLoading,
      profileReady,
      isAdmin,
      plan,
      usage,
      providers,
      firebaseReady: firebaseConfigured,
      refreshProfile,
      login,
      register,
      loginWithGoogle,
      logout,
      sendResetEmail,
      resendVerification,
    }),
    [
      user,
      authLoading,
      profile,
      profileLoading,
      profileReady,
      isAdmin,
      plan,
      usage,
      providers,
      refreshProfile,
      login,
      register,
      loginWithGoogle,
      logout,
      sendResetEmail,
      resendVerification,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
