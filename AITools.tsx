/**
 * AI Tools — 8 fully working tools, each with a dedicated form interface.
 * Runs are saved server-side and quota is enforced on the server.
 */
import { useState } from 'react';
import {
  PenLine, Languages, FileText, Code2, Mail, BookOpen, Wand2, HelpCircle,
  Play, Copy, Check, RotateCcw, Zap, Clock, History,
} from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useLang } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { MarkdownView } from '../components/MarkdownView';
import { PageHeader } from '../components/States';
import { useToast } from '../components/Toast';
import { useAsync } from '../hooks/useAsync';
import { cn, formatDateTime } from '../utils/helpers';
import type { ChatMessage } from '../types';

const TOOL_META = [
  { id: 'writer', icon: PenLine, color: 'text-portal-violet-light' },
  { id: 'translator', icon: Languages, color: 'text-portal-cyan' },
  { id: 'summarizer', icon: FileText, color: 'text-portal-blue' },
  { id: 'coding', icon: Code2, color: 'text-portal-success' },
  { id: 'email', icon: Mail, color: 'text-portal-warning' },
  { id: 'story', icon: BookOpen, color: 'text-pink-300' },
  { id: 'improver', icon: Wand2, color: 'text-portal-violet-light' },
  { id: 'qa', icon: HelpCircle, color: 'text-portal-cyan' },
] as const;

type ToolId = (typeof TOOL_META)[number]['id'];

/* --------------------------- field definitions --------------------------- */

interface Field {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  options?: { value: string; label: Record<'ar' | 'en', string> }[];
  placeholder?: string;
  rows?: number;
  optional?: boolean;
}

