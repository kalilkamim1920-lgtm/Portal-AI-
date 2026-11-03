/**
 * Subscription routes — DEMO PAYMENT ONLY (no real money moves).
 *
 * GET  /api/subscriptions/me        → active subscription + usage
 * POST /api/subscriptions/checkout  → demo checkout → activates plan 30 days
 * POST /api/subscriptions/cancel    → cancel at period end (stays active till endsAt)
 * POST /api/subscriptions/resume    → undo cancel
 * POST /api/subscriptions/upgrade   → immediate plan change (prorated demo)
 * GET  /api/subscriptions/invoices  → demo invoice history
 *
 * Quotas are enforced server-side in services/plans.js on every AI call.
 */
import { Router } from 'express';
import { z } from 'zod';
import { db, COLLECTIONS } from '../config/firebase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, badRequest, notFound } from '../utils/errors.js';
import { getPlan, getActivePlanId, remainingQuota, listPlans } from '../services/plans.js';
import { logActivity } from '../services/activity.js';

const router = Router();

/* Public plans endpoint (pricing page works for signed-out visitors too) */
router.get(
  '/plans',
  asyncHandler(async (req, res) => {
    res.json({ plans: await listPlans() });
  })
);

router.use(requireAuth);

const PLAN_IDS = ['free', 'basic', 'pro', 'premium'];

/* ----------------------------- helpers ----------------------------- */

async function getSubscription(uid) {
  const snap = await db.collection(COLLECTIONS.subscriptions).doc(uid).get();
  return snap.exists ? snap.data() : null;
}

function subView(sub) {
  if (!sub) return null;
  return {
    plan: sub.plan,
    status: sub.status,
    enabled: sub.enabled !== false,
    startedAt: sub.startedAt?.toDate?.().toISOString?.() || null,
    endsAt: sub.endsAt?.toDate?.().toISOString?.() || null,
    canceledAt: sub.canceledAt?.toDate?.().toISOString?.() || null,
    amount: sub.amount,
    currency: sub.currency,
    demo: true,
  };
}

async function createDemoInvoice(uid, plan, planDef, note = 'DEMO PAYMENT — no real charge') {
  const now = new Date();
  const ref = await db.collection(COLLECTIONS.invoices).add({
    uid,
    plan,
    planName: planDef.name,
    amount: planDef.price,
    currency: planDef.currency || 'USD',
    status: 'paid',
    demo: true,
    note,
    periodStart: now,
    periodEnd: new Date(now.getTime() + 30 * 24 * 3600 * 1000),
    createdAt: now,
  });
  return ref.id;
}

/** Basic demo card validation — Luhn check. Clearly labeled DEMO. */
function luhnValid(num) {
  const digits = num.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/* ------------------------------ routes ------------------------------ */

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const uid = req.user.uid;
    const [sub, planId, quota] = await Promise.all([getSubscription(uid), getActivePlanId(uid), remainingQuota(uid)]);
    res.json({
      subscription: subView(sub),
      activePlan: planId,
      usage: quota,
      demoNotice: 'DEMO PAYMENT SYSTEM — لا يتم خصم أي أموال حقيقية / No real money is charged.',
    });
  })
);

