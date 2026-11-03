/**
 * Image Generator — real server-side generation with size/style options,
 * gallery history, download and delete.
 */
import { useState } from 'react';
import { ImageIcon, Wand2, Download, Trash2, RefreshCw, ImagePlus } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useLang } from '../i18n/LanguageContext';
import { api } from '../services/api';
import { PageHeader, ErrorState } from '../components/States';
import { useToast } from '../components/Toast';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../context/AuthContext';
import { formatDateTime } from '../utils/helpers';
import type { ImageItem } from '../types';

interface ImageMeta { sizes: { id: string; label: string }[]; styles: { id: string; label: string }[] }

export default function ImageGenerator() {
  const { t, lang } = useLang();
  const { toast } = useToast();
  const { refreshProfile, providers } = useAuth();

  const { data: meta } = useAsync<ImageMeta>(async () => api.get<ImageMeta>('/images/meta'), []);
  const { data: images, loading, refresh, error } = useAsync<ImageItem[]>(
    async () => (await api.get<{ images: ImageItem[] }>('/images')).images ?? [],
    []
  );

  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState('1024x1024');
  const [style, setStyle] = useState('none');
  const [generating, setGenerating] = useState(false);
  const [current, setCurrent] = useState<ImageItem | null>(null);

  const generate = async () => {
    if (prompt.trim().length < 3) {
      toast('warning', t.tools.needInput);
      return;
    }
    setGenerating(true);
    try {
      const res = await api.post<{ image: ImageItem }>('/images/generate', { prompt: prompt.trim(), size, style });
      setCurrent(res.image);
      refresh();
      refreshProfile(); // quota refresh
      toast('success', t.images.result);
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const download = async (img: ImageItem) => {
    try {
      const res = await fetch(img.url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `portal-ai-${img.id}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast('error', 'Download failed');
    }
  };

  const remove = async (id: string) => {
    try {
      await api.del(`/images/${id}`);
      if (current?.id === id) setCurrent(null);
      refresh();
      toast('success', t.common.delete);
    } catch (e) {
      toast('error', (e as Error).message);
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl">
        <PageHeader title={t.images.title} subtitle={t.images.subtitle} />

        {error && !images && <ErrorState message={t.common.serverError} onRetry={refresh} />}

        <div className="grid gap-5 lg:grid-cols-5">
          {/* Controls */}
          <section className="glass-card p-6 lg:col-span-2">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Wand2 className="h-5 w-5 text-portal-violet-light" />
              {t.images.title}
            </h2>

            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="prompt" className="mb-1.5 block text-sm font-medium">{t.images.prompt}</label>
                <textarea
                  id="prompt"
                  rows={4}
                  className="input-glass resize-y"
                  placeholder={t.images.promptPlaceholder}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="size" className="mb-1.5 block text-sm font-medium">{t.images.size}</label>
                  <select id="size" className="input-glass" value={size} onChange={(e) => setSize(e.target.value)}>
                    {(meta?.sizes || [{ id: '1024x1024', label: 'Square' }]).map((s) => (
                      <option key={s.id} value={s.id}>{s.id} — {s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="style" className="mb-1.5 block text-sm font-medium">{t.images.style}</label>
                  <select id="style" className="input-glass" value={style} onChange={(e) => setStyle(e.target.value)}>
                    {(meta?.styles || [{ id: 'none', label: 'None' }]).map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button onClick={generate} disabled={generating} className="btn-primary w-full">
                {generating ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    {t.images.generating}
                  </>
                ) : (
                  <><Wand2 className="h-4 w-4" /> {t.images.generate}</>
                )}
              </button>

              {!providers?.image && (
                <p className="text-xs leading-6 text-portal-warning">{t.images.missingProvider}</p>
              )}
            </div>

            {/* Current result */}
            {current && (
              <div className="mt-6 border-t border-white/10 pt-5">
                <h3 className="mb-3 text-sm font-semibold">{t.images.result}</h3>
                <figure className="overflow-hidden rounded-xl border border-white/10">
                  <img src={current.url} alt={current.prompt} className="w-full" loading="lazy" />
                </figure>
                <p className="mt-2 truncate text-xs text-portal-muted">{current.prompt}</p>
                <button onClick={() => download(current)} className="btn-secondary mt-3 w-full !py-2.5 !text-xs">
                  <Download className="h-4 w-4" /> {t.images.download}
                </button>
              </div>
            )}
          </section>

          {/* Gallery */}
          <section className="glass-card p-6 lg:col-span-3">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <ImageIcon className="h-5 w-5 text-portal-cyan" />
                {t.images.history}
              </h2>
              <button onClick={refresh} className="btn-ghost !min-h-0 !p-2" aria-label={t.common.retry}>
                <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              </button>
            </div>

            {loading && !images ? (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((i) => <div key={i} className="skeleton aspect-square w-full" />)}
              </div>
            ) : images && images.length > 0 ? (
              <div className="mt-4 grid max-h-[70vh] grid-cols-2 gap-3 overflow-y-auto pe-1 sm:grid-cols-3">
                {images.map((img) => (
                  <figure key={img.id} className="group relative overflow-hidden rounded-xl border border-white/10">
                    <img
                      src={img.url}
                      alt={img.prompt}
                      className="aspect-square w-full cursor-pointer object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                      onClick={() => setCurrent(img)}
                    />
                    <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/85 to-transparent p-2 pt-6">
                      <span className="truncate text-[10px] text-white/80">{img.prompt}</span>
                      <span className="flex shrink-0 gap-1">
                        <button onClick={() => download(img)} className="rounded-md bg-black/50 p-1 text-white/80 hover:text-white" aria-label={t.images.download} title={t.images.download}>
                          <Download className="h-3 w-3" />
                        </button>
                        <button onClick={() => remove(img.id)} className="rounded-md bg-black/50 p-1 text-white/80 hover:text-red-300" aria-label={t.images.delete} title={t.images.delete}>
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <div className="mt-8 flex flex-col items-center gap-2 text-center text-sm text-portal-muted">
                <ImagePlus className="h-8 w-8 text-portal-muted/40" />
                {t.images.empty}
              </div>
            )}

            <p className="mt-4 text-center text-[11px] text-portal-muted">
              {formatDateTime(images?.[0]?.createdAt, lang)} · {lang === 'ar' ? 'سجل محفوظ على الخادم' : 'Server-side history'}
            </p>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
