# Portal AI deployment notes

This project is a Vite + React frontend with an Express API server.

## Replit / Node hosting
- Install command: `npm install`
- Build command: `npm run build`
- Run command: `npm start`
- Runtime: Node.js 18 or newer
- The server listens on `PORT` (or `SERVER_PORT`, default 3030).

## Required secrets / environment variables
Set these in the hosting provider's Secrets / Environment Variables UI, not in source files:

### Firebase client (required for account sign-in)
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

### Firebase Admin (required for server-side auth and Firestore)
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (preserve newlines, or use `\\n` between lines)

### AI (required for Gemini chat)
- `GEMINI_API_KEY`
- Optional: `GEMINI_MODEL`

Optional configuration:
- `CLIENT_ORIGIN` (allowed browser origins; usually the deployed app URL)
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` (only if intentionally configuring an admin account)
- `IMAGE_PROVIDER`, `IMAGE_DATA_DIR`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MINUTES`, `AI_RATE_LIMIT_MAX`, `AI_RATE_LIMIT_WINDOW_MINUTES`, `FORCE_HTTPS`

Do not publish Firebase service-account private keys, Gemini API keys, passwords, or `.env` files in GitHub or in a public ZIP.
