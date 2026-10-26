/**
 * TabelaPadrao: a ÚNICA tabela do sistema. Toda lista em grade (cadastros,
 * ordens, movimentos, usuários) passa por aqui, para ter o mesmo cabeçalho, a
 * mesma altura de linha, a mesma ordenação, o mesmo rodapé e os mesmos
 * cartões no celular. Não monte <table> à mão em tela nova.
 *
 * O que ela faz sozinha:
 * - cabeçalho preso (11 px, maiúsculas, fundo #f3f6f4) e ordenação clicando
 *   no título, com `aria-sort` no próprio <th scope="col">;
 * - linha de 40 px e letra de 13 px; coluna `alinhamento: 'direita'` vira
 *   número (à direita, algarismos de mesma largura);
 * - texto longo quebra em até 2 linhas, com o texto inteiro no `title`;
 * - caixa de marcar na 1ª coluna (`selecao`) e ações na última (`acoes`);
 * - linha clicável (`onAbrirLinha`) também abre com Enter ou Espaço;
 * - rodapé preso com o total, "Mostrar 25/50/100" (padrão 50) e páginas;
 * - abaixo de 768 px vira cartões, com os mesmos campos na mesma ordem
 *   (a coluna com `noCartao: false` fica fora do cartão);
 * - ocupa a altura do pai (`h-full`) e rola por dentro: dentro do molde de
 *   tela cheia, ponha a tabela na área de dados (`flex-1 min-h-0`). Fora do
 *   molde, a área de linhas para em `--tabela-altura-max` (padrão
 *   `100dvh - 7rem`), para cabeçalho e rodapé nunca saírem da tela.
 *
 * Exemplo:
 *
 *   const colunas: ColunaTabela<Abastecimento>[] = [
 *     { chave: 'data', titulo: 'Data', render: a => formatarData(a.data), valorOrdenacao: a => a.data },
 *     { chave: 'prefixo', titulo: 'Equipamento', render: a => a.prefixo, valorOrdenacao: a => a.prefixo, larguraMinima: 140 },
 *     { chave: 'litros', titulo: 'Litros', alinhamento: 'direita', render: a => numero(a.litros), valorOrdenacao: a => a.litros },
 *     { chave: 'obs', titulo: 'Observação', render: a => a.obs || '—', dica: a => a.obs, noCartao: false },
 *   ];
 *
 *   <TabelaPadrao
 *     titulo="Abastecimentos do mês"
 *     linhas={abastecimentos}
 *     colunas={colunas}
 *     idDaLinha={a => a.id}
 *     nomeDoItem={{ um: 'abastecimento', varios: 'abastecimentos' }}
 *     ordenacaoInicial={{ chave: 'data', direcao: 'desc' }}
 *     onAbrirLinha={abrir}
 *     acoes={a => <button type="button" onClick={() => excluir(a)}>Excluir</button>}
 *   />
 *
 * Ordenação e página podem vir de fora (`ordenacao` + `onOrdenar`,
 * `pagina` + `onPagina`) quando a tela já guarda esse estado; aí a tabela
 * só desenha o que recebe, sem ordenar de novo.
 */
import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { useTelaLarga } from '../hooks/useTelaLarga';
import { cn } from './styles';

export type DirecaoOrdenacao = 'asc' | 'desc';
export interface Ordenacao { chave: string; direcao: DirecaoOrdenacao }
export type ValorOrdenacao = string | number | null | undefined;

export interface ColunaTabela<T> {
  /** Identificador estável da coluna (usado na ordenação). */
  chave: string;
  /** Texto do cabeçalho e do rótulo no cartão do celular. */
  titulo: string;
  /** `direita` para números: alinha à direita com algarismos de mesma largura. */
  alinhamento?: 'esquerda' | 'direita' | 'centro';
  /** Largura mínima em px. Sem ela a coluna divide o espaço com as outras. */
  larguraMinima?: number;
  /** O que aparece na célula e no cartão. */
  render: (linha: T) => ReactNode;
  /** Com ele o título vira botão de ordenar. */
  valorOrdenacao?: (linha: T) => ValorOrdenacao;
  /** Texto inteiro mostrado ao passar o mouse quando a célula quebra. */
  dica?: (linha: T) => string | undefined;
  /** `false` tira a coluna do cartão do celular. Padrão: aparece. */
  noCartao?: boolean;
}

