import type { ReactNode } from 'react';
import { cn } from './styles';

interface FilterBarProps {
  label?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Common, keyboard-friendly container for a screen's query controls. */
export function FilterBar({ label = 'Filtros', children, actions, className }: FilterBarProps) {
  return (
    <section aria-label={label} className={cn('renea-filter-bar', className)}>
      <div className="renea-filter-bar__fields">{children}</div>
      {actions && <div className="renea-filter-bar__actions">{actions}</div>}
    </section>
  );
}
