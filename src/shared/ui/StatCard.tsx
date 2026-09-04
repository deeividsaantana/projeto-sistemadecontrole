import type { LucideIcon } from 'lucide-react';
import { cn } from './styles';

type StatTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: string;
  tone?: StatTone;
  className?: string;
}

const toneClass: Record<StatTone, string> = {
  neutral: 'text-slate-900',
  success: 'text-emerald-700',
  warning: 'text-amber-700',
  danger: 'text-rose-700',
  info: 'text-sky-700',
};

const iconToneClass: Record<StatTone, string> = {
  neutral: 'bg-slate-100 text-slate-600',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-rose-50 text-rose-700',
  info: 'bg-sky-50 text-sky-700',
};

export function StatCard({ label, value, icon: Icon, trend, tone = 'neutral', className }: StatCardProps) {
  return (
    <div className={cn('rounded-lg border border-slate-200 bg-white p-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {Icon && (
          <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', iconToneClass[tone])}>
            <Icon size={16} strokeWidth={2} />
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <strong className={cn('text-2xl font-bold leading-none', toneClass[tone])}>{value}</strong>
        {trend && <span className="text-xs font-medium text-slate-400">{trend}</span>}
      </div>
    </div>
  );
}
