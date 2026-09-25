import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronRight as Abrir, SearchX } from 'lucide-react';
import type { ColunaCadastro, LinhaCadastro } from '../../utils/cadastrosLista';
import { BOTAO_SECUNDARIO, CARTAO, FOCO, TOM_SITUACAO } from './estilos';

export const LINHAS_POR_PAGINA = 50;

interface Props {
  linhas: LinhaCadastro[];
  colunas: ColunaCadastro[];
  mostrarSituacao: boolean;
  ordem: { coluna: string; direcao: 'asc' | 'desc' };
  onOrdenar: (coluna: string) => void;
  pagina: number;
  onPagina: (pagina: number) => void;
  selecionadoId: string | null;
  onAbrir: (linha: LinhaCadastro) => void;
  vazio: { titulo: string; texto: string; acao?: { label: string; onClick: () => void } };
  /** Com seleção, cada linha ganha uma caixa para marcar e excluir vários de uma vez. */
  selecao?: {
    marcados: ReadonlySet<string>;
    onAlternar: (id: string) => void;
    onAlternarPagina: (ids: string[], marcar: boolean) => void;
  };
}

const CAIXA = 'size-5 cursor-pointer rounded border-slate-300 accent-[#176b4d]';

/**
 * Tabela no computador e cartões no celular, da mesma lista já filtrada.
 * A linha inteira abre o detalhe: não há ícone pequeno para acertar.
 */
