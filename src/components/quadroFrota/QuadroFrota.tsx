/**
 * Vista Quadro do Controle de Frotas: todas as máquinas do dia, separadas por canteiro, para
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
import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { CheckCircle2, Keyboard, LayoutGrid, ListChecks, ListFilter, MapPin, Search, SlidersHorizontal, Trash2, Truck, X } from 'lucide-react';
import type { Abastecimento, ControleEquipamentoDiario, Equipamento, FrenteServico, Funcionario, GrupoEquipe } from '../../types';
import { Modal } from '../../shared/ui';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
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
  rascunhoDoCartao,
  registroDaEdicao,
  type CartaoFrota,
  type EdicaoQuadro,
  type FiltrosQuadro,
  type GrupoStatus,
  type Ordem,
} from '../../modules/frota/quadroFrota';
import { OPERATIONAL_DRIVERS } from '../../fleet/operationalDrivers';
import { CartaoArrastavel } from './CartaoArrastavel';
import { registrarAtalhosDoQuadro, type AcoesAtalhoQuadro } from './atalhosQuadro';
import { INSTRUCOES_ARRASTAR, avisosDoArrastar, coordenadasDoCanteiro } from './arrastarComTeclado';
import { ColunaCanteiro } from './ColunaCanteiro';
import { TOM } from './CartaoEquipamento';
import { LancarFrota } from './LancarFrota';
import { PainelEquipamento } from './PainelEquipamento';
import { BOTAO_PERIGO, BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO } from '../cadastros/estilos';

interface Props {
  equipamentos: readonly Equipamento[];
  registros: readonly ControleEquipamentoDiario[];
  gruposEquipe: readonly GrupoEquipe[];
  abastecimentos: readonly Abastecimento[];
  /** Canteiros do cadastro; sem isso usa a lista fixa de reserva. */
  canteiros?: readonly string[];
  frentes: readonly FrenteServico[];
  funcionarios: readonly Funcionario[];
  /** Motoristas e operadores cadastrados no Controle de Frotas; mesma lista das três abas. */
  operationalDrivers?: readonly Funcionario[];
  podeEditar: boolean;
  usuario: string;
  onSave: (registro: ControleEquipamentoDiario, novo: boolean) => void;
  onSaveMany: (itens: Array<{ registro: ControleEquipamentoDiario; novo: boolean }>) => void;
  /** Sem ele, não aparece Excluir lançamento: só o administrador exclui (A7). */
  onDeleteMany?: (ids: string[]) => void;
  /** Mesma permissão de excluir em Cadastros; quem não tem não desmobiliza pelo quadro. */
  podeRemover?: boolean;
  /** Desmobiliza as máquinas (saem do quadro pra sempre) e apaga o lançamento de hoje, se houver. */
  onRemoverEquipamentos?: (itens: Array<{ equipamentoId: string; registroId?: string }>) => void;
  onNavigate: (aba: string) => void;
  /** Quem não abre a aba não vê o botão que leva até ela. */
  podeAbrir?: (aba: string) => boolean;
  /**
   * O dia, o relatório e a importação são os do Controle de Frotas: as vistas
   * mostram sempre o mesmo dia.
   */
  dia: string;
  /** Volta para a Situação do dia do Controle de Frotas. */
  onAbrirSituacao: () => void;
  /** Busca já preenchida quando a tela abre vinda de outra (ex.: Manutenção). */
  buscaInicial?: string;
  /** Abre as ordens de serviço da máquina na Manutenção. */
  onVerOrdens?: (prefixo: string) => void;
}

const horaAgora = () => new Date().toTimeString().slice(0, 5);

