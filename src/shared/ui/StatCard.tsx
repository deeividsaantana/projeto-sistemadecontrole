import { useRef } from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { cn } from './styles';

type StatTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

/**
 * `info` marca o total da tela — "quantos documentos existem" —, e total não é
 * estado: vestir de azul um número que não avisa nada faz o olho procurar
 * significado onde não há. Ele é grafite, mais firme que o neutro; verde,
 * âmbar e vermelho ficam reservados para o que de fato pede reação.
 */

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
  info: 'text-slate-800',
};

const accentClass: Record<StatTone, string> = {
  neutral: 'bg-slate-300',
  success: 'bg-emerald-600',
  warning: 'bg-amber-500',
  danger: 'bg-rose-600',
  info: 'bg-slate-500',
};

const iconToneClass: Record<StatTone, string> = {
  neutral: 'bg-slate-100 text-slate-600',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-rose-50 text-rose-700',
  info: 'bg-slate-100 text-slate-700',
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
        'group relative flex flex-col gap-2.5 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors duration-200 hover:border-slate-300 sm:p-5',
        onClick && 'w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40',
        className,
      )}
    >
      {/* Filete de estado à esquerda, como nos indicadores da referência: diz a
          situação sem pintar o cartão inteiro. */}
      <span className={cn('absolute inset-y-4 left-0 w-[3px] rounded-r-full', accentClass[tone])} aria-hidden="true" />
      <div className="relative flex items-start justify-between gap-2">
        {/* No celular o rótulo ocupa a largura toda: nomes longos como
            "Disponibilidade" não cabem ao lado do ícone em telas estreitas. */}
        <p className="min-w-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">{label}</p>
        {Icon && (
          <span className={cn('hidden size-9 shrink-0 place-items-center rounded-lg sm:grid', iconToneClass[tone])}>
            <Icon size={17} strokeWidth={2.15} />
          </span>
        )}
      </div>
      <div className="relative flex flex-wrap items-center gap-x-2 gap-y-1">
        {Icon && (
          <span className={cn('grid size-7 shrink-0 place-items-center rounded-md sm:hidden', iconToneClass[tone])}>
            <Icon size={15} strokeWidth={2.15} />
          </span>
        )}
        <strong ref={valueRef} className={cn('text-[1.75rem] font-bold leading-none tracking-[-0.02em] tabular-nums sm:text-[2.15rem]', toneClass[tone])}>{isNumeric ? '0' : value}</strong>
        {trend && <span className="min-w-0 text-[11px] font-medium text-slate-500">{trend}</span>}
      </div>
      {onClick && (
        <span className="relative flex items-center gap-1 text-[11px] font-semibold text-slate-400 transition-colors group-hover:text-emerald-700">
          Ver detalhe <ChevronRight size={12} />
        </span>
      )}
    </Root>
  );
}
