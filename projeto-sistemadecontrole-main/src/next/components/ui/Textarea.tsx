import { forwardRef, type TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, id, className = '', rows = 4, ...rest }, ref) => {
    const areaId = id || rest.name;
    return (
      <label className="flex flex-col gap-1.5" htmlFor={areaId}>
        {label && <span className="text-xs font-semibold text-[var(--color-ink-secondary)]">{label}</span>}
        <textarea
          ref={ref}
          id={areaId}
          rows={rows}
          className={`rounded-[var(--radius-md)] border bg-[var(--color-surface-raised)] px-3 py-2 text-sm text-[var(--color-ink-primary)] outline-none transition placeholder:text-[var(--color-ink-muted)] focus:ring-2 ${
            error
              ? 'border-[var(--color-status-critical-fg)] focus:ring-[var(--color-status-critical-fg)]/20'
              : 'border-[var(--color-border-strong)] focus:border-[var(--color-brand-500)] focus:ring-[var(--color-brand-300)]/40'
          } ${className}`}
          aria-invalid={Boolean(error)}
          {...rest}
        />
        {error && <span className="text-xs font-medium text-[var(--color-status-critical-fg)]">{error}</span>}
      </label>
    );
  },
);
Textarea.displayName = 'Textarea';
