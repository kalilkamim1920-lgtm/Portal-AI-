/**
 * Authentication middleware.
 *
 * Verifies the Firebase ID token from the `Authorization: Bearer` header,
 * auto-provisions the Firestore user profile document on first sight, and
 * attaches { uid, email, claims, profile } to the request.
 *
 * The user document load is separated from token verification so that
 * profile issues never invalidate a valid session.
 */
import { auth, db, COLLECTIONS } from '../config/firebase.js';
import { unauthorized } from '../utils/errors.js';
import { getActivePlanId } from '../services/plans.js';

export async function ensureUserDoc(decodedToken, req) {
  const { uid, email, name, picture } = decodedToken;
  const ref = db.collection(COLLECTIONS.users).doc(uid);
  const snap = await ref.get();

  if (!snap.exists) {
    const now = new Date();
    const doc = {
      uid,
      email: email || null,
      displayName: name || (email ? email.split('@')[0] : 'User'),
      photoURL: picture || null,
      role: 'user',
      plan: 'free', // informational mirror; source of truth = subscriptions
      language: 'ar',
      settings: {
        defaultModel: 'gemini-2.0-flash',
        emailNotifications: true,
        pushNotifications: true,
      },
      lastLoginAt: now,
      disabled: false,
      createdAt: now,
    };
    await ref.set(doc);
    return doc;
  }

  const data = snap.data();
  // Track last login (non-blocking on failure)
  ref.update({ lastLoginAt: new Date() }).catch(() => {});
  return { uid, ...data };
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw unauthorized('Missing session token');

    let decoded;
    try {
      // Revocation checking (verifyIdToken token, true) calls admin.getUser(),
      // which requires either the Auth emulator or real Admin SDK credentials.
      // With real Firebase auth but no service account (preview mode), we
      // verify the JWT signature/audience only.
      const canCheckRevoked =
        Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST) ||
        Boolean(process.env.FIREBASE_CLIENT_EMAIL);
      decoded = await auth.verifyIdToken(token, canCheckRevoked);
    } catch {
      throw unauthorized('Invalid or expired session token');
    }

    const profile = await ensureUserDoc(decoded, req);
    if (profile?.disabled) throw unauthorized('This account has been disabled');

    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      name: decoded.name || null,
      picture: decoded.picture || null,
      claims: decoded,
    };
    req.profile = profile;
    req.plan = await getActivePlanId(decoded.uid);
    next();
  } catch (e) {
    next(e);
  }
}

export default requireAuth;