const F = {
  type: (name: string, label: string): Field => ({
    name, label, type: 'select',
    options: [
      { value: 'article', label: { ar: 'مقال', en: 'Article' } },
      { value: 'blog', label: { ar: 'تدوينة', en: 'Blog post' } },
      { value: 'social', label: { ar: 'منشور اجتماعي', en: 'Social post' } },
      { value: 'ads', label: { ar: 'إعلان', en: 'Ad copy' } },
      { value: 'product', label: { ar: 'وصف منتج', en: 'Product description' } },
    ],
  }),
  tone: (name: string, label: string): Field => ({
    name, label, type: 'select',
    options: [
      { value: 'professional', label: { ar: 'احترافية', en: 'Professional' } },
      { value: 'friendly', label: { ar: 'ودّية', en: 'Friendly' } },
      { value: 'persuasive', label: { ar: 'إقناعية', en: 'Persuasive' } },
      { value: 'casual', label: { ar: 'عفوية', en: 'Casual' } },
      { value: 'academic', label: { ar: 'أكاديمية', en: 'Academic' } },
      { value: 'formal', label: { ar: 'رسمية', en: 'Formal' } },
      { value: 'neutral', label: { ar: 'محايدة', en: 'Neutral' } },
      { value: 'apologetic', label: { ar: 'اعتذارية', en: 'Apologetic' } },
    ],
  }),
  length: (name: string, label: string): Field => ({
    name, label, type: 'select',
    options: [
      { value: 'short', label: { ar: 'قصير', en: 'Short' } },
      { value: 'medium', label: { ar: 'متوسط', en: 'Medium' } },
      { value: 'long', label: { ar: 'طويل', en: 'Long' } },
      { value: 'flash', label: { ar: 'خاطف', en: 'Flash' } },
    ],
  }),
  langOpt: (name: string, label: string): Field => ({
    name, label, type: 'select',
    options: [
      { value: 'auto', label: { ar: 'تلقائي', en: 'Auto' } },
      { value: 'ar', label: { ar: 'العربية', en: 'Arabic' } },
      { value: 'en', label: { ar: 'الإنجليزية', en: 'English' } },
    ],
  }),
  languages: (name: string, label: string, withAuto = true): Field => ({
    name, label, type: 'select',
    options: [
      ...(withAuto ? [{ value: 'auto', label: { ar: 'كشف تلقائي', en: 'Detect' } }] : []),
      { value: 'ar', label: { ar: 'العربية', en: 'Arabic' } },
      { value: 'en', label: { ar: 'الإنجليزية', en: 'English' } },
      { value: 'fr', label: { ar: 'الفرنسية', en: 'French' } },
      { value: 'es', label: { ar: 'الإسبانية', en: 'Spanish' } },
      { value: 'de', label: { ar: 'الألمانية', en: 'German' } },
      { value: 'tr', label: { ar: 'التركية', en: 'Turkish' } },
    ],
  }),
  ratio: (name: string, label: string): Field => ({
    name, label, type: 'select',
    options: [
      { value: 'brief', label: { ar: 'موجز', en: 'Brief' } },
      { value: 'balanced', label: { ar: 'متوازن', en: 'Balanced' } },
      { value: 'detailed', label: { ar: 'مفصّل', en: 'Detailed' } },
    ],
  }),
  format: (name: string, label: string): Field => ({
    name, label, type: 'select',
    options: [
      { value: 'bullets', label: { ar: 'نقاط', en: 'Bullets' } },
      { value: 'paragraph', label: { ar: 'فقرة', en: 'Paragraph' } },
      { value: 'tldr', label: { ar: 'TL;DR', en: 'TL;DR' } },
    ],
  }),
  mode: (name: string, label: string): Field => ({
    name, label, type: 'select',
    options: [
      { value: 'write', label: { ar: 'كتابة كود', en: 'Write code' } },
      { value: 'explain', label: { ar: 'شرح كود', en: 'Explain' } },
      { value: 'review', label: { ar: 'مراجعة كود', en: 'Review' } },
      { value: 'fix', label: { ar: 'إصلاح كود', en: 'Fix' } },
    ],
  }),
  recipient: (name: string, label: string): Field => ({
    name, label, type: 'select',
    options: [
      { value: 'boss', label: { ar: 'المدير', en: 'Boss' } },
      { value: 'client', label: { ar: 'عميل', en: 'Client' } },
      { value: 'colleague', label: { ar: 'زميل', en: 'Colleague' } },
      { value: 'support', label: { ar: 'الدعم', en: 'Support' } },
      { value: 'other', label: { ar: 'آخر', en: 'Other' } },
    ],
  }),
  genre: (name: string, label: string): Field => ({
    name, label, type: 'select',
    options: [
      { value: 'sci-fi', label: { ar: 'خيال علمي', en: 'Sci-fi' } },
      { value: 'fantasy', label: { ar: 'فانتازيا', en: 'Fantasy' } },
      { value: 'mystery', label: { ar: 'غموض', en: 'Mystery' } },
      { value: 'romance', label: { ar: 'رومانسي', en: 'Romance' } },
      { value: 'horror', label: { ar: 'رعب', en: 'Horror' } },
      { value: 'adventure', label: { ar: 'مغامرة', en: 'Adventure' } },
      { value: 'comedy', label: { ar: 'كوميدي', en: 'Comedy' } },
    ],
  }),
  goal: (name: string, label: string): Field => ({
    name, label, type: 'select',
    options: [
      { value: 'clarity', label: { ar: 'وضوح', en: 'Clarity' } },
      { value: 'grammar', label: { ar: 'قواعد', en: 'Grammar' } },
      { value: 'professional', label: { ar: 'احترافية', en: 'Professional' } },
      { value: 'creative', label: { ar: 'إبداع', en: 'Creative' } },
      { value: 'concise', label: { ar: 'اختصار', en: 'Concise' } },
    ],
  }),
  style: (name: string, label: string): Field => ({
    name, label, type: 'select',
    options: [
      { value: 'concise', label: { ar: 'مختصر', en: 'Concise' } },
      { value: 'detailed', label: { ar: 'مفصل', en: 'Detailed' } },
      { value: 'eli5', label: { ar: 'مبسط جدًا', en: 'ELI5' } },
      { value: 'faithful', label: { ar: 'أمين', en: 'Faithful' } },
      { value: 'natural', label: { ar: 'طبيعي', en: 'Natural' } },
      { value: 'informal', label: { ar: 'غير رسمي', en: 'Informal' } },
    ],
  }),
};

