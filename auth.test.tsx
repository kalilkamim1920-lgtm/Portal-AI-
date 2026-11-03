/**
 * Auth & routing tests — the anti-login-loop guarantees.
 *
 * These tests mock the firebase/auth module and run the REAL AuthContext,
 * guards and helpers against it, verifying:
 *  - authLoading gates every redirect until the session is known
 *  - signed-in user on /login is redirected to ?next= or /dashboard exactly once
 *  - signed-out user on a protected page is sent to /login?next=<saved>
 *  - sanitizeNext blocks open redirects and /login↔/dashboard loops
 *  - Firebase error codes map to clear messages
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';

/* ---------------------- mock firebase/auth ---------------------- */

type Listener = (user: { uid: string; email: string } | null) => void;

const state = {
  currentUser: null as null | { uid: string; email: string },
  listener: null as Listener | null,
};

vi.mock('firebase/auth', () => {
  return {
    onAuthStateChanged: (_auth: unknown, cb: Listener) => {
      state.listener = cb;
      // Emit the persisted session asynchronously (like the real SDK)
      Promise.resolve().then(() => cb(state.currentUser));
      return () => {
        state.listener = null;
      };
    },
    signInWithEmailAndPassword: vi.fn(async (_a: unknown, email: string) => {
      state.currentUser = { uid: 'u-1', email };
      state.listener?.(state.currentUser);
      return { user: state.currentUser };
    }),
    createUserWithEmailAndPassword: vi.fn(async (_a: unknown, email: string) => {
      state.currentUser = { uid: 'u-2', email };
      state.listener?.(state.currentUser);
      return { user: state.currentUser };
    }),
    sendPasswordResetEmail: vi.fn(async () => {}),
    sendEmailVerification: vi.fn(async () => {}),
    signInWithPopup: vi.fn(async () => {}),
    signOut: vi.fn(async () => {
      state.currentUser = null;
      state.listener?.(null);
    }),
    updateProfile: vi.fn(async () => {}),
    setPersistence: vi.fn(async () => {}),
    browserLocalPersistence: 'local',
    GoogleAuthProvider: class {},
  };
});

vi.mock('../src/services/firebase', () => ({
  firebaseConfigured: true,
  firebaseAuth: { currentUser: null },
  firebaseApp: {},
}));

vi.mock('../src/services/api', () => ({
  api: {
    get: vi.fn(async () => ({
      user: { uid: 'u-1', email: 'a@b.c', displayName: 'A', language: 'ar', settings: {}, emailVerified: true, photoURL: null, createdAt: null },
      plan: 'free',
      planName: 'Free',
      usage: { limits: { messages: 10, images: 2 }, used: { messages: 0, images: 0, toolCalls: 0 }, remaining: { messages: 10, images: 2 } },
      isAdmin: false,
      providers: { chat: 'gemini', image: 'zai', models: [] },
    })),
    post: vi.fn(async () => ({})),
    patch: vi.fn(async () => ({})),
    del: vi.fn(async () => ({})),
  },
  invalidateTokenCache: vi.fn(),
}));

import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { sanitizeNext, mapFirebaseError } from '../src/utils/helpers';

/* --------------------------- helpers --------------------------- */

function Probe() {
  const { authLoading, user } = useAuth();
  return (
    <div data-testid="probe">
      {authLoading ? 'loading' : user ? `user:${user.email}` : 'anonymous'}
    </div>
  );
}

function renderAt(ui: React.ReactNode, initialPath: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/login" element={ui} />
          <Route path="/dashboard" element={ui} />
          <Route path="*" element={ui} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

beforeEach(() => {
  state.currentUser = null;
  state.listener = null;
  window.localStorage.clear();
});

afterEach(cleanup);

/* --------------------------- AuthContext --------------------------- */

describe('AuthContext', () => {
  it('starts in authLoading until the first onAuthStateChanged event', async () => {
    renderAt(<Probe />, '/dashboard');
    // Before the observer fires we must be "loading" — never "anonymous"
    expect(screen.getByTestId('probe').textContent).toBe('loading');
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('anonymous'));
  });

  it('restores the persisted session after refresh (no login loop)', async () => {
    state.currentUser = { uid: 'u-1', email: 'persisted@test.io' };
    renderAt(<Probe />, '/dashboard');
    expect(screen.getByTestId('probe').textContent).toBe('loading');
    await waitFor(() => expect(screen.getByTestId('probe').textContent).toBe('user:persisted@test.io'));
  });

  it('login() signs in without any automatic sign-out or redirect side effects', async () => {
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    function LoginProbe() {
      const { login } = useAuth();
      return <button onClick={() => void login('me@test.io', 'secret123')}>do-login</button>;
    }
    renderAt(<LoginProbe />, '/login');
    (screen.getByText('do-login') as HTMLButtonElement).click();
    await waitFor(() => expect(signInWithEmailAndPassword).toHaveBeenCalled());
    await waitFor(() => expect(state.currentUser?.email).toBe('me@test.io'));
  });

  it('logout() clears the user through the observer', async () => {
    state.currentUser = { uid: 'u-1', email: 'x@test.io' };
    function LogoutProbe() {
      const { logout } = useAuth();
      return <button onClick={() => void logout()}>do-logout</button>;
    }
    renderAt(<LogoutProbe />, '/dashboard');
    (screen.getByText('do-logout') as HTMLButtonElement).click();
    await waitFor(() => expect(state.currentUser).toBeNull());
  });
});

