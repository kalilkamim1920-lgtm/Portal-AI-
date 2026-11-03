/**
 * Image Generator routes.
 *
 * POST /api/images/generate  → { prompt, size, style } → quota + provider + Firestore history
 * GET  /api/images           → user's image history
 * GET  /api/images/file/:id  → serve generated file (owner-only)
 * DELETE /api/images/:id     → remove from history
 */
import { Router } from 'express';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { db, COLLECTIONS } from '../config/firebase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, badRequest, notFound } from '../utils/errors.js';
import { consumeQuota } from '../services/plans.js';
import { generateImage, IMAGE_SIZES, IMAGE_STYLES } from '../services/imageProvider.js';
import { logActivity } from '../services/activity.js';

const router = Router();
const DATA_DIR = path.resolve(process.env.IMAGE_DATA_DIR || process.cwd(), 'server/data/images');

router.use(requireAuth);

router.get(
  '/meta',
  asyncHandler(async (req, res) => {
    res.json({ sizes: IMAGE_SIZES, styles: IMAGE_STYLES });
  })
);

router.post(
  '/generate',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      prompt: z.string().trim().min(3).max(1000),
      size: z.string().max(20).default('1024x1024'),
      style: z.string().max(30).default('none'),
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) throw badRequest('Invalid image request');

    if (!IMAGE_SIZES.some((s) => s.id === parsed.data.size)) throw badRequest('Unsupported size');
    if (!IMAGE_STYLES.some((s) => s.id === parsed.data.style)) throw badRequest('Unsupported style');

    // Server-side quota enforcement
    await consumeQuota(req.user.uid, 'images');

    const generated = await generateImage(parsed.data);

    const now = new Date();
    const doc = {
      uid: req.user.uid,
      prompt: parsed.data.prompt,
      size: parsed.data.size,
      style: parsed.data.style,
      provider: generated.provider,
      file: path.basename(generated.filePath),
      bytes: generated.bytes,
      createdAt: now,
    };
    const ref = await db.collection(COLLECTIONS.images).add(doc);
    logActivity(req.user.uid, 'image.generate', { size: parsed.data.size, style: parsed.data.style }, req);

    res.status(201).json({
      image: {
        id: ref.id,
        url: `/api/images/file/${ref.id}`,
        prompt: parsed.data.prompt,
        size: parsed.data.size,
        style: parsed.data.style,
        provider: generated.provider,
        createdAt: now.toISOString(),
      },
    });
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const snap = await db
      .collection(COLLECTIONS.images)
      .where('uid', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .limit(60)
      .get();
    const images = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        url: `/api/images/file/${d.id}`,
        prompt: data.prompt,
        size: data.size,
        style: data.style,
        provider: data.provider,
        createdAt: data.createdAt?.toDate?.().toISOString?.() || null,
      };
    });
    res.json({ images });
  })
);

router.get(
  '/file/:id',
  asyncHandler(async (req, res) => {
    const snap = await db.collection(COLLECTIONS.images).doc(req.params.id).get();
    if (!snap.exists || snap.data()?.uid !== req.user.uid) throw notFound('Image not found');
    const file = path.join(DATA_DIR, path.basename(snap.data().file));
    if (!fs.existsSync(file)) throw notFound('Image file missing');
    res.setHeader('Content-Type', snap.data().file.endsWith('.jpg') ? 'image/jpeg' : 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    fs.createReadStream(file).pipe(res);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const ref = db.collection(COLLECTIONS.images).doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.uid !== req.user.uid) throw notFound('Image not found');
    const file = path.join(DATA_DIR, path.basename(snap.data().file));
    if (fs.existsSync(file)) fs.unlinkSync(file);
    await ref.delete();
    res.json({ ok: true });
  })
);

export default router;
