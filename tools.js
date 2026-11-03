/**
 * AI Tools routes — 8 real, working tools.
 *
 * POST /api/tools/:tool
 *   writer | translator | summarizer | coding | email | story | improver | qa
 *
 * Each tool consumes 1 message from the user's daily quota (server-enforced)
 * and returns structured output. History of tool results is stored in the
 * `messages` collection under a synthetic conversation id (tools) so the UI
 * can show recent runs.
 */
import { Router } from 'express';
import { z } from 'zod';
import { COLLECTIONS } from '../config/firebase.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, badRequest, notFound } from '../utils/errors.js';
import { consumeToolQuota } from '../services/plans.js';
import { generate } from '../services/gemini.js';
import { logActivity } from '../services/activity.js';

const router = Router();
router.use(requireAuth);

/* ----------------------------- tool specs ----------------------------- */

export const TOOLS = {
  writer: {
    name: 'AI Writer',
    nameAr: 'كاتب AI',
    schema: z.object({
      topic: z.string().trim().min(3).max(2000),
      type: z.enum(['article', 'blog', 'social', 'ads', 'product']).default('article'),
      tone: z.enum(['professional', 'friendly', 'persuasive', 'casual', 'academic']).default('professional'),
      length: z.enum(['short', 'medium', 'long']).default('medium'),
      language: z.enum(['auto', 'ar', 'en']).default('auto'),
    }),
    system:
      'You are an elite copywriter. Produce polished, publication-ready content in Markdown. ' +
      'Never mention that you are an AI. Respond in the same language as the topic unless told otherwise.',
    build: (d) =>
      `Write a ${d.length} ${d.type} about: "${d.topic}". Tone: ${d.tone}. ${d.language !== 'auto' ? `Language: ${d.language}.` : ''}\n` +
      'Include a compelling title, clear sections with headers, and a strong conclusion.',
  },
  translator: {
    name: 'AI Translator',
    nameAr: 'مترجم AI',
    schema: z.object({
      text: z.string().trim().min(1).max(5000),
      from: z.enum(['auto', 'ar', 'en', 'fr', 'es', 'de', 'tr']).default('auto'),
      to: z.enum(['ar', 'en', 'fr', 'es', 'de', 'tr']).default('en'),
      style: z.enum(['faithful', 'natural', 'formal', 'informal']).default('natural'),
    }),
    system:
      'You are a professional translator. Translate accurately while preserving meaning, tone and formatting. ' +
      'Output ONLY the translation, nothing else. Keep Markdown formatting if present.',
    build: (d) =>
      `Translate from ${d.from === 'auto' ? 'the detected language' : d.from} to ${d.to} (${d.style} style):\n\n${d.text}`,
  },
  summarizer: {
    name: 'AI Summarizer',
    nameAr: 'تلخيص AI',
    schema: z.object({
      text: z.string().trim().min(50).max(20000),
      ratio: z.enum(['brief', 'balanced', 'detailed']).default('balanced'),
      format: z.enum(['paragraph', 'bullets', 'tldr']).default('bullets'),
      language: z.enum(['auto', 'ar', 'en']).default('auto'),
    }),
    system:
      'You are an expert summarizer. Capture key points faithfully without inventing information. ' +
      'Answer in the same language as the input unless told otherwise.',
    build: (d) =>
      `Summarize the following text (${d.ratio}, output as ${d.format === 'bullets' ? 'markdown bullet points' : d.format === 'tldr' ? 'a one-line TL;DR followed by 3 key points' : 'a cohesive paragraph'}):\n\n${d.text}`,
  },
  coding: {
    name: 'AI Coding Assistant',
    nameAr: 'مساعد البرمجة',
    schema: z.object({
      task: z.string().trim().min(3).max(3000),
      language: z.string().trim().max(30).default('typescript'),
      mode: z.enum(['write', 'explain', 'review', 'fix']).default('write'),
      code: z.string().max(10000).optional(),
    }),
    system:
      'You are a senior software engineer. Give correct, secure, idiomatic code with brief explanations. ' +
      'Always use fenced code blocks with the language tag. Point out edge cases and security issues.',
    build: (d) =>
      `Mode: ${d.mode}. Language: ${d.language}.\nTask: ${d.task}\n${d.code ? `\nExisting code:\n\`\`\`\n${d.code}\n\`\`\`` : ''}`,
  },
  email: {
    name: 'AI Email Writer',
    nameAr: 'كاتب الإيميلات',
    schema: z.object({
      intent: z.string().trim().min(3).max(1000),
      recipient: z.enum(['boss', 'client', 'colleague', 'support', 'other']).default('client'),
      tone: z.enum(['formal', 'neutral', 'friendly', 'apologetic']).default('formal'),
      language: z.enum(['auto', 'ar', 'en']).default('auto'),
    }),
    system:
      'You write professional emails. Output: subject line, greeting, body, sign-off. Keep it concise and actionable.',
    build: (d) =>
      `Write an email to my ${d.recipient} (tone: ${d.tone}) about: ${d.intent}. ${d.language !== 'auto' ? `Language: ${d.language}.` : ''}`,
  },
  story: {
    name: 'AI Story Generator',
    nameAr: 'مولّد القصص',
    schema: z.object({
      idea: z.string().trim().min(3).max(1000),
      genre: z.enum(['sci-fi', 'fantasy', 'mystery', 'romance', 'horror', 'adventure', 'comedy']).default('fantasy'),
      length: z.enum(['flash', 'short']).default('flash'),
      language: z.enum(['auto', 'ar', 'en']).default('auto'),
    }),
    system:
      'You are a creative fiction author. Write vivid, original stories with strong openings and satisfying endings. ' +
      'Use Markdown for chapters/sections when appropriate.',
    build: (d) =>
      `Write a ${d.length === 'flash' ? 'flash fiction (~400 words)' : 'short story (~900 words)'} in the ${d.genre} genre based on this idea: "${d.idea}". ${d.language !== 'auto' ? `Language: ${d.language}.` : ''}`,
  },
  improver: {
    name: 'AI Text Improver',
    nameAr: 'محسّن النصوص',
    schema: z.object({
      text: z.string().trim().min(2).max(8000),
      goal: z.enum(['clarity', 'grammar', 'professional', 'creative', 'concise']).default('clarity'),
      language: z.enum(['auto', 'ar', 'en']).default('auto'),
    }),
    system:
      'You are an editor. Improve the given text per the requested goal while preserving its voice and meaning. ' +
      'Output: the improved text first, then a short "What changed" section as bullet points.',
    build: (d) =>
      `Improve this text for ${d.goal}. ${d.language !== 'auto' ? `Output language: ${d.language}.` : ''}\n\n${d.text}`,
  },
  qa: {
    name: 'AI Question Answering',
    nameAr: 'الإجابة عن الأسئلة',
    schema: z.object({
      question: z.string().trim().min(3).max(2000),
      context: z.string().max(10000).optional(),
      style: z.enum(['concise', 'detailed', 'eli5']).default('concise'),
    }),
    system:
      'You are a knowledgeable assistant. Answer strictly from the provided context when context is given; ' +
      'if the answer is not in the context, say so clearly. Be accurate and cite parts of the context when possible.',
    build: (d) =>
      `Answer this question (${d.style === 'eli5' ? 'explain like I am 5' : d.style}): ${d.question}\n${d.context ? `\nContext:\n"""\n${d.context}\n"""` : ''}`,
  },
};

export function toolList() {
  return Object.entries(TOOLS).map(([id, t]) => ({
    id,
    name: t.name,
    nameAr: t.nameAr,
    fields: Object.keys(t.schema.shape || {}),
  }));
}

/* ------------------------------ routes ------------------------------ */

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ tools: toolList() });
  })
);

router.post(
  '/:tool',
  asyncHandler(async (req, res) => {
    const toolId = req.params.tool;
    const tool = TOOLS[toolId];
    if (!tool) throw notFound(`Unknown tool: ${toolId}`);

    const parsed = tool.schema.safeParse(req.body || {});
    if (!parsed.success) {
      throw badRequest('Invalid tool input', {
        issues: parsed.error.issues?.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    // Server-side quota enforcement (counts toward daily messages)
    await consumeToolQuota(req.user.uid);

    const prompt = tool.build(parsed.data);
    const result = await generate({
      messages: [{ role: 'user', content: prompt }],
      system: tool.system,
    });

    // Save to history
    await saveToolRun(req, toolId, parsed.data, result.text);

    logActivity(req.user.uid, 'tool.run', { tool: toolId, model: result.model }, req);

    res.json({
      tool: toolId,
      result: result.text,
      model: result.model,
      provider: result.provider,
    });
  })
);

/** Store tool run in messages collection (synthetic conversation per tool). */
async function saveToolRun(req, toolId, input, output) {
  const { db } = await import('../config/firebase.js');
  const uid = req.user.uid;
  const syntheticId = `tool-${toolId}-${uid}`;
  const now = new Date();
  const convRef = db.collection(COLLECTIONS.conversations).doc(syntheticId);
  const convSnap = await convRef.get();
  if (!convSnap.exists) {
    await convRef.set({
      uid,
      kind: 'tool-history',
      tool: toolId,
      title: `سجل أداة ${toolId}`,
      createdAt: now,
      updatedAt: now,
      lastMessage: '',
    });
  } else {
    await convRef.set({ updatedAt: now }, { merge: true });
  }
  await db.collection(COLLECTIONS.messages).add({
    conversationId: syntheticId,
    uid,
    role: 'tool',
    tool: toolId,
    content: output,
    input,
    createdAt: now,
  });
}

export default router;
