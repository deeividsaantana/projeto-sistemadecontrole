import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const Card = ({ children, className = '', ...rest }: CardProps) => (
  <div
    className={`rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] shadow-[var(--shadow-card)] ${className}`}
    {...rest}
  >
    {children}
  </div>
);

export const CardHeader = ({ title, description, action }: { title: string; description?: string; action?: ReactNode }) => (
  <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border-subtle)] px-5 py-4">
    <div>
      <h3 className="text-sm font-bold text-[var(--color-ink-primary)]">{title}</h3>
      {description && <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">{description}</p>}
    </div>
    {action}
  </div>
);

export const CardBody = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`px-5 py-4 ${className}`}>{children}</div>
);
