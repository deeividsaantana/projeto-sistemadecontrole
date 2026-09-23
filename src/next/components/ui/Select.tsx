import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, id, className = '', children, ...rest }, ref) => {
    const selectId = id || rest.name;
    return (
      <label className="flex flex-col gap-1.5" htmlFor={selectId}>
        {label && <span className="text-xs font-semibold text-[var(--color-ink-secondary)]">{label}</span>}
        <span className="relative">
          <select
            ref={ref}
            id={selectId}
            className={`h-10 w-full appearance-none rounded-[var(--radius-md)] border bg-[var(--color-surface-raised)] px-3 pr-9 text-sm text-[var(--color-ink-primary)] outline-none transition focus:ring-2 ${
              error
                ? 'border-[var(--color-status-critical-fg)] focus:ring-[var(--color-status-critical-fg)]/20'
                : 'border-[var(--color-border-strong)] focus:border-[var(--color-brand-500)] focus:ring-[var(--color-brand-300)]/40'
            } ${className}`}
            aria-invalid={Boolean(error)}
            {...rest}
          >
            {children}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-ink-muted)]" aria-hidden="true" />
        </span>
        {error && <span className="text-xs font-medium text-[var(--color-status-critical-fg)]">{error}</span>}
      </label>
    );
  },
);
Select.displayName = 'Select';
