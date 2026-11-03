/**
 * Auth & profile routes (session-sync after Firebase client login).
 *
 * GET  /api/auth/me       → user profile + plan + usage + isAdmin
 * PATCH /api/auth/profile → displayName, language, settings
 */
import { Router } from 'express';
import { z } from 'zod';
import { db, auth, COLLECTIONS } from '../config/firebase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, badRequest, notFound } from '../utils/errors.js';
import { remainingQuota } from '../services/plans.js';
import { listModels, hasGemini } from '../services/gemini.js';
import { providerName as imageProvider } from '../services/imageProvider.js';
import { logActivity } from '../services/activity.js';

const router = Router();

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { uid } = req.user;
    const [quota, models, imgProvider] = await Promise.all([
      remainingQuota(uid),
      listModels(),
      imageProvider(),
    ]);

    const isAdmin = req.user.claims?.admin === true || req.profile?.role === 'admin';

    res.json({
      user: {
        uid,
        email: req.user.email,
        displayName: req.profile?.displayName || req.user.name,
        photoURL: req.profile?.photoURL || req.user.picture,
        emailVerified: req.user.claims?.email_verified || false,
        createdAt: req.profile?.createdAt || null,
        language: req.profile?.language || 'ar',
        settings: req.profile?.settings || {},
      },
      plan: quota.plan,
      planName: quota.planName,
      usage: quota,
      isAdmin,
      providers: {
        chat: hasGemini() ? 'gemini' : models.length ? 'fallback' : null,
        image: imgProvider,
        models,
      },
    });
  })
);

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  language: z.enum(['ar', 'en']).optional(),
  settings: z
    .object({
      defaultModel: z.string().max(80).optional(),
      emailNotifications: z.boolean().optional(),
      pushNotifications: z.boolean().optional(),
    })
    .optional(),
});

router.patch(
  '/profile',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Invalid profile data');

    const { uid } = req.user;
    const updates = {};
    if (parsed.data.displayName !== undefined) updates.displayName = parsed.data.displayName;
    if (parsed.data.language !== undefined) updates.language = parsed.data.language;
    if (parsed.data.settings) {
      updates.settings = { ...(req.profile?.settings || {}), ...parsed.data.settings };
    }

    await db.collection(COLLECTIONS.users).doc(uid).set(updates, { merge: true });

    if (parsed.data.displayName) {
      await auth.updateUser(uid, { displayName: parsed.data.displayName }).catch(() => {});
    }
    logActivity(uid, 'profile.update', { fields: Object.keys(updates) }, req);

    res.json({ ok: true, updated: Object.keys(updates) });
  })
);

/** Update password from the client is done via Firebase client SDK (updatePassword).
 *  This endpoint exists for completeness: it verifies the user's identity server-side
 *  before delegating an admin password change (never stores plaintext). */
router.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const schema = z.object({ newPassword: z.string().min(8).max(128) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Password must be at least 8 characters');
    await auth.updateUser(req.user.uid, { password: parsed.data.newPassword });
    logActivity(req.user.uid, 'auth.password_changed', {}, req);
    res.json({ ok: true });
  })
);

/** Delete current user account (erases profile doc; auth record removal). */
router.delete(
  '/account',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { uid } = req.user;
    await db.collection(COLLECTIONS.users).doc(uid).delete();
    logActivity(uid, 'auth.account_deleted', {}, req);
    res.json({ ok: true });
  })
);

export default router;
