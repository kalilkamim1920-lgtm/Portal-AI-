/**
 * AI Chat routes — conversations + messages + streaming generation.
 *
 * Collections: conversations (metadata), messages (chat turns).
 * All writes include uid scoping; reads are filtered by uid.
 *
 * POST /api/chat                → SSE stream of the assistant reply
 * GET  /api/chat/conversations  → list user's conversations
 * POST /api/chat/conversations  → create conversation
 * PATCH /api/chat/conversations/:id  → rename
 * DELETE /api/chat/conversations/:id → delete (messages too)
 * GET  /api/chat/conversations/:id/messages → history
 */
import { Router } from 'express';
import { z } from 'zod';
import { db, COLLECTIONS } from '../config/firebase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, badRequest, notFound, quotaExceeded } from '../utils/errors.js';
import { consumeQuota } from '../services/plans.js';
import { generate, streamGenerate } from '../services/gemini.js';
import { logActivity } from '../services/activity.js';

const router = Router();
router.use(requireAuth);

/* ---------------------------- helpers ---------------------------- */

const CONV_LIMIT = 100;

async function ownedConversation(uid, id) {
  const ref = db.collection(COLLECTIONS.conversations).doc(id);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.uid !== uid) throw notFound('Conversation not found');
  return { ref, data: snap.data() };
}

async function saveMessage(conversationId, uid, role, content, extra = {}) {
  const now = new Date();
  const ref = await db.collection(COLLECTIONS.messages).add({
    conversationId,
    uid,
    role,
    content,
    createdAt: now,
    ...extra,
  });
  await db
    .collection(COLLECTIONS.conversations)
    .doc(conversationId)
    .set(
      {
        updatedAt: now,
        lastMessage: content.slice(0, 120),
      },
      { merge: true }
    )
    .catch(() => {});
  return { id: ref.id, conversationId, role, content, createdAt: now.toISOString() };
}

/* ------------------------ conversations CRUD ------------------------ */

router.get(
  '/conversations',
  asyncHandler(async (req, res) => {
    const snap = await db
      .collection(COLLECTIONS.conversations)
      .where('uid', '==', req.user.uid)
      .orderBy('updatedAt', 'desc')
      .limit(CONV_LIMIT)
      .get();
    const conversations = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ conversations });
  })
);

router.post(
  '/conversations',
  asyncHandler(async (req, res) => {
    const schema = z.object({
      title: z.string().trim().max(120).optional(),
      model: z.string().max(80).optional(),
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) throw badRequest('Invalid conversation data');

    const now = new Date();
    const ref = await db.collection(COLLECTIONS.conversations).add({
      uid: req.user.uid,
      title: parsed.data.title || 'محادثة جديدة',
      model: parsed.data.model || 'gemini-2.0-flash',
      createdAt: now,
      updatedAt: now,
      lastMessage: '',
    });
    res.status(201).json({ conversation: { id: ref.id, uid: req.user.uid, ...parsed.data, createdAt: now.toISOString(), updatedAt: now.toISOString() } });
  })
);

router.patch(
  '/conversations/:id',
  asyncHandler(async (req, res) => {
    const schema = z.object({ title: z.string().trim().min(1).max(120) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Title is required (1-120 chars)');
    const { ref } = await ownedConversation(req.user.uid, req.params.id);
    await ref.update({ title: parsed.data.title });
    res.json({ ok: true, id: ref.id, title: parsed.data.title });
  })
);

router.delete(
  '/conversations/:id',
  asyncHandler(async (req, res) => {
    const { ref } = await ownedConversation(req.user.uid, req.params.id);
    // Delete messages belonging to this conversation (batched)
    const msgs = await db
      .collection(COLLECTIONS.messages)
      .where('conversationId', '==', ref.id)
      .where('uid', '==', req.user.uid)
      .get();
    const batch = db.batch();
    msgs.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(ref);
    await batch.commit();
    res.json({ ok: true, deleted: ref.id, messages: msgs.size });
  })
);

router.get(
  '/conversations/:id/messages',
  asyncHandler(async (req, res) => {
    await ownedConversation(req.user.uid, req.params.id);
    const snap = await db
      .collection(COLLECTIONS.messages)
      .where('conversationId', '==', req.params.id)
      .where('uid', '==', req.user.uid)
      .orderBy('createdAt', 'asc')
      .limit(300)
      .get();
    const messages = snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate?.().toISOString() }));
    res.json({ messages });
  })
);

