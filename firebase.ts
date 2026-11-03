/**
 * Firebase client bootstrap (Authentication only).
 *
 * - Credentials come from Vite env vars (VITE_FIREBASE_*), never hardcoded.
 * - Session persistence uses browserLocalPersistence (IndexedDB) so the
 *   session survives page refreshes.
 * - When VITE_FIREBASE_EMULATOR_URL is set (local development), the Auth SDK
 *   connects to the local Firebase Emulator Suite instead of production.
 * - When no config is present, the app still renders; auth-dependent pages
 *   show a clear configuration notice instead of failing silently.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  connectAuthEmulator,
  type Auth,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const firebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;

if (firebaseConfigured) {
  app = initializeApp(firebaseConfig as Required<typeof firebaseConfig>);
  authInstance = getAuth(app);
  // Keep the user signed in across page refreshes (persistent login)
  setPersistence(authInstance, browserLocalPersistence).catch(() => {});

  const emulatorUrl = (import.meta.env.VITE_FIREBASE_EMULATOR_URL as string | undefined)?.trim();
  if (emulatorUrl) {
    // "origin" resolves at runtime to the current host — useful when the
    // Auth Emulator is proxied behind the same domain (reverse proxy/preview).
    const resolved = emulatorUrl === 'origin' ? window.location.origin : emulatorUrl;
    connectAuthEmulator(authInstance, resolved, { disableWarnings: true });
  }
}

export const firebaseAuth = authInstance as Auth;
export const firebaseApp = app;
