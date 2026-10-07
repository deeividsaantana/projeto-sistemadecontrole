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
          'h-11 w-full rounded-md border border-[#c8d3cd] bg-white px-3.5 text-sm font-medium text-[#17231f] outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-[#84918b] focus:border-[#087653] focus:ring-4 focus:ring-[#087653]/10 disabled:cursor-not-allowed disabled:bg-[#f1f4f2] disabled:text-[#7a8781]',
          Icon && 'pl-9',
          className,
        )}
        {...props}
      />
    </div>
  );
}
