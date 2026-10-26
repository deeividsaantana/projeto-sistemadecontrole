import { useEffect, useId, useRef, type ComponentType, type KeyboardEvent } from 'react';
import { cn } from './styles';

/**
 * Subtelas de uma aba (A3/M1 da auditoria de 21/10/2026): um jeito só de
 * trocar de subtela no sistema inteiro, sempre no topo (sem menu lateral
 * interno). Fica no cabeçalho da TelaCheia, ao lado do título, com o visual
 * das abas do topo do Controle de Frotas e da Presença: faixa branca com
 * borda e a aba aberta em verde cheio.
 *
 * Muitas subtelas (Materiais, Estacas e Cadastros têm 17-18): agrupe com
 * `{ grupo, rotulo, abas }`. A primeira linha mostra os grupos (e as abas
 * soltas); a segunda linha, logo abaixo, mostra só as abas do grupo aberto.
 * Tocar num grupo abre a última aba usada nele (ou a primeira). Assim 18
 * subtelas cabem a 1366 px sem rolagem lateral.
 *
 * Acessibilidade: cada linha é um role=tablist com aria-selected; só a aba
 * ativa de cada linha entra no Tab do teclado, e as setas (Home/End também)
 * andam entre as abas da linha e já abrem a escolhida. No celular cada linha
 * rola na horizontal por conta própria e leva a aba ativa para a vista; no
 * computador a linha quebra em vez de rolar. A página nunca rola para o lado.
 */
type Icone = ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;

export interface AbaDaTela<T extends string = string> {
  id: T;
  rotulo: string;
  /** Nome curto para o celular (abaixo de 640 px). Sem ele, usa o rótulo. */
  curto?: string;
  icone?: Icone;
  /** Número do selo (ex.: quantos faltam). Zero ou vazio não mostra selo. */
  contador?: number;
  /** O que o número quer dizer, lido pelo leitor de tela: "a confirmar". */
  contadorRotulo?: string;
  /**
   * `alerta` (padrão): selo laranja, o número pede atenção e soma no grupo.
   * `neutro`: selo cinza, só o total da subtela (ex.: quantos cadastros);
   * não soma no grupo, porque somar totais de listas que se repetem engana.
   */
  tom?: 'alerta' | 'neutro';
  /** data-testid do botão; sem ele fica `${testId}-${id}` quando o grupo tem testId. */
  testId?: string;
}

/** Grupo de subtelas: vira uma aba na primeira linha e abre a segunda linha. */
export interface GrupoDeAbas<T extends string = string> {
  grupo: string;
  rotulo: string;
  curto?: string;
  icone?: Icone;
  abas: ReadonlyArray<AbaDaTela<T>>;
}

export type ItemDasAbas<T extends string = string> = AbaDaTela<T> | GrupoDeAbas<T>;

const ehGrupo = <T extends string>(item: ItemDasAbas<T>): item is GrupoDeAbas<T> => 'grupo' in item;

interface AbasDaTelaProps<T extends string> {
  abas: ReadonlyArray<ItemDasAbas<T>>;
  ativa: T;
  onTrocar: (id: T) => void;
  /** Nome do grupo para o leitor de tela: "Subtelas do controle de frotas". */
  rotulo: string;
  /** Base dos ids das abas; a TelaCheia usa `idDaAba(id, ativa)` para ligar a área de dados à aba. */
  id?: string;
  /** id da área que as abas controlam (aria-controls). */
  idPainel?: string;
  className?: string;
  testId?: string;
}

/** id do botão de uma aba, para a área de dados apontar com aria-labelledby. */
export const idDaAba = (base: string, aba: string) => `${base}-aba-${aba}`;

/** Mesmo foco das outras ações do sistema (cadastros/estilos.ts, FOCO). */
const FOCO = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--renea-focus)';

interface BotaoDaLinha {
  chave: string;
  idBotao: string;
  rotulo: string;
  curto?: string;
  icone?: Icone;
  contador: number;
  contadorRotulo?: string;
  tom?: 'alerta' | 'neutro';
  testId?: string;
  selecionada: boolean;
  controla?: string;
  escolher: () => void;
}

