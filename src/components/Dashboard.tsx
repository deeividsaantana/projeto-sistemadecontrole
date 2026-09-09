import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, CheckCircle2, ChevronRight, Clock3,
  Gauge, History, Truck, UserRound, Wrench, type LucideIcon,
} from 'lucide-react';
import type {
  Abastecimento, Comboio, ControleEquipamentoDiario, ControleEstacas, Empresa,
  Equipamento, FichaVerificacaoServico, FrenteServico, Funcionario, GrupoEquipe,
  HistoryLog, Inspecao, LancamentoCusto, ListaPresenca, Lubrificacao, Material,
  Medicao, MovimentoMaterial, NaoConformidade, ObraLocal, OrcamentoItem,
  OrdemServico, PlanejamentoItem, PresencaApontamento, ProdutoLubrificacao,
  RegistroProducao, StatusControleEquipamentoDiario, TicketJazida, TipoCombustivel,
} from '../types';
import { instanteDoHistorico } from '../utils/formato';
import { PageHeader } from '../shared/ui';

interface DashboardProps {
  empresas: Empresa[]; obras: ObraLocal[]; equipamentos: Equipamento[];
  funcionarios: Funcionario[]; comboios: Comboio[]; combustiveis: TipoCombustivel[];
  lubrificantes: ProdutoLubrificacao[]; abastecimentos: Abastecimento[];
  lubrificacoes: Lubrificacao[]; historyLogs: HistoryLog[];
  listasPresenca?: ListaPresenca[]; ordensServico?: OrdemServico[];
  ticketsJazida?: TicketJazida[]; estacas?: ControleEstacas;
  presencasLink?: PresencaApontamento[]; controlesEquipamentos?: ControleEquipamentoDiario[];
  gruposEquipe?: GrupoEquipe[]; planejamento?: PlanejamentoItem[];
  producao?: RegistroProducao[]; medicoes?: Medicao[]; materiais?: Material[];
  movimentosMaterial?: MovimentoMaterial[]; fichasFvs?: FichaVerificacaoServico[];
  inspecoes?: Inspecao[]; naoConformidades?: NaoConformidade[];
  lancamentosCusto?: LancamentoCusto[]; orcamento?: OrcamentoItem[];
  frentes?: FrenteServico[]; onNavigate: (tab: string) => void;
}

const PROJECT_TABS = [
  { label: 'Geral', target: 'dashboard' },
  { label: 'Cronograma', target: 'cronograma' },
  { label: 'Diário de obra', target: 'diario-obra' },
  { label: 'Medições', target: 'medicoes' },
  { label: 'Financeiro', target: 'custos' },
  { label: 'Materiais', target: 'materiais' },
  { label: 'Qualidade', target: 'fvs' },
] as const;

/**
 * Os nove status do controle diário caem em quatro leituras operacionais. Cada
 * uma tem cor própria e é sempre acompanhada de rótulo e contagem: a cor
 * reforça, nunca carrega sozinha a informação (a paleta passa na verificação de
 * daltonismo, mas o cinza do "disponível" é neutro de propósito).
 */
type Bucket = 'operacao' | 'manutencao' | 'confirmar' | 'disponivel';

const BUCKET_DE_STATUS: Record<StatusControleEquipamentoDiario, Bucket> = {
  'Em operação': 'operacao',
  'Em manutenção': 'manutencao',
  'Aguardando manutenção': 'manutencao',
  'A confirmar': 'confirmar',
  'Aguardando motorista': 'confirmar',
  'Aguardando equipamento': 'confirmar',
  Disponível: 'disponivel',
  Reserva: 'disponivel',
  Desmobilizado: 'disponivel',
};

