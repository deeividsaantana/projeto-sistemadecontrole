import { useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
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

const accentClass: Record<StatTone, string> = {
  neutral: 'bg-slate-400',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-sky-500',
};

const iconToneClass: Record<StatTone, string> = {
  neutral: 'bg-gradient-to-br from-slate-500 to-slate-700 shadow-slate-500/25',
  success: 'bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-emerald-500/30',
  warning: 'bg-gradient-to-br from-amber-500 to-amber-600 shadow-amber-500/30',
  danger: 'bg-gradient-to-br from-rose-500 to-rose-600 shadow-rose-500/30',
  info: 'bg-gradient-to-br from-sky-500 to-sky-600 shadow-sky-500/30',
};

const glowClass: Record<StatTone, string> = {
  neutral: 'bg-slate-400/10',
  success: 'bg-emerald-400/15',
  warning: 'bg-amber-400/15',
  danger: 'bg-rose-400/15',
  info: 'bg-sky-400/15',
};

export function StatCard({ label, value, icon: Icon, trend, tone = 'neutral', className }: StatCardProps) {
  const valueRef = useRef<HTMLElement>(null);
  const isNumeric = typeof value === 'number' && Number.isFinite(value);

  useGSAP(() => {
    if (!isNumeric || !valueRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      valueRef.current.textContent = value.toLocaleString('pt-BR');
      return;
    }
    const counter = { current: 0 };
    gsap.to(counter, {
      current: value,
      duration: 0.8,
      ease: 'power2.out',
      onUpdate: () => {
        if (valueRef.current) valueRef.current.textContent = Math.round(counter.current).toLocaleString('pt-BR');
      },
    });
  }, { dependencies: [value, isNumeric] });

  return (
    <div className={cn('group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_28px_-14px_rgba(15,23,42,0.22)]', className)}>
      <span className={cn('absolute -right-6 -top-6 size-24 rounded-full blur-2xl transition-transform duration-300 group-hover:scale-125', glowClass[tone])} aria-hidden="true" />
      <span className={cn('absolute inset-x-0 top-0 h-[3px]', accentClass[tone])} aria-hidden="true" />
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {Icon && (
          <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl text-white shadow-lg transition-transform duration-200 group-hover:scale-110 group-hover:rotate-3', iconToneClass[tone])}>
            <Icon size={18} strokeWidth={2.25} />
          </span>
        )}
      </div>
      <div className="relative mt-3 flex items-baseline gap-2">
        <strong ref={valueRef} className={cn('text-[2.1rem] font-black leading-none tracking-tight tabular-nums', toneClass[tone])}>{isNumeric ? '0' : value}</strong>
        {trend && <span className="text-xs font-medium text-slate-400">{trend}</span>}
      </div>
    </div>
  );
}
