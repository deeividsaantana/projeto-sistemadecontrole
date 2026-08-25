import type { InputHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from './styles';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: LucideIcon;
}

export function TextInput({
  icon: Icon,
  className,
  type = 'text',
  ...props
}: TextInputProps) {
  return (
    <div className="relative">
      {Icon && (
        <Icon
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          aria-hidden="true"
        />
      )}
      <input
        type={type}
        className={cn(
          'h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-medium text-slate-800 shadow-sm outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500',
          Icon && 'pl-9',
          className,
        )}
        {...props}
      />
    </div>
  );
}
