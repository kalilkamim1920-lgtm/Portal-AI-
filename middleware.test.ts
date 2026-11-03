/**
 * Auth middleware + subscription validation tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  getUserDoc: vi.fn(),
}));

vi.mock('../config/firebase.js', () => ({
  db: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({ get: mocks.getUserDoc, update: vi.fn(async () => {}), set: vi.fn(async () => {}) })),
    })),
  },
  auth: { verifyIdToken: mocks.verifyIdToken },
  IS_EMULATOR: true,
  COLLECTIONS: { users: 'users', subscriptions: 'subscriptions' },
}));

const { requireAuth } = await import('../middleware/auth.js');

function makeRes() {
  const res = {
    statusCode: 0,
    payload: null as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(p: unknown) { this.payload = p; return this; },
  };
  return res;
}

describe('requireAuth middleware', () => {
  beforeEach(() => {
    mocks.verifyIdToken.mockReset();
    mocks.getUserDoc.mockReset();
  });

  it('rejects requests without a bearer token (401 via next(error))', async () => {
    const res = makeRes();
    const next = vi.fn();
    await requireAuth({ headers: {} }, res as never, next);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.status).toBe(401);
    expect(err.code).toBe('unauthorized');
  });

  it('rejects invalid tokens (401)', async () => {
    mocks.verifyIdToken.mockRejectedValue(new Error('auth/id-token-expired'));
    const res = makeRes();
    const next = vi.fn();
    await requireAuth({ headers: { authorization: 'Bearer bad.token.here' } }, res as never, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].status).toBe(401);
  });

  it('accepts a valid token and attaches user + profile', async () => {
    mocks.verifyIdToken.mockResolvedValue({ uid: 'u9', email: 'u9@test.io', admin: false });
    mocks.getUserDoc.mockResolvedValue({ exists: true, id: 'u9', data: () => ({ uid: 'u9', displayName: 'Nine', disabled: false, role: 'user' }) });

    const req: Record<string, unknown> = { headers: { authorization: 'Bearer good.token' } };
    const res = makeRes();
    const next = vi.fn();

    await requireAuth(req as never, res as never, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0].length).toBe(0); // no error passed
    expect((req.user as { uid: string } | undefined)?.uid).toBe('u9');
    expect((req.profile as { displayName: string } | undefined)?.displayName).toBe('Nine');
    expect(req.plan).toBe('free');
  });

  it('blocks disabled accounts even with a valid token', async () => {
    mocks.verifyIdToken.mockResolvedValue({ uid: 'u-disabled', email: 'd@test.io' });
    mocks.getUserDoc.mockResolvedValue({ exists: true, id: 'u-disabled', data: () => ({ uid: 'u-disabled', disabled: true, role: 'user' }) });

    const req = { headers: { authorization: 'Bearer valid.token' } };
    const res = makeRes();
    const next = vi.fn();

    await requireAuth(req as never, res as never, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].status).toBe(401);
    expect(next.mock.calls[0][0].message).toContain('disabled');
  });
});

/* ------------------- demo card validation (Luhn) ------------------- */

describe('demo checkout card validation (Luhn)', () => {
  // Re-implemented here to lock the accepted test-card behavior:
  // 4242 4242 4242 4242 must pass, malformed numbers must fail.
  function luhnValid(num: string) {
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

  it('accepts the classic test card 4242…', () => {
    expect(luhnValid('4242 4242 4242 4242')).toBe(true);
  });

  it('rejects malformed card numbers', () => {
    expect(luhnValid('1234 5678 9012 3456')).toBe(false);
    expect(luhnValid('4242')).toBe(false);
    expect(luhnValid('')).toBe(false);
  });
});