const BUCKETS: { id: Bucket; label: string; cor: string; chip: string; destino: string }[] = [
  { id: 'operacao', label: 'Em operação', cor: '#059669', chip: 'bg-emerald-50 text-emerald-700', destino: 'controle-equipamentos' },
  { id: 'manutencao', label: 'Em manutenção', cor: '#f59e0b', chip: 'bg-amber-50 text-amber-700', destino: 'manutencao' },
  { id: 'confirmar', label: 'A confirmar', cor: '#0ea5e9', chip: 'bg-sky-50 text-sky-700', destino: 'controle-equipamentos' },
  { id: 'disponivel', label: 'Disponível', cor: '#94a3b8', chip: 'bg-slate-100 text-slate-600', destino: 'frota' },
];

const PERIODOS = [7, 14, 30] as const;
type Periodo = (typeof PERIODOS)[number];

const iso = (date: Date) => date.toISOString().slice(0, 10);
const diaBr = (data: string) => data.split('-').reverse().slice(0, 2).join('/');
const numero = (valor: number) => valor.toLocaleString('pt-BR');

/** Telas de frota, para separar o que é atividade da operação no histórico. */
const TELAS_DE_FROTA = ['Controle', 'Frota', 'Equipamento', 'Manutenção', 'Abastecimento', 'Checklist'];

function Painel({ titulo, descricao, acao, children, className = '' }: {
  titulo: string; descricao?: string; acao?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-xl border border-slate-200 bg-white ${className}`}>
      <header className="flex min-h-14 items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-[13px] font-bold text-slate-900">{titulo}</h2>
          {descricao && <p className="mt-0.5 truncate text-[11px] text-slate-500">{descricao}</p>}
        </div>
        {acao}
      </header>
      {children}
    </section>
  );
}

function LinkPainel({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
    >
      {children} <ArrowRight className="size-3.5" aria-hidden="true" />
    </button>
  );
}

function Vazio({ texto, icone: Icone = CheckCircle2 }: { texto: string; icone?: LucideIcon }) {
  return (
    <div className="flex min-h-28 flex-col items-center justify-center gap-2 px-4 py-6 text-center">
      <Icone className="size-5 text-emerald-600" strokeWidth={1.7} aria-hidden="true" />
      <p className="text-[11px] text-slate-500">{texto}</p>
    </div>
  );
}

/** Um indicador do topo: número grande, contexto e barra fina de proporção. */
function Indicador({ label, valor, contexto, proporcao, cor, icone: Icone, onClick }: {
  label: string; valor: string; contexto: string; proporcao?: number;
  cor: string; icone: LucideIcon; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-0 flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-3.5 text-left transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 sm:p-4"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${cor}1a`, color: cor }}>
            <Icone className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
          </span>
          <span className="text-[11px] font-semibold leading-tight text-slate-600">{label}</span>
        </span>
        <ChevronRight className="hidden size-3.5 shrink-0 text-slate-700 group-hover:text-emerald-600 sm:block" aria-hidden="true" />
      </span>
      <strong className="block text-2xl font-bold leading-none tabular-nums text-slate-900">{valor}</strong>
      <span className="block text-[10px] leading-snug text-slate-500">{contexto}</span>
      {proporcao !== undefined && (
        <span className="block h-1 w-full overflow-hidden rounded-full bg-slate-100">
          <span className="block h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, proporcao))}%`, backgroundColor: cor }} />
        </span>
      )}
    </button>
  );
}

interface PontoEvolucao {
  data: string;
  operacao: number;
  manutencao: number;
  confirmar: number;
  registros: number;
}

/**
 * Curva de equipamentos em operação no período. Uma série só — a legenda seria
 * ruído, então o título nomeia o dado e o tooltip abre a composição do dia.
 * Mouse, toque e teclado (setas) selecionam o mesmo ponto.
 */
