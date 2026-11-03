/**
 * Activity logging — fire-and-forget audit trail in `activityLogs`.
 */
import { db, COLLECTIONS } from '../config/firebase.js';

export function logActivity(uid, action, meta = {}, req = null) {
  const entry = {
    uid: uid || null,
    action,
    meta,
    ip: req ? (req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip) : null,
    userAgent: req?.headers['user-agent'] || null,
    createdAt: new Date(),
  };
  db.collection(COLLECTIONS.activityLogs).add(entry).catch((e) =>
    console.error('[activityLog] failed:', e.message)
  );
  return entry;
}