export interface SelecaoTabela<T> {
  marcados: ReadonlySet<string>;
  onAlternar: (id: string) => void;
  onAlternarVarios: (ids: string[], marcar: boolean) => void;
  /** Nome lido pelo leitor de tela na caixa de cada linha. */
  rotulo?: (linha: T) => string;
}

export interface TabelaPadraoProps<T> {
  /** Nome da tabela para leitor de tela (vira <caption>). Obrigatório. */
  titulo: string;
  linhas: readonly T[];
  colunas: readonly ColunaTabela<T>[];
  idDaLinha: (linha: T) => string;
  carregando?: boolean;
  /** Texto ou bloco mostrado quando não há linhas. */
  vazio?: ReactNode;
  /** Como contar no rodapé: "1 ordem" / "12 ordens". */
  nomeDoItem?: { um: string; varios: string };
  onAbrirLinha?: (linha: T) => void;
  /** Botões da última coluna. */
  acoes?: (linha: T) => ReactNode;
  tituloAcoes?: string;
  selecao?: SelecaoTabela<T>;
  /** Linha marcada como aberta (fica destacada). */
  linhaAtivaId?: string | null;
  /** Classe extra da linha (ex.: inativo em cinza, atrasado em âmbar). */
  classeLinha?: (linha: T) => string | undefined;
  ordenacaoInicial?: Ordenacao;
  ordenacao?: Ordenacao;
  onOrdenar?: (chave: string) => void;
  porPaginaInicial?: PorPagina;
  pagina?: number;
  onPagina?: (pagina: number) => void;
  /** Sem rodapé de páginas: para listas curtas e fechadas (ex.: matriz de permissões). */
  semPaginacao?: boolean;
  className?: string;
  testId?: string;
}

export const OPCOES_POR_PAGINA = [25, 50, 100] as const;
export type PorPagina = typeof OPCOES_POR_PAGINA[number];
export const POR_PAGINA_PADRAO: PorPagina = 50;

/** Só as primeiras linhas entram na cascata de entrada (useEntradaDeLista). */
const LINHAS_ANIMADAS = 20;

const colecao = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

/** Ordena sem mexer na lista original. Vazio vai sempre para o fim. */
export const ordenarLinhasTabela = <T,>(
  linhas: readonly T[],
  colunas: readonly ColunaTabela<T>[],
  ordenacao: Ordenacao | null | undefined,
): readonly T[] => {
  const coluna = ordenacao && colunas.find(item => item.chave === ordenacao.chave);
  const valor = coluna?.valorOrdenacao;
  if (!ordenacao || !valor) return linhas;
  const sinal = ordenacao.direcao === 'asc' ? 1 : -1;
  const vazio = (item: ValorOrdenacao) => item === null || item === undefined || item === '';
  return linhas
    .map((linha, indice) => ({ linha, indice, chave: valor(linha) }))
    .sort((a, b) => {
      if (vazio(a.chave) || vazio(b.chave)) {
        if (vazio(a.chave) && vazio(b.chave)) return a.indice - b.indice;
        return vazio(a.chave) ? 1 : -1;
      }
      const comparacao = typeof a.chave === 'number' && typeof b.chave === 'number'
        ? a.chave - b.chave
        : colecao.compare(String(a.chave), String(b.chave));
      return comparacao * sinal || a.indice - b.indice;
    })
    .map(item => item.linha);
};