function CurvaOperacao({ pontos, onNavigate }: { pontos: PontoEvolucao[]; onNavigate: () => void }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  // O viewBox acompanha a largura real do container: uma unidade do SVG vale um
  // pixel, então texto e traço saem do mesmo tamanho no desktop e no celular.
  const [W, setW] = useState(720);
  useEffect(() => {
    const alvo = areaRef.current;
    if (!alvo || typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(entradas => {
      const medida = entradas[0]?.contentRect.width;
      if (medida) setW(Math.round(medida));
    });
    observador.observe(alvo);
    return () => observador.disconnect();
  }, []);
  const L = W < 420 ? 26 : 40, R = 24, T = 14, B = 26, H = 210;
  const largura = W - L - R;
  const altura = H - T - B;
  const maximo = Math.max(1, ...pontos.map(p => p.operacao));
  const teto = Math.max(1, Math.ceil(maximo * 1.15));
  const x = (i: number) => (pontos.length <= 1 ? L + largura / 2 : L + (i / (pontos.length - 1)) * largura);
  const y = (v: number) => T + altura - (v / teto) * altura;
  const linha = pontos.map((p, i) => `${x(i)},${y(p.operacao)}`).join(' ');
  const area = pontos.length ? `${L},${T + altura} ${linha} ${x(pontos.length - 1)},${T + altura}` : '';
  const grade = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(teto * f));
  const cabem = Math.max(3, Math.floor(largura / 46));
  const rotulos = pontos.length > cabem ? pontos.filter((_, i) => i % Math.ceil(pontos.length / cabem) === 0) : pontos;

  const indicePorPosicao = useCallback((clientX: number) => {
    const caixa = areaRef.current?.getBoundingClientRect();
    if (!caixa || pontos.length === 0) return null;
    const rel = ((clientX - caixa.left) / caixa.width) * W;
    const passo = pontos.length <= 1 ? largura : largura / (pontos.length - 1);
    return Math.min(pontos.length - 1, Math.max(0, Math.round((rel - L) / passo)));
  }, [pontos.length, largura]);

  const aoTeclar = (evento: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!pontos.length) return;
    if (evento.key === 'ArrowRight' || evento.key === 'ArrowLeft') {
      evento.preventDefault();
      setAtivo(atual => {
        const base = atual ?? pontos.length - 1;
        return Math.min(pontos.length - 1, Math.max(0, base + (evento.key === 'ArrowRight' ? 1 : -1)));
      });
    }
    if (evento.key === 'Escape') setAtivo(null);
  };

  const ponto = ativo === null ? null : pontos[ativo];

  return (
    <div className="p-4 sm:p-5">
      <div
        ref={areaRef}
        role="img"
        tabIndex={0}
        aria-label={`Equipamentos em operação por dia. ${pontos.length} dias no período, máximo de ${maximo} equipamentos.`}
        onKeyDown={aoTeclar}
        onMouseMove={evento => setAtivo(indicePorPosicao(evento.clientX))}
        onMouseLeave={() => setAtivo(null)}
        onTouchStart={evento => setAtivo(indicePorPosicao(evento.touches[0].clientX))}
        onTouchMove={evento => setAtivo(indicePorPosicao(evento.touches[0].clientX))}
        className="relative rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full touch-pan-y select-none" aria-hidden="true">
          <defs>
            <linearGradient id="curva-operacao" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0" />
            </linearGradient>
          </defs>
          {grade.map(valor => (
            <g key={valor}>
              <line x1={L} x2={W - R} y1={y(valor)} y2={y(valor)} stroke="#eef2f0" strokeWidth="1" />
              <text x={L - 8} y={y(valor) + 3.5} textAnchor="end" className="fill-slate-400 text-[10px] tabular-nums">{valor}</text>
            </g>
          ))}
          {area && <polygon points={area} fill="url(#curva-operacao)" />}
          <polyline points={linha} fill="none" stroke="#059669" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {ativo !== null && ponto && (
            <g>
              <line x1={x(ativo)} x2={x(ativo)} y1={T} y2={T + altura} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={x(ativo)} cy={y(ponto.operacao)} r="5.5" fill="#059669" stroke="#ffffff" strokeWidth="2" />
            </g>
          )}
          {rotulos.map(p => {
            const i = pontos.indexOf(p);
            return <text key={p.data} x={x(i)} y={H - 8} textAnchor="middle" className="fill-slate-400 text-[10px] tabular-nums">{diaBr(p.data)}</text>;
          })}
        </svg>
        {ponto && (
          <div
            role="status"
            className="pointer-events-none absolute top-2 z-10 w-44 rounded-lg border border-slate-200 bg-white p-2.5 shadow-lg"
            style={{ left: `min(calc(100% - 11rem), max(0px, ${(x(ativo ?? 0) / W) * 100}% - 5.5rem))` }}
          >
            <p className="text-[11px] font-bold text-slate-900">{ponto.data.split('-').reverse().join('/')}</p>
            <dl className="mt-1.5 space-y-1">
              {[
                { label: 'Em operação', valor: ponto.operacao, cor: '#059669' },
                { label: 'Em manutenção', valor: ponto.manutencao, cor: '#f59e0b' },
                { label: 'A confirmar', valor: ponto.confirmar, cor: '#0ea5e9' },
              ].map(linhaTip => (
                <div key={linhaTip.label} className="flex items-center gap-2">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: linhaTip.cor }} />
                  <dt className="flex-1 text-[10px] text-slate-500">{linhaTip.label}</dt>
                  <dd className="text-[11px] font-semibold tabular-nums text-slate-900">{linhaTip.valor}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-1.5 border-t border-slate-100 pt-1.5 text-[10px] text-slate-400">{numero(ponto.registros)} lançamentos no dia</p>
          </div>
        )}
      </div>
      <p className="mt-2 text-[10px] text-slate-400">
        Setas ← → percorrem os dias. <button type="button" onClick={onNavigate} className="font-semibold text-emerald-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40">Abrir lançamentos</button>
      </p>
    </div>
  );
}

