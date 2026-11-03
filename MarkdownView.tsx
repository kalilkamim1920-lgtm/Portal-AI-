/**
 * Markdown renderer for chat + tool outputs with copy-able code blocks.
 */
import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';
import { cn } from '../utils/helpers';

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="group relative my-3" dir="ltr">
      <div className="flex items-center justify-between rounded-t-xl border border-white/10 border-b-0 bg-white/[0.06] px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-portal-muted">{lang || 'code'}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-portal-muted transition-colors hover:bg-white/10 hover:text-portal-text"
          aria-label="Copy code"
        >
          {copied ? <Check className="h-3 w-3 text-portal-success" /> : <Copy className="h-3 w-3" />}
          {copied ? '✓' : 'Copy'}
        </button>
      </div>
      <pre className="!mt-0 !rounded-t-none">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export const MarkdownView = memo(function MarkdownView({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn('md-content', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => {
            // Extract code text + language from the pre>code element
            const child = Array.isArray(children) ? children[0] : children;
            const className = (child as { props?: { className?: string } })?.props?.className || '';
            const lang = /language-(\w+)/.exec(className)?.[1];
            const code = extractText(child);
            return <CodeBlock code={code} lang={lang} />;
          },
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

function extractText(node: unknown): string {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (typeof node === 'object' && 'props' in (node as Record<string, unknown>)) {
    const props = (node as { props: { children?: unknown } }).props;
    return extractText(props?.children);
  }
  return '';
}
