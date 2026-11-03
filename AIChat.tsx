/**
 * AI Chat — full-featured chat page.
 *
 * Features: conversation list (create/rename/delete), streaming replies with
 * a stop button, typing indicator, model picker, Markdown + code blocks with
 * copy, image attachments, answer copy, clear error states.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus, MessageSquare, Pencil, Trash2, Send, Square, Copy, Check,
  Paperclip, X, AlertCircle, PanelRightClose,
} from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useLang } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { api, streamChat, fileToBase64 } from '../services/api';
import type { Conversation, ChatMessage } from '../types';
import { useAsync } from '../hooks/useAsync';
import { MarkdownView } from '../components/MarkdownView';
import { Spinner } from '../components/LoadingScreen';
import { useToast } from '../components/Toast';
import { cn, initials, formatDateTime } from '../utils/helpers';

export default function AIChat() {
  const { t, lang } = useLang();
  const { user, refreshProfile, providers } = useAuth();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const activeId = params.get('c');

  /* ------------------------------ state ------------------------------ */
  const { data: conversations, refresh: refreshConversations } = useAsync<Conversation[]>(
    async () => (await api.get<{ conversations: Conversation[] }>('/chat/conversations')).conversations?.filter((c: Conversation) => c.kind !== 'tool-history') ?? [],
    []
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [model, setModel] = useState('');
  const [attachments, setAttachments] = useState<{ name: string; mimeType: string; dataBase64: string }[]>([]);
  const [quotaBlock, setQuotaBlock] = useState<{ limit: number; plan: string } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamingRef = useRef(false); // blocks history reloads mid-stream

  const models = providers?.models ?? [];
  const activeConversation = useMemo(
    () => conversations?.find((c) => c.id === activeId) || null,
    [conversations, activeId]
  );

  /* Load default model from profile settings */
  useEffect(() => {
    if (!model) setModel('');
  }, []);

  /* Load history when switching conversation (never mid-stream — that would
     wipe the locally streaming messages when a new conversation id arrives). */
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    if (streamingRef.current) return;
    let cancelled = false;
    setHistoryLoading(true);
    api
      .get<{ messages: ChatMessage[] }>(`/chat/conversations/${activeId}/messages`)
      .then((res: { messages: ChatMessage[] }) => {
        if (!cancelled) setMessages(res.messages || []);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  /** Refetch server history for a conversation (used after stream completes). */
  const reloadHistory = useCallback(async (convId: string) => {
    try {
      const res = await api.get<{ messages: ChatMessage[] }>(`/chat/conversations/${convId}/messages`);
      setMessages(res.messages || []);
    } catch {
      /* keep local state */
    }
  }, []);

  /* Autoscroll to the latest message */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, streaming]);

  /* --------------------------- actions --------------------------- */

  const newChat = () => {
    setParams({});
    setMessages([]);
    setInput('');
  };

  const doRename = async () => {
    if (!renaming) return;
    try {
      await api.patch(`/chat/conversations/${renaming.id}`, { title: renaming.title.trim() || '—' });
      setRenaming(null);
      refreshConversations();
      toast('success', t.common.save);
    } catch (e) {
      toast('error', (e as Error).message);
    }
  };

  const doDelete = async (id: string) => {
    if (!window.confirm(t.chat.deleteConfirm)) return;
    try {
      await api.del(`/chat/conversations/${id}`);
      if (id === activeId) newChat();
      refreshConversations();
    } catch (e) {
      toast('error', (e as Error).message);
    }
  };

  const pickFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const picked: { name: string; mimeType: string; dataBase64: string }[] = [];
    for (const f of Array.from(files).slice(0, 3)) {
      if (!f.type.startsWith('image/')) continue;
      if (f.size > 5 * 1024 * 1024) {
        toast('warning', `${f.name}: >5MB`);
        continue;
      }
      picked.push(await fileToBase64(f));
    }
    setAttachments((prev) => [...prev, ...picked].slice(0, 3));
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setQuotaBlock(null);

    const userMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: text,
      attachments: attachments.map((a) => ({ name: a.name, mimeType: a.mimeType })),
    };
    const assistantMsg: ChatMessage = { id: `stream-${Date.now()}`, role: 'assistant', content: '', pending: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    const currentAttachments = attachments;
    setAttachments([]);
    setStreaming(true);
    streamingRef.current = true;

    const controller = new AbortController();
    abortRef.current = controller;

    await streamChat(
      {
        conversationId: activeId || undefined,
        message: text,
        model: model || undefined,
        attachments: currentAttachments.length ? currentAttachments : undefined,
      },
      {
        onMeta: (meta) => {
          if (!activeId && meta.conversationId) {
            setParams({ c: meta.conversationId }, { replace: true });
          }
        },
        onDelta: (chunk) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.pending) next[next.length - 1] = { ...last, content: last.content + chunk };
            return next;
          });
        },
        onDone: (info) => {
          setStreaming(false);
          streamingRef.current = false;
          abortRef.current = null;
          refreshConversations();
          refreshProfile(); // update quota display
          // Sync final saved state (handles stop-mid-stream partials)
          void reloadHistory(info.conversationId);
        },
        onError: (message) => {
          const isQuota = /quota/i.test(message) || /الحصة/.test(message);
          if (isQuota) setQuotaBlock({ limit: 0, plan: '' });
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.pending) {
              next[next.length - 1] = { ...last, pending: false, content: last.content, error: message };
            }
            return next;
          });
          setStreaming(false);
          streamingRef.current = false;
          abortRef.current = null;
          refreshProfile();
        },
      },
      controller.signal
    ).catch(() => {
      setStreaming(false);
    });
  };

  /* --------------------------- render --------------------------- */

  const ChatListItem = ({ c }: { c: Conversation }) => (
    <li className="group relative">
      {renaming?.id === c.id ? (
        <div className="flex items-center gap-1 px-2 py-1">
          <input
            autoFocus
            className="input-glass !min-h-0 !py-2 !text-xs"
            value={renaming.title}
            onChange={(e) => setRenaming({ ...renaming, title: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && doRename()}
          />
          <button onClick={doRename} className="btn-ghost !min-h-0 !p-1.5 text-portal-success" aria-label={t.common.save}><Check className="h-3.5 w-3.5" /></button>
        </div>
      ) : (
        <button
          onClick={() => setParams({ c: c.id })}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start text-sm transition-colors',
            c.id === activeId
              ? 'border border-portal-violet/30 bg-portal-violet/15 text-portal-text'
              : 'border border-transparent text-portal-muted hover:bg-white/[0.05] hover:text-portal-text'
          )}
        >
          <MessageSquare className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{c.title}</span>
        </button>
      )}

      {renaming?.id !== c.id && (
        <div className="absolute end-1.5 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-lg bg-portal-surface/95 p-0.5 shadow group-hover:flex">
          <button onClick={() => setRenaming({ id: c.id, title: c.title })} className="rounded-md p-1.5 text-portal-muted hover:bg-white/10 hover:text-portal-text" aria-label={t.chat.rename} title={t.chat.rename}>
            <Pencil className="h-3 w-3" />
          </button>
          <button onClick={() => doDelete(c.id)} className="rounded-md p-1.5 text-portal-muted hover:bg-red-500/20 hover:text-red-300" aria-label={t.chat.delete} title={t.chat.delete}>
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </li>
  );

  return (
    <DashboardLayout>
      <div className="mx-auto flex h-[calc(100vh-7.5rem)] max-w-7xl gap-4">
        {/* -------- Conversations sidebar -------- */}
        <aside
          className={cn(
            'glass flex w-64 shrink-0 flex-col rounded-2xl transition-all duration-300 max-lg:absolute max-lg:inset-y-20 max-lg:start-4 max-lg:z-30 max-lg:w-72',
            !showSidebar && 'max-lg:hidden'
          )}
        >
          <div className="border-b border-white/10 p-3">
            <button onClick={newChat} className="btn-primary w-full !py-2.5 !text-xs">
              <Plus className="h-4 w-4" /> {t.chat.newChat}
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {conversations && conversations.length > 0 ? (
              <ul className="space-y-1">
                {conversations.map((c) => <ChatListItem key={c.id} c={c} />)}
              </ul>
            ) : (
              <p className="p-4 text-center text-xs text-portal-muted">{t.chat.historyEmpty}</p>
            )}
          </div>
          <button onClick={() => setShowSidebar(false)} className="hidden border-t border-white/10 p-2 text-center text-xs text-portal-muted hover:text-portal-text max-lg:block">
            <PanelRightClose className="mx-auto h-4 w-4" />
          </button>
        </aside>

        {/* -------- Chat column -------- */}
        <section className="glass flex min-w-0 flex-1 flex-col rounded-2xl">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-white/10 p-3">
            <div className="flex min-w-0 items-center gap-2">
              {!showSidebar && (
                <button onClick={() => setShowSidebar(true)} className="btn-ghost !min-h-0 !p-2 max-lg:block hidden" aria-label={t.common.menu}>
                  <MessageSquare className="h-4 w-4" />
                </button>
              )}
              <h2 className="truncate text-sm font-semibold">{activeConversation?.title || t.chat.newChat}</h2>
            </div>

            {/* Model picker */}
            <div className="flex items-center gap-2">
              <label htmlFor="model" className="hidden text-xs text-portal-muted sm:block">{t.chat.model}</label>
              <select
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="input-glass !min-h-0 !w-auto !py-2 !text-xs"
              >
                <option value="">Auto</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {historyLoading ? (
              <div className="flex justify-center py-8"><Spinner className="h-6 w-6 text-portal-violet" /></div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-portal-violet to-portal-blue shadow-glow">
                  <MessageSquare className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-bold">{t.chat.emptyTitle}</h3>
                <p className="max-w-sm text-sm text-portal-muted">{t.chat.emptyDesc}</p>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {[t.chat.suggestions1, t.chat.suggestions2, t.chat.suggestions3].map((s) => (
                    <button key={s} onClick={() => setInput(s)} className="badge border-white/10 bg-white/[0.05] text-portal-muted hover:border-portal-violet/40 hover:text-portal-text">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => <MessageBubble key={m.id} m={m} t={t} userInitials={initials(user?.displayName, user?.email)} lang={lang} />)
            )}
          </div>

          {/* Quota banner */}
          {quotaBlock && (
            <div className="mx-4 mb-2 flex items-center justify-between gap-3 rounded-xl border border-portal-warning/30 bg-portal-warning/10 px-4 py-2.5">
              <p className="text-xs text-portal-warning">⚠ {t.chat.quotaTitle}</p>
              <Link to="/pricing" className="btn-primary !min-h-0 !px-3 !py-1.5 !text-xs">{t.chat.upgradeCta}</Link>
            </div>
          )}

          {/* Composer */}
          <div className="border-t border-white/10 p-3">
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map((a, i) => (
                  <span key={i} className="badge border-white/10 bg-white/[0.06] text-portal-muted">
                    {a.mimeType.startsWith('image/') ? '🖼' : '📄'} {a.name}
                    <button onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} aria-label="Remove"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2">
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => pickFiles(e.target.files)} />
              <button onClick={() => fileRef.current?.click()} className="btn-ghost !min-h-0 shrink-0 !p-3" title={t.chat.attach} aria-label={t.chat.attach}>
                <Paperclip className="h-5 w-5" />
              </button>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder={t.chat.placeholder}
                className="input-glass max-h-32 min-h-[46px] flex-1 resize-none"
                aria-label={t.chat.placeholder}
              />

              {streaming ? (
                <button onClick={stopGeneration} className="btn-danger shrink-0 !px-4" title={t.chat.stop}>
                  <Square className="h-4 w-4" />
                  <span className="hidden sm:inline">{t.chat.stop}</span>
                </button>
              ) : (
                <button onClick={send} disabled={!input.trim()} className="btn-primary shrink-0 !px-4" title={t.chat.send} aria-label={t.chat.send}>
                  <Send className="h-4 w-4 rtl:-scale-x-100" />
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

/* --------------------------- message bubble --------------------------- */

function MessageBubble({
  m,
  t,
  userInitials,
  lang,
}: {
  m: ChatMessage;
  t: ReturnType<typeof useLang>['t'];
  userInitials: string;
  lang: 'ar' | 'en';
}) {
  const [copied, setCopied] = useState(false);
  const isUser = m.role === 'user';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* noop */ }
  };

  return (
    <article className={cn('flex gap-3 animate-fade-in', isUser && 'flex-row-reverse')}>
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold',
          isUser
            ? 'bg-white/[0.08] text-portal-text'
            : 'bg-gradient-to-br from-portal-violet to-portal-blue text-white shadow-glow-sm'
        )}
      >
        {isUser ? userInitials : 'AI'}
      </span>

      <div className={cn('min-w-0 max-w-[85%]', isUser && 'text-end')}>
        <div className="mb-1 flex items-center gap-2 text-[11px] text-portal-muted" style={{ justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
          <span>{isUser ? t.chat.you : 'PORTAL AI'}</span>
          {m.model && <span className="hidden sm:inline">· {m.model}</span>}
          {m.createdAt && <span>· {formatDateTime(m.createdAt, lang)}</span>}
        </div>

        <div
          className={cn(
            'inline-block rounded-2xl px-4 py-3 text-start shadow-card',
            isUser
              ? 'border border-portal-violet/30 bg-gradient-to-br from-portal-violet/20 to-portal-blue/10'
              : 'glass'
          )}
        >
          {m.content ? (
            <MarkdownView content={m.content} />
          ) : m.pending ? (
            <span className="flex items-center gap-1.5 py-1" role="status">
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
              <span className="ms-2 text-xs text-portal-muted">{t.chat.thinking}</span>
            </span>
          ) : null}

          {m.error && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-red-300">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {m.error}
            </p>
          )}

          {m.attachments?.length ? (
            <p className="mt-2 text-xs text-portal-muted">📎 {m.attachments.length} {t.chat.attachmentsNote}</p>
          ) : null}
        </div>

        {!isUser && !m.pending && m.content && (
          <button
            onClick={copy}
            className="mt-1 flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-portal-muted hover:bg-white/[0.06] hover:text-portal-text"
            aria-label={t.chat.copy}
          >
            {copied ? <Check className="h-3 w-3 text-portal-success" /> : <Copy className="h-3 w-3" />}
            {copied ? t.chat.copied : t.chat.copy}
          </button>
        )}
      </div>
    </article>
  );
}
