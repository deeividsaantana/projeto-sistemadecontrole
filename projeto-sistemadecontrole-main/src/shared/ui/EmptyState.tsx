import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from './styles';

interface EmptyStateProps {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center text-slate-500',
        compact ? 'py-6' : 'py-10',
        className,
      )}
    >
      <Icon className="mb-2 h-7 w-7 text-slate-400" aria-hidden="true" />
      <p className="text-xs font-bold text-slate-600">{title}</p>
      {description && <p className="mt-1 max-w-64 text-[11px] leading-relaxed text-slate-500">{description}</p>}
    </div>
  );
}
