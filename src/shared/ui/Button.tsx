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
  // Verde da marca, o mesmo do item ativo da navegação e das ações principais.
  // A cor do texto usa valor literal em vez de `text-white`: a camada de
  // compatibilidade do index.css converte `.text-white` em tinta escura, exceto
  // para uma lista fixa de fundos — e isso deixava este botão com texto
  // invisível sobre fundo escuro.
  primary: 'border-[#087653] bg-[#087653] text-[#ffffff] hover:bg-[#066344] hover:border-[#066344]',
  secondary: 'border-slate-300 bg-white text-slate-700 shadow-sm hover:-translate-y-0.5 hover:bg-slate-50 hover:border-slate-400',
  subtle: 'border-slate-200 bg-slate-50 text-slate-700 hover:-translate-y-0.5 hover:bg-slate-100 hover:border-slate-300',
  ghost: 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger: 'border-rose-700 bg-rose-700 text-white shadow-sm hover:-translate-y-0.5 hover:bg-rose-800 hover:border-rose-800',
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
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border font-semibold tracking-[-0.01em] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-600/20 disabled:cursor-not-allowed disabled:opacity-60',
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