const TOOL_FIELDS: Record<ToolId, Field[]> = {
  writer: [
    { name: 'topic', label: 'topic', type: 'textarea', rows: 3 },
    F.type('type', 'type'), F.tone('tone', 'tone'), F.length('length', 'length'), F.langOpt('language', 'language'),
  ],
  translator: [
    { name: 'text', label: 'text', type: 'textarea', rows: 5 },
    F.languages('from', 'from'), F.languages('to', 'to', false),
    { ...F.style('style', 'style') },
  ],
  summarizer: [
    { name: 'text', label: 'text', type: 'textarea', rows: 7 },
    F.ratio('ratio', 'ratio'), F.format('format', 'format'), F.langOpt('language', 'language'),
  ],
  coding: [
    { name: 'task', label: 'task', type: 'textarea', rows: 3 },
    { name: 'language', label: 'language', type: 'text', placeholder: 'typescript' },
    F.mode('mode', 'mode'),
    { name: 'code', label: 'code', type: 'textarea', rows: 5, optional: true },
  ],
  email: [
    { name: 'intent', label: 'intent', type: 'textarea', rows: 3 },
    F.recipient('recipient', 'recipient'),
    F.tone('tone', 'tone'),
    F.langOpt('language', 'language'),
  ],
  story: [
    { name: 'idea', label: 'idea', type: 'textarea', rows: 3 },
    F.genre('genre', 'genre'), F.length('length', 'length'), F.langOpt('language', 'language'),
  ],
  improver: [
    { name: 'text', label: 'text', type: 'textarea', rows: 5 },
    F.goal('goal', 'goal'), F.langOpt('language', 'language'),
  ],
  qa: [
    { name: 'question', label: 'question', type: 'textarea', rows: 2 },
    { name: 'context', label: 'context', type: 'textarea', rows: 5, optional: true },
    F.style('style', 'style'),
  ],
};

const DEFAULTS: Record<ToolId, Record<string, string>> = {
  writer: { type: 'article', tone: 'professional', length: 'medium', language: 'auto' },
  translator: { from: 'auto', to: 'en', style: 'natural' },
  summarizer: { ratio: 'balanced', format: 'bullets', language: 'auto' },
  coding: { language: 'typescript', mode: 'write' },
  email: { recipient: 'client', tone: 'formal', language: 'auto' },
  story: { genre: 'fantasy', length: 'flash', language: 'auto' },
  improver: { goal: 'clarity', language: 'auto' },
  qa: { style: 'concise' },
};

/* ------------------------------ component ------------------------------ */

