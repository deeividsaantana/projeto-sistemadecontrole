import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';

export const EmptyState = ({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) => (
  <div className="flex flex-col items-center gap-3 py-14 text-center">
    <span className="grid size-12 place-items-center rounded-full bg-[var(--color-surface-sunken)] text-[var(--color-ink-muted)]">
      <Icon className="size-5" aria-hidden="true" />
    </span>
    <div>
      <p className="text-sm font-bold text-[var(--color-ink-primary)]">{title}</p>
      {description && <p className="mt-1 max-w-xs text-xs text-[var(--color-ink-muted)]">{description}</p>}
    </div>
    {action}
  </div>
);

export const LoadingState = ({ label = 'Carregando…' }: { label?: string }) => (
  <div className="flex flex-col items-center gap-3 py-14 text-center" role="status" aria-live="polite">
    <Loader2 className="size-6 animate-spin text-[var(--color-brand-500)]" aria-hidden="true" />
    <p className="text-xs font-semibold text-[var(--color-ink-muted)]">{label}</p>
  </div>
);

export const ErrorState = ({
  title = 'Não foi possível carregar',
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) => (
  <div className="flex flex-col items-center gap-3 py-14 text-center">
    <span className="grid size-12 place-items-center rounded-full bg-[var(--color-status-critical-bg)] text-[var(--color-status-critical-fg)]">
      <AlertTriangle className="size-5" aria-hidden="true" />
    </span>
    <div>
      <p className="text-sm font-bold text-[var(--color-ink-primary)]">{title}</p>
      {description && <p className="mt-1 max-w-xs text-xs text-[var(--color-ink-muted)]">{description}</p>}
    </div>
    {onRetry && (
      <Button size="sm" variant="secondary" onClick={onRetry}>
        Tentar novamente
      </Button>
    )}
  </div>
);
