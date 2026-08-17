import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from './styles';

type ButtonVariant = 'primary' | 'secondary' | 'subtle' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  trailingIcon?: LucideIcon;
  children: ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: 'border-emerald-600 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 hover:border-emerald-700',
  secondary: 'border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-400',
  subtle: 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-300',
  ghost: 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger: 'border-rose-600 bg-rose-600 text-white shadow-sm hover:bg-rose-700 hover:border-rose-700',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-[11px]',
  md: 'h-10 px-3 text-xs',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  trailingIcon: TrailingIcon,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-md border font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        sizeClass[size],
        variantClass[variant],
        className,
      )}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
      <span className="min-w-0 truncate">{children}</span>
      {TrailingIcon && <TrailingIcon className="h-4 w-4 shrink-0" aria-hidden="true" />}
    </button>
  );
}
