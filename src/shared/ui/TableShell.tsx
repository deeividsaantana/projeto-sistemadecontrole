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
    <div className={cn('renea-table-shell w-full overflow-x-auto', className)}>
      <table className="renea-table w-full text-left text-sm" style={{ minWidth: `${minWidth}px` }}>
        {children}
      </table>
    </div>
  );
}

/** Cabeçalho padrão das tabelas do sistema. */
export function TableHead({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <thead className={cn('bg-[#eef1ed] text-[10px] font-black uppercase tracking-[0.1em] text-[#53635c]', className)}>
      {children}
    </thead>
  );
}

/** Corpo padrão: linhas separadas por linha fina e realce no hover. */
export function TableBody({ children, className }: { children: ReactNode; className?: string }) {
  return <tbody className={cn('divide-y divide-[#e0e6e2]', className)}>{children}</tbody>;
}
