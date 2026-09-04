import { ChevronRight } from 'lucide-react';
import { cn } from './styles';

export interface BreadcrumbItem {
  label: string;
  /** Sem onClick o item vira apenas texto (posição atual). */
  onClick?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

/** Trilha de navegação: mostra onde o usuário está dentro do sistema. */
export function Breadcrumb({ items, className }: BreadcrumbProps) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Trilha de navegação" className={cn('flex min-w-0 items-center gap-1 text-xs', className)}>
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
            {index > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-slate-300" aria-hidden="true" />}
            {item.onClick && !last ? (
              <button
                type="button"
                onClick={item.onClick}
                className="truncate rounded font-medium text-slate-500 transition-colors hover:text-emerald-700"
              >
                {item.label}
              </button>
            ) : (
              <span
                aria-current={last ? 'page' : undefined}
                className={cn('truncate', last ? 'font-bold text-slate-800' : 'font-medium text-slate-500')}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
