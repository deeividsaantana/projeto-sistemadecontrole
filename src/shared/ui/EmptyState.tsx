import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from './styles';

interface EmptyStateProps {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  compact?: boolean;
  /** Botão com o próximo passo (ex.: "Novo lançamento"). */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  compact = false,
  action,
  className,
}: EmptyStateProps) {
  // Mesmo desenho do LoadingState e do ErrorState: ícone num círculo, frase
  // curta do que aconteceu e, embaixo, o que fazer. Letra de 14 a 16 px para
  // ler de relance.
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center px-4 text-center',
        compact ? 'py-6' : 'py-10',
        className,
      )}
    >
      <span className={cn('mb-3 grid place-items-center rounded-full bg-[#f7f8f6] text-[#5b6870]', compact ? 'size-10' : 'size-12')}>
        <Icon className={compact ? 'size-5' : 'size-6'} aria-hidden="true" />
      </span>
      <p className={cn('font-bold text-slate-800', compact ? 'text-sm' : 'text-base')}>{title}</p>
      {description && <p className="mt-1 max-w-md text-sm leading-relaxed text-slate-600">{description}</p>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
