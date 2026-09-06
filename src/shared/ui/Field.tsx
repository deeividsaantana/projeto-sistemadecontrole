import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from './styles';

/**
 * Campo de formulário do sistema. Este bloco (rótulo em cima, controle de 44px
 * de altura, foco verde) estava copiado mais de cento e cinquenta vezes com
 * pequenas diferenças de espaçamento. Aqui o rótulo é sempre um <label> de
 * verdade ligado ao controle — placeholder não é rótulo para leitor de tela.
 */
const controlClass = 'mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 disabled:bg-slate-50 disabled:text-slate-400';

interface BaseProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  className?: string;
}

const Wrapper = ({ label, hint, error, className, children }: BaseProps & { children: ReactNode }) => (
  <label className={cn('block text-xs font-bold text-slate-600', className)}>
    {label}
    {children}
    {hint && !error && <span className="mt-1 block text-[10px] font-normal text-slate-500">{hint}</span>}
    {error && <span className="mt-1 block text-[11px] font-bold text-rose-700">{error}</span>}
  </label>
);

export function Field({ label, hint, error, className, ...props }: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Wrapper label={label} hint={hint} error={error} className={className}>
      <input {...props} aria-invalid={error ? true : undefined} className={cn(controlClass, error && 'border-rose-400')} />
    </Wrapper>
  );
}

export function SelectField({ label, hint, error, className, children, ...props }: BaseProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Wrapper label={label} hint={hint} error={error} className={className}>
      <select {...props} className={cn(controlClass, error && 'border-rose-400')}>{children}</select>
    </Wrapper>
  );
}

export function TextAreaField({ label, hint, error, className, rows = 2, ...props }: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Wrapper label={label} hint={hint} error={error} className={className}>
      <textarea {...props} rows={rows} className={cn(controlClass, 'py-2', error && 'border-rose-400')} />
    </Wrapper>
  );
}