router.post(
  '/checkout',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      planId: z.enum(PLAN_IDS),
      cardName: z.string().trim().min(2).max(60),
      cardNumber: z.string().min(12).max(24),
      expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Expiry must be MM/YY'),
      cvc: z.string().regex(/^\d{3,4}$/, 'CVC must be 3-4 digits'),
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) {
      throw badRequest('Invalid payment form', {
        issues: parsed.error.issues?.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    const { planId, cardName, cardNumber, expiry, cvc } = parsed.data;
    if (planId === 'free') throw badRequest('Use the downgrade endpoint or cancel to return to Free');

    // Demo validation (declined cards for obvious test failures)
    if (!luhnValid(cardNumber)) throw badRequest('رقم البطاقة غير صالح / Card number failed validation (demo)');
    if (!cardName || !expiry || !cvc) throw badRequest('Missing card details');

    const planDef = await getPlan(planId);
    const uid = req.user.uid;
    const now = new Date();
    const endsAt = new Date(now.getTime() + 30 * 24 * 3600 * 1000);

    const invoiceId = await createDemoInvoice(uid, planId, planDef);
    const last4 = cardNumber.replace(/\D/g, '').slice(-4);

    await db.collection(COLLECTIONS.subscriptions).doc(uid).set({
      uid,
      plan: planId,
      status: 'active',
      enabled: true,
      startedAt: now,
      endsAt,
      canceledAt: null,
      amount: planDef.price,
      currency: planDef.currency || 'USD',
      demo: true,
      demoCard: { last4, brand: cardNumber.startsWith('4') ? 'visa' : 'card' },
      invoiceId,
      updatedAt: now,
    });
    await db.collection(COLLECTIONS.users).doc(uid).set({ plan: planId }, { merge: true });

    logActivity(uid, 'subscription.checkout', { plan: planId, invoiceId, demo: true }, req);

    res.status(201).json({
      ok: true,
      demo: true,
      message: 'DEMO PAYMENT accepted — plan activated for 30 days. No real money was charged.',
      subscription: subView(await getSubscription(uid)),
      invoiceId,
    });
  })
);

router.post(
  '/cancel',
  asyncHandler(async (req, res) => {
    const uid = req.user.uid;
    const sub = await getSubscription(uid);
    if (!sub || sub.status !== 'active') throw notFound('No active subscription to cancel');
    await db.collection(COLLECTIONS.subscriptions).doc(uid).set(
      { status: 'canceled', canceledAt: new Date(), updatedAt: new Date() },
      { merge: true }
    );
    logActivity(uid, 'subscription.cancel', { plan: sub.plan }, req);
    res.json({ ok: true, message: 'Subscription canceled. Plan remains active until the period ends (demo).' });
  })
);

router.post(
  '/resume',
  asyncHandler(async (req, res) => {
    const uid = req.user.uid;
    const sub = await getSubscription(uid);
    if (!sub) throw notFound('No subscription found');
    if (sub.endsAt && sub.endsAt.toDate() < new Date()) throw badRequest('Subscription already expired, please checkout again');
    await db.collection(COLLECTIONS.subscriptions).doc(uid).set(
      { status: 'active', canceledAt: null, enabled: true, updatedAt: new Date() },
      { merge: true }
    );
    logActivity(uid, 'subscription.resume', { plan: sub.plan }, req);
    res.json({ ok: true });
  })
);

router.post(
  '/upgrade',
  asyncHandler(async (req, res) => {
    const schema = z.object({ planId: z.enum(PLAN_IDS) });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) throw badRequest('Invalid plan');
    const { planId } = parsed.data;
    if (planId === 'free') throw badRequest('Use /cancel to move to Free');
    const uid = req.user.uid;
    const planDef = await getPlan(planId);
    const now = new Date();
    const invoiceId = await createDemoInvoice(uid, planId, planDef, 'DEMO PAYMENT — plan change');
    await db.collection(COLLECTIONS.subscriptions).doc(uid).set(
      {
        uid,
        plan: planId,
        status: 'active',
        enabled: true,
        startedAt: now,
        endsAt: new Date(now.getTime() + 30 * 24 * 3600 * 1000),
        canceledAt: null,
        amount: planDef.price,
        currency: planDef.currency || 'USD',
        demo: true,
        invoiceId,
        updatedAt: now,
      },
      { merge: true }
    );
    await db.collection(COLLECTIONS.users).doc(uid).set({ plan: planId }, { merge: true });
    logActivity(uid, 'subscription.upgrade', { plan: planId }, req);
    res.json({ ok: true, demo: true, subscription: subView(await getSubscription(uid)) });
  })
);

router.get(
  '/invoices',
  asyncHandler(async (req, res) => {
    const snap = await db
      .collection(COLLECTIONS.invoices)
      .where('uid', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    const invoices = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        plan: data.plan,
        planName: data.planName,
        amount: data.amount,
        currency: data.currency,
        status: data.status,
        demo: data.demo,
        createdAt: data.createdAt?.toDate?.().toISOString?.() || null,
        periodStart: data.periodStart?.toDate?.().toISOString?.() || null,
        periodEnd: data.periodEnd?.toDate?.().toISOString?.() || null,
      };
    });
    res.json({ invoices, demo: true });
  })
);

export default router;
