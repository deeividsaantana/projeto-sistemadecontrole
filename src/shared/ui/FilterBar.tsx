import type { ReactNode } from 'react';
import { cn } from './styles';

interface PillsProps<T extends string> {
  opcoes: ReadonlyArray<{ valor: T; rotulo: string }>;
  valor: T;
  onChange: (valor: T) => void;
  className?: string;
  'aria-label'?: string;
}

/**
 * Grupo de filtros rápidos (Hoje, 7 dias, 30 dias). É um grupo de rádio de
 * verdade para o teclado e o leitor de tela, não um punhado de botões soltos.
 */
export function FilterPills<T extends string>({ opcoes, valor, onChange, className, ...props }: PillsProps<T>) {
  return (
    <div role="radiogroup" aria-label={props['aria-label'] || 'Filtro'} className={cn('inline-flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1', className)}>
      {opcoes.map(opcao => {
        const ativo = opcao.valor === valor;
        return (
          <button
            key={opcao.valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => onChange(opcao.valor)}
            className={cn(
              'h-8 rounded-md px-3 text-[12px] font-semibold transition-colors',
              ativo ? 'bg-[#087353] text-white' : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            {opcao.rotulo}
          </button>
        );
      })}
    </div>
  );
}

/** Linha de filtros da listagem: campos à esquerda, ação à direita. */
export function FilterBar({ children, acao, className }: { children: ReactNode; acao?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3', className)}>
      <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2">{children}</div>
      {acao}
    </div>
  );
}