export default function Dashboard({
  obras = [], equipamentos, funcionarios, historyLogs, controlesEquipamentos = [],
  ordensServico = [], onNavigate,
}: DashboardProps) {
  const [periodo, setPeriodo] = useState<Periodo>(7);
  const [tipo, setTipo] = useState('');
  const [familia, setFamilia] = useState('');
  const [situacao, setSituacao] = useState<Bucket | ''>('');

  const hoje = iso(new Date());
  const inicio = useMemo(() => {
    const data = new Date(`${hoje}T12:00:00`);
    data.setDate(data.getDate() - (periodo - 1));
    return iso(data);
  }, [hoje, periodo]);

  const equipamentoPorId = useMemo(
    () => new Map(equipamentos.map(item => [item.id, item])),
    [equipamentos],
  );

  /** Opções dos filtros: só o que existe de fato no cadastro da frota. */
  const tiposDisponiveis = useMemo(
    () => Array.from(new Set(equipamentos.map(item => item.tipo).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [equipamentos],
  );
  const familiasDisponiveis = useMemo(
    () => Array.from(new Set([
      ...equipamentos.map(item => item.familia || ''),
      ...controlesEquipamentos.map(item => item.familia || ''),
    ].filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [equipamentos, controlesEquipamentos],
  );

  const atendeDimensao = useCallback((registro: ControleEquipamentoDiario) => {
    const equipamento = registro.equipamentoId ? equipamentoPorId.get(registro.equipamentoId) : undefined;
    if (tipo && (equipamento?.tipo || registro.tipoEquipamento || '') !== tipo) return false;
    if (familia && (registro.familia || equipamento?.familia || '') !== familia) return false;
    return true;
  }, [equipamentoPorId, tipo, familia]);

  const analise = useMemo(() => {
    const janela = controlesEquipamentos.filter(item => item.data >= inicio && item.data <= hoje && atendeDimensao(item));

    /** Foto atual da frota: o lançamento mais recente de cada equipamento. */
    const ultimoPorEquipamento = new Map<string, ControleEquipamentoDiario>();
    janela.forEach(registro => {
      const chave = registro.equipamentoId || registro.prefixo;
      if (!chave) return;
      const anterior = ultimoPorEquipamento.get(chave);
      const maisNovo = !anterior
        || registro.data > anterior.data
        || (registro.data === anterior.data && (registro.atualizadoEm || '') > (anterior.atualizadoEm || ''));
      if (maisNovo) ultimoPorEquipamento.set(chave, registro);
    });

    const foto = Array.from(ultimoPorEquipamento.values());
    const porBucket = { operacao: 0, manutencao: 0, confirmar: 0, disponivel: 0 } as Record<Bucket, number>;
    foto.forEach(registro => { porBucket[BUCKET_DE_STATUS[registro.status] ?? 'disponivel'] += 1; });

    const frotaAtiva = equipamentos.filter(item => {
      if (item.status === 'Desmobilizado') return false;
      if (tipo && item.tipo !== tipo) return false;
      if (familia && (item.familia || '') !== familia) return false;
      return true;
    });
    const base = foto.length || frotaAtiva.length;
    // Mesma leitura de disponibilidade que o painel já usava: frota em operação
    // sobre a frota acompanhada no período.
    const disponibilidade = base ? Math.round((porBucket.operacao / base) * 100) : 0;

    const evolucao: PontoEvolucao[] = Array.from({ length: periodo }, (_, indice) => {
      const data = new Date(`${hoje}T12:00:00`);
      data.setDate(data.getDate() - (periodo - 1 - indice));
      const dia = iso(data);
      const doDia = janela.filter(registro => registro.data === dia);
      const distintos = (bucket: Bucket) => new Set(
        doDia.filter(registro => (BUCKET_DE_STATUS[registro.status] ?? 'disponivel') === bucket)
          .map(registro => registro.equipamentoId || registro.prefixo),
      ).size;
      return {
        data: dia,
        operacao: distintos('operacao'),
        manutencao: distintos('manutencao'),
        confirmar: distintos('confirmar'),
        registros: doDia.length,
      };
    });

    const visiveis = situacao ? foto.filter(registro => (BUCKET_DE_STATUS[registro.status] ?? 'disponivel') === situacao) : foto;

    return { janela, foto, visiveis, porBucket, frotaAtiva, base, disponibilidade, evolucao };
  }, [controlesEquipamentos, equipamentos, inicio, hoje, periodo, situacao, tipo, familia, atendeDimensao]);

  /** Pendências só entram aqui se houver ação clara do outro lado do clique. */
  const pendencias = useMemo(() => {
    const comOs = new Set(ordensServico.filter(item => !['Concluída', 'Cancelada'].includes(item.status)).map(item => item.equipamentoId));
    const confirmarAtrasado = analise.janela.filter(item => item.status === 'A confirmar' && item.data < hoje);
    const manutencaoSemOs = analise.foto.filter(item => BUCKET_DE_STATUS[item.status] === 'manutencao' && !item.ordemServicoId && !comOs.has(item.equipamentoId));
    const semLiberacao = analise.janela.filter(item => item.horaEntradaManutencao && !item.horaLiberacao);
    const semMotorista = analise.janela.filter(item => item.status === 'Em operação' && !item.funcionarioId && !item.codigoFuncionario);
    return [
      { id: 'confirmar', total: confirmarAtrasado.length, titulo: 'Lançamentos a confirmar de dias anteriores', detalhe: 'Fecham o dia da frota sem status definitivo', destino: 'controle-equipamentos' },
      { id: 'os', total: manutencaoSemOs.length, titulo: 'Equipamentos em manutenção sem ordem de serviço', detalhe: 'Parados sem OS aberta para acompanhar', destino: 'manutencao' },
      { id: 'liberacao', total: semLiberacao.length, titulo: 'Entradas em manutenção sem hora de liberação', detalhe: 'A hora parada continua contando', destino: 'horas-paradas' },
      { id: 'motorista', total: semMotorista.length, titulo: 'Equipamentos em operação sem motorista informado', detalhe: 'Impede o vínculo com o apontamento', destino: 'controle-equipamentos' },
    ].filter(item => item.total > 0);
  }, [analise.janela, analise.foto, ordensServico, hoje]);

  // O histórico grava a data no formato brasileiro, não em ISO: ordenar pelo
  // texto colocaria o dia 30 na frente do dia 08 do mês seguinte.
  const atividade = useMemo(() => historyLogs
    .filter(log => TELAS_DE_FROTA.some(tela => (log.tela || '').includes(tela)))
    .map(log => ({ log, instante: instanteDoHistorico(log.timestamp) }))
    .sort((a, b) => (Number.isFinite(b.instante) ? b.instante : -Infinity) - (Number.isFinite(a.instante) ? a.instante : -Infinity))
    .slice(0, 6), [historyLogs]);

  const funcionarioPorId = useMemo(() => new Map(funcionarios.map(item => [item.id, item])), [funcionarios]);
  const previa = useMemo(() => analise.visiveis
    .slice()
    .sort((a, b) => (b.data || '').localeCompare(a.data || '') || (a.prefixo || '').localeCompare(b.prefixo || ''))
    .slice(0, 8), [analise.visiveis]);

  const semDados = controlesEquipamentos.length === 0;
  const semDadosNoPeriodo = !semDados && analise.janela.length === 0;
  const obra = obras.find(item => item.status === 'Ativa') || obras[0];
  const rotuloPeriodo = `${diaBr(inicio)} a ${diaBr(hoje)} · ${periodo} dias`;
  const filtroAtivo = Boolean(tipo || familia || situacao);

  return (
    <div id="dashboard-tab" className="renea-page-dashboard min-h-full bg-[#f8f7f4] pb-14">
      <PageHeader
        eyebrow="Operação em tempo real"
        photo="rodovia-duplicada"
        title="Visão operacional"
        description={`${obra?.nome || 'Obra não informada'} · ${rotuloPeriodo}`}
      />
      <div className="border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
        <nav className="-mx-4 flex overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8" aria-label="Módulos da obra">
          {PROJECT_TABS.map(aba => (
            <button
              key={aba.target}
              type="button"
              onClick={() => onNavigate(aba.target)}
              aria-current={aba.target === 'dashboard' ? 'page' : undefined}
              className={`h-11 shrink-0 border-b-2 px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 sm:px-4 ${
                aba.target === 'dashboard' ? 'border-emerald-700 text-emerald-800' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
              }`}
            >
              {aba.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 lg:px-8">
        {/* Filtros em uma linha só, acima de tudo que eles alteram. */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5">
          <div className="flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Período do painel">
            {PERIODOS.map(dias => (
              <button
                key={dias}
                type="button"
                onClick={() => setPeriodo(dias)}
                aria-pressed={periodo === dias}
                className={`h-8 rounded-md px-3 text-[11px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                  periodo === dias ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {dias} dias
              </button>
            ))}
          </div>
          <label className="sr-only" htmlFor="painel-tipo">Tipo de equipamento</label>
          <select
            id="painel-tipo"
            value={tipo}
            onChange={evento => setTipo(evento.target.value)}
            className="h-8 min-w-32 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
          >
            <option value="">Todos os tipos</option>
            {tiposDisponiveis.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <label className="sr-only" htmlFor="painel-familia">Grupo / família</label>
          <select
            id="painel-familia"
            value={familia}
            onChange={evento => setFamilia(evento.target.value)}
            className="h-8 min-w-32 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
          >
            <option value="">Todos os grupos</option>
            {familiasDisponiveis.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <label className="sr-only" htmlFor="painel-situacao">Situação</label>
          <select
            id="painel-situacao"
            value={situacao}
            onChange={evento => setSituacao(evento.target.value as Bucket | '')}
            className="h-8 min-w-32 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
          >
            <option value="">Todas as situações</option>
            {BUCKETS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          {filtroAtivo && (
            <button
              type="button"
              onClick={() => { setTipo(''); setFamilia(''); setSituacao(''); }}
              className="h-8 rounded-lg px-2 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
            >
              Limpar filtros
            </button>
          )}
          {/* Quantos lançamentos sustentam os números da tela: fica junto dos
              filtros porque é o filtro que muda esse total. */}
          <p className="ml-auto flex items-center gap-2 text-[11px] font-medium text-slate-600">
            <span className="size-2 rounded-full bg-emerald-600" aria-hidden="true" />
            {numero(analise.janela.length)} lançamentos de frota no período
          </p>
        </div>

        {semDados ? (
          <div className="mt-3 flex min-h-64 flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-6 text-center">
            <Truck className="size-7 text-slate-700" strokeWidth={1.6} aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-slate-800">Nenhum lançamento de frota registrado</p>
              <p className="mt-1 text-xs text-slate-500">O painel é montado a partir do controle operacional diário.</p>
            </div>
            <LinkPainel onClick={() => onNavigate('controle-equipamentos')}>Abrir controle operacional</LinkPainel>
          </div>
        ) : (
          <>
            <section className="mt-3 grid grid-cols-2 gap-2.5 xl:grid-cols-5" aria-label="Indicadores da frota">
              <Indicador
                label="Frota ativa" valor={numero(analise.frotaAtiva.length)} icone={Truck} cor="#0f766e"
                contexto={`${numero(analise.foto.length)} com lançamento no período`}
                onClick={() => onNavigate('frota')}
              />
              {BUCKETS.slice(0, 3).map(bucket => (
                <Indicador
                  key={bucket.id}
                  label={bucket.label}
                  valor={numero(analise.porBucket[bucket.id])}
                  icone={bucket.id === 'operacao' ? Activity : bucket.id === 'manutencao' ? Wrench : Clock3}
                  cor={bucket.cor}
                  contexto={`${analise.base ? Math.round((analise.porBucket[bucket.id] / analise.base) * 100) : 0}% da frota acompanhada`}
                  proporcao={analise.base ? (analise.porBucket[bucket.id] / analise.base) * 100 : 0}
                  onClick={() => { setSituacao(bucket.id); onNavigate(bucket.destino); }}
                />
              ))}
              <Indicador
                label="Disponibilidade" valor={`${analise.disponibilidade}%`} icone={Gauge} cor="#059669"
                contexto={`${numero(analise.porBucket.operacao)} de ${numero(analise.base)} equipamentos`}
                proporcao={analise.disponibilidade}
                onClick={() => onNavigate('indicadores')}
              />
            </section>

            {semDadosNoPeriodo ? (
              <div className="mt-3 flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-center">
                <Clock3 className="size-6 text-slate-700" strokeWidth={1.6} aria-hidden="true" />
                <p className="text-sm font-bold text-slate-800">Sem lançamentos nos últimos {periodo} dias</p>
                <p className="text-xs text-slate-500">Aumente o período ou limpe os filtros para ver o histórico.</p>
              </div>
            ) : (
              <>
                <section className="mt-3 grid items-start gap-3 xl:grid-cols-[minmax(0,1.7fr)_minmax(19rem,.7fr)]">
                  <Painel
                    titulo="Equipamentos em operação por dia"
                    descricao={rotuloPeriodo}
                    acao={<LinkPainel onClick={() => onNavigate('controle-equipamentos')}>Lançamentos</LinkPainel>}
                  >
                    <CurvaOperacao pontos={analise.evolucao} onNavigate={() => onNavigate('controle-equipamentos')} />
                  </Painel>

                  <Painel titulo="Distribuição da frota" descricao={`Último status de ${numero(analise.foto.length)} equipamentos`}>
                    <div className="p-4 sm:p-5">
                      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-slate-100" role="presentation">
                        {BUCKETS.map(bucket => {
                          const fatia = analise.foto.length ? (analise.porBucket[bucket.id] / analise.foto.length) * 100 : 0;
                          return fatia > 0 ? <span key={bucket.id} style={{ width: `${fatia}%`, backgroundColor: bucket.cor }} /> : null;
                        })}
                      </div>
                      <ul className="mt-4 space-y-1">
                        {BUCKETS.map(bucket => {
                          const total = analise.porBucket[bucket.id];
                          const fatia = analise.foto.length ? Math.round((total / analise.foto.length) * 100) : 0;
                          return (
                            <li key={bucket.id}>
                              <button
                                type="button"
                                onClick={() => setSituacao(atual => (atual === bucket.id ? '' : bucket.id))}
                                aria-pressed={situacao === bucket.id}
                                className={`flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${situacao === bucket.id ? 'bg-slate-50' : ''}`}
                              >
                                <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: bucket.cor }} aria-hidden="true" />
                                <span className="flex-1 truncate text-[11px] font-medium text-slate-600">{bucket.label}</span>
                                <span className="text-[11px] tabular-nums text-slate-400">{fatia}%</span>
                                <strong className="w-8 text-right text-[12px] font-bold tabular-nums text-slate-900">{numero(total)}</strong>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </Painel>
                </section>

                <section className="mt-3 grid items-start gap-3 xl:grid-cols-[repeat(3,minmax(0,1fr))]">
                  <Painel titulo="Pendências críticas" descricao="Cada item abre a tela que resolve">
                    <ul className="divide-y divide-slate-100">
                      {pendencias.length ? pendencias.map(item => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => onNavigate(item.destino)}
                            className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/40 sm:px-5"
                          >
                            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700">
                              <AlertTriangle className="size-4" aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <strong className="block text-[12px] leading-snug text-slate-800">{item.titulo}</strong>
                              <small className="mt-0.5 block text-[10px] leading-snug text-slate-500">{item.detalhe}</small>
                            </span>
                            <strong className="text-sm font-bold tabular-nums text-amber-700">{numero(item.total)}</strong>
                          </button>
                        </li>
                      )) : <li><Vazio texto="Nenhuma pendência crítica na frota" /></li>}
                    </ul>
                  </Painel>

                  <Painel
                    titulo="Atividade recente"
                    descricao="Histórico dos módulos de frota"
                    acao={<LinkPainel onClick={() => onNavigate('timeline')}>Timeline</LinkPainel>}
                  >
                    <ul className="divide-y divide-slate-100">
                      {atividade.length ? atividade.map(({ log, instante }) => (
                        <li key={log.id} className="flex min-h-14 items-center gap-3 px-4 py-2.5 sm:px-5">
                          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
                            <History className="size-3.5" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <strong className="block truncate text-[12px] font-medium text-slate-800">{log.descricao}</strong>
                            <small className="mt-0.5 block truncate text-[10px] text-slate-500">
                              {log.acao} · {log.tela}
                              {Number.isFinite(instante) && ` · ${new Date(instante).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
                            </small>
                          </span>
                        </li>
                      )) : <li><Vazio texto="Sem movimentação registrada na frota" icone={History} /></li>}
                    </ul>
                  </Painel>

                  <Painel
                    titulo="Equipamentos"
                    descricao={situacao ? `Filtrado por ${BUCKETS.find(item => item.id === situacao)?.label}` : 'Último lançamento de cada equipamento'}
                    acao={<LinkPainel onClick={() => onNavigate('frota')}>Ver frota</LinkPainel>}
                  >
                    <ul className="divide-y divide-slate-100">
                      {previa.length ? previa.map(registro => {
                        const bucket = BUCKETS.find(item => item.id === (BUCKET_DE_STATUS[registro.status] ?? 'disponivel'));
                        const motorista = registro.nomeMotorista || funcionarioPorId.get(registro.funcionarioId)?.nome || 'Sem motorista';
                        return (
                          <li key={registro.id}>
                            <button
                              type="button"
                              onClick={() => onNavigate('controle-equipamentos')}
                              className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/40 sm:px-5"
                            >
                              <span className="min-w-0 flex-1">
                                <strong className="block truncate text-[12px] font-bold tabular-nums text-slate-800">{registro.prefixo || '—'}</strong>
                                <small className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-slate-500">
                                  <UserRound className="size-3 shrink-0" aria-hidden="true" />{motorista}
                                </small>
                              </span>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${bucket?.chip || 'bg-slate-100 text-slate-600'}`}>
                                {registro.status}
                              </span>
                            </button>
                          </li>
                        );
                      }) : <li><Vazio texto="Nenhum equipamento nesta situação" icone={Truck} /></li>}
                    </ul>
                  </Painel>
                </section>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
