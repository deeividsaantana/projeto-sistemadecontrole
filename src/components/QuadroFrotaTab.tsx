/**
 * Quadro da frota: todos os equipamentos da obra num dia só, cada um no
 * cartão da frente onde trabalhou, com operador, horímetro e situação.
 *
 * A tela só lê. Quem muda status, operador ou frente é o Controle de Frotas;
 * o botão principal leva para lá.
 */
import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { AlertTriangle, CalendarDays, ChevronDown, Gauge, PauseCircle, PlayCircle, Search, Truck, UserCheck, UserX, Wrench, X, type LucideIcon } from 'lucide-react';
import type { Abastecimento, ControleEquipamentoDiario, Equipamento, FrenteServico, GrupoEquipe } from '../types';
import { CountUp, Drawer, PageHeader, isoDay } from '../shared/ui';
import {
  FILTROS_VAZIOS,
  ROTULO_GRUPO,
  SEM_FRENTE,
  agruparPorFrente,
  calcularIndicadores,
  filtrarCartoes,
  montarQuadro,
  type CartaoFrota,
  type FiltrosQuadro,
  type GrupoStatus,
} from '../modules/frota/quadroFrota';
import { DesenhoMaquina } from './quadroFrota/DesenhoMaquina';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO } from './cadastros/estilos';

interface Props {
  equipamentos: readonly Equipamento[];
  registros: readonly ControleEquipamentoDiario[];
  gruposEquipe: readonly GrupoEquipe[];
  abastecimentos: readonly Abastecimento[];
  frentes: readonly FrenteServico[];
  onNavigate: (aba: string) => void;
}

/** Cor de cada situação: faixa do cartão, bolinha e etiqueta. */
const TOM: Record<GrupoStatus, { faixa: string; etiqueta: string; ponto: string }> = {
  operando: { faixa: 'bg-[#176b4d]', etiqueta: 'bg-emerald-50 text-emerald-800 ring-emerald-200', ponto: 'bg-emerald-500' },
  manutencao: { faixa: 'bg-rose-600', etiqueta: 'bg-rose-50 text-rose-800 ring-rose-200', ponto: 'bg-rose-500' },
  parado: { faixa: 'bg-amber-400', etiqueta: 'bg-amber-50 text-amber-800 ring-amber-200', ponto: 'bg-amber-400' },
  'sem-lancamento': { faixa: 'bg-slate-300', etiqueta: 'bg-slate-100 text-slate-600 ring-slate-200', ponto: 'bg-slate-400' },
};

