/**
 * Quadro da frota: todas as máquinas do dia, separadas por canteiro, para
 * atualizar na hora. Tocar no cartão abre o painel que lança situação,
 * canteiro, frente e operador no mesmo formato do Controle de Frotas.
 *
 * A vista Lançar mostra as mesmas máquinas em lista, uma por linha, para
 * lançar, mover de canteiro e excluir o lançamento do dia de várias de uma vez.
 *
 * Teclas, fora de campo de texto: / busca, ? atalhos, A atualizar pendentes,
 * V troca Quadro e Lançar, 1 a 4 filtram a situação, L limpa os filtros.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronDown, Fuel, Gauge, Keyboard, LayoutGrid, ListChecks, ListFilter, PauseCircle, PlayCircle, Search, SlidersHorizontal, Truck, UserCheck, UserX, Wrench, X, type LucideIcon } from 'lucide-react';
import type { Abastecimento, ControleEquipamentoDiario, Equipamento, FrenteServico, Funcionario, GrupoEquipe } from '../types';
import { CountUp, Modal, PageHeader, isoDay } from '../shared/ui';
import {
  CANTEIROS,
  FILTROS_VAZIOS,
  ROTULO_GRUPO,
  ROTULO_ORDEM,
  SEM_CANTEIRO,
  agruparPorCanteiro,
  calcularIndicadores,
  etiquetasDosFiltros,
  filtrarCartoes,
  montarQuadro,
  registroDaEdicao,
  type CartaoFrota,
  type EdicaoQuadro,
  type FiltrosQuadro,
  type GrupoStatus,
  type Ordem,
} from '../modules/frota/quadroFrota';
import { abastecidasSemLancamento } from '../modules/frota/combustivelDoDia';
import { OPERATIONAL_DRIVERS } from '../fleet/operationalDrivers';
import { CartaoEquipamento } from './quadroFrota/CartaoEquipamento';
import { LancarFrota } from './quadroFrota/LancarFrota';
import { PainelEquipamento } from './quadroFrota/PainelEquipamento';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO } from './cadastros/estilos';

interface Props {
  equipamentos: readonly Equipamento[];
  registros: readonly ControleEquipamentoDiario[];
  gruposEquipe: readonly GrupoEquipe[];
  abastecimentos: readonly Abastecimento[];
  frentes: readonly FrenteServico[];
  funcionarios: readonly Funcionario[];
  /** Motoristas e operadores cadastrados no Controle de Frotas; mesma lista das três abas. */
  operationalDrivers?: readonly Funcionario[];
  podeEditar: boolean;
  usuario: string;
  onSave: (registro: ControleEquipamentoDiario, novo: boolean) => void;
  onSaveMany: (itens: Array<{ registro: ControleEquipamentoDiario; novo: boolean }>) => void;
  onDeleteMany: (ids: string[]) => void;
  onNavigate: (aba: string) => void;
}