/** Clicar de novo na mesma coluna inverte; coluna nova começa crescente. */
export const proximaOrdenacao = (atual: Ordenacao | null | undefined, chave: string): Ordenacao => (
  atual?.chave === chave
    ? { chave, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' }
    : { chave, direcao: 'asc' }
);

/** Fatia a página pedida; página fora do intervalo cai na mais próxima. */
export const paginarLinhas = <T,>(linhas: readonly T[], pagina: number, porPagina: number) => {
  const tamanho = Math.max(1, Math.floor(porPagina));
  const totalPaginas = Math.max(1, Math.ceil(linhas.length / tamanho));
  const atual = Math.min(Math.max(1, Math.floor(pagina) || 1), totalPaginas);
  const inicio = (atual - 1) * tamanho;
  return { visiveis: linhas.slice(inicio, inicio + tamanho), pagina: atual, totalPaginas, inicio, total: linhas.length };
};

/** Campos do cartão do celular: os mesmos da tabela, na mesma ordem. */
export const colunasDoCartao = <T,>(colunas: readonly ColunaTabela<T>[]) => colunas.filter(coluna => coluna.noCartao !== false);

/** Janela de até 5 números de página em volta da atual. */
export const paginasVisiveis = (pagina: number, totalPaginas: number) => {
  const primeira = Math.max(1, Math.min(pagina - 2, totalPaginas - 4));
  return Array.from({ length: Math.min(5, totalPaginas) }, (_, indice) => primeira + indice);
};

const contagem = (total: number, nome?: { um: string; varios: string }) => (
  `${total.toLocaleString('pt-BR')} ${total === 1 ? nome?.um ?? 'registro' : nome?.varios ?? 'registros'}`
);

const ALINHAMENTO = { esquerda: 'text-left', direita: 'text-right tabular-nums', centro: 'text-center' } as const;
const FOCO = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--renea-focus)';
/** 24 px também no computador: é o mínimo de alvo de toque e clique (M4). */
const CAIXA = 'size-6 cursor-pointer rounded border-slate-300 accent-[#176b4d]';
// Cor e borda ficam fora da base: duas classes de fundo na mesma tag brigam e
// a página atual saía branca sobre branco.
const BOTAO_PAGINA_BASE = `grid min-h-11 min-w-11 place-items-center rounded-lg border px-2 text-[13px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 md:min-h-8 md:min-w-8 ${FOCO}`;
const BOTAO_PAGINA = `${BOTAO_PAGINA_BASE} border-slate-200 bg-white text-slate-700 hover:border-emerald-500`;
const BOTAO_PAGINA_ATUAL = `${BOTAO_PAGINA_BASE} border-[#176b4d] bg-[#176b4d] text-white`;

/** Clique que nasceu num botão, link ou campo dentro da linha não abre a linha. */
const veioDeControle = (evento: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
  const alvo = evento.target as HTMLElement | null;
  const controle = alvo?.closest('button, a, input, select, textarea, label, [role="button"]');
  return Boolean(controle && controle !== evento.currentTarget && evento.currentTarget.contains(controle));
};

const textoDe = (conteudo: ReactNode) => (typeof conteudo === 'string' || typeof conteudo === 'number' ? String(conteudo) : undefined);

