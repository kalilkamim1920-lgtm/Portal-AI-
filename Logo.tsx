import { cn } from '../utils/helpers';

export function Logo({ size = 'md', compact = false }: { size?: 'md' | 'lg'; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', compact && 'gap-2')}>
      <span
        className={cn(
          'flex items-center justify-center rounded-xl bg-gradient-to-br from-portal-violet to-portal-blue shadow-glow-sm',
          size === 'lg' ? 'h-11 w-11' : 'h-8 w-8'
        )}
      >
        <svg viewBox="0 0 24 24" className={size === 'lg' ? 'h-6 w-6' : 'h-4.5 w-4.5 h-5 w-5'} fill="none" stroke="white" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {!compact && (
        <span
          className={cn(
            'font-display font-extrabold tracking-tight',
            size === 'lg' ? 'text-xl' : 'text-base'
          )}
        >
          <span className="gradient-text">PORTAL</span>{' '}
          <span className="text-portal-text">AI</span>
        </span>
      )}
    </span>
  );
}