const ATALHOS: ReadonlyArray<{ teclas: string; oQueFaz: string; editar?: boolean }> = [
  { teclas: 'A', oQueFaz: 'Atualizar as máquinas sem lançamento, uma atrás da outra', editar: true },
  { teclas: 'V', oQueFaz: 'Trocar entre o quadro e a lista de lançamento', editar: true },
  { teclas: '/', oQueFaz: 'Buscar máquina' },
  { teclas: '1 a 4', oQueFaz: 'Mostrar só em operação, manutenção, à disposição ou sem lançamento' },
  { teclas: 'L', oQueFaz: 'Limpar os filtros' },
  { teclas: 'O, M, P', oQueFaz: 'No painel da máquina: em operação, manutenção ou à disposição', editar: true },
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

/** Colunas do quadro: primeiro o que falta lançar, depois as situações do dia. */
const COLUNAS: readonly GrupoStatus[] = ['sem-lancamento', 'operando', 'manutencao', 'parado'];
const CONTA: Record<GrupoStatus, (indicadores: ReturnType<typeof calcularIndicadores>) => number> = {
  'sem-lancamento': item => item.semLancamento,
  operando: item => item.operando,
  manutencao: item => item.manutencao,
  parado: item => item.parado,
};

export default function QuadroFrota({ equipamentos, registros, gruposEquipe, abastecimentos, canteiros = CANTEIROS, frentes, funcionarios, operationalDrivers, podeEditar, usuario, onSave, onSaveMany, onDeleteMany, podeRemover = false, onRemoverEquipamentos, onNavigate, podeAbrir = () => true, dia, onAbrirSituacao, buscaInicial = '', onVerOrdens }: Props) {
  const escopo = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  // Mesma lista de motoristas e operadores do Controle de Frotas, para o operador
  // sugerido aqui ser sempre o mesmo cadastro, sem duplicar em colaboradores.
  const motoristas = useMemo(() => operationalDrivers || funcionarios || OPERATIONAL_DRIVERS, [operationalDrivers, funcionarios]);
  const [filtros, setFiltros] = useState<FiltrosQuadro>({ ...FILTROS_VAZIOS, busca: buscaInicial });
  // A caixa de busca mostra o texto na hora; o filtro (que refiltra e reanima
  // os cartões) só atualiza um instante depois, pra digitar rápido não travar.
  const [buscaTexto, setBuscaTexto] = useState(buscaInicial);
  const [ordem, setOrdem] = useState<Ordem>('prefixo');
  const [maisFiltros, setMaisFiltros] = useState(false);
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [atalhosAberto, setAtalhosAberto] = useState(false);
  const [aviso, setAviso] = useState('');
  const [modoSelecao, setModoSelecao] = useState(false);
  const [selecionados, setSelecionados] = useState<ReadonlySet<string>>(() => new Set());
  const [confirmarExclusaoSelecao, setConfirmarExclusaoSelecao] = useState(false);
  const [remocaoPendente, setRemocaoPendente] = useState<readonly CartaoFrota[] | null>(null);
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

  // Espera a pessoa parar de digitar antes de refiltrar e reanimar o quadro.
  useEffect(() => {
    const tempo = window.setTimeout(() => setFiltros(atual => (atual.busca === buscaTexto ? atual : { ...atual, busca: buscaTexto })), 220);
    return () => window.clearTimeout(tempo);
  }, [buscaTexto]);

  // Trocar de dia ou de vista fecha a seleção: ela é sempre da tela de agora.
  useEffect(() => {
    setModoSelecao(false);
    setSelecionados(new Set());
  }, [dia, vista]);

  const cartoes = useMemo(
    () => montarQuadro({ dia, equipamentos, registros, gruposEquipe, abastecimentos, canteiros }),
    [dia, equipamentos, registros, gruposEquipe, abastecimentos, canteiros],
  );
  const indicadores = useMemo(() => calcularIndicadores(cartoes), [cartoes]);
  const filtrados = useMemo(() => filtrarCartoes(cartoes, filtros, ordem), [cartoes, filtros, ordem]);
  const filtrando = Object.values(filtros).some(Boolean);
  const grupos = useMemo(() => agruparPorCanteiro(filtrados, !filtrando, canteiros), [filtrados, filtrando, canteiros]);

  // Ordem em que a tela mostra as máquinas: é a ordem do "Salvar e próximo".
  const naTela = useMemo(() => grupos.flatMap(grupo => COLUNAS.flatMap(situacao => grupo.cartoes.filter(cartao => cartao.grupo === situacao))), [grupos]);
  const contagemCanteiro = useMemo(() => {
    const mapa = new Map<string, number>();
    cartoes.forEach(item => mapa.set(item.canteiro, (mapa.get(item.canteiro) || 0) + 1));
    return mapa;
  }, [cartoes]);
  const pendentes = useMemo(() => filtrados.filter(item => item.grupo === 'sem-lancamento'), [filtrados]);
  const aberto = abertoId ? cartoes.find(item => item.equipamentoId === abertoId) || null : null;
  const indiceAberto = aberto ? naTela.findIndex(item => item.equipamentoId === aberto.equipamentoId) : -1;
  const proximo = indiceAberto >= 0 ? naTela[indiceAberto + 1] : undefined;

  const frentesAtivas = useMemo(() => frentes.filter(item => item.ativo !== false && item.situacao !== 'Concluída').map(item => item.nome), [frentes]);
  const opcoesFrente = useMemo(() => Array.from(new Set([...frentesAtivas, ...cartoes.map(item => item.frente)])).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR')), [cartoes, frentesAtivas]);
  const opcoesTipo = useMemo(() => Array.from(new Set(cartoes.map(item => item.tipo))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [cartoes]);
  const opcoesMarca = useMemo(() => Array.from(new Set(cartoes.map(item => item.marca).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [cartoes]);
  const operadores = useMemo(() => Array.from(new Set(motoristas.filter(item => item.ativo !== false).map(item => item.nome.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [motoristas]);
  const etiquetas = etiquetasDosFiltros(filtros);

  const mudar = (parcial: Partial<FiltrosQuadro>) => setFiltros(atual => ({ ...atual, ...parcial }));
  const limparFiltros = () => {
    setBuscaTexto('');
    setFiltros(FILTROS_VAZIOS);
  };
  const alternarModoSelecao = () => {
    setModoSelecao(atual => !atual);
    setSelecionados(new Set());
  };
  const alternarSelecao = (id: string) => setSelecionados(atual => {
    const proximo = new Set(atual);
    if (proximo.has(id)) proximo.delete(id);
    else proximo.add(id);
    return proximo;
  });
  const cartoesSelecionados = useMemo(() => filtrados.filter(cartao => selecionados.has(cartao.equipamentoId)), [filtrados, selecionados]);
  const selecionadosExcluiveis = cartoesSelecionados.filter(cartao => cartao.registroId);
  const moverSelecionadosPara = (canteiro: string) => {
    if (cartoesSelecionados.length === 0) return;
    const hora = horaAgora();
    const agora = new Date().toISOString();
    const prontos: Array<{ registro: ControleEquipamentoDiario; novo: boolean }> = [];
    const problemas: string[] = [];
    cartoesSelecionados.forEach(cartao => {
      const equipamento = equipamentos.find(item => item.id === cartao.equipamentoId);
      if (!equipamento) return;
      const rascunho = rascunhoDoCartao(cartao);
      const resultado = registroDaEdicao({ dia, hora, agora, usuario, equipamento, registros, funcionarios: motoristas, edicao: { ...rascunho, canteiro: canteiro === SEM_CANTEIRO ? '' : canteiro, status: rascunho.status || 'Disponível' } });
      if ('erro' in resultado) problemas.push(`${cartao.prefixo}: ${resultado.erro}`);
      else prontos.push({ registro: resultado.registro, novo: resultado.novo });
    });
    if (prontos.length) onSaveMany(prontos);
    setAviso(problemas.length
      ? `${prontos.length} movida(s) para ${canteiro}. ${problemas.length} precisam de situação/operador antes: ${problemas.join('; ')}.`
      : `${prontos.length} máquina(s) movida(s) para ${canteiro}.`);
    setSelecionados(new Set());
    setModoSelecao(false);
  };
  const excluirSelecionados = () => {
    if (!onDeleteMany) return;
    onDeleteMany(selecionadosExcluiveis.map(cartao => cartao.registroId!));
    setAviso(`${selecionadosExcluiveis.length} lançamento(s) do dia excluído(s). As máquinas continuam no cadastro.`);
    setConfirmarExclusaoSelecao(false);
    setSelecionados(new Set());
    setModoSelecao(false);
  };
  const confirmarRemocao = () => {
    if (!remocaoPendente || !onRemoverEquipamentos) return;
    onRemoverEquipamentos(remocaoPendente.map(cartao => ({ equipamentoId: cartao.equipamentoId, registroId: cartao.registroId })));
    setAviso(`${remocaoPendente.length} máquina(s) removida(s) do quadro. Para trazer de volta, reative em Cadastros > Equipamentos.`);
    setRemocaoPendente(null);
    setSelecionados(new Set());
    setModoSelecao(false);
    setAbertoId(null);
  };
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

  // O arrastar mora na alça do cartão: mouse e dedo pegam depois de mover 4px
  // (a alça tem touch-action: none, então o dedo não rola a tela junto) e o
  // teclado pega com Espaço e pula de canteiro em canteiro pelas setas.
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: coordenadasDoCanteiro }),
  );
  const acessibilidadeArrastar = useMemo(() => ({
    screenReaderInstructions: INSTRUCOES_ARRASTAR,
    announcements: avisosDoArrastar(id => cartoes.find(item => item.equipamentoId === id)?.prefixo || String(id)),
  }), [cartoes]);
  const arrastarSoltou = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const cartao = cartoes.find(item => item.equipamentoId === active.id);
    if (!cartao) return;
    const canteiroAtual = cartao.canteiro === SEM_CANTEIRO ? '' : cartao.canteiro;
    const novoCanteiro = String(over.id) === SEM_CANTEIRO ? '' : String(over.id);
    if (canteiroAtual === novoCanteiro) return;
    const rascunho = rascunhoDoCartao(cartao);
    salvar(cartao, { ...rascunho, canteiro: novoCanteiro, status: rascunho.status || 'Disponível' }, false);
  };

  useEffect(() => {
    if (!aviso) return undefined;
    const tempo = window.setTimeout(() => setAviso(''), 4000);
    return () => window.clearTimeout(tempo);
  }, [aviso]);

  // Teclas do registro global (contexto "frotas"). Ficam desligadas com o
  // painel da máquina, a lista de atalhos ou a seleção abertos: lá as teclas
  // são outras. As ações são lidas na hora, nunca de uma tela que já mudou.
  const acoesAtalho = useRef<AcoesAtalhoQuadro | null>(null);
  useEffect(() => {
    acoesAtalho.current = {
      focarBusca: () => buscaRef.current?.focus(),
      abrirAjuda: () => setAtalhosAberto(true),
      atualizarPendentes: () => { if (podeEditar) atualizarPendentes(); },
      alternarVista: () => { if (podeEditar) trocarVista(vista === 'quadro' ? 'lancar' : 'quadro'); },
      alternarGrupo: grupo => mudar({ grupo: filtros.grupo === grupo ? '' : grupo }),
      limparFiltros,
    };
  });
  useEffect(() => registrarAtalhosDoQuadro(() => acoesAtalho.current!), []);
  useKeyboardShortcuts('frotas', !aberto && !atalhosAberto && !modoSelecao);

  useGSAP(() => {
    const raiz = escopo.current;
    if (!raiz || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Animações de entrada: sections e elementos com reveal
    gsap.fromTo(raiz.querySelectorAll('[data-quadro-reveal]'),
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.04, ease: 'power3.out', clearProps: 'transform,opacity' }
    );

  }, { scope: escopo, dependencies: [dia, vista] });

  const lancadas = indicadores.total - indicadores.semLancamento;
  const porcento = indicadores.total ? Math.round((lancadas / indicadores.total) * 100) : 0;
  const colunasVisiveis = filtros.grupo ? [filtros.grupo] : COLUNAS;
  const modeloGrade = { gridTemplateColumns: `9.5rem repeat(${colunasVisiveis.length}, minmax(0, 1fr))` };
  const filtrosExtras = [filtros.frente, filtros.marca, filtros.operador, filtros.horimetro, filtros.foto].filter(Boolean).length + (ordem !== 'prefixo' ? 1 : 0);

  return (
    <div ref={escopo} id="quadro-frota-tab" data-testid="quadro-frota-tab" className="space-y-3">
      <section aria-label="Resumo do dia" data-quadro-reveal className={`${CARTAO} space-y-3 p-3`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="flex items-baseline gap-2 text-sm font-semibold text-slate-600">
              Lançadas hoje
              <span className="font-mono text-xl font-extrabold text-slate-900">{lancadas}</span>
              <span className="font-bold text-slate-500">de {indicadores.total}</span>
            </p>
            <div className="mt-1.5 h-1.5 max-w-md overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Máquinas lançadas hoje" aria-valuemin={0} aria-valuemax={100} aria-valuenow={porcento}>
              <div className="h-full rounded-full bg-[#176b4d] transition-[width] duration-500" style={{ width: `${porcento}%` }} />
            </div>
          </div>
          {podeEditar && (
            <button type="button" onClick={atualizarPendentes} disabled={pendentes.length === 0} className={`${BOTAO_PRIMARIO} w-full px-4 sm:w-auto sm:shrink-0`} data-testid="quadro-acao-principal">
              {pendentes.length === 0 ? <CheckCircle2 className="size-5" aria-hidden="true" /> : <Truck className="size-5" aria-hidden="true" />}
              {pendentes.length === 0 ? 'Tudo lançado no dia' : `Lançar ${pendentes.length} sem lançamento`}
            </button>
          )}
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin] lg:grid lg:grid-cols-5 lg:overflow-visible lg:pb-0" role="group" aria-label="Situação" data-testid="quadro-situacoes">
          {([['', 'Todas', indicadores.total, 'bg-slate-400'], ...COLUNAS.map(grupo => [grupo, ROTULO_GRUPO[grupo], CONTA[grupo](indicadores), TOM[grupo].ponto] as const)] as const).map(([grupo, rotulo, total, ponto]) => {
            const ligado = filtros.grupo === grupo;
            return (
              <button key={grupo || 'todas'} type="button" aria-pressed={ligado} onClick={() => mudar({ grupo: ligado ? '' : grupo as GrupoStatus | '' })} data-testid={`quadro-situacao-${grupo || 'todas'}`} className={`inline-flex min-h-11 shrink-0 items-center justify-between gap-3 whitespace-nowrap rounded-xl px-3 text-sm font-bold ring-1 transition duration-200 active:scale-[0.97] ${ligado ? 'bg-[#176b4d] text-white ring-[#176b4d]' : 'bg-white text-slate-700 ring-slate-200 hover:ring-emerald-300'} ${FOCO}`}>
                <span className="inline-flex items-center gap-2">
                  <span className={`size-2.5 rounded-full ${ligado ? 'bg-white' : ponto}`} aria-hidden="true" />
                  {rotulo}
                </span>
                <span className={`font-mono text-base ${ligado ? '' : 'text-slate-900'}`}>{total}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-label="Busca e filtros" data-quadro-reveal className={`${CARTAO} space-y-2 p-2.5 lg:sticky lg:top-0 lg:z-20`}>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <label className="relative min-w-0 lg:flex-1">
            <span className="sr-only">Buscar prefixo, modelo ou operador</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input ref={buscaRef} value={buscaTexto} onChange={event => setBuscaTexto(event.target.value)} placeholder="Buscar prefixo, modelo ou operador" className={`${CAMPO} pl-9`} data-testid="quadro-busca" />
          </label>
          <div className="grid grid-cols-2 gap-2 lg:flex lg:shrink-0">
            <select value={filtros.canteiro} onChange={event => mudar({ canteiro: event.target.value })} aria-label="Canteiro" className={`${CAMPO} lg:w-44`} data-testid="quadro-filtro-canteiro">
              <option value="">Todos os canteiros</option>
              {canteiros.map(nome => <option key={nome} value={nome}>{nome} ({contagemCanteiro.get(nome) || 0})</option>)}
              {(contagemCanteiro.get(SEM_CANTEIRO) || 0) > 0 && <option value={SEM_CANTEIRO}>{SEM_CANTEIRO} ({contagemCanteiro.get(SEM_CANTEIRO)})</option>}
            </select>
            <select value={filtros.tipo} onChange={event => mudar({ tipo: event.target.value })} aria-label="Tipo" className={`${CAMPO} lg:w-44`}>
              <option value="">Todos os tipos</option>
              {opcoesTipo.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-2 lg:shrink-0 lg:flex-nowrap">
            <button type="button" onClick={() => setMaisFiltros(atual => !atual)} aria-expanded={maisFiltros} className={`${BOTAO_SECUNDARIO} flex-none`} data-testid="quadro-mais-filtros">
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Filtros{filtrosExtras ? ` (${filtrosExtras})` : ''}
            </button>
            {podeEditar && (
              <div className="flex flex-none rounded-xl bg-slate-100 p-1" role="group" aria-label="Forma de ver">
                {([['quadro', 'Quadro', LayoutGrid], ['lancar', 'Lista', ListChecks]] as const).map(([id, rotulo, Icone]) => (
                  <button key={id} type="button" aria-pressed={vista === id} onClick={() => trocarVista(id)} data-testid={`quadro-vista-${id}`} className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-bold transition ${vista === id ? 'bg-white text-[#176b4d] shadow-sm' : 'text-slate-600 hover:text-slate-900'} ${FOCO}`}>
                    <Icone className="size-4" aria-hidden="true" />
                    {rotulo}
                  </button>
                ))}
              </div>
            )}
            {podeEditar && vista === 'quadro' && (
              <button type="button" onClick={alternarModoSelecao} aria-pressed={modoSelecao} className={`${modoSelecao ? BOTAO_PRIMARIO : BOTAO_SECUNDARIO} flex-none`} data-testid="quadro-alternar-selecao">
                <ListChecks className="size-4" aria-hidden="true" />
                {modoSelecao ? 'Cancelar seleção' : 'Selecionar'}
              </button>
            )}
            <button type="button" onClick={() => setAtalhosAberto(true)} className={`${BOTAO_SECUNDARIO} flex-none max-lg:hidden`} aria-label="Atalhos do quadro" data-testid="quadro-atalhos">
              <Keyboard className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        {maisFiltros && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" data-testid="quadro-painel-filtros">
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
              <ListFilter className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <select value={ordem} onChange={event => setOrdem(event.target.value as Ordem)} className={`${CAMPO} pl-9`} data-testid="quadro-ordem">
                {(Object.keys(ROTULO_ORDEM) as Ordem[]).map(chave => <option key={chave} value={chave}>Ordem: {ROTULO_ORDEM[chave]}</option>)}
              </select>
            </label>
          </div>
        )}
        {etiquetas.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" data-testid="quadro-etiquetas">
            {etiquetas.map(etiqueta => (
              <button key={etiqueta.chave} type="button" onClick={() => { if (etiqueta.chave === 'busca') setBuscaTexto(''); mudar({ [etiqueta.chave]: '' }); }} className={`inline-flex min-h-11 items-center gap-1.5 rounded-full bg-emerald-50 pl-3 pr-2 lg:min-h-9 text-xs font-bold text-[#176b4d] ring-1 ring-inset ring-emerald-200 transition hover:bg-emerald-100 ${FOCO}`} aria-label={`Tirar filtro ${etiqueta.texto}`}>
                {etiqueta.texto}
                <X className="size-3.5" aria-hidden="true" />
              </button>
            ))}
            <button type="button" onClick={limparFiltros} className={`min-h-11 px-2 text-xs font-semibold text-slate-500 underline-offset-4 hover:text-[#176b4d] hover:underline lg:min-h-9 ${FOCO}`} data-testid="quadro-limpar">
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
          <Truck className="size-8 text-slate-500" aria-hidden="true" />
          <p className="text-base font-bold text-slate-800">Nenhuma máquina cadastrada</p>
          {podeAbrir('cadastros') ? (
            <>
              <p className="max-w-md text-sm text-slate-500">Cadastre as máquinas em Cadastros. Elas aparecem aqui assim que entram na obra.</p>
              <button type="button" onClick={() => onNavigate('cadastros')} className={`${BOTAO_SECUNDARIO} mt-2`}>Abrir Cadastros</button>
            </>
          ) : (
            <p className="max-w-md text-sm text-slate-500">Peça ao gestor para cadastrar as máquinas. Elas aparecem aqui assim que entram na obra.</p>
          )}
        </div>
      ) : filtrados.length === 0 ? (
        <div data-quadro-reveal className={`${CARTAO} grid place-items-center gap-2 px-6 py-12 text-center`}>
          <p className="text-base font-bold text-slate-800">Nenhuma máquina com esses filtros</p>
          <button type="button" onClick={limparFiltros} className={BOTAO_SECUNDARIO}>Limpar filtros</button>
        </div>
      ) : vista === 'lancar' ? (
        <LancarFrota
          cartoes={filtrados}
          dia={dia}
          equipamentos={equipamentos}
          registros={registros}
          canteiros={canteiros}
          funcionarios={motoristas}
          frentes={opcoesFrente}
          operadores={operadores}
          usuario={usuario}
          onSaveMany={onSaveMany}
          onDeleteMany={onDeleteMany}
          onAviso={setAviso}
        />
      ) : (
        <>
        {modoSelecao && (
          <div className="fixed inset-x-3 bottom-3 z-30 mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-2xl bg-white p-2.5 shadow-[0_18px_40px_-16px_rgba(15,40,31,0.45)] ring-1 ring-slate-200" data-testid="quadro-barra-selecao">
            <span className="px-2 text-sm font-bold text-slate-800">{selecionados.size > 0 ? `${selecionados.size} selecionada(s)` : 'Toque nas máquinas pra selecionar'}</span>
            {selecionados.size > 0 && (
              <>
                <label className="flex min-w-0 flex-1 items-center gap-1.5 sm:flex-none">
                  <MapPin className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
                  <span className="sr-only">Mover as selecionadas para o canteiro</span>
                  <select value="" onChange={event => { if (event.target.value) moverSelecionadosPara(event.target.value); }} className={`${CAMPO} sm:w-52`} data-testid="quadro-mover-sel">
                    <option value="">Mover para o canteiro…</option>
                    {canteiros.map(canteiro => <option key={canteiro} value={canteiro}>{canteiro}</option>)}
                  </select>
                </label>
                {onDeleteMany && <button type="button" onClick={() => setConfirmarExclusaoSelecao(true)} disabled={selecionadosExcluiveis.length === 0} className={`${podeRemover && onRemoverEquipamentos ? '' : 'ml-auto'} inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-white px-3 text-sm font-bold text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 ${FOCO}`} data-testid="quadro-excluir-sel">
                  <Trash2 className="size-4" aria-hidden="true" />
                  Excluir lançamento{selecionadosExcluiveis.length ? ` (${selecionadosExcluiveis.length})` : ''}
                </button>}
                {podeRemover && onRemoverEquipamentos && (
                  <button type="button" onClick={() => setRemocaoPendente(cartoesSelecionados)} disabled={cartoesSelecionados.length === 0} className={`ml-auto inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3 text-sm font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50 ${FOCO}`} data-testid="quadro-remover-sel">
                    <Trash2 className="size-4" aria-hidden="true" />
                    Remover do quadro{cartoesSelecionados.length ? ` (${cartoesSelecionados.length})` : ''}
                  </button>
                )}
              </>
            )}
            <button type="button" onClick={alternarModoSelecao} className={`inline-flex min-h-11 items-center gap-1 px-2 text-xs font-semibold text-slate-500 hover:text-[#176b4d] ${FOCO}`}>
              <X className="size-3.5" aria-hidden="true" />
              Sair da seleção
            </button>
          </div>
        )}
        <DndContext sensors={sensores} accessibility={acessibilidadeArrastar} onDragEnd={modoSelecao ? undefined : arrastarSoltou}>
          <div className={`${CARTAO} overflow-hidden ${modoSelecao ? 'mb-24' : ''}`} data-testid="quadro-colunas">
            <div className="hidden border-b border-slate-200 bg-slate-50 text-sm font-semibold text-slate-600 lg:grid" style={modeloGrade} aria-hidden="true">
              <span className="px-3 py-2">Canteiro</span>
              {colunasVisiveis.map(grupo => (
                <span key={grupo} className="flex items-center gap-1.5 border-l border-slate-200 px-3 py-2">
                  <span className={`size-2 rounded-full ${TOM[grupo].ponto}`} />
                  {ROTULO_GRUPO[grupo]}
                </span>
              ))}
            </div>
            {grupos.map(grupo => {
              const semCanteiro = grupo.canteiro === SEM_CANTEIRO;
              const porSituacao = colunasVisiveis.map(situacao => [situacao, grupo.cartoes.filter(cartao => cartao.grupo === situacao)] as const);
              return (
                <ColunaCanteiro key={grupo.canteiro} canteiro={grupo.canteiro} style={modeloGrade} className="border-b border-slate-200 last:border-b-0 max-lg:!block lg:grid">
                  <section aria-label={`Canteiro ${grupo.canteiro}`} data-testid="quadro-coluna" className="contents">
                    <header className="flex items-center gap-2 bg-slate-50/70 px-3 py-2 lg:flex-col lg:items-start lg:justify-start lg:gap-0.5 lg:bg-transparent lg:py-3">
                      <h2 className={`min-w-0 truncate text-sm font-bold ${semCanteiro ? 'text-slate-500' : 'text-slate-900'}`}>{grupo.canteiro}</h2>
                      <span className="ml-auto text-xs font-semibold text-slate-500 lg:ml-0">{grupo.cartoes.length} {grupo.cartoes.length === 1 ? 'máquina' : 'máquinas'}</span>
                    </header>
                    {porSituacao.map(([situacao, lista]) => (
                      <div key={situacao} className={`px-3 pb-2 lg:border-l lg:border-slate-200 lg:px-2 lg:py-2 ${lista.length === 0 ? 'max-lg:hidden' : ''}`}>
                        <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-slate-600 lg:hidden">
                          <span className={`size-2 rounded-full ${TOM[situacao].ponto}`} aria-hidden="true" />
                          {ROTULO_GRUPO[situacao]} · {lista.length}
                        </p>
                        {lista.length === 0 ? (
                          <span className="hidden text-sm text-slate-500 lg:block" aria-hidden="true">—</span>
                        ) : (
                          <div className="grid gap-1.5 [grid-template-columns:repeat(auto-fill,minmax(6.5rem,1fr))]">
                            {lista.map(cartao => (
                              <CartaoArrastavel
                                key={cartao.equipamentoId}
                                cartao={cartao}
                                podeArrastar={podeEditar}
                                onAbrir={() => setAbertoId(cartao.equipamentoId)}
                                modoSelecao={modoSelecao}
                                selecionado={selecionados.has(cartao.equipamentoId)}
                                onAlternarSelecao={() => alternarSelecao(cartao.equipamentoId)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {grupo.cartoes.length === 0 && <p className="px-3 pb-2 text-xs text-slate-500 lg:hidden">Nenhuma máquina. Arraste uma para cá.</p>}
                  </section>
                </ColunaCanteiro>
              );
            })}
          </div>
        </DndContext>
        </>
      )}

      <Modal
        open={confirmarExclusaoSelecao}
        title={`Excluir ${selecionadosExcluiveis.length} lançamento(s) de hoje?`}
        size="sm"
        onClose={() => setConfirmarExclusaoSelecao(false)}
        footer={(
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmarExclusaoSelecao(false)} className={BOTAO_SECUNDARIO}>Cancelar</button>
            <button type="button" onClick={excluirSelecionados} className={BOTAO_PERIGO} data-testid="quadro-confirmar-exclusao-sel">Excluir lançamento</button>
          </div>
        )}
      >
        <p className="text-sm text-slate-600">Some só o lançamento deste dia. As máquinas continuam no cadastro e voltam para "Sem lançamento".</p>
        <p className="mt-3 font-mono text-sm font-bold text-slate-800">{selecionadosExcluiveis.map(cartao => cartao.prefixo).join(', ')}</p>
      </Modal>

      <Modal
        open={Boolean(remocaoPendente)}
        title={`Remover ${remocaoPendente?.length || 0} máquina(s) do quadro pra sempre?`}
        size="sm"
        onClose={() => setRemocaoPendente(null)}
        footer={(
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setRemocaoPendente(null)} className={BOTAO_SECUNDARIO}>Cancelar</button>
            <button type="button" onClick={confirmarRemocao} className={BOTAO_PERIGO} data-testid="quadro-confirmar-remocao">Remover do quadro</button>
          </div>
        )}
      >
        <p className="text-sm text-slate-600">Sai do quadro e do Controle de Frotas até alguém reativar em Cadastros &gt; Equipamentos. O cadastro e o histórico continuam guardados.</p>
        <p className="mt-3 font-mono text-sm font-bold text-slate-800">{remocaoPendente?.map(cartao => cartao.prefixo).join(', ')}</p>
      </Modal>

      <PainelEquipamento
        cartao={aberto}
        podeEditar={podeEditar}
        temProximo={Boolean(proximo)}
        canteiros={canteiros}
        frentes={opcoesFrente}
        operadores={operadores}
        onFechar={() => setAbertoId(null)}
        onSalvar={salvar}
        onAbrirControle={() => { setAbertoId(null); onAbrirSituacao(); }}
        onVerOrdens={onVerOrdens && aberto ? () => { setAbertoId(null); onVerOrdens(aberto.prefixo); } : undefined}
        podeRemover={podeRemover && Boolean(onRemoverEquipamentos)}
        onRemover={aberto ? () => setRemocaoPendente([aberto]) : undefined}
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
