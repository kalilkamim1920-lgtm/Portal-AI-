/**
 * AI text provider — Gemini API (primary) with automatic fallback.
 *
 * The API key NEVER leaves the server. The browser talks only to /api/*.
 *
 * Providers:
 *   1. Google Gemini (generativelanguage.googleapis.com) when GEMINI_API_KEY is set.
 *      Supports true SSE streaming.
 *   2. Platform SDK fallback (z-ai-web-dev-sdk) when available (sandbox/demo),
 *      exposed as the "portal-flash" model so the demo always works.
 */
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const GEMINI_MODELS = [
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'gemini', badge: 'Fast' },
  { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', provider: 'gemini', badge: 'Light' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'gemini', badge: 'Stable' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'gemini', badge: 'Pro' },
];

export const FALLBACK_MODEL_ID = 'portal-flash';
export const FALLBACK_MODEL = {
  id: FALLBACK_MODEL_ID,
  name: 'Portal Flash (fallback)',
  provider: 'zai',
  badge: 'Demo',
};

let zaiCache = null;
async function getZai() {
  if (zaiCache) return zaiCache;
  const mod = await import('z-ai-web-dev-sdk').catch(() => null);
  if (!mod?.default) return null;
  zaiCache = await mod.default.create();
  return zaiCache;
}

export function hasGemini() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function listModels() {
  const models = [];
  if (hasGemini()) models.push(...GEMINI_MODELS);
  const zai = await getZai().catch(() => null);
  if (zai) models.push(FALLBACK_MODEL);
  return models;
}

export function isSupportedModel(modelId) {
  if (modelId === FALLBACK_MODEL_ID) return true;
  return GEMINI_MODELS.some((m) => m.id === modelId);
}

function buildContents(messages, attachments) {
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
  if (attachments?.length) {
    const last = contents[contents.length - 1];
    for (const att of attachments) {
      if (att.dataBase64 && att.mimeType?.startsWith('image/')) {
        last.parts.push({ inlineData: { mimeType: att.mimeType, data: att.dataBase64 } });
      }
    }
  }
  return contents;
}

/** Non-streaming generation. Returns { text, model, provider }. */
export async function generate({ messages, model, system, attachments }) {
  const zai = await getZai().catch(() => null);
  const useGemini = hasGemini() && (!model || model !== FALLBACK_MODEL_ID);

  if (useGemini) {
    const modelId = isSupportedModel(model) ? model : process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const body = {
      contents: buildContents(messages, attachments),
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      generationConfig: { temperature: 0.8, maxOutputTokens: 4096 },
    };
    const res = await fetch(
      `${GEMINI_BASE}/models/${modelId}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Gemini error ${res.status}: ${errText.slice(0, 300)}`);
    }
    const data = await res.json();
    const text =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ||
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      '';
    return { text, model: modelId, provider: 'gemini' };
  }

  if (zai) {
    const zaiMessages = [
      ...(system ? [{ role: 'assistant', content: system }] : []),
      ...messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    ];
    const completion = await zai.chat.completions.create({
      messages: zaiMessages,
      thinking: { type: 'disabled' },
    });
    const text = completion.choices?.[0]?.message?.content || '';
    return { text, model: FALLBACK_MODEL_ID, provider: 'zai' };
  }

  throw new Error(
    'No AI provider configured. Set GEMINI_API_KEY in the server environment (.env).'
  );
}

/**
 * Streaming generation (SSE chunks via async generator).
 * Falls back to a single-chunk stream when Gemini is unavailable.
 */
export async function* streamGenerate({ messages, model, system, attachments }) {
  const zai = await getZai().catch(() => null);
  const useGemini = hasGemini() && (!model || model !== FALLBACK_MODEL_ID);

  if (useGemini) {
    const modelId = isSupportedModel(model) ? model : process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const body = {
      contents: buildContents(messages, attachments),
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      generationConfig: { temperature: 0.8, maxOutputTokens: 4096 },
    };
    const res = await fetch(
      `${GEMINI_BASE}/models/${modelId}:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Gemini error ${res.status}: ${errText.slice(0, 300)}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          const chunk = json.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
          if (chunk) yield { chunk, model: modelId, provider: 'gemini' };
        } catch {
          /* ignore malformed keep-alive lines */
        }
      }
    }
    return;
  }

  if (zai) {
    const result = await generate({ messages, model: FALLBACK_MODEL_ID, system, attachments });
    // Emit in small chunks so the UI keeps its streaming behavior
    const pieces = result.text.match(/[\s\S]{1,48}/g) || [result.text];
    for (const piece of pieces) {
      yield { chunk: piece, model: FALLBACK_MODEL_ID, provider: 'zai' };
      await new Promise((r) => setTimeout(r, 12));
    }
    return;
  }

  throw new Error('No AI provider configured. Set GEMINI_API_KEY in the server environment (.env).');
}
