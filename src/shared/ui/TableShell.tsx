import type { ReactNode } from 'react';
import { cn } from './styles';

interface TableShellProps {
  /** Largura mínima da tabela: abaixo disso o container rola na horizontal. */
  minWidth?: number;
  children: ReactNode;
  className?: string;
}

/**
 * Envolve uma tabela para ela rolar dentro do próprio container, e não empurrar
 * a página inteira na horizontal no celular.
 */
export function TableShell({ minWidth = 720, children, className }: TableShellProps) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full text-left text-sm" style={{ minWidth: `${minWidth}px` }}>
        {children}
      </table>
    </div>
  );
}

/** Cabeçalho padrão das tabelas do sistema. */
export function TableHead({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <thead className={cn('bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500', className)}>
      {children}
    </thead>
  );
}

/** Corpo padrão: linhas separadas por linha fina e realce no hover. */
export function TableBody({ children, className }: { children: ReactNode; className?: string }) {
  return <tbody className={cn('divide-y divide-slate-100', className)}>{children}</tbody>;
}
