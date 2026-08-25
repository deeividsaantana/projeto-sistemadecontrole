import type { ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from './styles';

type IconButtonVariant = 'secondary' | 'subtle' | 'ghost' | 'primary';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string;
  icon: LucideIcon;
  variant?: IconButtonVariant;
  active?: boolean;
  badge?: number;
}

const variantClass: Record<IconButtonVariant, string> = {
  primary: 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700',
  secondary: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400',
  subtle: 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  ghost: 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
};

export function IconButton({
  label,
  icon: Icon,
  variant = 'secondary',
  active = false,
  badge,
  className,
  type = 'button',
  title,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={title || label}
      className={cn(
        'relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-600/20 disabled:cursor-not-allowed disabled:opacity-60',
        active ? 'border-emerald-600 bg-emerald-600 text-white' : variantClass[variant],
        className,
      )}
      {...props}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {typeof badge === 'number' && badge > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[8px] font-extrabold leading-none text-white shadow-sm">
          {badge}
        </span>
      )}
    </button>
  );
}