const dataLonga = (dia: string) => new Date(`${dia}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const horaAgora = () => new Date().toTimeString().slice(0, 5);

const ATALHOS: ReadonlyArray<{ teclas: string; oQueFaz: string; editar?: boolean }> = [
  { teclas: 'A', oQueFaz: 'Atualizar as máquinas sem lançamento, uma atrás da outra', editar: true },
  { teclas: 'V', oQueFaz: 'Trocar entre o quadro e a lista de lançamento', editar: true },
  { teclas: '/', oQueFaz: 'Buscar máquina' },
  { teclas: '1 a 4', oQueFaz: 'Mostrar só operando, manutenção, parados ou sem lançamento' },
  { teclas: 'L', oQueFaz: 'Limpar os filtros' },
  { teclas: 'O, M, P', oQueFaz: 'No painel da máquina: operando, manutenção ou parado', editar: true },
  { teclas: 'Shift+Enter', oQueFaz: 'No painel da máquina: salvar e abrir a próxima', editar: true },
  { teclas: '?', oQueFaz: 'Mostrar esta lista' },
];

type Vista = 'quadro' | 'lancar';
const CHAVE_VISTA = 'renea_quadro_frota_vista';
const vistaGuardada = (): Vista => {
  try {
    return window.localStorage.getItem(CHAVE_VISTA) === 'lancar' ? 'lancar' : 'quadro';
  } catch {
    return 'quadro';
  }
};

const GRUPO_DA_TECLA: Record<string, GrupoStatus> = { 1: 'operando', 2: 'manutencao', 3: 'parado', 4: 'sem-lancamento' };

interface Indicador {
  id: string;
  titulo: string;
  valor: number;
  sufixo?: string;
  detalhe: string;
  Icone: LucideIcon;
  tom: string;
  filtro?: Partial<FiltrosQuadro>;
  aoClicar?: () => void;
}

export default function QuadroFrotaTab({ equipamentos, registros, gruposEquipe, abastecimentos, frentes, funcionarios, operationalDrivers, podeEditar, usuario, onSave, onSaveMany, onDeleteMany, onNavigate }: Props) {
  const escopo = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  // Mesma lista de motoristas e operadores do Controle de Frotas, para o operador
  // sugerido aqui ser sempre o mesmo cadastro, sem duplicar em colaboradores.
  const motoristas = useMemo(() => operationalDrivers || funcionarios || OPERATIONAL_DRIVERS, [operationalDrivers, funcionarios]);
  const [dia, setDia] = useState(() => isoDay(new Date()));
  const [filtros, setFiltros] = useState<FiltrosQuadro>(FILTROS_VAZIOS);
  const [ordem, setOrdem] = useState<Ordem>('prefixo');
  const [maisFiltros, setMaisFiltros] = useState(false);
  const [fechados, setFechados] = useState<ReadonlySet<string>>(() => new Set());
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [atalhosAberto, setAtalhosAberto] = useState(false);
  const [aviso, setAviso] = useState('');
  const [vistaEscolhida, setVistaEscolhida] = useState<Vista>(vistaGuardada);
  const vista: Vista = podeEditar ? vistaEscolhida : 'quadro';
  const trocarVista = (nova: Vista) => {
    setVistaEscolhida(nova);
    try {
      window.localStorage.setItem(CHAVE_VISTA, nova);
    } catch {
      // Sem memória do aparelho a escolha vale só nesta visita.
    }
  };

  const cartoes = useMemo(
    () => montarQuadro({ dia, equipamentos, registros, gruposEquipe, abastecimentos }),
    [dia, equipamentos, registros, gruposEquipe, abastecimentos],
  );
  const indicadores = useMemo(() => calcularIndicadores(cartoes), [cartoes]);
  const filtrados = useMemo(() => filtrarCartoes(cartoes, filtros, ordem), [cartoes, filtros, ordem]);
  const filtrando = Object.values(filtros).some(Boolean);
  const grupos = useMemo(() => agruparPorCanteiro(filtrados, !filtrando), [filtrados, filtrando]);
  // Ordem em que a tela mostra as máquinas: é a ordem do "Salvar e próximo".
  const naTela = useMemo(() => grupos.filter(grupo => !fechados.has(grupo.canteiro)).flatMap(grupo => grupo.cartoes), [grupos, fechados]);
  const contagemCanteiro = useMemo(() => {
    const mapa = new Map<string, number>();
    cartoes.forEach(item => mapa.set(item.canteiro, (mapa.get(item.canteiro) || 0) + 1));
    return mapa;
  }, [cartoes]);
  const pendentes = useMemo(() => filtrados.filter(item => item.grupo === 'sem-lancamento'), [filtrados]);
  const abastecidasSemLancar = useMemo(() => abastecidasSemLancamento(cartoes, abastecimentos, dia), [cartoes, abastecimentos, dia]);
  const aberto = abertoId ? cartoes.find(item => item.equipamentoId === abertoId) || null : null;
  const indiceAberto = aberto ? naTela.findIndex(item => item.equipamentoId === aberto.equipamentoId) : -1;
  const proximo = indiceAberto >= 0 ? naTela[indiceAberto + 1] : undefined;

  const frentesAtivas = useMemo(() => frentes.filter(item => item.ativo !== false && item.situacao !== 'Concluída').map(item => item.nome), [frentes]);
  const opcoesFrente = useMemo(() => Array.from(new Set([...frentesAtivas, ...cartoes.map(item => item.frente)])).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR')), [cartoes, frentesAtivas]);
  const opcoesTipo = useMemo(() => Array.from(new Set(cartoes.map(item => item.tipo))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [cartoes]);
  const opcoesMarca = useMemo(() => Array.from(new Set(cartoes.map(item => item.marca).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [cartoes]);
  const operadores = useMemo(() => Array.from(new Set(motoristas.filter(item => item.ativo !== false).map(item => item.nome.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [motoristas]);
  const etiquetas = etiquetasDosFiltros(filtros);

  const lista: Indicador[] = [
    { id: 'total', titulo: 'Total', valor: indicadores.total, detalhe: 'máquinas', Icone: Truck, tom: 'bg-slate-100 text-slate-700', filtro: FILTROS_VAZIOS },
    { id: 'operando', titulo: 'Operando', valor: indicadores.operando, detalhe: 'em operação', Icone: PlayCircle, tom: 'bg-emerald-50 text-[#176b4d]', filtro: { grupo: 'operando' } },
    { id: 'manutencao', titulo: 'Manutenção', valor: indicadores.manutencao, detalhe: 'em reparo', Icone: Wrench, tom: 'bg-rose-50 text-rose-700', filtro: { grupo: 'manutencao' } },
    { id: 'parado', titulo: 'Parados', valor: indicadores.parado, detalhe: 'sem operação', Icone: PauseCircle, tom: 'bg-amber-50 text-amber-700', filtro: { grupo: 'parado' } },
    { id: 'sem-lancamento', titulo: 'Sem lançamento', valor: indicadores.semLancamento, detalhe: 'falta atualizar', Icone: AlertTriangle, tom: 'bg-slate-100 text-slate-600', filtro: { grupo: 'sem-lancamento' } },
    { id: 'disponibilidade', titulo: 'Disponibilidade', valor: indicadores.disponibilidade ?? 0, sufixo: indicadores.disponibilidade === null ? '' : '%', detalhe: indicadores.disponibilidade === null ? 'nada lançado no dia' : 'fora da manutenção', Icone: Gauge, tom: 'bg-sky-50 text-sky-700' },
    { id: 'com-operador', titulo: 'Com operador', valor: indicadores.comOperador, detalhe: 'operadores no dia', Icone: UserCheck, tom: 'bg-emerald-50 text-[#176b4d]', filtro: { operador: 'com' } },
    { id: 'sem-operador', titulo: 'Sem operador', valor: indicadores.semOperador, detalhe: 'aguardando', Icone: UserX, tom: 'bg-orange-50 text-[#f26a2e]', filtro: { operador: 'sem' } },
    { id: 'abasteceu-sem-lancar', titulo: 'Abasteceu sem lançar', valor: abastecidasSemLancar.length, detalhe: 'confira no Combustível', Icone: Fuel, tom: 'bg-amber-50 text-amber-700', aoClicar: abastecidasSemLancar.length ? () => onNavigate('lancamentos') : undefined },
  ];

  const mudar = (parcial: Partial<FiltrosQuadro>) => setFiltros(atual => ({ ...atual, ...parcial }));
  const alternarGrupo = (canteiro: string) => setFechados(atual => {
    const proximoConjunto = new Set(atual);
    if (proximoConjunto.has(canteiro)) proximoConjunto.delete(canteiro);
    else proximoConjunto.add(canteiro);
    return proximoConjunto;
  });
  const atualizarPendentes = () => {
    if (pendentes.length === 0) return;
    setFiltros(atual => ({ ...atual, grupo: '' }));
    setAbertoId(pendentes[0].equipamentoId);
  };

  const salvar = (cartao: CartaoFrota, edicao: EdicaoQuadro, irParaProximo: boolean): string | undefined => {
    const equipamento = equipamentos.find(item => item.id === cartao.equipamentoId);
    if (!equipamento) return 'Esta máquina não está mais no cadastro.';
    const resultado = registroDaEdicao({ dia, hora: horaAgora(), agora: new Date().toISOString(), usuario, equipamento, registros, funcionarios: motoristas, edicao });
    if ('erro' in resultado) return resultado.erro;
    // Escolhe a próxima antes de gravar: depois de gravar a máquina pode sair do filtro.
    const seguinte = irParaProximo ? proximo : undefined;
    onSave(resultado.registro, resultado.novo);
    setAviso(`${cartao.prefixo} salvo: ${edicao.status}${edicao.canteiro ? `, ${edicao.canteiro}` : ''}.`);
    setAbertoId(seguinte ? seguinte.equipamentoId : null);
    return undefined;
  };

  useEffect(() => {
    if (!aviso) return undefined;
    const tempo = window.setTimeout(() => setAviso(''), 4000);
    return () => window.clearTimeout(tempo);
  }, [aviso]);

  useEffect(() => {
    if (aberto || atalhosAberto) return undefined;
    const teclar = (event: KeyboardEvent) => {
      const alvo = event.target as HTMLElement | null;
      if (alvo?.matches('input, textarea, select, [contenteditable="true"]') || event.ctrlKey || event.metaKey || event.altKey) return;
      const tecla = event.key.toLocaleLowerCase('pt-BR');
      if (tecla === '/') {
        event.preventDefault();
        buscaRef.current?.focus();
      } else if (tecla === '?') {
        event.preventDefault();
        setAtalhosAberto(true);
      } else if (GRUPO_DA_TECLA[tecla]) {
        event.preventDefault();
        mudar({ grupo: filtros.grupo === GRUPO_DA_TECLA[tecla] ? '' : GRUPO_DA_TECLA[tecla] });
      } else if (tecla === 'l') {
        event.preventDefault();
        setFiltros(FILTROS_VAZIOS);
      } else if (tecla === 'v' && podeEditar) {
        event.preventDefault();
        trocarVista(vista === 'quadro' ? 'lancar' : 'quadro');
      } else if (tecla === 'a' && podeEditar) {
        event.preventDefault();
        atualizarPendentes();
      }
    };
    document.addEventListener('keydown', teclar);
    return () => document.removeEventListener('keydown', teclar);
  });

  useGSAP(() => {
    const raiz = escopo.current;
    if (!raiz || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(raiz.querySelectorAll('[data-quadro-reveal]'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.04, ease: 'power3.out', clearProps: 'transform,opacity' });
    gsap.fromTo(raiz.querySelectorAll('[data-quadro-cartao]'), { opacity: 0, y: 10, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.4, stagger: { each: 0.01, from: 'start' }, ease: 'power2.out', delay: 0.12, clearProps: 'transform,opacity' });
  }, { scope: escopo, dependencies: [dia, filtros, ordem, vista] });

  const chipCanteiro = (nome: string, rotulo: string, total: number) => {
    const ligado = filtros.canteiro === nome;
    return (
      <button
        key={nome || 'todos'}
        type="button"
        aria-pressed={ligado}
        onClick={() => mudar({ canteiro: ligado ? '' : nome })}
        data-testid={`quadro-aba-canteiro-${nome || 'todos'}`}
        className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] ${ligado ? 'bg-[#176b4d] text-white shadow-[0_8px_18px_-10px_rgba(23,107,77,0.8)]' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-emerald-300'} ${FOCO}`}
      >
        {rotulo}
        <span className={`rounded-full px-1.5 font-mono text-xs ${ligado ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{total}</span>
      </button>
    );
  };

  return (
    <div ref={escopo} id="quadro-frota-tab" data-testid="quadro-frota-tab" className="space-y-4">
      <div data-quadro-reveal>
        <PageHeader
          eyebrow="Frota"
          title="Quadro da frota"
          description="Todas as máquinas do dia, por canteiro. Toque numa máquina para atualizar situação, canteiro, frente e operador."
          actions={<div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <label className="relative flex w-full min-w-0 items-center sm:inline-flex sm:w-auto">
              <span className="sr-only">Dia do quadro</span>
              <CalendarDays className="pointer-events-none absolute left-3 size-4 text-slate-400" aria-hidden="true" />
              <input type="date" value={dia} onChange={event => setDia(event.target.value || isoDay(new Date()))} className={`${CAMPO} min-w-0 pl-9 font-semibold sm:w-auto`} data-testid="quadro-dia" />
            </label>
            <button type="button" onClick={() => setAtalhosAberto(true)} className={`${BOTAO_SECUNDARIO} max-lg:hidden`} aria-label="Atalhos do teclado" data-testid="quadro-atalhos">
              <Keyboard className="size-4" aria-hidden="true" />
              <kbd className="text-xs">?</kbd>
            </button>
            {podeEditar ? (
              <button type="button" onClick={atualizarPendentes} disabled={pendentes.length === 0} className={`${BOTAO_PRIMARIO} w-full px-5 max-sm:order-first sm:w-auto`} data-testid="quadro-acao-principal">
                {pendentes.length === 0 ? <CheckCircle2 className="size-5" aria-hidden="true" /> : <Truck className="size-5" aria-hidden="true" />}
                {pendentes.length === 0 ? 'Tudo lançado hoje' : `Atualizar ${pendentes.length} sem lançamento`}
              </button>
            ) : (
              <button type="button" onClick={() => onNavigate('controle-equipamentos')} className={`${BOTAO_PRIMARIO} w-full px-5 max-sm:order-first sm:w-auto`} data-testid="quadro-acao-principal">
                <Truck className="size-5" aria-hidden="true" />
                Abrir Controle de Frotas
              </button>
            )}
          </div>}
        />
        <p className="-mt-1 text-sm font-semibold text-slate-500 first-letter:uppercase">{dataLonga(dia)}</p>
      </div>

      <section aria-label="Resumo da frota no dia" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 2xl:grid-cols-8">
        {lista.map(item => {
          const ativo = item.id !== 'total' && item.filtro && Object.entries(item.filtro).every(([chave, valor]) => filtros[chave as keyof FiltrosQuadro] === valor);
          const conteudo = (
            <>
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 [overflow-wrap:anywhere] sm:tracking-[0.12em]">{item.titulo}</span>
                <span className={`grid size-8 shrink-0 place-items-center rounded-full ${item.tom}`}><item.Icone className="size-4" aria-hidden="true" /></span>
              </span>
              <CountUp value={item.valor} suffix={item.sufixo} className="mt-1 block text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl" />
              <span className="block text-xs text-slate-500">{item.detalhe}</span>
            </>
          );
          const classe = `${CARTAO} flex min-h-24 flex-col p-3 text-left sm:min-h-28 sm:p-3.5 transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${ativo ? 'border-[#176b4d] ring-2 ring-[#176b4d]/15' : ''}`;
          return item.filtro ? (
            <button key={item.id} type="button" data-quadro-reveal data-testid={`quadro-indicador-${item.id}`} aria-pressed={ativo || undefined} onClick={() => setFiltros(ativo ? { ...filtros, ...Object.fromEntries(Object.keys(item.filtro!).map(chave => [chave, ''])) } : item.id === 'total' ? FILTROS_VAZIOS : { ...filtros, ...item.filtro })} className={`${classe} hover:-translate-y-0.5 hover:border-emerald-300 active:scale-[0.98] ${FOCO}`}>
              {conteudo}
            </button>
          ) : item.aoClicar ? (
            <button key={item.id} type="button" data-quadro-reveal data-testid={`quadro-indicador-${item.id}`} onClick={item.aoClicar} className={`${classe} hover:-translate-y-0.5 hover:border-emerald-300 active:scale-[0.98] ${FOCO}`}>
              {conteudo}
            </button>
          ) : (
            <div key={item.id} data-quadro-reveal data-testid={`quadro-indicador-${item.id}`} className={classe}>{conteudo}</div>
          );
        })}
      </section>

      <section aria-label="Canteiros e filtros" data-quadro-reveal className={`${CARTAO} space-y-3 p-3 lg:sticky lg:top-0 lg:z-10`}>
        {podeEditar && (
          <div role="group" aria-label="Como ver as máquinas" className="grid grid-cols-2 gap-1 rounded-2xl bg-[#f7f8f6] p-1 ring-1 ring-inset ring-slate-200 sm:inline-grid" data-testid="quadro-vista">
            {([['quadro', 'Quadro', LayoutGrid], ['lancar', 'Lançar', ListChecks]] as const).map(([valor, rotulo, Icone]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={vista === valor}
                onClick={() => trocarVista(valor)}
                data-testid={`quadro-vista-${valor}`}
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] ${vista === valor ? 'bg-white text-[#176b4d] shadow-[0_6px_16px_-10px_rgba(15,40,31,0.45)] ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'} ${FOCO}`}
              >
                <Icone className="size-4" aria-hidden="true" />
                {rotulo}
              </button>
            ))}
          </div>
        )}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]" role="group" aria-label="Canteiro">
          {chipCanteiro('', 'Todos', cartoes.length)}
          {CANTEIROS.map(nome => chipCanteiro(nome, nome, contagemCanteiro.get(nome) || 0))}
          {(contagemCanteiro.get(SEM_CANTEIRO) || 0) > 0 && chipCanteiro(SEM_CANTEIRO, SEM_CANTEIRO, contagemCanteiro.get(SEM_CANTEIRO) || 0)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-[1_1_14rem]">
            <span className="sr-only">Buscar prefixo, modelo ou operador</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input ref={buscaRef} value={filtros.busca} onChange={event => mudar({ busca: event.target.value })} placeholder="Buscar prefixo, modelo ou operador" className={`${CAMPO} pl-9`} data-testid="quadro-busca" />
          </label>
          <select value={filtros.grupo} onChange={event => mudar({ grupo: event.target.value as GrupoStatus | '' })} aria-label="Situação" className={`${CAMPO} min-w-0 flex-[1_1_9rem] sm:w-auto`}>
            <option value="">Todas as situações</option>
            {(Object.keys(ROTULO_GRUPO) as GrupoStatus[]).map(grupo => <option key={grupo} value={grupo}>{ROTULO_GRUPO[grupo]}</option>)}
          </select>
          <select value={filtros.tipo} onChange={event => mudar({ tipo: event.target.value })} aria-label="Tipo" className={`${CAMPO} min-w-0 flex-[1_1_9rem] sm:w-auto`}>
            <option value="">Todos os tipos</option>
            {opcoesTipo.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
          </select>
          <button type="button" onClick={() => setMaisFiltros(atual => !atual)} aria-expanded={maisFiltros} className={`${BOTAO_SECUNDARIO} flex-none`} data-testid="quadro-mais-filtros">
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Mais filtros
          </button>
        </div>
        {maisFiltros && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6" data-testid="quadro-painel-filtros">
            <select value={filtros.frente} onChange={event => mudar({ frente: event.target.value })} aria-label="Frente" className={CAMPO}>
              <option value="">Todas as frentes</option>
              {opcoesFrente.map(frente => <option key={frente} value={frente}>{frente}</option>)}
            </select>
            <select value={filtros.marca} onChange={event => mudar({ marca: event.target.value })} aria-label="Marca" className={CAMPO}>
              <option value="">Todas as marcas</option>
              {opcoesMarca.map(marca => <option key={marca} value={marca}>{marca}</option>)}
            </select>
            <select value={filtros.operador} onChange={event => mudar({ operador: event.target.value as FiltrosQuadro['operador'] })} aria-label="Operador" className={CAMPO}>
              <option value="">Com e sem operador</option>
              <option value="com">Com operador</option>
              <option value="sem">Sem operador</option>
            </select>
            <select value={filtros.horimetro} onChange={event => mudar({ horimetro: event.target.value as FiltrosQuadro['horimetro'] })} aria-label="Horímetro" className={CAMPO}>
              <option value="">Com e sem horímetro</option>
              <option value="com">Com horímetro</option>
              <option value="sem">Sem horímetro</option>
            </select>
            <select value={filtros.foto} onChange={event => mudar({ foto: event.target.value as FiltrosQuadro['foto'] })} aria-label="Foto" className={CAMPO}>
              <option value="">Com e sem foto</option>
              <option value="com">Com foto</option>
              <option value="sem">Sem foto</option>
            </select>
            <label className="relative">
              <span className="sr-only">Ordenar por</span>
              <ListFilter className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <select value={ordem} onChange={event => setOrdem(event.target.value as Ordem)} className={`${CAMPO} pl-9`} data-testid="quadro-ordem">
                {(Object.keys(ROTULO_ORDEM) as Ordem[]).map(chave => <option key={chave} value={chave}>Ordenar: {ROTULO_ORDEM[chave]}</option>)}
              </select>
            </label>
          </div>
        )}
        {etiquetas.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" data-testid="quadro-etiquetas">
            {etiquetas.map(etiqueta => (
              <button key={etiqueta.chave} type="button" onClick={() => mudar({ [etiqueta.chave]: '' })} className={`inline-flex min-h-9 items-center gap-1.5 rounded-full bg-emerald-50 pl-3 pr-2 text-xs font-bold text-[#176b4d] ring-1 ring-inset ring-emerald-200 transition hover:bg-emerald-100 ${FOCO}`} aria-label={`Tirar filtro ${etiqueta.texto}`}>
                {etiqueta.texto}
                <X className="size-3.5" aria-hidden="true" />
              </button>
            ))}
            <button type="button" onClick={() => setFiltros(FILTROS_VAZIOS)} className="min-h-9 px-2 text-xs font-semibold text-slate-500 underline-offset-4 hover:text-[#176b4d] hover:underline" data-testid="quadro-limpar">
              Limpar tudo
            </button>
            <span className="ml-auto text-xs font-semibold text-slate-500">{filtrados.length} de {cartoes.length} máquinas</span>
          </div>
        )}
      </section>

      <p role="status" aria-live="polite" className={`${aviso ? '' : 'sr-only'} flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 ring-1 ring-inset ring-emerald-200`} data-testid="quadro-aviso">
        {aviso && <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />}
        {aviso}
      </p>

      {cartoes.length === 0 ? (
        <div data-quadro-reveal className={`${CARTAO} grid place-items-center gap-2 px-6 py-14 text-center`}>
          <Truck className="size-8 text-slate-300" aria-hidden="true" />
          <p className="text-base font-bold text-slate-800">Nenhuma máquina cadastrada</p>
          <p className="max-w-md text-sm text-slate-500">Cadastre as máquinas em Cadastros. Elas aparecem aqui assim que entram na obra.</p>
          <button type="button" onClick={() => onNavigate('cadastros')} className={`${BOTAO_SECUNDARIO} mt-2`}>Abrir Cadastros</button>
        </div>
      ) : filtrados.length === 0 ? (
        <div data-quadro-reveal className={`${CARTAO} grid place-items-center gap-2 px-6 py-12 text-center`}>
          <p className="text-base font-bold text-slate-800">Nenhuma máquina com esses filtros</p>
          <button type="button" onClick={() => setFiltros(FILTROS_VAZIOS)} className={BOTAO_SECUNDARIO}>Limpar filtros</button>
        </div>
      ) : vista === 'lancar' ? (
        <LancarFrota
          cartoes={filtrados}
          dia={dia}
          equipamentos={equipamentos}
          registros={registros}
          funcionarios={motoristas}
          frentes={opcoesFrente}
          operadores={operadores}
          usuario={usuario}
          onSaveMany={onSaveMany}
          onDeleteMany={onDeleteMany}
          onAviso={setAviso}
        />
      ) : (
        <div className="space-y-4" data-testid="quadro-colunas">
          {grupos.map(grupo => {
            const fechado = fechados.has(grupo.canteiro);
            const semCanteiro = grupo.canteiro === SEM_CANTEIRO;
            return (
              <section key={grupo.canteiro} data-quadro-reveal aria-label={`Canteiro ${grupo.canteiro}`} data-testid="quadro-coluna" className="overflow-hidden rounded-[1.25rem] bg-[#f7f8f6] p-1.5 ring-1 ring-slate-200">
                <header className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[0.9rem] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,40,31,0.05)]">
                  <span className={`size-2.5 shrink-0 rounded-full ${semCanteiro ? 'bg-slate-300' : 'bg-[#176b4d]'}`} aria-hidden="true" />
                  <h2 className="min-w-0 truncate text-base font-bold uppercase tracking-wide text-slate-900">{grupo.canteiro}</h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-700">{grupo.cartoes.length}</span>
                  {grupo.cartoes.length === 0 && (
                    <span className="text-xs text-slate-400">Vazio. Abra uma máquina e escolha este canteiro.</span>
                  )}
                  {grupo.cartoes.length > 0 && (
                    <span className="flex items-center gap-3 text-xs font-semibold text-slate-500">
                      <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />{grupo.operando} operando</span>
                      {grupo.manutencao > 0 && <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-rose-500" aria-hidden="true" />{grupo.manutencao} manutenção</span>}
                    </span>
                  )}
                  {grupo.cartoes.length > 0 && <button
                    type="button"
                    onClick={() => alternarGrupo(grupo.canteiro)}
                    aria-expanded={!fechado}
                    aria-label={fechado ? `Mostrar ${grupo.canteiro}` : `Esconder ${grupo.canteiro}`}
                    className={`ml-auto grid size-11 place-items-center rounded-xl border border-slate-200 text-slate-500 transition duration-200 hover:border-emerald-400 hover:text-[#176b4d] ${FOCO}`}
                  >
                    <ChevronDown className={`size-4 transition duration-300 ${fechado ? '-rotate-90' : ''}`} aria-hidden="true" />
                  </button>}
                </header>
                {!fechado && grupo.cartoes.length > 0 && (
                  <div className="grid gap-2 p-2 [grid-template-columns:repeat(auto-fill,minmax(8.5rem,1fr))]">
                    {grupo.cartoes.map(cartao => <CartaoEquipamento key={cartao.equipamentoId} cartao={cartao} onAbrir={() => setAbertoId(cartao.equipamentoId)} />)}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <PainelEquipamento
        cartao={aberto}
        podeEditar={podeEditar}
        temProximo={Boolean(proximo)}
        frentes={opcoesFrente}
        operadores={operadores}
        onFechar={() => setAbertoId(null)}
        onSalvar={salvar}
        onAbrirControle={() => { setAbertoId(null); onNavigate('controle-equipamentos'); }}
      />

      <Modal open={atalhosAberto} title="Atalhos do teclado" size="sm" onClose={() => setAtalhosAberto(false)}>
        <dl className="divide-y divide-slate-100">
          {ATALHOS.filter(atalho => podeEditar || !atalho.editar).map(atalho => (
            <div key={atalho.teclas} className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-sm text-slate-700">{atalho.oQueFaz}</dt>
              <dd><kbd className="whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm font-bold text-slate-700">{atalho.teclas}</kbd></dd>
            </div>
          ))}
        </dl>
      </Modal>
    </div>
  );
}
