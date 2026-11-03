/**
 * Admin guard — server-side authorization ONLY.
 *
 * A user is an admin when EITHER:
 *  - their Firebase ID token carries the `admin: true` custom claim, OR
 *  - their Firestore user document has role === 'admin'.
 *
 * Custom claims are set exclusively through the Admin SDK
 * (`server/scripts/seed.js` / admin API) — never from the browser.
 */
import { db, COLLECTIONS } from '../config/firebase.js';
import { forbidden } from '../utils/errors.js';
import { asyncHandler } from '../utils/errors.js';

export const requireAdmin = asyncHandler(async (req, res, next) => {
  if (!req.user) return next(forbidden());
  if (req.user.claims?.admin === true) return next();

  // Fallback: authoritative check from the user document
  const snap = await db.collection(COLLECTIONS.users).doc(req.user.uid).get();
  if (snap.exists && snap.data()?.role === 'admin') return next();

  throw forbidden('Admin privileges required');
});
