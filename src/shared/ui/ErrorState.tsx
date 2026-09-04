import type { ReactNode } from 'react';
import { OctagonAlert, RotateCcw } from 'lucide-react';
import { cn } from './styles';

interface ErrorStateProps {
  title?: ReactNode;
  description?: ReactNode;
  retryLabel?: string;
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
}

/** Falha de carregamento com caminho de recuperação. */
export function ErrorState({
  title = 'Não foi possível carregar',
  description = 'Verifique a conexão e tente novamente.',
  retryLabel = 'Tentar novamente',
  onRetry,
  compact = false,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'py-6' : 'py-10', className)}>
      <OctagonAlert className="mb-2 h-7 w-7 text-rose-500" aria-hidden="true" />
      <p className="text-xs font-bold text-slate-700">{title}</p>
      {description && <p className="mt-1 max-w-72 text-[11px] leading-relaxed text-slate-500">{description}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition-colors hover:border-emerald-500 hover:text-emerald-700"
        >
          <RotateCcw className="h-3.5 w-3.5" /> {retryLabel}
        </button>
      )}
    </div>
  );
}