export default function AITools() {
  const { t, lang } = useLang();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTool, setActiveTool] = useState<ToolId>('writer');
  const [values, setValues] = useState<Record<ToolId, Record<string, string>>>(DEFAULTS);
  const [result, setResult] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: history, refresh: refreshHistory } = useAsync<ChatMessage[]>(
    async () => {
      if (!user?.uid) return [];
      const res = await api
        .get<{ messages: ChatMessage[] }>(`/chat/conversations/tool-${activeTool}-${user.uid}/messages`)
        .catch(() => ({ messages: [] as ChatMessage[] }));
      return (res.messages ?? []).reverse().slice(-6);
    },
    [activeTool, user?.uid]
  );

  const setField = (name: string, v: string) =>
    setValues((prev) => ({ ...prev, [activeTool]: { ...prev[activeTool], [name]: v } }));

  const runTool = async () => {
    const payload = { ...values[activeTool] };
    // Basic client validation; the server validates authoritatively
    const textFields = TOOL_FIELDS[activeTool].filter((f) => f.type !== 'select' && !f.optional);
    if (textFields.some((f) => !(payload[f.name] || '').trim())) {
      toast('warning', t.tools.needInput);
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const res = await api.post<{ result: string; model: string }>(`/tools/${activeTool}`, payload);
      setResult(res.result);
      refreshHistory();
      toast('success', t.tools.result);
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const copyResult = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const meta = TOOL_META.find((m) => m.id === activeTool)!;
  const fields = TOOL_FIELDS[activeTool];
  const labels = t.tools[activeTool as keyof typeof t.tools] as Record<string, string>;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl">
        <PageHeader title={t.tools.title} subtitle={t.tools.subtitle} />

        {/* Tool selector */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TOOL_META.map(({ id, icon: Icon, color }) => (
            <button
              key={id}
              onClick={() => { setActiveTool(id); setResult(null); }}
              className={cn(
                'glass-card glass-card-hover flex items-center gap-2.5 p-3.5 text-start text-sm font-semibold',
                activeTool === id && 'border-portal-violet/50 bg-gradient-to-br from-portal-violet/20 to-portal-blue/10 shadow-glow-sm'
              )}
            >
              <Icon className={cn('h-5 w-5 shrink-0', color)} />
              <span className="truncate">{(t.tools[id as keyof typeof t.tools] as { title: string }).title}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-5">
          {/* Form */}
          <section className="glass-card p-6 lg:col-span-2">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <meta.icon className={cn('h-5 w-5', meta.color)} />
              {labels?.title || meta.id}
            </h2>

            <div className="mt-5 space-y-4">
              {fields.map((f) => (
                <div key={f.name}>
                  <label htmlFor={`f-${f.name}`} className="mb-1.5 block text-sm font-medium">
                    {labels?.[f.label] || f.label}
                    {f.optional && <span className="text-portal-muted/60"> (اختياري)</span>}
                  </label>
                  {f.type === 'textarea' ? (
                    <textarea
                      id={`f-${f.name}`}
                      rows={f.rows || 3}
                      className="input-glass resize-y"
                      placeholder={f.placeholder}
                      value={values[activeTool][f.name] || ''}
                      onChange={(e) => setField(f.name, e.target.value)}
                      dir={f.name === 'code' ? 'ltr' : undefined}
                    />
                  ) : f.type === 'text' ? (
                    <input
                      id={`f-${f.name}`}
                      type="text"
                      className="input-glass"
                      placeholder={f.placeholder}
                      value={values[activeTool][f.name] || ''}
                      onChange={(e) => setField(f.name, e.target.value)}
                      dir={f.name === 'language' ? 'ltr' : undefined}
                    />
                  ) : (
                    <select
                      id={`f-${f.name}`}
                      className="input-glass"
                      value={values[activeTool][f.name] || f.options?.[0]?.value || ''}
                      onChange={(e) => setField(f.name, e.target.value)}
                    >
                      {(f.options || []).map((o) => (
                        <option key={o.value} value={o.value}>{o.label[lang]}</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}

              <div className="flex gap-2 pt-1">
                <button onClick={runTool} disabled={running} className="btn-primary flex-1">
                  {running ? <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />{t.tools.running}</span> : <><Play className="h-4 w-4" />{t.tools.run}</>}
                </button>
                <button
                  onClick={() => { setValues((p) => ({ ...p, [activeTool]: DEFAULTS[activeTool] })); setResult(null); }}
                  className="btn-secondary"
                  title={t.tools.clear}
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>

          {/* Result */}
          <section className="glass-card min-h-[300px] p-6 lg:col-span-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">{t.tools.result}</h2>
              {result && (
                <button onClick={copyResult} className="btn-ghost !min-h-0 !px-3 !py-1.5 !text-xs">
                  {copied ? <Check className="h-3.5 w-3.5 text-portal-success" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? t.chat.copied : t.tools.copyResult}
                </button>
              )}
            </div>

            <div className="mt-4">
              {running ? (
                <div className="space-y-3">
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-4 w-full" />
                  <div className="skeleton h-4 w-5/6" />
                  <div className="skeleton h-4 w-2/3" />
                </div>
              ) : result ? (
                <div className="max-h-[60vh] overflow-y-auto pe-1"><MarkdownView content={result} /></div>
              ) : (
                <div className="flex h-44 flex-col items-center justify-center gap-2 text-center text-sm text-portal-muted">
                  <Zap className="h-8 w-8 text-portal-muted/40" />
                  {t.tools.subtitle}
                </div>
              )}
            </div>

            {/* Recent runs */}
            {history && history.length > 0 && (
              <div className="mt-6 border-t border-white/10 pt-4">
                <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-portal-muted">
                  <History className="h-3.5 w-3.5" /> {t.tools.history}
                </h3>
                <ul className="space-y-1.5">
                  {history.map((h) => (
                    <li key={h.id}>
                      <button
                        onClick={() => setResult(h.content)}
                        className="flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-start transition-colors hover:border-white/10 hover:bg-white/[0.05]"
                      >
                        <Clock className="h-3.5 w-3.5 shrink-0 text-portal-muted" />
                        <span className="min-w-0 flex-1 truncate text-xs text-portal-muted">{h.content.slice(0, 90)}</span>
                        <span className="shrink-0 text-[10px] text-portal-muted/70">{formatDateTime(h.createdAt, lang)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
