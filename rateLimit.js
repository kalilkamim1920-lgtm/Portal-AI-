/**
 * Rate limiting — two tiers:
 *  - global: every /api request (per IP)
 *  - ai: generation endpoints /api/chat, /api/tools, /api/images (per IP + uid)
 * Authenticated users are additionally protected by Firestore-backed daily
 * quotas (see services/usage.js) — rate limiting here only stops abuse bursts.
 */
import rateLimit from 'express-rate-limit';

const minutes = (n) => n * 60 * 1000;

const keyGenerator = (req) => {
  if (req.user?.uid) return `u:${req.user.uid}`;
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
};

export const globalLimiter = rateLimit({
  windowMs: minutes(Number(process.env.RATE_LIMIT_WINDOW_MINUTES || 15)),
  limit: Number(process.env.RATE_LIMIT_MAX || 300),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator,
  message: { error: { code: 'rate_limited', message: 'Too many requests, please slow down' } },
});

export const aiLimiter = rateLimit({
  windowMs: minutes(Number(process.env.AI_RATE_LIMIT_WINDOW_MINUTES || 15)),
  limit: Number(process.env.AI_RATE_LIMIT_MAX || 60),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator,
  message: { error: { code: 'rate_limited', message: 'AI request limit reached, please try again shortly' } },
});
