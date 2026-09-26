import { useEffect, useState } from 'react';
import { ArrowRight, Boxes, Package } from 'lucide-react';
import type { MovimentoMaterial } from '../../types';
import type { PosicaoEstoque } from '../../utils/estoque';
import { formatarData, numero } from '../../utils/formato';
import { Badge, EmptyState, TableBody, TableHead, TableShell } from '../../shared/ui';
import { BOTAO_PERIGO_LEVE, BOTAO_SECUNDARIO, CARTAO, FOCO } from '../cadastros/estilos';

export const PASSO_MOVIMENTOS = 100;

const tomDoTipo = (tipo: MovimentoMaterial['tipo']) => (tipo === 'Entrada' ? 'success' : tipo === 'Saída' ? 'danger' : 'neutral');
const trajeto = (item: MovimentoMaterial) => [item.origem, item.destino].filter(Boolean);
// A cascata de entrada só vale para as primeiras linhas, as que cabem na
// tela. Animar as 100 fazia o GSAP medir cada uma e parava a tela.
const LINHAS_ANIMADAS = 20;
const animada = (indice: number) => (indice < LINHAS_ANIMADAS ? { 'data-linha-lista': true } : {});

const TELA_LARGA = '(min-width: 768px)';
const ehTelaLarga = () => typeof window === 'undefined' || typeof window.matchMedia !== 'function' || window.matchMedia(TELA_LARGA).matches;

/** Desenha só a tabela ou só os cartões: as duas juntas dobravam o peso da lista. */
export const useTelaLarga = () => {
  const [larga, setLarga] = useState(ehTelaLarga);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const consulta = window.matchMedia(TELA_LARGA);
    const mudar = () => setLarga(consulta.matches);
    consulta.addEventListener('change', mudar);
    return () => consulta.removeEventListener('change', mudar);
  }, []);
  return larga;
};

const fornecedorENota = (item: MovimentoMaterial) => [item.fornecedorNome, item.notaFiscal && `NF ${item.notaFiscal}`].filter(Boolean).join(' · ');

interface MovimentosProps {
  movimentos: readonly MovimentoMaterial[];
  /** Muda quando a busca muda: a lista volta para o começo. */
  chave: string;
  /** Com seleção, cada movimento ganha uma caixa para marcar vários. */
  selecao?: {
    marcados: ReadonlySet<string>;
    onAlternar: (id: string) => void;
    onAlternarVarios: (ids: string[], marcar: boolean) => void;
  };
  /** Tocar no movimento abre para editar. */
  onAbrir?: (movimento: MovimentoMaterial) => void;
}

const CAIXA = 'size-5 cursor-pointer rounded border-slate-300 accent-[#176b4d]';

/**
 * Lista de movimentos, do mais recente para o mais antigo. Com a planilha de
 * agregados são mais de 11 mil linhas: desenhar todas de uma vez parava a
 * tela por uns 7 segundos, então a lista mostra um pedaço e cresce quando a
 * pessoa pede. A busca continua olhando todos. No celular cada movimento vira
 * um cartão, sem rolar para o lado.
 */
