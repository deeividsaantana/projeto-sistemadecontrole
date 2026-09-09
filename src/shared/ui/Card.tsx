import type { ReactNode } from 'react';
import { cn } from './styles';

interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Remove o respiro interno para conteúdos que encostam na borda (tabelas). */
  flush?: boolean;
  children: ReactNode;
  className?: string;
}

/** Container padrão do sistema: borda fina, canto de 8px, fundo branco. */
export function Card({ title, description, actions, flush = false, children, className }: CardProps) {
  return (
    <section className={cn('renea-card overflow-hidden rounded-[3px] border border-[#cfd8d3] bg-white', className)}>
      {(title || actions) && (
        <header className="flex flex-col gap-2 border-b border-[#dce3df] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {title && <h2 className="text-xs font-black uppercase tracking-[0.1em] text-[#17231f]">{title}</h2>}
            {description && <p className="mt-1.5 text-xs leading-relaxed text-[#66736e]">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={flush ? undefined : 'p-5'}>{children}</div>
    </section>
  );
}