export function TabelaPadrao<T>({
  titulo,
  linhas,
  colunas,
  idDaLinha,
  carregando = false,
  vazio = 'Nenhum registro encontrado.',
  nomeDoItem,
  onAbrirLinha,
  acoes,
  tituloAcoes = 'Ações',
  selecao,
  linhaAtivaId,
  classeLinha,
  ordenacaoInicial,
  ordenacao: ordenacaoExterna,
  onOrdenar,
  porPaginaInicial = POR_PAGINA_PADRAO,
  pagina: paginaExterna,
  onPagina,
  semPaginacao = false,
  className,
  testId,
}: TabelaPadraoProps<T>) {
  const telaLarga = useTelaLarga();
  const [ordenacaoInterna, setOrdenacaoInterna] = useState<Ordenacao | null>(ordenacaoInicial ?? null);
  const [paginaInterna, setPaginaInterna] = useState(1);
  const [porPagina, setPorPagina] = useState<number>(porPaginaInicial);

  const ordenacaoControlada = ordenacaoExterna !== undefined && Boolean(onOrdenar);
  const ordenacao = ordenacaoControlada ? ordenacaoExterna : ordenacaoInterna;
  const paginaControlada = paginaExterna !== undefined && Boolean(onPagina);
  const irPara = (pagina: number) => (paginaControlada ? onPagina!(pagina) : setPaginaInterna(pagina));

  // Filtrou e a lista mudou de tamanho: volta para a primeira página, senão a
  // pessoa cai numa página vazia.
  useEffect(() => {
    if (!paginaControlada) setPaginaInterna(1);
  }, [linhas.length, paginaControlada]);

  const ordenadas = useMemo(
    () => (ordenacaoControlada ? linhas : ordenarLinhasTabela(linhas, colunas, ordenacao)),
    [colunas, linhas, ordenacao, ordenacaoControlada],
  );
  const fatia = paginarLinhas(ordenadas, semPaginacao ? 1 : paginaControlada ? paginaExterna! : paginaInterna, semPaginacao ? Math.max(1, ordenadas.length) : porPagina);
  const { visiveis } = fatia;

  const ordenar = (chave: string) => {
    if (ordenacaoControlada) onOrdenar!(chave);
    else setOrdenacaoInterna(atual => proximaOrdenacao(atual, chave));
    irPara(1);
  };

  const idsVisiveis = visiveis.map(idDaLinha);
  const marcadosVisiveis = selecao ? idsVisiveis.filter(id => selecao.marcados.has(id)).length : 0;
  const todosVisiveis = marcadosVisiveis > 0 && marcadosVisiveis === idsVisiveis.length;

  const abrirComTeclado = (linha: T) => (evento: KeyboardEvent<HTMLElement>) => {
    if (evento.target !== evento.currentTarget) return;
    if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault();
      onAbrirLinha?.(linha);
    }
  };
  const abrirComClique = (linha: T) => (evento: MouseEvent<HTMLElement>) => {
    if (!veioDeControle(evento)) onAbrirLinha?.(linha);
  };
  const propsDaLinha = (linha: T, indice: number) => ({
    ...(indice < LINHAS_ANIMADAS ? { 'data-linha-lista': true } : {}),
    ...(onAbrirLinha ? { tabIndex: 0, onClick: abrirComClique(linha), onKeyDown: abrirComTeclado(linha) } : {}),
  });
  const destaque = (linha: T, id: string) => cn(
    (linhaAtivaId === id || selecao?.marcados.has(id)) && 'bg-emerald-50/70',
    classeLinha?.(linha),
  );

  const caixaDaLinha = (linha: T, id: string) => selecao && (
    <input
      type="checkbox"
      className={CAIXA}
      aria-label={selecao.rotulo ? selecao.rotulo(linha) : `Marcar linha ${id}`}
      checked={selecao.marcados.has(id)}
      onChange={() => selecao.onAlternar(id)}
    />
  );
  const caixaDaPagina = selecao && (
    <input
      type="checkbox"
      className={CAIXA}
      aria-label={todosVisiveis ? 'Desmarcar os mostrados' : 'Marcar os mostrados'}
      checked={todosVisiveis}
      ref={elemento => { if (elemento) elemento.indeterminate = marcadosVisiveis > 0 && !todosVisiveis; }}
      onChange={() => selecao.onAlternarVarios(idsVisiveis, !todosVisiveis)}
      data-testid="tabela-marcar-mostrados"
    />
  );

  const celula = (coluna: ColunaTabela<T>, linha: T) => {
    const conteudo = coluna.render(linha);
    const dica = coluna.dica?.(linha) ?? textoDe(conteudo);
    return <div className="line-clamp-2 break-words" title={dica || undefined}>{conteudo ?? '—'}</div>;
  };

  const tabela = (
    <table className="w-full border-separate border-spacing-0 text-left text-[13px] text-slate-800">
      <caption className="sr-only">{titulo}</caption>
      <thead>
        <tr>
          {selecao && (
            <th scope="col" className="sticky top-0 z-[2] w-12 border-b border-slate-200 bg-[#f3f6f4] p-0">
              <label className="flex min-h-10 cursor-pointer items-center justify-center">{caixaDaPagina}</label>
            </th>
          )}
          {colunas.map(coluna => {
            const ativa = ordenacao?.chave === coluna.chave;
            const Seta = !ativa ? ChevronsUpDown : ordenacao!.direcao === 'asc' ? ArrowUp : ArrowDown;
            return (
              <th
                key={coluna.chave}
                scope="col"
                aria-sort={coluna.valorOrdenacao ? (ativa ? (ordenacao!.direcao === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
                style={coluna.larguraMinima ? { minWidth: coluna.larguraMinima } : undefined}
                className={cn(
                  'sticky top-0 z-[1] h-9 whitespace-nowrap border-b border-slate-200 bg-[#f3f6f4] px-3 text-xs font-bold uppercase tracking-wide text-[#53635c]',
                  ALINHAMENTO[coluna.alinhamento ?? 'esquerda'],
                )}
              >
                {coluna.valorOrdenacao ? (
                  <button
                    type="button"
                    onClick={() => ordenar(coluna.chave)}
                    className={cn('-mx-1 inline-flex min-h-8 items-center gap-1 rounded px-1 uppercase hover:text-slate-900', coluna.alinhamento === 'direita' && 'flex-row-reverse', FOCO)}
                  >
                    {coluna.titulo}
                    <Seta className={cn('size-3.5', ativa ? 'text-[#176b4d]' : 'text-slate-400')} aria-hidden="true" />
                  </button>
                ) : coluna.titulo}
              </th>
            );
          })}
          {acoes && (
            <th scope="col" className="sticky top-0 z-[1] h-9 whitespace-nowrap border-b border-slate-200 bg-[#f3f6f4] px-3 text-right text-[11px] font-bold uppercase tracking-wide text-[#53635c]">
              {tituloAcoes}
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {visiveis.map((linha, indice) => {
          const id = idsVisiveis[indice];
          return (
            <tr
              key={id}
              {...propsDaLinha(linha, indice)}
              className={cn(
                'h-10 bg-white transition-colors hover:bg-[#f0f4f1]',
                onAbrirLinha && `cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#176b4d]`,
                destaque(linha, id),
              )}
            >
              {selecao && (
                <td className="border-b border-slate-100 p-0">
                  <label className="flex min-h-10 cursor-pointer items-center justify-center">{caixaDaLinha(linha, id)}</label>
                </td>
              )}
              {colunas.map(coluna => (
                <td key={coluna.chave} className={cn('border-b border-slate-100 px-3 py-1.5 align-middle leading-snug', ALINHAMENTO[coluna.alinhamento ?? 'esquerda'])}>
                  {celula(coluna, linha)}
                </td>
              ))}
              {acoes && (
                <td className="border-b border-slate-100 px-3 py-1 text-right align-middle">
                  <div className="flex justify-end gap-1.5 whitespace-nowrap">{acoes(linha)}</div>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const camposCartao = colunasDoCartao(colunas);
  const cartoes = (
    <ul className="divide-y divide-slate-100" aria-label={titulo}>
      {visiveis.map((linha, indice) => {
        const id = idsVisiveis[indice];
        const [principal, ...resto] = camposCartao;
        return (
          <li
            key={id}
            {...propsDaLinha(linha, indice)}
            className={cn('flex items-start gap-1 bg-white', onAbrirLinha && `cursor-pointer active:bg-emerald-50 ${FOCO} focus-visible:-outline-offset-2`, destaque(linha, id))}
          >
            {selecao && <label className="flex min-h-14 w-12 shrink-0 cursor-pointer items-center justify-center">{caixaDaLinha(linha, id)}</label>}
            <div className={cn('min-w-0 flex-1 py-3 pr-4', !selecao && 'pl-4')}>
              {principal && <div className="text-base font-semibold leading-snug text-slate-900 [overflow-wrap:anywhere]">{principal.render(linha) ?? '—'}</div>}
              {resto.length > 0 && (
                <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {resto.map(coluna => (
                    <div key={coluna.chave} className="min-w-0">
                      <dt className="text-xs font-semibold text-slate-500">{coluna.titulo}</dt>
                      <dd className={cn('text-sm text-slate-800 [overflow-wrap:anywhere]', coluna.alinhamento === 'direita' && 'tabular-nums')}>{coluna.render(linha) ?? '—'}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {acoes && <div className="mt-2.5 flex flex-wrap gap-2">{acoes(linha)}</div>}
            </div>
          </li>
        );
      })}
    </ul>
  );

  const temLinhas = !carregando && linhas.length > 0;
  const mostrarRodape = temLinhas && !semPaginacao;

  return (
    <div className={cn('flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white', className)} data-testid={testId}>
      {carregando ? (
        <p role="status" className="px-4 py-10 text-center text-sm font-semibold text-slate-600">Carregando…</p>
      ) : linhas.length === 0 ? (
        typeof vazio === 'string'
          ? <p className="px-4 py-10 text-center text-sm font-semibold text-slate-600">{vazio}</p>
          : vazio
      ) : telaLarga ? (
        <div
          role="region"
          aria-label={titulo}
          tabIndex={0}
          className={cn('min-h-0 flex-1 overflow-auto overscroll-contain md:max-h-[var(--tabela-altura-max,calc(100dvh-7rem))]', FOCO, 'focus-visible:-outline-offset-2')}
        >
          {tabela}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">{cartoes}</div>
      )}

      {temLinhas && semPaginacao && (
        <p className="shrink-0 border-t border-slate-200 bg-[#f3f6f4] px-3 py-2 text-[13px] font-semibold tabular-nums text-slate-700">{contagem(linhas.length, nomeDoItem)}</p>
      )}
      {mostrarRodape && (
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-slate-200 bg-[#f3f6f4] px-3 py-2 text-[13px] text-slate-700">
          <p className="font-semibold tabular-nums" aria-live="polite">
            {fatia.totalPaginas === 1
              ? contagem(fatia.total, nomeDoItem)
              : `${(fatia.inicio + 1).toLocaleString('pt-BR')} a ${(fatia.inicio + visiveis.length).toLocaleString('pt-BR')} de ${contagem(fatia.total, nomeDoItem)}`}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {fatia.total > OPCOES_POR_PAGINA[0] && (
              <label className="flex items-center gap-2 font-semibold">
                Mostrar
                <select
                  value={porPagina}
                  onChange={evento => { setPorPagina(Number(evento.target.value)); irPara(1); }}
                  className={`min-h-11 rounded-lg border border-slate-300 bg-white px-2 text-[13px] text-slate-800 md:min-h-8 ${FOCO}`}
                >
                  {OPCOES_POR_PAGINA.map(opcao => <option key={opcao} value={opcao}>{opcao}</option>)}
                </select>
              </label>
            )}
            {fatia.totalPaginas > 1 && (
              <nav aria-label={`Páginas de ${titulo}`} className="flex items-center gap-1">
                <button type="button" className={BOTAO_PAGINA} disabled={fatia.pagina <= 1} onClick={() => irPara(fatia.pagina - 1)} aria-label="Página anterior">
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </button>
                {paginasVisiveis(fatia.pagina, fatia.totalPaginas).map(numero => (
                  <button
                    key={numero}
                    type="button"
                    onClick={() => irPara(numero)}
                    aria-current={numero === fatia.pagina ? 'page' : undefined}
                    aria-label={`Página ${numero}`}
                    className={cn(numero === fatia.pagina ? BOTAO_PAGINA_ATUAL : cn(BOTAO_PAGINA, 'max-sm:hidden'), 'tabular-nums')}
                  >
                    {numero}
                  </button>
                ))}
                <button type="button" className={BOTAO_PAGINA} disabled={fatia.pagina >= fatia.totalPaginas} onClick={() => irPara(fatia.pagina + 1)} aria-label="Próxima página">
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
              </nav>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