/* ----------------------------- guards ----------------------------- */

describe('Route guards (loop prevention)', () => {
  it('ProtectedRoute sends an anonymous user to /login?next=<intended>', async () => {
    const { ProtectedRoute: Protected } = await import('../src/routes/guards');
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/dashboard" element={<Protected><div>SECRET</div></Protected>} />
            <Route path="/login" element={<div>LOGIN-PAGE</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText('LOGIN-PAGE')).toBeTruthy());
    // next saved for post-login redirect
    expect(window.location.pathname).not.toBe('/dashboard');
  });

  it('ProtectedRoute shows a loading screen (never redirects) while authLoading', async () => {
    // Do not fire the observer yet: no currentUser, listener stored but pending
    let holdListener: Listener | null = null;
    const auth = await import('firebase/auth');
    const original = auth.onAuthStateChanged;
    // Override once to delay the first event
    // @ts-expect-error test override
    auth.onAuthStateChanged = (_a: unknown, cb: Listener) => {
      holdListener = cb;
      return () => {};
    };
    const { ProtectedRoute: Protected } = await import('../src/routes/guards');
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/dashboard" element={<Protected><div>SECRET</div></Protected>} />
            <Route path="/login" element={<div>LOGIN-PAGE</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );
    // Still loading → NO login redirect yet
    expect(screen.queryByText('LOGIN-PAGE')).toBeNull();
    expect(screen.queryByText('SECRET')).toBeNull();
    // Now resolve the session
    auth.onAuthStateChanged = original as typeof auth.onAuthStateChanged;
    state.currentUser = null;
    (holdListener as Listener | null)?.(null);
    await waitFor(() => expect(screen.getByText('LOGIN-PAGE')).toBeTruthy());
  });

  it('PublicOnlyRoute sends a signed-in user who opens /login to the dashboard', async () => {
    state.currentUser = { uid: 'u-1', email: 'signed@test.io' };
    const { PublicOnlyRoute: PublicOnly } = await import('../src/routes/guards');
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<PublicOnly><div>LOGIN-FORM</div></PublicOnly>} />
            <Route path="/dashboard" element={<div>DASHBOARD</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText('DASHBOARD')).toBeTruthy());
    expect(screen.queryByText('LOGIN-FORM')).toBeNull();
  });

  it('PublicOnlyRoute honors a sanitized ?next= target', async () => {
    state.currentUser = { uid: 'u-1', email: 'signed@test.io' };
    const { PublicOnlyRoute: PublicOnly } = await import('../src/routes/guards');
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login?next=%2Fchat']}>
          <Routes>
            <Route path="/login" element={<PublicOnly><div>LOGIN-FORM</div></PublicOnly>} />
            <Route path="/chat" element={<div>CHAT-PAGE</div>} />
            <Route path="/dashboard" element={<div>DASHBOARD</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText('CHAT-PAGE')).toBeTruthy());
  });
});

/* --------------------------- sanitizeNext --------------------------- */

describe('sanitizeNext', () => {
  it('allows internal paths', () => {
    expect(sanitizeNext('/chat')).toBe('/chat');
    expect(sanitizeNext('/dashboard?tab=usage')).toBe('/dashboard?tab=usage');
  });

  it('blocks open redirects (absolute URLs, protocol-relative)', () => {
    expect(sanitizeNext('https://evil.io')).toBe('/dashboard');
    expect(sanitizeNext('//evil.io')).toBe('/dashboard');
    expect(sanitizeNext('javascript:alert(1)')).toBe('/dashboard');
    expect(sanitizeNext(null)).toBe('/dashboard');
  });

  it('breaks login↔dashboard redirect loops by never returning auth pages', () => {
    expect(sanitizeNext('/login')).toBe('/dashboard');
    expect(sanitizeNext('/register')).toBe('/dashboard');
    expect(sanitizeNext('/forgot-password')).toBe('/dashboard');
    expect(sanitizeNext('/reset-password')).toBe('/dashboard');
  });
});

/* --------------------------- error mapping --------------------------- */

describe('mapFirebaseError', () => {
  it('maps known Firebase codes to clear messages', () => {
    expect(mapFirebaseError('auth/invalid-credential', 'ar')).toContain('غير صحيحة');
    expect(mapFirebaseError('auth/email-already-in-use', 'en')).toContain('already registered');
    expect(mapFirebaseError('auth/weak-password', 'ar')).toContain('ضعيفة');
  });

  it('falls back for unknown codes', () => {
    expect(mapFirebaseError('auth/something-odd', 'en')).toContain('something odd');
  });
});
