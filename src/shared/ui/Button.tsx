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
  // A cor do texto usa valor literal em vez de `text-slate-800`: a camada de
  // compatibilidade do index.css converte `.text-slate-800` em tinta escura, exceto
  // para uma lista fixa de fundos — e isso deixava este botão com texto
  // invisível sobre fundo escuro.
  primary: 'border-[#087653] bg-[#087653] text-[#ffffff] hover:bg-[#066344] hover:border-[#066344]',
  secondary: 'border-[#bfcac4] bg-white text-[#20302a] hover:bg-[#f0f3ef] hover:border-[#87978f]',
  subtle: 'border-[#d7ded9] bg-[#eef1ed] text-[#30423b] hover:bg-[#e4e9e5] hover:border-[#b9c5bf]',
  ghost: 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger: 'border-rose-700 bg-rose-700 text-[#ffffff] hover:bg-rose-800 hover:border-rose-800',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'min-h-10 px-3 text-[11px]',
  md: 'min-h-11 px-4 text-xs',
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
        'renea-button inline-flex shrink-0 items-center justify-center gap-2 rounded-md border font-bold transition-[background-color,border-color,color,transform,box-shadow] duration-200 ease-out active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-600/20 disabled:cursor-not-allowed disabled:opacity-60',
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
