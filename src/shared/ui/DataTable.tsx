import { useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from './styles';

export interface ColunaTabela<T> {
  chave: string;
  titulo: string;
  /** Conteúdo da célula. Sem isto, usa o valor bruto do campo homônimo. */
  render?: (item: T) => ReactNode;
  alinhamento?: 'esquerda' | 'direita' | 'centro';
  larguraMinima?: number;
  /** Some abaixo de 1024px, para a tabela caber no celular sem virar sopa. */
  ocultarNoCelular?: boolean;
}

export interface AcaoTabela<T> {
  rotulo: string;
  onSelect: (item: T) => void;
  /** Ação destrutiva ganha destaque em vermelho no menu. */
  perigosa?: boolean;
}

interface DataTableProps<T> {
  colunas: Array<ColunaTabela<T>>;
  itens: T[];
  chaveDe: (item: T) => string;
  acoes?: Array<AcaoTabela<T>>;
  onRowClick?: (item: T) => void;
  vazio?: ReactNode;
  larguraMinima?: number;
  className?: string;
}

const alinhar = {
  esquerda: 'text-left',
  direita: 'text-right',
  centro: 'text-center',
};

/**
 * Tabela padrão do sistema: cabeçalho claro, linhas compactas, hover discreto e
 * as ações sempre na última coluna. Existe para as telas pararem de reescrever
 * a mesma marcação de tabela com espaçamentos ligeiramente diferentes.
 */
export function DataTable<T>({
  colunas,
  itens,
  chaveDe,
  acoes,
  onRowClick,
  vazio,
  larguraMinima = 880,
  className,
}: DataTableProps<T>) {
  const [menuAberto, setMenuAberto] = useState<string | null>(null);

  if (itens.length === 0 && vazio) return <>{vazio}</>;

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full text-left" style={{ minWidth: `${larguraMinima}px` }}>
        <thead className="bg-slate-50/80">
          <tr>
            {colunas.map(coluna => (
              <th
                key={coluna.chave}
                scope="col"
                className={cn(
                  'whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500',
                  alinhar[coluna.alinhamento || 'esquerda'],
                  coluna.ocultarNoCelular && 'hidden lg:table-cell',
                )}
                style={coluna.larguraMinima ? { minWidth: `${coluna.larguraMinima}px` } : undefined}
              >
                {coluna.titulo}
              </th>
            ))}
            {acoes && acoes.length > 0 && (
              <th scope="col" className="w-16 px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Ações
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {itens.map(item => {
            const chave = chaveDe(item);
            return (
              <tr
                key={chave}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                className={cn('transition-colors hover:bg-slate-50/70', onRowClick && 'cursor-pointer')}
              >
                {colunas.map(coluna => (
                  <td
                    key={coluna.chave}
                    className={cn(
                      'px-4 py-3 text-[13px] text-slate-700',
                      alinhar[coluna.alinhamento || 'esquerda'],
                      coluna.ocultarNoCelular && 'hidden lg:table-cell',
                    )}
                  >
                    {coluna.render ? coluna.render(item) : String((item as Record<string, unknown>)[coluna.chave] ?? '—')}
                  </td>
                ))}
                {acoes && acoes.length > 0 && (
                  <td className="relative px-4 py-3 text-right">
                    <button
                      type="button"
                      aria-label={`Ações da linha`}
                      aria-expanded={menuAberto === chave}
                      onClick={event => { event.stopPropagation(); setMenuAberto(atual => atual === chave ? null : chave); }}
                      className="inline-grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-emerald-500 hover:text-emerald-700"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {menuAberto === chave && (
                      <>
                        <span className="fixed inset-0 z-10" onClick={event => { event.stopPropagation(); setMenuAberto(null); }} />
                        <div className="absolute right-4 top-11 z-20 min-w-40 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                          {acoes.map(acao => (
                            <button
                              key={acao.rotulo}
                              type="button"
                              onClick={event => { event.stopPropagation(); setMenuAberto(null); acao.onSelect(item); }}
                              className={cn(
                                'block w-full px-3 py-2 text-left text-[12px] font-medium transition-colors hover:bg-slate-50',
                                acao.perigosa ? 'text-rose-700' : 'text-slate-700',
                              )}
                            >
                              {acao.rotulo}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