export default function CadastroLista({ linhas, colunas, mostrarSituacao, ordem, onOrdenar, pagina, onPagina, selecionadoId, onAbrir, vazio, selecao }: Props) {
  const total = linhas.length;
  const paginas = Math.max(1, Math.ceil(total / LINHAS_POR_PAGINA));
  const atual = Math.min(pagina, paginas);
  const inicio = (atual - 1) * LINHAS_POR_PAGINA;
  const visiveis = linhas.slice(inicio, inicio + LINHAS_POR_PAGINA);
  const idsDaPagina = visiveis.map(linha => linha.id);
  const marcadosNaPagina = selecao ? idsDaPagina.filter(id => selecao.marcados.has(id)).length : 0;
  const paginaToda = marcadosNaPagina > 0 && marcadosNaPagina === idsDaPagina.length;

  if (total === 0) {
    return (
      <div className={`${CARTAO} flex flex-col items-center gap-2 px-6 py-12 text-center`} data-testid="cadastro-lista-vazia">
        <SearchX className="size-8 text-slate-300" aria-hidden="true" />
        <p className="text-base font-bold text-slate-800">{vazio.titulo}</p>
        <p className="max-w-sm text-sm text-slate-500">{vazio.texto}</p>
        {vazio.acao && <button type="button" onClick={vazio.acao.onClick} className={`${BOTAO_SECUNDARIO} mt-2`}>{vazio.acao.label}</button>}
      </div>
    );
  }

  return (
    <div className={`${CARTAO} overflow-clip`}>
      <table className="hidden w-full table-fixed border-collapse text-left text-sm md:table">
        {/* Largura fixa por coluna: texto longo corta com reticências em vez de
            empurrar a tabela para fora da tela em notebook com zoom de 100%. */}
        <colgroup>
          {selecao && <col className="w-12" />}
          {colunas.map(coluna => <col key={coluna.id} className={`${coluna.codigo ? 'w-28' : coluna.larga ? 'w-[28%]' : ''} ${coluna.secundaria ? 'hidden xl:table-column' : ''}`} />)}
          {mostrarSituacao && <col className="w-28" />}
          <col className="w-10" />
        </colgroup>
        <thead className="lg:sticky lg:top-[var(--cad-topo-lista,0px)] lg:z-10">
          <tr className="border-b border-slate-200 bg-slate-50">
            {selecao && (
              <th scope="col" className="w-12 p-0">
                <label className="flex min-h-11 cursor-pointer items-center justify-center">
                  <input
                    type="checkbox"
                    className={CAIXA}
                    aria-label={paginaToda ? 'Desmarcar esta página' : 'Marcar esta página'}
                    checked={paginaToda}
                    ref={caixa => { if (caixa) caixa.indeterminate = marcadosNaPagina > 0 && !paginaToda; }}
                    onChange={() => selecao.onAlternarPagina(idsDaPagina, !paginaToda)}
                    data-testid="cadastro-marcar-pagina"
                  />
                </label>
              </th>
            )}
            {colunas.map(coluna => {
              const ativa = ordem.coluna === coluna.id;
              const Seta = ordem.direcao === 'asc' ? ArrowUp : ArrowDown;
              return (
                <th key={coluna.id} scope="col" aria-sort={ativa ? (ordem.direcao === 'asc' ? 'ascending' : 'descending') : 'none'} className={`p-0 ${coluna.secundaria ? 'hidden xl:table-cell' : ''}`}>
                  <button type="button" onClick={() => onOrdenar(coluna.id)} className={`flex min-h-10 w-full min-w-0 items-center gap-1.5 px-3 text-xs font-bold uppercase tracking-wide text-slate-500 hover:text-slate-800 ${FOCO}`}>
                    <span className="truncate" title={coluna.label}>{coluna.label}</span>
                    {ativa && <Seta className="size-3.5 text-[#176b4d]" aria-hidden="true" />}
                  </button>
                </th>
              );
            })}
            {mostrarSituacao && <th scope="col" className="px-3 text-xs font-bold uppercase tracking-wide text-slate-500">Situação</th>}
            <th scope="col" className="w-10"><span className="sr-only">Abrir</span></th>
          </tr>
        </thead>
        <tbody>
          {visiveis.map(linha => (
            <tr
              key={linha.id}
              data-linha-lista
              onClick={() => onAbrir(linha)}
              className={`group cursor-pointer border-b border-slate-100 transition-colors duration-150 last:border-0 hover:bg-emerald-50/50 ${selecionadoId === linha.id || selecao?.marcados.has(linha.id) ? 'bg-emerald-50/70' : ''} ${linha.ativo ? '' : 'text-slate-400'}`}
            >
              {selecao && (
                <td className="p-0" onClick={event => event.stopPropagation()}>
                  <label className="flex h-11 cursor-pointer items-center justify-center">
                    <input
                      type="checkbox"
                      className={CAIXA}
                      aria-label={`Marcar ${linha.titulo}`}
                      checked={selecao.marcados.has(linha.id)}
                      onChange={() => selecao.onAlternar(linha.id)}
                    />
                  </label>
                </td>
              )}
              {colunas.map((coluna, indice) => (
                <td key={coluna.id} title={linha.colunas[coluna.id] || undefined} className={`h-11 truncate px-3 ${coluna.secundaria ? 'hidden xl:table-cell' : ''} ${coluna.codigo ? 'font-mono text-[13px] tabular-nums' : ''} ${indice === 0 || coluna.id === 'nome' ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                  {indice === 0 ? (
                    <button type="button" onClick={event => { event.stopPropagation(); onAbrir(linha); }} className={`max-w-full truncate rounded text-left ${FOCO}`}>
                      {linha.colunas[coluna.id] || '—'}
                    </button>
                  ) : (linha.colunas[coluna.id] || <span className="text-slate-300">—</span>)}
                </td>
              ))}
              {mostrarSituacao && (
                <td className="truncate px-3">
                  <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${TOM_SITUACAO[linha.tom]}`}>{linha.situacao}</span>
                </td>
              )}
              <td className="pr-3 text-slate-300 group-hover:text-[#176b4d]"><Abrir className="size-4" aria-hidden="true" /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y divide-slate-100 md:hidden">
        {visiveis.map(linha => (
          <li key={linha.id} data-linha-lista className={`flex items-stretch ${selecao?.marcados.has(linha.id) ? 'bg-emerald-50/70' : ''}`}>
            {selecao && (
              <label className="flex w-14 shrink-0 cursor-pointer items-center justify-center">
                <input
                  type="checkbox"
                  className={`${CAIXA} size-6`}
                  aria-label={`Marcar ${linha.titulo}`}
                  checked={selecao.marcados.has(linha.id)}
                  onChange={() => selecao.onAlternar(linha.id)}
                />
              </label>
            )}
            <button type="button" onClick={() => onAbrir(linha)} className={`flex min-h-16 w-full min-w-0 items-center gap-3 py-3 pr-4 text-left ${selecao ? 'pl-0' : 'pl-4'} transition-colors duration-150 active:bg-emerald-50 ${FOCO}`}>
              <span className="min-w-0 flex-1">
                <span className={`block break-words text-base font-semibold leading-snug ${linha.ativo ? 'text-slate-900' : 'text-slate-500'}`}>{linha.titulo}</span>
                {linha.detalhe && <span className="mt-0.5 block truncate text-sm text-slate-500">{linha.detalhe}</span>}
              </span>
              {mostrarSituacao && <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${TOM_SITUACAO[linha.tom]}`}>{linha.situacao}</span>}
              <Abrir className="size-5 shrink-0 text-slate-300" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
        <span className="tabular-nums">
          {total <= LINHAS_POR_PAGINA
            ? `${total.toLocaleString('pt-BR')} ${total === 1 ? 'cadastro' : 'cadastros'}`
            : `${(inicio + 1).toLocaleString('pt-BR')} a ${Math.min(total, inicio + LINHAS_POR_PAGINA).toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')}`}
        </span>
        {paginas > 1 && (
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Página anterior" disabled={atual <= 1} onClick={() => onPagina(atual - 1)} className={`${BOTAO_SECUNDARIO} px-3`}>
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <span className="min-w-20 text-center font-semibold tabular-nums text-slate-700">{atual} de {paginas}</span>
            <button type="button" aria-label="Próxima página" disabled={atual >= paginas} onClick={() => onPagina(atual + 1)} className={`${BOTAO_SECUNDARIO} px-3`}>
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
