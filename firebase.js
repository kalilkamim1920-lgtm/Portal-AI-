/**
 * Firebase Admin SDK bootstrap (server-side only).
 *
 * Credential resolution order:
 *  1. Firebase Emulator Suite (FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST)
 *     → no credentials needed, uses local emulators (development).
 *  2. Service account from env (FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY).
 *  3. Google Application Default Credentials (e.g. Cloud Run, GCE).
 *
 * The Admin SDK is the ONLY component allowed to touch Firestore directly on
 * the backend; all client requests must go through authenticated API routes.
 */
import 'dotenv/config';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'portal-ai-demo';

const usingEmulators = Boolean(
  process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST
);

function buildCredential() {
  if (usingEmulators) return undefined;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  if (clientEmail && rawKey) {
    return cert({
      projectId,
      clientEmail,
      privateKey: rawKey.replace(/\\n/g, '\n'),
    });
  }
  return undefined; // fall back to Application Default Credentials
}

export function initAdmin() {
  if (getApps().length === 0) {
    const opts = { projectId };
    const credential = buildCredential();
    if (credential) opts.credential = credential;
    initializeApp(opts);
  }
  return getApps()[0];
}

const app = initAdmin();

export const db = getFirestore(app);
db.settings({ ignoreUndefinedProperties: true });

export const auth = getAuth(app);

export const IS_EMULATOR = usingEmulators;

/** Collection names (single source of truth). */
export const COLLECTIONS = {
  users: 'users',
  conversations: 'conversations',
  messages: 'messages',
  subscriptions: 'subscriptions',
  plans: 'plans',
  invoices: 'invoices',
  notifications: 'notifications',
  usage: 'usage',
  activityLogs: 'activityLogs',
  images: 'images',
};