const numero = (valor: number) => valor.toLocaleString('pt-BR');
const dataLonga = (dia: string) => new Date(`${dia}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

interface Indicador {
  id: string;
  titulo: string;
  valor: number;
  sufixo?: string;
  detalhe: string;
  Icone: LucideIcon;
  tom: string;
  /** Filtro que o cartão liga ao ser tocado. */
  filtro?: Partial<FiltrosQuadro>;
}

function CartaoEquipamento({ cartao, onAbrir }: { cartao: CartaoFrota; onAbrir: () => void }) {
  const tom = TOM[cartao.grupo];
  return (
    <button
      type="button"
      onClick={onAbrir}
      data-quadro-cartao
      data-testid={`quadro-cartao-${cartao.prefixo}`}
      className={`group relative flex min-h-44 flex-col items-center overflow-hidden rounded-xl border border-slate-200 bg-white px-2 pb-2.5 pt-3 text-center shadow-[0_1px_2px_rgba(15,40,31,0.04)] transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[0_10px_24px_-12px_rgba(15,40,31,0.25)] active:scale-[0.98] ${FOCO}`}
    >
      <span className={`absolute inset-x-0 top-0 h-1 ${tom.faixa}`} aria-hidden="true" />
      {!cartao.operador && (
        <span className="absolute left-2 top-2.5 size-2 rounded-full bg-[#f26a2e]" title="Sem operador" aria-hidden="true" />
      )}
      <span className="grid h-14 w-full place-items-center">
        {cartao.foto
          ? <img src={cartao.foto} alt="" className="h-14 w-full rounded-md object-contain" loading="lazy" />
          : <DesenhoMaquina tipo={cartao.silhueta} className="h-14 w-24 transition duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105" />}
      </span>
      <strong className="mt-2 font-mono text-[15px] font-bold tracking-tight text-slate-900">{cartao.prefixo}</strong>
      <span className="line-clamp-1 w-full text-[10px] font-semibold uppercase tracking-wide text-slate-500">{cartao.modelo}</span>
      <span className="mt-0.5 font-mono text-[10px] text-slate-400">{cartao.horimetro ? `${numero(cartao.horimetro)} h` : ' '}</span>
      <span className={`mt-1 line-clamp-1 w-full text-[10px] font-bold uppercase ${cartao.operador ? 'text-slate-700' : 'italic font-medium normal-case text-slate-400'}`}>
        {cartao.operador ? <><span className="mr-1 inline-block size-1.5 rounded-full bg-emerald-500 align-middle" aria-hidden="true" />{cartao.operador.split(' ')[0]}</> : 'sem operador'}
      </span>
      <span className={`mt-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset ${tom.etiqueta}`}>
        <span className={`size-1.5 rounded-full ${tom.ponto}`} aria-hidden="true" />
        {ROTULO_GRUPO[cartao.grupo]}
      </span>
    </button>
  );
}

export default function QuadroFrotaTab({ equipamentos, registros, gruposEquipe, abastecimentos, frentes, onNavigate }: Props) {
  const escopo = useRef<HTMLDivElement>(null);
  const [dia, setDia] = useState(() => isoDay(new Date()));
  const [filtros, setFiltros] = useState<FiltrosQuadro>(FILTROS_VAZIOS);
  const [fechadas, setFechadas] = useState<ReadonlySet<string>>(() => new Set());
  const [aberto, setAberto] = useState<CartaoFrota | null>(null);

  const cartoes = useMemo(
    () => montarQuadro({ dia, equipamentos, registros, gruposEquipe, abastecimentos }),
    [dia, equipamentos, registros, gruposEquipe, abastecimentos],
  );
  const indicadores = useMemo(() => calcularIndicadores(cartoes), [cartoes]);
  const filtrados = useMemo(() => filtrarCartoes(cartoes, filtros), [cartoes, filtros]);
  // Frente cadastrada e em andamento aparece mesmo vazia, para ver onde falta máquina.
  const frentesAtivas = useMemo(
    () => frentes.filter(item => item.ativo !== false && item.situacao !== 'Concluída').map(item => item.nome),
    [frentes],
  );
  const colunas = useMemo(
    () => agruparPorFrente(filtrados, filtros.frente || filtros.grupo || filtros.tipo || filtros.operador || filtros.busca ? [] : frentesAtivas),
    [filtrados, filtros, frentesAtivas],
  );
  const opcoesFrente = useMemo(() => Array.from(new Set([...frentesAtivas, ...cartoes.map(item => item.frente)])).sort((a, b) => a.localeCompare(b, 'pt-BR')), [cartoes, frentesAtivas]);
  const opcoesTipo = useMemo(() => Array.from(new Set(cartoes.map(item => item.tipo))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [cartoes]);
  const filtrando = Object.values(filtros).some(Boolean);

  const lista: Indicador[] = [
    { id: 'total', titulo: 'Total', valor: indicadores.total, detalhe: 'equipamentos', Icone: Truck, tom: 'bg-slate-100 text-slate-700', filtro: FILTROS_VAZIOS },
    { id: 'operando', titulo: 'Operando', valor: indicadores.operando, detalhe: 'em operação', Icone: PlayCircle, tom: 'bg-emerald-50 text-[#176b4d]', filtro: { grupo: 'operando' } },
    { id: 'manutencao', titulo: 'Manutenção', valor: indicadores.manutencao, detalhe: 'em reparo', Icone: Wrench, tom: 'bg-rose-50 text-rose-700', filtro: { grupo: 'manutencao' } },
    { id: 'parado', titulo: 'Parados', valor: indicadores.parado, detalhe: 'sem operação', Icone: PauseCircle, tom: 'bg-amber-50 text-amber-700', filtro: { grupo: 'parado' } },
    { id: 'sem-lancamento', titulo: 'Sem lançamento', valor: indicadores.semLancamento, detalhe: 'não lançados no dia', Icone: AlertTriangle, tom: 'bg-slate-100 text-slate-600', filtro: { grupo: 'sem-lancamento' } },
    { id: 'disponibilidade', titulo: 'Disponibilidade', valor: indicadores.disponibilidade ?? 0, sufixo: indicadores.disponibilidade === null ? '' : '%', detalhe: indicadores.disponibilidade === null ? 'sem lançamento no dia' : 'frota disponível', Icone: Gauge, tom: 'bg-sky-50 text-sky-700' },
    { id: 'com-operador', titulo: 'Com operador', valor: indicadores.comOperador, detalhe: 'operadores no dia', Icone: UserCheck, tom: 'bg-emerald-50 text-[#176b4d]', filtro: { operador: 'com' } },
    { id: 'sem-operador', titulo: 'Sem operador', valor: indicadores.semOperador, detalhe: 'aguardando', Icone: UserX, tom: 'bg-orange-50 text-[#f26a2e]', filtro: { operador: 'sem' } },
  ];

  const mudar = (parcial: Partial<FiltrosQuadro>) => setFiltros(atual => ({ ...atual, ...parcial }));
  const alternarColuna = (frente: string) => setFechadas(atual => {
    const proximo = new Set(atual);
    if (proximo.has(frente)) proximo.delete(frente);
    else proximo.add(frente);
    return proximo;
  });

  useGSAP(() => {
    const raiz = escopo.current;
    if (!raiz || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(raiz.querySelectorAll('[data-quadro-reveal]'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.04, ease: 'power3.out', clearProps: 'transform,opacity' });
    gsap.fromTo(raiz.querySelectorAll('[data-quadro-cartao]'), { opacity: 0, y: 10, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.4, stagger: { each: 0.012, from: 'start' }, ease: 'power2.out', delay: 0.15, clearProps: 'transform,opacity' });
  }, { scope: escopo, dependencies: [dia, filtros] });

  return (
    <div ref={escopo} id="quadro-frota-tab" data-testid="quadro-frota-tab" className="space-y-4">
      <div data-quadro-reveal>
        <PageHeader
          eyebrow="Frota"
          title="Quadro da frota"
          description="Todos os equipamentos do dia, cada um na frente onde trabalhou. Toque num cartão para ver o detalhe."
          actions={<div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <label className="relative flex w-full min-w-0 items-center sm:inline-flex sm:w-auto">
              <span className="sr-only">Dia do quadro</span>
              <CalendarDays className="pointer-events-none absolute left-3 size-4 text-slate-400" aria-hidden="true" />
              <input type="date" value={dia} onChange={event => setDia(event.target.value || isoDay(new Date()))} className={`${CAMPO} min-w-0 pl-9 sm:w-auto font-semibold`} data-testid="quadro-dia" />
            </label>
            <button type="button" onClick={() => onNavigate('controle-equipamentos')} className={`${BOTAO_PRIMARIO} w-full px-5 max-sm:order-first sm:w-auto`} data-testid="quadro-acao-principal">
              <Truck className="size-5" aria-hidden="true" />
              Lançar no Controle de Frotas
            </button>
          </div>}
        />
        <p className="-mt-1 text-sm font-semibold text-slate-500 first-letter:uppercase">{dataLonga(dia)}</p>
      </div>

      <section aria-label="Resumo da frota no dia" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 2xl:grid-cols-8">
        {lista.map(item => {
          const ativo = item.filtro && Object.entries(item.filtro).every(([chave, valor]) => filtros[chave as keyof FiltrosQuadro] === valor) && item.id !== 'total';
          const conteudo = (
            <>
              <span className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{item.titulo}</span>
                <span className={`grid size-8 shrink-0 place-items-center rounded-full ${item.tom}`}><item.Icone className="size-4" aria-hidden="true" /></span>
              </span>
              <CountUp value={item.valor} suffix={item.sufixo} className="mt-1 block text-3xl font-bold tabular-nums text-slate-900" />
              <span className="block text-xs text-slate-500">{item.detalhe}</span>
            </>
          );
          const classe = `${CARTAO} flex min-h-28 flex-col p-3.5 text-left transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${ativo ? 'border-[#176b4d] ring-2 ring-[#176b4d]/15' : ''}`;
          return item.filtro ? (
            <button key={item.id} type="button" data-quadro-reveal data-testid={`quadro-indicador-${item.id}`} aria-pressed={ativo || undefined} onClick={() => setFiltros(ativo ? FILTROS_VAZIOS : { ...FILTROS_VAZIOS, ...item.filtro })} className={`${classe} hover:-translate-y-0.5 hover:border-emerald-300 active:scale-[0.98] ${FOCO}`}>
              {conteudo}
            </button>
          ) : (
            <div key={item.id} data-quadro-reveal data-testid={`quadro-indicador-${item.id}`} className={classe}>{conteudo}</div>
          );
        })}
      </section>

      <section aria-label="Filtros do quadro" data-quadro-reveal className={`${CARTAO} flex flex-wrap items-center gap-2 p-3 lg:sticky lg:top-0 lg:z-10`}>
        <label className="relative min-w-0 flex-[1_1_14rem]">
          <span className="sr-only">Buscar prefixo, modelo ou operador</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input value={filtros.busca} onChange={event => mudar({ busca: event.target.value })} placeholder="Buscar prefixo, modelo ou operador" className={`${CAMPO} pl-9`} data-testid="quadro-busca" />
        </label>
        <select value={filtros.frente} onChange={event => mudar({ frente: event.target.value })} aria-label="Frente" className={`${CAMPO} flex-[1_1_10rem] sm:w-auto`}>
          <option value="">Todas as frentes</option>
          {opcoesFrente.map(frente => <option key={frente} value={frente}>{frente}</option>)}
        </select>
        <select value={filtros.grupo} onChange={event => mudar({ grupo: event.target.value as GrupoStatus | '' })} aria-label="Situação" className={`${CAMPO} flex-[1_1_9rem] sm:w-auto`}>
          <option value="">Todas as situações</option>
          {(Object.keys(ROTULO_GRUPO) as GrupoStatus[]).map(grupo => <option key={grupo} value={grupo}>{ROTULO_GRUPO[grupo]}</option>)}
        </select>
        <select value={filtros.tipo} onChange={event => mudar({ tipo: event.target.value })} aria-label="Tipo" className={`${CAMPO} flex-[1_1_9rem] sm:w-auto`}>
          <option value="">Todos os tipos</option>
          {opcoesTipo.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
        </select>
        <select value={filtros.operador} onChange={event => mudar({ operador: event.target.value as FiltrosQuadro['operador'] })} aria-label="Operador" className={`${CAMPO} flex-[1_1_9rem] sm:w-auto`}>
          <option value="">Com e sem operador</option>
          <option value="com">Com operador</option>
          <option value="sem">Sem operador</option>
        </select>
        {filtrando && (
          <button type="button" onClick={() => setFiltros(FILTROS_VAZIOS)} className={`${BOTAO_SECUNDARIO} flex-none`} data-testid="quadro-limpar">
            <X className="size-4" aria-hidden="true" />
            Limpar
          </button>
        )}
      </section>

      {cartoes.length === 0 ? (
        <div data-quadro-reveal className={`${CARTAO} grid place-items-center gap-2 px-6 py-14 text-center`}>
          <Truck className="size-8 text-slate-300" aria-hidden="true" />
          <p className="text-base font-bold text-slate-800">Nenhum equipamento cadastrado</p>
          <p className="max-w-md text-sm text-slate-500">Cadastre os equipamentos em Cadastros. Eles aparecem aqui assim que entram na obra.</p>
          <button type="button" onClick={() => onNavigate('cadastros')} className={`${BOTAO_SECUNDARIO} mt-2`}>Abrir Cadastros</button>
        </div>
      ) : colunas.length === 0 ? (
        <div data-quadro-reveal className={`${CARTAO} grid place-items-center gap-2 px-6 py-12 text-center`}>
          <p className="text-base font-bold text-slate-800">Nenhum equipamento com esses filtros</p>
          <button type="button" onClick={() => setFiltros(FILTROS_VAZIOS)} className={BOTAO_SECUNDARIO}>Limpar filtros</button>
        </div>
      ) : (
        <div className="grid items-start gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,24rem),1fr))]" data-testid="quadro-colunas">
          {colunas.map(coluna => {
            const fechada = fechadas.has(coluna.frente);
            const semFrente = coluna.frente === SEM_FRENTE;
            return (
              <section key={coluna.frente} data-quadro-reveal aria-label={`Frente ${coluna.frente}`} data-testid="quadro-coluna" className="overflow-hidden rounded-2xl border border-slate-200 bg-[#f7f8f6]">
                <header className="flex items-center gap-2.5 border-b border-slate-200 bg-white px-4 py-3">
                  <span className={`size-2.5 shrink-0 rounded-full ${semFrente ? 'bg-slate-300' : 'bg-[#176b4d]'}`} aria-hidden="true" />
                  <h2 className="min-w-0 truncate text-sm font-bold uppercase tracking-wide text-slate-900">{coluna.frente}</h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-700">{coluna.cartoes.length}</span>
                  {coluna.cartoes.length > 0 && (
                    <span className="text-xs font-semibold text-slate-500 max-sm:hidden">{coluna.operando} operando</span>
                  )}
                  <button
                    type="button"
                    onClick={() => alternarColuna(coluna.frente)}
                    aria-expanded={!fechada}
                    aria-label={fechada ? `Mostrar ${coluna.frente}` : `Esconder ${coluna.frente}`}
                    className={`ml-auto grid size-11 place-items-center rounded-xl border border-slate-200 text-slate-500 transition duration-200 hover:border-emerald-400 hover:text-[#176b4d] ${FOCO}`}
                  >
                    <ChevronDown className={`size-4 transition duration-300 ${fechada ? '-rotate-90' : ''}`} aria-hidden="true" />
                  </button>
                </header>
                {!fechada && (
                  coluna.cartoes.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm text-slate-400">Sem equipamentos nesta frente hoje</p>
                  ) : (
                    <div className="grid gap-2 p-2.5 [grid-template-columns:repeat(auto-fill,minmax(7.25rem,1fr))]">
                      {coluna.cartoes.map(cartao => <CartaoEquipamento key={cartao.equipamentoId} cartao={cartao} onAbrir={() => setAberto(cartao)} />)}
                    </div>
                  )
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Portal: a animação de entrada da aba deixa transform na raiz, e o painel fixo ficaria preso a ela. */}
      {createPortal(<Drawer
        open={Boolean(aberto)}
        onClose={() => setAberto(null)}
        title={aberto ? `${aberto.prefixo} · ${aberto.modelo}` : ''}
        description={aberto ? aberto.tipo : undefined}
        footer={aberto && (
          <button type="button" onClick={() => { setAberto(null); onNavigate('controle-equipamentos'); }} className={`${BOTAO_PRIMARIO} w-full`}>
            Alterar no Controle de Frotas
          </button>
        )}
      >
        {aberto && (
          <div className="space-y-4">
            <div className="grid place-items-center rounded-2xl border border-slate-200 bg-[#f7f8f6] p-4">
              {aberto.foto
                ? <img src={aberto.foto} alt={`Foto do ${aberto.prefixo}`} className="max-h-40 rounded-lg object-contain" />
                : <DesenhoMaquina tipo={aberto.silhueta} className="h-28 w-48" />}
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Situação', aberto.status],
                ['Frente', aberto.frente],
                ['Operador', aberto.operador || 'Sem operador'],
                ['Horímetro', aberto.horimetro ? `${numero(aberto.horimetro)} h` : 'Sem abastecimento com horímetro'],
                ...(aberto.motivoManutencao ? [['Motivo da manutenção', aberto.motivoManutencao]] : []),
                ...(aberto.observacao ? [['Observação', aberto.observacao]] : []),
              ].map(([rotulo, valor]) => (
                <div key={rotulo} className={`rounded-xl border border-slate-200 bg-white p-3 ${String(valor).length > 28 ? 'col-span-2' : ''}`}>
                  <dt className="text-xs font-semibold text-slate-500">{rotulo}</dt>
                  <dd className="mt-0.5 font-bold text-slate-900">{valor}</dd>
                </div>
              ))}
            </dl>
            {aberto.grupo === 'sem-lancamento' && (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
                Este equipamento não foi lançado no Controle de Frotas neste dia. Lance para ele aparecer na frente certa.
              </p>
            )}
          </div>
        )}
      </Drawer>, document.body)}
    </div>
  );
}
