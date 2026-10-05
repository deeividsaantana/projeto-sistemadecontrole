import { useRef } from 'react';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';
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
  /** Torna o cartão clicável, levando ao detalhe correspondente. */
  onClick?: () => void;
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
  neutral: 'border-slate-300 text-slate-600',
  success: 'border-emerald-300 text-emerald-700',
  warning: 'border-amber-300 text-amber-700',
  danger: 'border-rose-300 text-rose-700',
  info: 'border-sky-300 text-sky-700',
};

export function StatCard({ label, value, icon: Icon, trend, tone = 'neutral', onClick, className }: StatCardProps) {
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

  const Root = onClick ? 'button' : 'div';

  return (
    <Root
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'renea-stat group relative overflow-hidden rounded-[3px] border border-[#cfd8d3] bg-white p-4 text-left transition-colors duration-200 hover:border-[#85978e] hover:bg-[#fbfcfa] sm:p-5',
        onClick && 'w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40',
        className,
      )}
    >
      <div className="relative flex items-start justify-between gap-2">
        {/* No celular o rótulo ocupa a largura toda: nomes longos como
            "Disponibilidade" não cabem ao lado do ícone em telas estreitas. */}
        <p className="min-w-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">{label}</p>
        {Icon && (
          <span className={cn('hidden size-9 shrink-0 place-items-center rounded-full border bg-white sm:grid', iconToneClass[tone])}>
            <Icon size={18} strokeWidth={2.25} />
          </span>
        )}
      </div>
      <div className="relative mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        {Icon && (
          <span className={cn('grid size-8 shrink-0 place-items-center rounded-full border bg-white sm:hidden', iconToneClass[tone])}>
            <Icon size={16} strokeWidth={2.25} />
          </span>
        )}
        <strong ref={valueRef} className={cn('text-4xl font-black leading-none tracking-[-0.055em] tabular-nums sm:text-[2.75rem]', toneClass[tone])}>{isNumeric ? '0' : value}</strong>
        {trend && <span className="min-w-0 text-[11px] font-medium text-slate-400">{trend}</span>}
      </div>
      {onClick && (
        <span className="relative mt-2 flex items-center gap-1 text-[11px] font-semibold text-slate-400 transition-colors group-hover:text-emerald-700">
          Ver detalhe <ArrowUpRight size={12} />
        </span>
      )}
    </Root>
  );
}
