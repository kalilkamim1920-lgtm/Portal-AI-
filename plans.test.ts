/**
 * Backend unit tests — quota enforcement, plan resolution, demo payment
 * validation. All Firestore/Admin access is mocked; no emulator needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/* -------------------- mock firebase-admin config -------------------- */

const mocks = vi.hoisted(() => ({
  txGet: vi.fn(),
  txSet: vi.fn(),
  runTransaction: vi.fn(),
}));

vi.mock('../config/firebase.js', () => {
  const tx = { get: mocks.txGet, set: mocks.txSet };
  const db = {
    runTransaction: mocks.runTransaction,
    collection: vi.fn(),
    doc: vi.fn(),
  };
  return {
    db,
    auth: {},
    IS_EMULATOR: true,
    COLLECTIONS: {
      users: 'users', conversations: 'conversations', messages: 'messages',
      subscriptions: 'subscriptions', plans: 'plans', invoices: 'invoices',
      notifications: 'notifications', usage: 'usage', activityLogs: 'activityLogs', images: 'images',
    },
    __tx: tx,
  };
});

const { __tx, db } = (await import('../config/firebase.js')) as {
  __tx: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };
  db: { collection: ReturnType<typeof vi.fn>; runTransaction: ReturnType<typeof vi.fn> };
};

const { DEFAULT_PLANS, PLAN_IDS, usageDocId, todayKey, consumeQuota, getActivePlanId } =
  await import('../services/plans.js');
const { ApiError } = await import('../utils/errors.js');

/* ------------------------------ plans ------------------------------ */

describe('plans defaults (per requirements)', () => {
  it('defines FREE=10, BASIC=100, PRO=500, PREMIUM=1000 daily messages', () => {
    const byId = Object.fromEntries(DEFAULT_PLANS.map((p) => [p.id, p.dailyMessages]));
    expect(byId.free).toBe(10);
    expect(byId.basic).toBe(100);
    expect(byId.pro).toBe(500);
    expect(byId.premium).toBe(1000);
  });

  it('exposes exactly the four plan ids', () => {
    expect(PLAN_IDS).toEqual(['free', 'basic', 'pro', 'premium']);
  });
});

describe('usage doc keys', () => {
  it('scopes by uid + UTC day', () => {
    expect(usageDocId('abc', '2026-01-15')).toBe('abc_2026-01-15');
    expect(todayKey(new Date('2026-01-15T10:00:00Z'))).toBe('2026-01-15');
  });
});

/* --------------------------- active plan --------------------------- */

describe('getActivePlanId', () => {
  beforeEach(() => {
    db.collection = vi.fn(() => ({
      doc: () => ({ get: async () => ({ exists: false, data: () => ({}) }) }),
    }));
  });

  it('returns free when there is no subscription', async () => {
    expect(await getActivePlanId('u1')).toBe('free');
  });

  it('returns the subscription plan when active and not expired', async () => {
    const future = { toDate: () => new Date(Date.now() + 10 * 24 * 3600 * 1000) };
    (db.collection as ReturnType<typeof vi.fn>).mockReturnValue({
      doc: () => ({
        get: async () => ({ exists: true, data: () => ({ plan: 'pro', status: 'active', enabled: true, endsAt: future }) }),
      }),
    });
    expect(await getActivePlanId('u1')).toBe('pro');
  });

  it('falls back to free when the subscription expired', async () => {
    const past = { toDate: () => new Date(Date.now() - 24 * 3600 * 1000) };
    (db.collection as ReturnType<typeof vi.fn>).mockReturnValue({
      doc: () => ({
        get: async () => ({ exists: true, data: () => ({ plan: 'pro', status: 'active', endsAt: past }) }),
      }),
    });
    expect(await getActivePlanId('u1')).toBe('free');
  });

  it('falls back to free when the subscription is canceled', async () => {
    const future = { toDate: () => new Date(Date.now() + 10 * 24 * 3600 * 1000) };
    (db.collection as ReturnType<typeof vi.fn>).mockReturnValue({
      doc: () => ({
        get: async () => ({ exists: true, data: () => ({ plan: 'pro', status: 'canceled', endsAt: future }) }),
      }),
    });
    expect(await getActivePlanId('u1')).toBe('free');
  });

  it('falls back to free when an admin disabled the subscription', async () => {
    const future = { toDate: () => new Date(Date.now() + 10 * 24 * 3600 * 1000) };
    (db.collection as ReturnType<typeof vi.fn>).mockReturnValue({
      doc: () => ({
        get: async () => ({ exists: true, data: () => ({ plan: 'pro', status: 'active', enabled: false, endsAt: future }) }),
      }),
    });
    expect(await getActivePlanId('u1')).toBe('free');
  });
});

/* ----------------------------- quotas ----------------------------- */

describe('consumeQuota (server-side enforcement)', () => {
  beforeEach(() => {
    mocks.txGet.mockReset();
    mocks.txSet.mockReset();
    mocks.runTransaction.mockReset();
    db.collection = vi.fn((col: string) => ({
      doc: () => ({
        get: async () =>
          col === 'plans'
            ? { exists: true, id: 'free', data: () => ({ id: 'free', dailyMessages: 10, dailyImages: 2 }) }
            : { exists: true, data: () => ({ plan: 'free', status: 'active', enabled: true, endsAt: { toDate: () => new Date(Date.now() + 86400000) } }) },
      }),
    }));
  });

  it('allows a message under the limit and increments the counter', async () => {
    let stored: Record<string, unknown> = {};
    mocks.txGet.mockResolvedValue({ exists: true, data: () => ({ messages: 3, images: 0 }) });
    mocks.txSet.mockImplementation((_ref: unknown, data: Record<string, unknown>) => { stored = data; });
    mocks.runTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(__tx));

    const result = await consumeQuota('u1', 'messages');
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(4);
    expect(stored.messages).toBe(4);
  });

  it('rejects with 429 quota_exceeded at the limit (FREE plan = 10)', async () => {
    mocks.txGet.mockResolvedValue({ exists: true, data: () => ({ messages: 10, images: 0 }) });
    mocks.runTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(__tx));

    await expect(consumeQuota('u1', 'messages')).rejects.toMatchObject({
      status: 429,
      code: 'quota_exceeded',
    });
    // Ensure nothing was written when rejected
    expect(mocks.txSet).not.toHaveBeenCalled();
  });

  it('counts image quota separately (FREE plan = 2)', async () => {
    mocks.txGet.mockResolvedValue({ exists: true, data: () => ({ messages: 0, images: 2 }) });
    mocks.runTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(__tx));

    await expect(consumeQuota('u1', 'images')).rejects.toMatchObject({ status: 429 });
  });

  it('treats a missing usage doc as zero usage', async () => {
    let stored: Record<string, unknown> = {};
    mocks.txGet.mockResolvedValue({ exists: false, data: () => ({}) });
    mocks.txSet.mockImplementation((_ref: unknown, data: Record<string, unknown>) => { stored = data; });
    mocks.runTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(__tx));

    const result = await consumeQuota('u1', 'messages');
    expect(result.allowed).toBe(true);
    expect(stored.messages).toBe(1);
  });
});

/* --------------------------- error shape --------------------------- */

describe('ApiError', () => {
  it('carries status, code and extra payload', () => {
    const err = new ApiError(429, 'quota_exceeded', 'daily limit', { limit: 10 });
    expect(err.status).toBe(429);
    expect(err.code).toBe('quota_exceeded');
    expect(err.extra.limit).toBe(10);
  });
});
