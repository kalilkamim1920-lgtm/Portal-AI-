/**
 * Notifications routes.
 *
 * GET  /api/notifications            → user notifications + broadcasts
 * POST /api/notifications/:id/read   → mark one as read
 * POST /api/notifications/read-all   → mark all as read
 */
import { Router } from 'express';
import { db, COLLECTIONS } from '../config/firebase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, notFound } from '../utils/errors.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const uid = req.user.uid;
    const [userSnap, broadcastSnap] = await Promise.all([
      db.collection(COLLECTIONS.notifications).where('uid', '==', uid).orderBy('createdAt', 'desc').limit(50).get(),
      db.collection(COLLECTIONS.notifications).where('uid', '==', null).orderBy('createdAt', 'desc').limit(20).get(),
    ]);
    const map = (d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title,
        body: data.body,
        type: data.type || 'info',
        read: data.read || false,
        broadcast: !data.uid,
        createdAt: data.createdAt?.toDate?.().toISOString?.() || null,
      };
    };
    // Merge + de-duplicate read state for broadcasts (per-user read marks)
    const readMarks = await db.collection('notificationReads').where('uid', '==', uid).get();
    const readSet = new Set(readMarks.docs.map((d) => d.data().notificationId));
    const notifications = [
      ...userSnap.docs.map(map),
      ...broadcastSnap.docs.map((d) => ({ ...map(d), read: readSet.has(d.id) })),
    ].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json({ notifications, unread: notifications.filter((n) => !n.read).length });
  })
);

router.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const ref = db.collection(COLLECTIONS.notifications).doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) throw notFound('Notification not found');
    const data = snap.data();
    if (data.uid && data.uid !== req.user.uid) throw notFound('Notification not found');
    if (!data.uid) {
      // broadcast → per-user read mark
      await db.collection('notificationReads').add({
        uid: req.user.uid,
        notificationId: req.params.id,
        readAt: new Date(),
      });
    } else {
      await ref.update({ read: true });
    }
    res.json({ ok: true });
  })
);

router.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    const uid = req.user.uid;
    const [userSnap, broadcastSnap] = await Promise.all([
      db.collection(COLLECTIONS.notifications).where('uid', '==', uid).get(),
      db.collection(COLLECTIONS.notifications).where('uid', '==', null).get(),
    ]);
    const batch = db.batch();
    userSnap.docs.forEach((d) => batch.set(d.ref, { read: true }, { merge: true }));
    broadcastSnap.docs.forEach((d) =>
      batch.set(db.collection('notificationReads').doc(`${uid}_${d.id}`), {
        uid,
        notificationId: d.id,
        readAt: new Date(),
      })
    );
    await batch.commit();
    res.json({ ok: true });
  })
);

export default router;
