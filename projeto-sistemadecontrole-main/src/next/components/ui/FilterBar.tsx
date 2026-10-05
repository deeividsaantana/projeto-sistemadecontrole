import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';

export const FilterBar = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Buscar…',
  children,
  onClear,
}: {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
  onClear?: () => void;
}) => (
  <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-2.5">
    {onSearchChange && (
      <span className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-ink-muted)]" aria-hidden="true" />
        <input
          value={searchValue}
          onChange={event => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 w-full rounded-[var(--radius-md)] border border-transparent bg-[var(--color-surface-sunken)] pl-9 pr-3 text-sm outline-none transition focus:border-[var(--color-brand-500)] focus:bg-[var(--color-surface-raised)]"
        />
      </span>
    )}
    {children}
    {onClear && (
      <button
        type="button"
        onClick={onClear}
        className="inline-flex h-9 items-center gap-1 rounded-[var(--radius-md)] px-2.5 text-xs font-semibold text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-sunken)]"
      >
        <X className="size-3.5" aria-hidden="true" />
        Limpar
      </button>
    )}
  </div>
);
