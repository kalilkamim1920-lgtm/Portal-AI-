/**
 * Admin routes — protected by requireAuth + requireAdmin (custom claims / DB role).
 *
 * GET    /api/admin/stats              → counters + usage stats
 * GET    /api/admin/users?q=           → search & list users
 * PATCH  /api/admin/users/:uid         → disable/enable, role, plan override
 * POST   /api/admin/claims/:uid        → set admin custom claim (grant/revoke)
 * GET    /api/admin/plans  PATCH /api/admin/plans/:planId → manage plan limits
 * POST   /api/admin/notifications      → broadcast or targeted notification
 * GET    /api/admin/activity           → recent activity logs
 * POST   /api/admin/users/:uid/subscription → enable/disable a user's subscription (trial toggle)
 */
import { Router } from 'express';
import { z } from 'zod';
import { db, auth, COLLECTIONS } from '../config/firebase.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import { asyncHandler, badRequest, notFound } from '../utils/errors.js';
import { logActivity } from '../services/activity.js';
import { listPlans } from '../services/plans.js';

const router = Router();
router.use(requireAuth, requireAdmin);

/* ------------------------------ stats ------------------------------ */

async function count(col, ...constraints) {
  let q = db.collection(col);
  for (const c of constraints) q = q.where(c.field, c.op, c.value);
  const snap = await q.count().get();
  return snap.data().count;
}

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const [totalUsers, subs, invoices, messages, images, conversations] = await Promise.all([
      count(COLLECTIONS.users),
      count(COLLECTIONS.subscriptions, { field: 'status', op: '==', value: 'active' }),
      count(COLLECTIONS.invoices),
      count(COLLECTIONS.messages),
      count(COLLECTIONS.images),
      count(COLLECTIONS.conversations),
    ]);

    const activeUsers = await count(COLLECTIONS.users, {
      field: 'lastLoginAt',
      op: '>=',
      value: new Date(Date.now() - 7 * 24 * 3600 * 1000),
    });

    // Plan distribution
    const plansSnap = await db.collection(COLLECTIONS.subscriptions).where('status', '==', 'active').get();
    const planDistribution = {};
    plansSnap.docs.forEach((d) => {
      const p = d.data().plan;
      planDistribution[p] = (planDistribution[p] || 0) + 1;
    });

    // Usage last 7 days
    const usageSnap = await db
      .collection(COLLECTIONS.usage)
      .orderBy('date', 'desc')
      .limit(7)
      .get();
    const usageByDay = usageSnap.docs
      .map((d) => ({ date: d.data().date, messages: d.data().messages || 0, images: d.data().images || 0 }))
      .reverse();

    res.json({
      users: { total: totalUsers, activeLast7d: activeUsers },
      subscriptions: { active: subs, planDistribution },
      content: { messages, images, conversations },
      invoices: invoices,
      usageByDay,
      generatedAt: new Date().toISOString(),
    });
  })
);

/* ------------------------------ users ------------------------------ */

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').toLowerCase().trim();
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    let snap;
    if (q) {
      // Prefix search on email (Firestore range query)
      snap = await db
        .collection(COLLECTIONS.users)
        .orderBy('email')
        .startAt(q)
        .endAt(q + '\uf8ff')
        .limit(limit)
        .get();
    } else {
      snap = await db.collection(COLLECTIONS.users).orderBy('createdAt', 'desc').limit(limit).get();
    }
    const users = snap.docs.map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        email: data.email,
        displayName: data.displayName,
        role: data.role || 'user',
        plan: data.plan || 'free',
        disabled: !!data.disabled,
        createdAt: data.createdAt?.toDate?.().toISOString?.() || null,
        lastLoginAt: data.lastLoginAt?.toDate?.().toISOString?.() || null,
      };
    });
    res.json({ users });
  })
);

