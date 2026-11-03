/**
 * Image generation provider.
 *
 *  1. z-ai platform SDK (sandbox/demo) — real image generation, no key needed.
 *  2. Google Gemini / Imagen when GEMINI_API_KEY is set (provider=gemini).
 *
 * Generated files are written to server/data/images and served through
 * GET /api/images/file/:id (see routes/images.js). For serverless hosting,
 * swap this service for Firebase Storage or a CDN (documented in README).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = path.resolve(process.env.IMAGE_DATA_DIR || process.cwd(), 'server/data/images');

export const IMAGE_SIZES = [
  { id: '1024x1024', label: 'Square 1:1' },
  { id: '768x1344', label: 'Portrait 4:7' },
  { id: '864x1152', label: 'Portrait 3:4' },
  { id: '1344x768', label: 'Landscape 7:4' },
  { id: '1152x864', label: 'Landscape 4:3' },
  { id: '1440x720', label: 'Wide 2:1' },
  { id: '720x1440', label: 'Tall 1:2' },
];

export const IMAGE_STYLES = [
  { id: 'none', label: 'No style', promptSuffix: '' },
  { id: 'realistic', label: 'Realistic', promptSuffix: ', photorealistic, ultra detailed, 8k, natural lighting' },
  { id: 'anime', label: 'Anime', promptSuffix: ', anime style, vibrant colors, studio ghibli inspired' },
  { id: 'digital-art', label: 'Digital Art', promptSuffix: ', digital art, concept art, trending on artstation' },
  { id: '3d-render', label: '3D Render', promptSuffix: ', 3d render, octane render, cinematic lighting, high detail' },
  { id: 'watercolor', label: 'Watercolor', promptSuffix: ', watercolor painting, soft edges, artistic' },
  { id: 'cyberpunk', label: 'Cyberpunk', promptSuffix: ', cyberpunk style, neon lights, futuristic, moody atmosphere' },
  { id: 'minimalist', label: 'Minimalist', promptSuffix: ', minimalist, clean composition, flat design' },
];

let zaiCache = null;
async function getZai() {
  if (zaiCache) return zaiCache;
  const mod = await import('z-ai-web-dev-sdk').catch(() => null);
  if (!mod?.default) return null;
  zaiCache = await mod.default.create();
  return zaiCache;
}

export async function providerName() {
  const pref = process.env.IMAGE_PROVIDER || 'auto';
  if (pref === 'zai') return 'zai';
  if (pref === 'gemini' && process.env.GEMINI_API_KEY) return 'gemini';
  const zai = await getZai().catch(() => null);
  if (zai) return 'zai';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  return null;
}

export async function generateImage({ prompt, size = '1024x1024', style = 'none' }) {
  const provider = await providerName();
  if (!provider) {
    throw new Error('No image provider configured. Set GEMINI_API_KEY or IMAGE_PROVIDER in .env.');
  }

  const styleDef = IMAGE_STYLES.find((s) => s.id === style) || IMAGE_STYLES[0];
  const fullPrompt = `${prompt}${styleDef.promptSuffix}`;

  await fs.mkdir(DATA_DIR, { recursive: true });
  const id = crypto.randomUUID();
  let filePath;
  let buffer;

  if (provider === 'zai') {
    const zai = await getZai();
    const response = await zai.images.generations.create({ prompt: fullPrompt, size });
    const base64 = response.data[0].base64;
    buffer = Buffer.from(base64, 'base64');
    filePath = path.join(DATA_DIR, `${id}.png`);
    await fs.writeFile(filePath, buffer);
  } else {
    // Gemini image generation (gemini-2.0-flash-exp image out)
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
      }
    );
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`Gemini image error ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const imgPart = parts.find((p) => p.inlineData?.data);
    if (!imgPart) throw new Error('Gemini did not return an image for this prompt.');
    buffer = Buffer.from(imgPart.inlineData.data, 'base64');
    const mime = imgPart.inlineData.mimeType || 'image/png';
    const ext = mime.includes('jpeg') ? 'jpg' : 'png';
    filePath = path.join(DATA_DIR, `${id}.${ext}`);
    await fs.writeFile(filePath, buffer);
  }

  return { id, provider, filePath, bytes: buffer.length, size, style };
}