export function ListaMovimentos({ movimentos, chave, selecao, onAbrir }: MovimentosProps) {
  const [limite, setLimite] = useState(PASSO_MOVIMENTOS);
  useEffect(() => { setLimite(PASSO_MOVIMENTOS); }, [chave]);
  const telaLarga = useTelaLarga();

  if (movimentos.length === 0) {
    return <EmptyState icon={Boxes} title="Nenhum movimento" description="Use Novo lançamento ou importe a planilha." />;
  }
  const visiveis = movimentos.slice(0, limite);
  const idsVisiveis = visiveis.map(item => item.id);
  const marcadosVisiveis = selecao ? idsVisiveis.filter(id => selecao.marcados.has(id)).length : 0;
  const todosVisiveis = marcadosVisiveis > 0 && marcadosVisiveis === idsVisiveis.length;
  const caixa = (item: MovimentoMaterial) => selecao && (
    <input
      type="checkbox"
      className={CAIXA}
      aria-label={`Marcar ${item.tipo.toLocaleLowerCase('pt-BR')} de ${item.materialDescricao} em ${formatarData(item.data)}`}
      checked={selecao.marcados.has(item.id)}
      onChange={() => selecao.onAlternar(item.id)}
    />
  );
  const tipo = (item: MovimentoMaterial) => (item.canceladoEm
    ? <Badge tone="neutral">Desfeito</Badge>
    : <Badge tone={tomDoTipo(item.tipo)}>{item.tipo === 'Transferência' ? 'Transporte' : item.tipo}</Badge>);

  return (
    <div className={`${CARTAO} overflow-hidden`}>
      {telaLarga ? (
          <TableShell minWidth={760}>
            <TableHead>
              <tr>
                {selecao && (
                  <th className="w-12 p-0">
                    <label className="flex min-h-11 cursor-pointer items-center justify-center">
                      <input
                        type="checkbox"
                        className={CAIXA}
                        aria-label={todosVisiveis ? 'Desmarcar os mostrados' : 'Marcar os mostrados'}
                        checked={todosVisiveis}
                        ref={elemento => { if (elemento) elemento.indeterminate = marcadosVisiveis > 0 && !todosVisiveis; }}
                        onChange={() => selecao.onAlternarVarios(idsVisiveis, !todosVisiveis)}
                        data-testid="movimentos-marcar-mostrados"
                      />
                    </label>
                  </th>
                )}
                <th className="p-3">Data</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Material</th>
                <th className="p-3 text-right">Quantidade</th>
                <th className="p-3">De onde → para onde</th>
                <th className="p-3">Fornecedor / nota</th>
              </tr>
            </TableHead>
            <TableBody>
              {visiveis.map((item, indice) => (
                <tr
                  key={item.id}
                  {...animada(indice)}
                  onClick={onAbrir ? () => onAbrir(item) : undefined}
                  className={`transition-colors hover:bg-slate-50 ${onAbrir ? 'cursor-pointer' : ''} ${selecao?.marcados.has(item.id) ? 'bg-emerald-50/70' : ''} ${item.canceladoEm ? 'text-slate-400' : ''}`}
                >
                  {selecao && (
                    <td className="p-0" onClick={event => event.stopPropagation()}>
                      <label className="flex h-11 cursor-pointer items-center justify-center">{caixa(item)}</label>
                    </td>
                  )}
                  <td className="p-3 text-slate-700">
                    <span className="block tabular-nums">{formatarData(item.data)}</span>
                    {item.responsavel && <span className="block text-xs text-slate-500">{item.responsavel}</span>}
                  </td>
                  <td className="p-3">{tipo(item)}</td>
                  <td className={`p-3 font-bold ${item.canceladoEm ? 'text-slate-400' : 'text-slate-800'}`}>
                    {onAbrir ? (
                      <button type="button" onClick={event => { event.stopPropagation(); onAbrir(item); }} className={`rounded text-left hover:text-[#176b4d] ${FOCO}`}>{item.materialDescricao}</button>
                    ) : item.materialDescricao}
                  </td>
                  <td className={`p-3 text-right font-bold tabular-nums ${item.canceladoEm ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{numero(item.quantidade)} {item.unidade}</td>
                  <td className="p-3 text-slate-600">{trajeto(item).join(' → ') || '-'}</td>
                  <td className="p-3 text-slate-600">{fornecedorENota(item) || '-'}</td>
                </tr>
              ))}
            </TableBody>
          </TableShell>
      ) : (
        <ul className="divide-y divide-slate-100" aria-label="Movimentos">
          {visiveis.map((item, indice) => (
            <li key={item.id} {...animada(indice)} className={`flex items-stretch ${selecao?.marcados.has(item.id) ? 'bg-emerald-50/70' : ''}`}>
              {selecao && <label className="flex w-12 shrink-0 cursor-pointer items-start justify-center pt-4">{caixa(item)}</label>}
              <button
                type="button"
                disabled={!onAbrir}
                onClick={() => onAbrir?.(item)}
                className={`min-w-0 flex-1 space-y-1 py-4 pr-4 text-left disabled:cursor-default ${selecao ? '' : 'pl-4'} ${FOCO}`}
              >
                <span className="flex items-start justify-between gap-3">
                  <strong className={`min-w-0 text-base ${item.canceladoEm ? 'text-slate-400' : 'text-slate-900'}`}>{item.materialDescricao}</strong>
                  <strong className={`shrink-0 text-base tabular-nums ${item.canceladoEm ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{numero(item.quantidade)} {item.unidade}</strong>
                </span>
                <span className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  {tipo(item)}
                  <span className="tabular-nums">{formatarData(item.data)}</span>
                </span>
                {trajeto(item).length > 0 && (
                  <span className="flex flex-wrap items-center gap-1 text-sm text-slate-600">
                    {trajeto(item).map((local, posicao) => (
                      <span key={local} className="inline-flex items-center gap-1">
                        {posicao > 0 && <ArrowRight className="size-4 text-slate-400" aria-label="para" />}
                        {local}
                      </span>
                    ))}
                  </span>
                )}
                {fornecedorENota(item) && <span className="block text-sm text-slate-500">{fornecedorENota(item)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {movimentos.length > limite && (
        <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            Mostrando os {numero(limite)} mais recentes de {numero(movimentos.length)}. Use a busca para achar um movimento.
          </p>
          <button type="button" onClick={() => setLimite(atual => atual + PASSO_MOVIMENTOS)} className={BOTAO_SECUNDARIO}>
            Mostrar mais {PASSO_MOVIMENTOS}
          </button>
        </div>
      )}
    </div>
  );
}

interface CartoesProps {
  posicoes: readonly PosicaoEstoque[];
  modo: 'estoque' | 'cadastro';
  fornecedorDe: (posicao: PosicaoEstoque) => string;
  podeEditar: boolean;
  onEditar: (posicao: PosicaoEstoque) => void;
  onExcluir: (posicao: PosicaoEstoque) => void;
}

/** No celular, estoque e cadastro de materiais viram cartões em vez de tabela larga. */
export function CartoesMateriais({ posicoes, modo, fornecedorDe, podeEditar, onEditar, onExcluir }: CartoesProps) {
  if (posicoes.length === 0) {
    return <EmptyState icon={Package} title="Nenhum material cadastrado" description="Use Novo material para cadastrar o que a obra usa." />;
  }
  return (
    <ul className={`${CARTAO} divide-y divide-slate-100 overflow-hidden`} aria-label={modo === 'estoque' ? 'Estoque por material' : 'Materiais cadastrados'}>
      {posicoes.map((item, indice) => (
        <li key={item.material.id} {...animada(indice)} className="space-y-1 p-4">
          <div className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <strong className="block text-base text-slate-900">{item.material.descricao}</strong>
              <span className="block text-sm text-slate-500">{[item.material.codigo, item.material.categoria].filter(Boolean).join(' · ') || 'Sem código'}</span>
            </span>
            {modo === 'estoque' && (
              <strong className={`shrink-0 text-base tabular-nums ${item.abaixoDoMinimo ? 'text-amber-700' : 'text-slate-900'}`}>{numero(item.saldo)} {item.material.unidade}</strong>
            )}
          </div>
          {modo === 'estoque' ? (
            <p className="text-sm text-slate-600">
              Entrou {numero(item.entradas)} · saiu {numero(item.saidas)}{item.material.estoqueMinimo ? ` · mínimo ${numero(item.material.estoqueMinimo)}` : ''}
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-600">Unidade {item.material.unidade}{item.material.estoqueMinimo ? ` · mínimo ${numero(item.material.estoqueMinimo)}` : ''}</p>
              {fornecedorDe(item) && <p className="text-sm text-slate-500">{fornecedorDe(item)}</p>}
              {podeEditar && (
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => onEditar(item)} className={`${BOTAO_SECUNDARIO} flex-1`}>Editar</button>
                  <button type="button" onClick={() => onExcluir(item)} className={`${BOTAO_PERIGO_LEVE} flex-1`}>Excluir</button>
                </div>
              )}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
