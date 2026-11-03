/**
 * PORTAL AI — Express API + production SPA host.
 *
 * Development:  npm run dev:server  (API on :3030, Vite dev server on :5173 proxies /api)
 * Production:   npm run build && npm start  (Express serves dist/ + API on $PORT)
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { globalLimiter } from './middleware/rateLimit.js';
import { notFoundHandler, errorHandler } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import toolRoutes from './routes/tools.js';
import imageRoutes from './routes/images.js';
import subscriptionRoutes from './routes/subscriptions.js';
import notificationRoutes from './routes/notifications.js';
import adminRoutes from './routes/admin.js';
import { IS_EMULATOR } from './config/firebase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

/* ------------------------------ security ------------------------------ */

// Minimal strict CSP-style security headers (helmet-equivalent, dependency-free)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  if (process.env.NODE_ENV === 'production' || process.env.FORCE_HTTPS === 'true') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Body limits: chat attachments (images) can be large; keep a hard ceiling
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

// CORS allow-list from CLIENT_ORIGIN (comma separated)
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://localhost:4173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // curl / same-origin / mobile webview
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return cb(null, true);
      return cb(null, false); // silently drop: browser will block
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

app.use('/api', globalLimiter);

/* ------------------------------- routes ------------------------------- */

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'portal-ai-api',
    emulator: IS_EMULATOR,
    gemini: Boolean(process.env.GEMINI_API_KEY),
    time: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/tools', toolRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

/* --------------------------- SPA (production) --------------------------- */

const distDir = path.resolve(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { maxAge: '1d', index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

/* ------------------------------ errors ------------------------------ */

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = Number(process.env.SERVER_PORT || process.env.PORT || 3030);
const server = app.listen(PORT, () => {
  console.log(`[PORTAL AI] API ready on http://localhost:${PORT} ${IS_EMULATOR ? '(Firebase emulators)' : ''}`);
});

// Graceful shutdown
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));

export default app;
