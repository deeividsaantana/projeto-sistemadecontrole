import { forwardRef, type InputHTMLAttributes } from 'react';

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ label, error, hint, id, className = '', ...rest }, ref) => {
    const inputId = id || rest.name;
    return (
      <label className="flex flex-col gap-1.5" htmlFor={inputId}>
        {label && <span className="text-xs font-semibold text-[var(--color-ink-secondary)]">{label}</span>}
        <input
          ref={ref}
          id={inputId}
          className={`h-10 rounded-[var(--radius-md)] border bg-[var(--color-surface-raised)] px-3 text-sm text-[var(--color-ink-primary)] outline-none transition placeholder:text-[var(--color-ink-muted)] focus:ring-2 ${
            error
              ? 'border-[var(--color-status-critical-fg)] focus:ring-[var(--color-status-critical-fg)]/20'
              : 'border-[var(--color-border-strong)] focus:border-[var(--color-brand-500)] focus:ring-[var(--color-brand-300)]/40'
          } ${className}`}
          aria-invalid={Boolean(error)}
          {...rest}
        />
        {error ? (
          <span className="text-xs font-medium text-[var(--color-status-critical-fg)]">{error}</span>
        ) : hint ? (
          <span className="text-xs text-[var(--color-ink-muted)]">{hint}</span>
        ) : null}
      </label>
    );
  },
);
TextInput.displayName = 'TextInput';
