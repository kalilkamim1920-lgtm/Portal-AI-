/**
 * Backend API client.
 * - Attaches the Firebase ID token (Bearer) to every request.
 * - Handles JSON errors from the server uniformly.
 * - streamChat() consumes the server's SSE stream with abort support.
 */
import { firebaseAuth } from './firebase';

const BASE: string = import.meta.env.VITE_API_BASE_URL || '/api';
// Optional gateway routing param (sandbox preview only; empty in normal builds)
const PORT_PARAM: string = import.meta.env.VITE_XPORT || '';

export class ApiError extends Error {
  status: number;
  code: string;
  extra: Record<string, unknown>;
  constructor(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

function buildUrl(path: string): string {
  const url = `${BASE}${path}`;
  if (!PORT_PARAM) return url;
  return url + (url.includes('?') ? `&${PORT_PARAM}` : `?${PORT_PARAM}`);
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAuthToken(force = false): Promise<string | null> {
  if (!firebaseAuth?.currentUser) return null;
  const user = firebaseAuth.currentUser;
  if (!force && cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const token = await user.getIdToken(force);
  // Firebase tokens live 1h; refresh 5min early
  cachedToken = { token, expiresAt: Date.now() + 55 * 60 * 1000 };
  return token;
}

export function invalidateTokenCache() {
  cachedToken = null;
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  const res = await fetch(buildUrl(path), { ...options, headers });

  if (res.status === 401 && retry) {
    // Token may have just expired — force refresh once
    invalidateTokenCache();
    return request<T>(path, options, false);
  }

  const contentType = res.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await res.json().catch(() => ({})) : {};

  if (!res.ok) {
    const err = (payload as { error?: { code?: string; message?: string; messageAr?: string } }).error;
    throw new ApiError(res.status, err?.code || 'error', err?.message || `Request failed (${res.status})`, payload as Record<string, unknown>);
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/* ------------------------- SSE chat streaming ------------------------- */

export interface ChatStreamHandlers {
  onMeta?: (meta: { conversationId: string; userMessageId: string; model?: string }) => void;
  onDelta?: (chunk: string) => void;
  onDone?: (info: { messageId: string; model?: string; stopped: boolean; conversationId: string }) => void;
  onError?: (message: string) => void;
}

export async function streamChat(
  body: { conversationId?: string; message: string; model?: string; attachments?: { name?: string; mimeType: string; dataBase64: string }[] },
  handlers: ChatStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const token = await getAuthToken();
  const res = await fetch(buildUrl('/chat'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    let message = `Request failed (${res.status})`;
    try {
      const payload = await res.json();
      message = payload?.error?.message || message;
    } catch {
      /* ignore */
    }
    handlers.onError?.(message);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';
      for (const evt of events) {
        const lines = evt.split('\n');
        const event = lines.find((l) => l.startsWith('event:'))?.slice(6).trim();
        const dataLine = lines.find((l) => l.startsWith('data:'))?.slice(5).trim();
        if (!event || !dataLine) continue;
        try {
          const data = JSON.parse(dataLine);
          if (event === 'meta') handlers.onMeta?.(data);
          else if (event === 'delta') handlers.onDelta?.(data.chunk);
          else if (event === 'done') handlers.onDone?.(data);
          else if (event === 'error') handlers.onError?.(data.message);
        } catch {
          /* ignore malformed event */
        }
      }
    }
  } catch (e) {
    const err = e as Error;
    if (err.name !== 'AbortError') {
      handlers.onError?.('Connection interrupted. Please try again.');
    }
  }
}

/** Build an SSE-safe file → base64 (without prefix) for chat attachments. */
export function fileToBase64(file: File): Promise<{ name: string; mimeType: string; dataBase64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve({
        name: file.name,
        mimeType: file.type,
        dataBase64: result.split(',')[1] || '',
      });
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
