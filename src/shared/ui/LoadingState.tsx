import { LoaderCircle } from 'lucide-react';
import { cn } from './styles';

interface SpinnerProps {
  className?: string;
  label?: string;
}

/** Indicador de carregamento em linha, para botões e blocos pequenos. */
export function Spinner({ className, label = 'Carregando' }: SpinnerProps) {
  return <LoaderCircle role="status" aria-label={label} className={cn('h-4 w-4 animate-spin text-emerald-600', className)} />;
}

interface LoadingStateProps {
  message?: string;
  compact?: boolean;
  className?: string;
}

/** Estado de carregamento de uma seção inteira. */
export function LoadingState({ message = 'Carregando…', compact = false, className }: LoadingStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-4 text-center', compact ? 'py-6' : 'py-10', className)}>
      <Spinner className="size-6 text-[#176b4d]" />
      <p className="text-sm font-semibold text-slate-600">{message}</p>
    </div>
  );
}

interface SkeletonProps {
  className?: string;
}

/** Bloco cinza pulsante que reserva o espaço do conteúdo enquanto ele chega. */
export function Skeleton({ className }: SkeletonProps) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded bg-slate-200/80', className)} />;
}
