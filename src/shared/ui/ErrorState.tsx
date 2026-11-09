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
    <div role="alert" className={cn('flex flex-col items-center justify-center px-4 text-center', compact ? 'py-6' : 'py-10', className)}>
      <span className={cn('mb-3 grid place-items-center rounded-full bg-rose-50 text-rose-700', compact ? 'size-10' : 'size-12')}>
        <OctagonAlert className={compact ? 'size-5' : 'size-6'} aria-hidden="true" />
      </span>
      <p className={cn('font-bold text-slate-800', compact ? 'text-sm' : 'text-base')}>{title}</p>
      {description && <p className="mt-1 max-w-md text-sm leading-relaxed text-slate-600">{description}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:border-emerald-500 hover:text-[#176b4d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--renea-focus) lg:min-h-10"
        >
          <RotateCcw className="size-4" aria-hidden="true" /> {retryLabel}
        </button>
      )}
    </div>
  );
}