/** Uma linha de abas (role=tablist) com setas, rolagem própria no celular e selo. */
function LinhaDeAbas({ botoes, rotulo, testId, secundaria = false }: { botoes: BotaoDaLinha[]; rotulo: string; testId?: string; secundaria?: boolean }) {
  const listaRef = useRef<HTMLDivElement>(null);
  const ativa = botoes.find(botao => botao.selecionada)?.chave;

  // No celular a aba escolhida pode estar fora da faixa: traz para a vista
  // sem mexer na rolagem vertical da página.
  useEffect(() => {
    const lista = listaRef.current;
    const botao = lista?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!lista || !botao || lista.scrollWidth <= lista.clientWidth) return;
    const esquerda = botao.offsetLeft - lista.offsetLeft;
    if (esquerda < lista.scrollLeft || esquerda + botao.offsetWidth > lista.scrollLeft + lista.clientWidth) {
      lista.scrollTo({ left: Math.max(0, esquerda - 8) });
    }
  }, [ativa]);

  const teclar = (event: KeyboardEvent<HTMLDivElement>) => {
    const indice = Math.max(0, botoes.findIndex(botao => botao.selecionada));
    let proximo = -1;
    if (event.key === 'ArrowRight') proximo = (indice + 1) % botoes.length;
    else if (event.key === 'ArrowLeft') proximo = (indice - 1 + botoes.length) % botoes.length;
    else if (event.key === 'Home') proximo = 0;
    else if (event.key === 'End') proximo = botoes.length - 1;
    if (proximo < 0) return;
    event.preventDefault();
    botoes[proximo].escolher();
    listaRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[proximo]?.focus();
  };

  return (
    <div
      ref={listaRef}
      role="tablist"
      aria-label={rotulo}
      aria-orientation="horizontal"
      onKeyDown={teclar}
      data-testid={testId}
      className={cn(
        'renea-abas flex w-full max-w-full min-w-0 items-center gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:thin] md:w-auto lg:flex-wrap lg:overflow-visible',
        secundaria ? 'renea-abas--grupo px-1' : 'rounded-xl bg-white p-1 ring-1 ring-inset ring-slate-200',
      )}
    >
      {botoes.map(botao => {
        const Icone = botao.icone;
        return (
          <button
            key={botao.chave}
            id={botao.idBotao}
            type="button"
            role="tab"
            aria-selected={botao.selecionada}
            aria-controls={botao.controla}
            tabIndex={botao.selecionada ? 0 : -1}
            onClick={botao.escolher}
            data-testid={botao.testId}
            className={cn(
              'relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap px-3 text-sm font-bold transition duration-200 md:flex-none',
              secundaria
                ? cn('min-h-11 rounded-none border-b-2 lg:min-h-9', botao.selecionada ? 'border-[#176b4d] text-[#176b4d]' : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900')
                : cn('min-h-11 flex-1 rounded-lg lg:min-h-10', botao.selecionada ? 'bg-[#176b4d] text-white' : 'text-slate-600 hover:bg-emerald-50 hover:text-slate-900'),
              FOCO,
            )}
          >
            {Icone && <Icone className="hidden size-4 shrink-0 sm:block" aria-hidden="true" />}
            {botao.curto ? <>
              <span className="sm:hidden">{botao.curto}</span>
              <span className="hidden sm:inline">{botao.rotulo}</span>
            </> : <span>{botao.rotulo}</span>}
            {botao.contador > 0 && <>
              <span aria-hidden="true" className={cn('min-w-5 rounded-full px-1.5 text-center text-xs font-bold leading-5 tabular-nums', botao.tom === 'neutro'
                ? (botao.selecionada ? (secundaria ? 'bg-emerald-50 text-[#176b4d]' : 'bg-white text-[#176b4d]') : 'bg-slate-100 text-slate-700')
                : (botao.selecionada && !secundaria ? 'bg-white text-[#176b4d]' : 'bg-[#c2410c] text-white'))}>{botao.contador.toLocaleString('pt-BR')}</span>
              <span className="sr-only">, {botao.contador} {botao.contadorRotulo ?? ''}</span>
            </>}
          </button>
        );
      })}
    </div>
  );
}

const contadorDe = (valor?: number) => (valor && valor > 0 ? valor : 0);

export function AbasDaTela<T extends string>({ abas, ativa, onTrocar, rotulo, id, idPainel, className, testId }: AbasDaTelaProps<T>) {
  const automatico = useId();
  const base = id ?? automatico;
  /** Última aba aberta em cada grupo: voltar ao grupo volta para ela. */
  const ultimaDoGrupo = useRef(new Map<string, T>());
  const grupoAtivo = abas.find((item): item is GrupoDeAbas<T> => ehGrupo(item) && item.abas.some(aba => aba.id === ativa));
  if (grupoAtivo) ultimaDoGrupo.current.set(grupoAtivo.grupo, ativa);

  const botaoDaAba = (aba: AbaDaTela<T>): BotaoDaLinha => ({
    chave: aba.id,
    idBotao: idDaAba(base, aba.id),
    rotulo: aba.rotulo,
    curto: aba.curto,
    icone: aba.icone,
    contador: contadorDe(aba.contador),
    contadorRotulo: aba.contadorRotulo,
    tom: aba.tom,
    testId: aba.testId ?? (testId ? `${testId}-${aba.id}` : undefined),
    selecionada: aba.id === ativa,
    controla: idPainel,
    escolher: () => onTrocar(aba.id),
  });

  const primeiraLinha = abas.map((item): BotaoDaLinha => {
    if (!ehGrupo(item)) return botaoDaAba(item);
    const total = item.abas.reduce((soma, aba) => soma + (aba.tom === 'neutro' ? 0 : contadorDe(aba.contador)), 0);
    return {
      chave: `grupo-${item.grupo}`,
      // Grupo de uma aba só não abre segunda linha: o botão do grupo é a própria aba.
      idBotao: item.abas.length === 1 ? idDaAba(base, item.abas[0].id) : `${base}-grupo-${item.grupo}`,
      controla: item.abas.length === 1 ? idPainel : undefined,
      rotulo: item.rotulo,
      curto: item.curto,
      icone: item.icone,
      // Grupo de uma aba só mostra o selo da própria aba, com o mesmo tom.
      ...(item.abas.length === 1
        ? { contador: contadorDe(item.abas[0].contador), contadorRotulo: item.abas[0].contadorRotulo, tom: item.abas[0].tom }
        : { contador: total, contadorRotulo: 'no grupo' }),
      testId: testId ? `${testId}-grupo-${item.grupo}` : undefined,
      selecionada: item === grupoAtivo,
      escolher: () => {
        const destino = ultimaDoGrupo.current.get(item.grupo) ?? item.abas[0]?.id;
        if (destino) onTrocar(destino);
      },
    };
  });

  return (
    <div className={cn('renea-abas-da-tela flex min-w-0 max-w-full flex-col items-start gap-1', className)}>
      <LinhaDeAbas botoes={primeiraLinha} rotulo={rotulo} testId={testId} />
      {grupoAtivo && grupoAtivo.abas.length > 1 && (
        <LinhaDeAbas secundaria botoes={grupoAtivo.abas.map(botaoDaAba)} rotulo={`${rotulo}: ${grupoAtivo.rotulo}`} testId={testId ? `${testId}-grupo` : undefined} />
      )}
    </div>
  );
}
