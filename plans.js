/**
 * Plans + quota enforcement (SERVER-SIDE — never trust the UI).
 *
 * Plans live in the `plans` collection (admin-editable). Defaults are seeded
 * by server/scripts/seed.js and used as fallback if the collection is empty.
 *
 * Active plan resolution:
 *   1. subscriptions/{uid} — status 'active' and endsAt in the future → plan
 *   2. otherwise → 'free'
 */
import { db, COLLECTIONS } from '../config/firebase.js';
import { quotaExceeded } from '../utils/errors.js';

export const DEFAULT_PLANS = [
  {
    id: 'free',
    name: 'Free',
    nameAr: 'المجانية',
    price: 0,
    currency: 'USD',
    dailyMessages: 10,
    dailyImages: 2,
    features: ['10 رسائل يوميًا / 10 messages/day', 'AI Chat', 'أدوات أساسية / Basic tools', '2 صور يوميًا / 2 images/day'],
    active: true,
  },
  {
    id: 'basic',
    name: 'Basic',
    nameAr: 'الأساسية',
    price: 5,
    currency: 'USD',
    dailyMessages: 100,
    dailyImages: 10,
    features: ['100 رسالة يوميًا / 100 messages/day', 'جميع أدوات AI / All AI tools', '10 صور يوميًا / 10 images/day', 'سجل محادثات / Chat history'],
    active: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    nameAr: 'الاحترافية',
    price: 15,
    currency: 'USD',
    dailyMessages: 500,
    dailyImages: 50,
    features: ['500 رسالة يوميًا / 500 messages/day', 'أولوية في الاستجابة / Priority response', '50 صورة يوميًا / 50 images/day', 'نماذج متقدمة / Advanced models'],
    active: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    nameAr: 'المتميزة',
    price: 30,
    currency: 'USD',
    dailyMessages: 1000,
    dailyImages: 150,
    features: ['1000 رسالة يوميًا / 1000 messages/day', 'كل المميزات / All features', '150 صورة يوميًا / 150 images/day', 'دعم مخصص / Priority support'],
    active: true,
  },
];

export const PLAN_IDS = DEFAULT_PLANS.map((p) => p.id);

export async function listPlans() {
  const snap = await db.collection(COLLECTIONS.plans).get();
  if (snap.empty) return DEFAULT_PLANS;
  const plans = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  plans.sort((a, b) => DEFAULT_PLANS.findIndex((p) => p.id === a.id) - DEFAULT_PLANS.findIndex((p) => p.id === b.id));
  return plans;
}

export async function getPlan(planId) {
  const snap = await db.collection(COLLECTIONS.plans).doc(planId).get();
  if (snap.exists) return { id: snap.id, ...snap.data() };
  return DEFAULT_PLANS.find((p) => p.id === planId) || DEFAULT_PLANS[0];
}

/** Resolve the user's active plan id from their subscription document. */
export async function getActivePlanId(uid) {
  const subSnap = await db.collection(COLLECTIONS.subscriptions).doc(uid).get();
  if (subSnap.exists) {
    const sub = subSnap.data();
    if (sub.status === 'active' && sub.endsAt && sub.endsAt.toDate() > new Date() && sub.enabled !== false) {
      return sub.plan;
    }
  }
  return 'free';
}

export function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10); // UTC day
}

export function usageDocId(uid, date = todayKey()) {
  return `${uid}_${date}`;
}

export async function getUsage(uid) {
  const date = todayKey();
  const snap = await db.collection(COLLECTIONS.usage).doc(usageDocId(uid, date)).get();
  const data = snap.exists ? snap.data() : {};
  return {
    date,
    messages: data.messages || 0,
    images: data.images || 0,
    toolCalls: data.toolCalls || 0,
  };
}

/**
 * Atomically consume quota for an action. Throws 429 when exceeded.
 * kind: 'messages' | 'images'
 */
export async function consumeQuota(uid, kind) {
  const plan = await getPlan(await getActivePlanId(uid));
  const limit = kind === 'images' ? plan.dailyImages : plan.dailyMessages;
  const date = todayKey();
  const ref = db.collection(COLLECTIONS.usage).doc(usageDocId(uid, date));

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? snap.data() : { messages: 0, images: 0, toolCalls: 0 };
    const used = current[kind] || 0;

    if (used >= limit) {
      return { allowed: false, used, limit };
    }

    const updated = { ...current, [kind]: used + 1 };
    if (kind === 'messages') updated.toolCalls = (current.toolCalls || 0); // tools counted separately below
    tx.set(
      ref,
      { ...updated, uid, date, updatedAt: new Date() },
      { merge: true }
    );
    return { allowed: true, used: used + 1, limit };
  });

  if (!result.allowed) {
    throw quotaExceeded(
      `Daily ${kind} quota exceeded for the ${plan.name} plan (${result.limit}/day). Upgrade your plan for a higher limit.`,
      { used: result.used, limit: result.limit, plan: plan.id, kind, resetAt: '00:00 UTC' }
    );
  }
  return result;
}

/** Track a tool call (separate counter, shares the dailyMessages limit). */
export async function consumeToolQuota(uid) {
  return consumeQuota(uid, 'messages');
}

export async function remainingQuota(uid) {
  const [planId, usage] = await Promise.all([getActivePlanId(uid), getUsage(uid)]);
  const plan = await getPlan(planId);
  return {
    plan: planId,
    planName: plan.name,
    limits: { messages: plan.dailyMessages, images: plan.dailyImages },
    used: { messages: usage.messages, images: usage.images, toolCalls: usage.toolCalls },
    remaining: {
      messages: Math.max(0, plan.dailyMessages - usage.messages),
      images: Math.max(0, plan.dailyImages - usage.images),
    },
    date: usage.date,
  };
}