/* ----------------------------- chat ----------------------------- */

const chatSchema = z.object({
  conversationId: z.string().min(1).optional(),
  message: z.string().trim().min(1).max(8000),
  model: z.string().max(80).optional(),
  attachments: z
    .array(
      z.object({
        name: z.string().max(120).optional(),
        mimeType: z.string().max(80),
        dataBase64: z.string().max(8_000_000), // ~6MB binary
      })
    )
    .max(3)
    .optional(),
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest('Invalid chat payload', { issues: parsed.error.issues?.slice(0, 3) });
    }
    const { conversationId, message, model, attachments } = parsed.data;
    const uid = req.user.uid;

    // 1) Quota check on the server BEFORE any generation
    try {
      await consumeQuota(uid, 'messages');
    } catch (e) {
      if (e.status === 429) throw e;
      throw e;
    }

    // 2) Resolve or create conversation
    let convRef;
    let convData;
    if (conversationId) {
      const owned = await ownedConversation(uid, conversationId);
      convRef = owned.ref;
      convData = owned.data;
    } else {
      const now = new Date();
      const ref = await db.collection(COLLECTIONS.conversations).add({
        uid,
        title: message.slice(0, 60) || 'محادثة جديدة',
        model: model || 'gemini-2.0-flash',
        createdAt: now,
        updatedAt: now,
        lastMessage: message.slice(0, 120),
      });
      convRef = ref;
      convData = {};
    }

    // 3) Load short history for context (last 12 messages)
    const historySnap = await db
      .collection(COLLECTIONS.messages)
      .where('conversationId', '==', convRef.id)
      .where('uid', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(12)
      .get();
    const history = historySnap.docs
      .map((d) => d.data())
      .reverse()
      .map((m) => ({ role: m.role, content: m.content }));

    // 4) Persist the user message (with attachment metadata, not the bytes)
    const userMessage = await saveMessage(
      convRef.id,
      uid,
      'user',
      message,
      attachments?.length
        ? { attachments: attachments.map((a) => ({ name: a.name, mimeType: a.mimeType, size: a.dataBase64?.length })) }
        : {}
    );

    // 5) Stream the assistant reply over SSE
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const send = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    send('meta', { conversationId: convRef.id, userMessageId: userMessage.id, model: model || convData?.model });

    let full = '';
    let usedModel = model || 'gemini-2.0-flash';
    let abortedByClient = false;
    req.on('close', () => {
      abortedByClient = true;
    });

    const system =
      'You are PORTAL AI, a helpful premium AI assistant. Answer in the same language the user writes in ' +
      '(Arabic or English). Use Markdown for structure and fenced code blocks with language tags for code.';

    try {
      const stream = streamGenerate({
        messages: [...history, { role: 'user', content: message }],
        model,
        system,
        attachments,
      });
      for await (const piece of stream) {
        if (abortedByClient) break;
        full += piece.chunk;
        usedModel = piece.model;
        send('delta', { chunk: piece.chunk });
      }
    } catch (err) {
      console.error('[chat] generation failed:', err.message);
      if (!full) {
        send('error', {
          message:
            err.message?.includes('No AI provider')
              ? 'الخدمة غير مهيأة بعد / AI provider not configured — set GEMINI_API_KEY on the server.'
              : 'تعذر توليد الرد / Generation failed, please try again.',
        });
        return res.end();
      }
    }

    // 6) Persist assistant message (even if the client stopped generation mid-way
    //    — we keep the partial answer so the user does not lose it)
    if (full) {
      const saved = await saveMessage(convRef.id, uid, 'assistant', full, { model: usedModel });
      send('done', {
        messageId: saved.id,
        model: usedModel,
        stopped: abortedByClient,
        conversationId: convRef.id,
      });
      logActivity(uid, 'chat.message', { model: usedModel, chars: full.length }, req);
    }
    res.end();
  })
);

export default router;
