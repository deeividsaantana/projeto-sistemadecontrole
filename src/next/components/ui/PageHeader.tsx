import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

export interface Breadcrumb {
  label: string;
  href?: string;
}

export const BreadcrumbTrail = ({ items }: { items: Breadcrumb[] }) => (
  <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs font-medium text-[var(--color-ink-muted)]">
    {items.map((item, index) => (
      <span key={item.label} className="flex items-center gap-1">
        {index > 0 && <ChevronRight className="size-3" aria-hidden="true" />}
        <span className={index === items.length - 1 ? 'text-[var(--color-ink-primary)]' : ''}>{item.label}</span>
      </span>
    ))}
  </nav>
);

export const PageHeader = ({
  title,
  description,
  breadcrumbs,
  actions,
}: {
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: ReactNode;
}) => (
  <header className="flex flex-col gap-3 border-b border-[var(--color-border-subtle)] pb-5 sm:flex-row sm:items-end sm:justify-between">
    <div className="flex flex-col gap-1.5">
      {breadcrumbs && <BreadcrumbTrail items={breadcrumbs} />}
      <h1 className="text-2xl font-black tracking-tight text-[var(--color-ink-primary)]">{title}</h1>
      {description && <p className="text-sm text-[var(--color-ink-secondary)]">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
  </header>
);
