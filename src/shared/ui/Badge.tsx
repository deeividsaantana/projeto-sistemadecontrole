import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './styles';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  children: ReactNode;
}

const toneClass: Record<BadgeTone, string> = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-600',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
  info: 'border-sky-200 bg-sky-50 text-sky-700',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-6 max-w-full items-center rounded-md border px-2 text-[10px] font-bold uppercase leading-none',
        toneClass[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
