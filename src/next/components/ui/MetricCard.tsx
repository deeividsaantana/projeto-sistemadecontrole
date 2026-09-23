import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card } from './Card';

export interface MetricCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: { direction: 'up' | 'down'; label: string };
  tone?: 'brand' | 'neutral';
}

export const MetricCard = ({ label, value, icon: Icon, trend, tone = 'neutral' }: MetricCardProps) => (
  <Card className="p-4">
    <div className="flex items-start justify-between">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">{label}</span>
      <span
        className={`grid size-8 place-items-center rounded-[var(--radius-md)] ${
          tone === 'brand' ? 'bg-[var(--color-brand-50)] text-[var(--color-brand-600)]' : 'bg-[var(--color-surface-sunken)] text-[var(--color-ink-secondary)]'
        }`}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
    </div>
    <p className="mt-3 text-2xl font-black tracking-tight text-[var(--color-ink-primary)]">{value}</p>
    {trend && (
      <p
        className={`mt-1.5 flex items-center gap-1 text-xs font-semibold ${
          trend.direction === 'up' ? 'text-[var(--color-status-success-fg)]' : 'text-[var(--color-status-critical-fg)]'
        }`}
      >
        {trend.direction === 'up' ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
        {trend.label}
      </p>
    )}
  </Card>
);