router.patch(
  '/users/:uid',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      disabled: z.boolean().optional(),
      role: z.enum(['user', 'admin']).optional(),
      plan: z.enum(['free', 'basic', 'pro', 'premium']).optional(),
      displayName: z.string().trim().min(1).max(60).optional(),
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) throw badRequest('Invalid user update');

    const { uid } = req.params;
    if (uid === req.user.uid && parsed.data.disabled) throw badRequest('You cannot disable your own account');

    const updates = {};
    if (parsed.data.disabled !== undefined) updates.disabled = parsed.data.disabled;
    if (parsed.data.role !== undefined) updates.role = parsed.data.role;
    if (parsed.data.plan !== undefined) updates.plan = parsed.data.plan;
    if (parsed.data.displayName !== undefined) updates.displayName = parsed.data.displayName;

    await db.collection(COLLECTIONS.users).doc(uid).set(updates, { merge: true });

    // Mirror disable into Firebase Auth so tokens stop working
    if (parsed.data.disabled !== undefined) {
      await auth.updateUser(uid, { disabled: parsed.data.disabled }).catch((e) => {
        if (!/no user exists/i.test(e.message || '')) throw e;
      });
    }
    logActivity(req.user.uid, 'admin.user_update', { target: uid, ...updates }, req);
    res.json({ ok: true, updated: updates });
  })
);

router.post(
  '/claims/:uid',
  asyncHandler(async (req, res) => {
    const schema = z.object({ admin: z.boolean() });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) throw badRequest('admin boolean required');

    await auth.setCustomUserClaims(req.params.uid, { admin: parsed.data.admin });
    await db.collection(COLLECTIONS.users).doc(req.params.uid).set(
      { role: parsed.data.admin ? 'admin' : 'user' },
      { merge: true }
    );
    logActivity(req.user.uid, 'admin.claims_change', { target: req.params.uid, admin: parsed.data.admin }, req);
    res.json({ ok: true, uid: req.params.uid, admin: parsed.data.admin });
  })
);

router.post(
  '/users/:uid/subscription',
  asyncHandler(async (req, res) => {
    const schema = z.object({ enabled: z.boolean() });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) throw badRequest('enabled boolean required');
    await db.collection(COLLECTIONS.subscriptions).doc(req.params.uid).set(
      { uid: req.params.uid, enabled: parsed.data.enabled, updatedAt: new Date() },
      { merge: true }
    );
    logActivity(req.user.uid, 'admin.subscription_toggle', { target: req.params.uid, enabled: parsed.data.enabled }, req);
    res.json({ ok: true });
  })
);

/* ------------------------------ plans ------------------------------ */

router.get(
  '/plans',
  asyncHandler(async (req, res) => {
    res.json({ plans: await listPlans() });
  })
);

router.patch(
  '/plans/:planId',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      price: z.number().min(0).max(10000).optional(),
      dailyMessages: z.number().int().min(1).max(100000).optional(),
      dailyImages: z.number().int().min(0).max(10000).optional(),
      active: z.boolean().optional(),
      features: z.array(z.string().max(120)).max(12).optional(),
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) throw badRequest('Invalid plan update');
    const { planId } = req.params;
    if (!['free', 'basic', 'pro', 'premium'].includes(planId)) throw notFound('Plan not found');

    await db.collection(COLLECTIONS.plans).doc(planId).set(parsed.data, { merge: true });
    logActivity(req.user.uid, 'admin.plan_update', { planId, ...parsed.data }, req);
    const snap = await db.collection(COLLECTIONS.plans).doc(planId).get();
    res.json({ ok: true, plan: { id: snap.id, ...snap.data() } });
  })
);

/* ------------------- notifications & activity ------------------- */

router.post(
  '/notifications',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      title: z.string().trim().min(1).max(120),
      body: z.string().trim().min(1).max(1000),
      type: z.enum(['info', 'success', 'warning', 'danger']).default('info'),
      uid: z.string().trim().max(128).optional(), // omit → broadcast
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) throw badRequest('Invalid notification');

    const ref = await db.collection(COLLECTIONS.notifications).add({
      title: parsed.data.title,
      body: parsed.data.body,
      type: parsed.data.type,
      uid: parsed.data.uid || null,
      read: false,
      createdAt: new Date(),
    });
    logActivity(req.user.uid, 'admin.notification_send', { id: ref.id, to: parsed.data.uid || 'broadcast' }, req);
    res.status(201).json({ ok: true, id: ref.id });
  })
);

router.get(
  '/activity',
  asyncHandler(async (req, res) => {
    const snap = await db
      .collection(COLLECTIONS.activityLogs)
      .orderBy('createdAt', 'desc')
      .limit(Math.min(Number(req.query.limit) || 50, 200))
      .get();
    const logs = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        uid: data.uid,
        action: data.action,
        meta: data.meta,
        ip: data.ip,
        createdAt: data.createdAt?.toDate?.().toISOString?.() || null,
      };
    });
    res.json({ logs });
  })
);

export default router;
