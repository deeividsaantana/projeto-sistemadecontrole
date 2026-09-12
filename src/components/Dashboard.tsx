import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import {
  Activity, ArrowRight, BarChart3, CalendarDays, CheckCircle2, ClipboardPenLine,
  Clock3, Fuel, HardHat, PackageSearch, PauseCircle, Plus, ShieldCheck,
  Landmark, ListChecks, Package, SlidersHorizontal, Truck, Users, WalletCards, Wrench, type LucideIcon,
} from 'lucide-react';
import type {
  Abastecimento, Comboio, ControleEquipamentoDiario, ControleEstacas, Empresa,
  Equipamento, FichaVerificacaoServico, FrenteServico, Funcionario, GrupoEquipe,
  HistoryLog, Inspecao, LancamentoCusto, ListaPresenca, Lubrificacao, Material,
  Medicao, MovimentoMaterial, NaoConformidade, ObraLocal, OrcamentoItem,
  OrdemServico, PlanejamentoItem, PresencaApontamento, ProdutoLubrificacao,
  RegistroProducao, TicketJazida, TipoCombustivel,
} from '../types';
import siteAerial from '../assets/renea-editorial/rodovia-duplicada-1600.webp';
import { OBRA } from '../config/obra';
import { FLEET_STATUS_DEFINITIONS } from '../fleet/status';
import { FLEET_OPERATIONAL_STATUS } from '../fleet/domain';

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

type FleetFilter = 'Todos' | 'Em operação' | 'Em manutenção' | 'A confirmar' | 'À disposição';

const PROJECT_NAME = OBRA.nome;
const PROJECT_WORKSPACE_TABS = [
  { label: 'Geral', tab: 'dashboard', icon: Activity },
  { label: 'Cronograma', tab: 'cronograma', icon: CalendarDays },
  { label: 'Diário de obra', tab: 'diario-obra', icon: ClipboardPenLine },
  { label: 'Medições', tab: 'medicoes', icon: ListChecks },
  { label: 'Financeiro', tab: 'custos', icon: Landmark },
  { label: 'Materiais', tab: 'materiais', icon: Package },
  { label: 'Qualidade', tab: 'inspecoes', icon: ShieldCheck },
] as const;
const MAINTENANCE_STATUSES = new Set([
  'Em manutenção', 'Aguardando manutenção', 'Indisponível', 'Parado',
  'Aguardando equipamento', 'Reserva', 'Desmobilizado',
]);
const CONFIRM_STATUSES = new Set(['A confirmar', 'Aguardando motorista', 'Não classificado']);

const formatDate = (value: string) => {
  if (!value) return 'Sem data';
  const [year, month, day] = value.split('-');
  return [day, month, year].filter(Boolean).join('/');
};
const shortDate = (value: string) => {
  const [, month, day] = value.split('-');
  return [day, month].filter(Boolean).join('/');
};
const recordKey = (item: ControleEquipamentoDiario) => item.equipamentoId || item.prefixo || item.id;
const normalizeFleetStatus = (status: string): Exclude<FleetFilter, 'Todos'> | 'À disposição' => {
  if (status === 'Em operação') return 'Em operação';
  if (MAINTENANCE_STATUSES.has(status)) return 'Em manutenção';
  if (CONFIRM_STATUSES.has(status)) return 'A confirmar';
  return 'À disposição';
};
const uniqueLatestRecords = (records: ControleEquipamentoDiario[]) => {
  const byEquipment = new Map<string, ControleEquipamentoDiario>();
  records.forEach(item => {
    const key = recordKey(item);
    const current = byEquipment.get(key);
    if (!current || String(item.atualizadoEm || item.criadoEm) >= String(current.atualizadoEm || current.criadoEm)) {
      byEquipment.set(key, item);
    }
  });
  return Array.from(byEquipment.values());
};

function ActionLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#176b4d] transition hover:text-[#0b4935] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f26a2e]/40">
      {children}<ArrowRight className="size-3.5" aria-hidden="true" />
    </button>
  );
}

function Metric({ icon: Icon, label, value, detail, tone, active, onClick }: {
  icon: LucideIcon; label: string; value: string; detail: string;
  tone: 'graphite' | 'green' | 'orange' | 'amber'; active?: boolean; onClick: () => void;
}) {
  const tones = {
    graphite: 'border-[#213038] text-[#213038]',
    green: 'border-[#24965f] text-[#176b4d]',
    orange: 'border-[#f26a2e] text-[#c94f1c]',
    amber: 'border-[#e4a227] text-[#a76b08]',
  };
  return (
    <button type="button" onClick={onClick}
      className={'dashboard-metric group min-w-0 border-l bg-transparent px-5 py-5 text-left transition-colors duration-200 hover:bg-white/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#f26a2e]/60 ' + tones[tone] + (active ? ' is-active' : '')}>
      <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#47555c]">
        <Icon className="size-4 text-current" strokeWidth={1.8} aria-hidden="true" />{label}
      </span>
      <strong className="mt-3 block text-[clamp(2.6rem,4.5vw,5.2rem)] font-black leading-[0.82] tracking-[-0.07em] tabular-nums text-[#101c18]">{value}</strong>
      <span className="mt-2 block text-[11px] leading-snug text-[#718087]">{detail}</span>
    </button>
  );
}

function Panel({ title, action, children, className = '' }: {
  title: string; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={'min-w-0 border-t border-[#dce3df] bg-white ' + className}>
      <header className="flex min-h-14 items-center justify-between gap-3 px-4 sm:px-5">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-[#172329]">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

interface FleetStatusSegment {
  filter: Exclude<FleetFilter, 'Todos'>;
  label: string;
  icon: LucideIcon;
  color: string;
  value: number;
}

/**
 * Uma única barra empilhada com a leitura mais recente da frota. Cor nunca
 * carrega o significado sozinha: cada trecho tem ícone + rótulo + valor por
 * extenso na legenda, e a cor reaproveita FLEET_STATUS_DEFINITIONS — a mesma
 * paleta de status usada nos relatórios em PDF e nos badges da frota, para
 * não inventar um quarto sistema de cor dentro do painel.
 */
function StatusDistribution({ segments, total, active, onSelect }: {
  segments: FleetStatusSegment[]; total: number;
  active: FleetFilter; onSelect: (filter: FleetFilter) => void;
}) {
  if (!total) {
    return <div className="flex h-32 items-center justify-center px-5 text-sm text-[#7a878c]">Sem lançamento de frota na data mais recente</div>;
  }
  return (
    <div className="px-4 pb-5 sm:px-5">
      <div className="flex gap-0.5 overflow-hidden rounded-[4px]" role="group" aria-label="Distribuição da frota por situação">
        {segments.filter(segment => segment.value > 0).map(segment => (
          <button key={segment.filter} type="button" onClick={() => onSelect(active === segment.filter ? 'Todos' : segment.filter)}
            aria-pressed={active === segment.filter}
            title={`${segment.label}: ${segment.value} de ${total} (${(segment.value / total * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)`}
            style={{ flex: `${segment.value} 1 0%`, backgroundColor: segment.color }}
            className={'h-4 min-w-[3px] transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#f26a2e]/60' + (active !== 'Todos' && active !== segment.filter ? ' opacity-40' : '')}>
            <span className="sr-only">{segment.label}: {segment.value} equipamentos, {(segment.value / total * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>
          </button>
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {segments.map(segment => {
          const Icon = segment.icon;
          const share = total ? segment.value / total * 100 : 0;
          return (
            <li key={segment.filter}>
              <button type="button" onClick={() => onSelect(active === segment.filter ? 'Todos' : segment.filter)}
                aria-pressed={active === segment.filter}
                className={'flex w-full items-center gap-2 rounded-[2px] px-1 py-1 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f26a2e]/50' + (active === segment.filter ? ' bg-[#f2f4f1]' : ' hover:bg-[#f7f9f7]')}>
                <span className="grid size-6 shrink-0 place-items-center rounded-full" style={{ backgroundColor: segment.color + '1a' }}>
                  <Icon className="size-3.5" style={{ color: segment.color }} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-semibold text-[#47555c]">{segment.label}</span>
                  <span className="flex items-baseline gap-1.5">
                    <strong className="text-sm font-bold tabular-nums text-[#172329]">{segment.value}</strong>
                    <span className="text-[10px] tabular-nums text-[#8a969b]">{share.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function IntegratedMetric({ icon: Icon, eyebrow, value, detail, progress, featured = false, onClick }: {
  icon: LucideIcon; eyebrow: string; value: string; detail: string;
  progress?: number; featured?: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={'dashboard-integrated-metric group min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ed5d24]/55 ' + (featured ? 'is-featured' : '')}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-black uppercase tracking-[.13em] text-current/65">{eyebrow}</span>
        <Icon className="size-4 opacity-65 transition-transform duration-200 group-hover:-translate-y-0.5" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <strong className="mt-4 block truncate text-[clamp(1.9rem,3vw,3.25rem)] font-black leading-none tracking-[-.055em] tabular-nums">{value}</strong>
      <span className="mt-2 block min-h-8 text-[11px] leading-4 opacity-70">{detail}</span>
      {progress !== undefined && (
        <span className="mt-4 block h-1 overflow-hidden bg-current/10" aria-hidden="true">
          <span className="block h-full bg-current transition-[width] duration-700" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </span>
      )}
    </button>
  );
}

function ModuleSignal({ label, value, detail, progress, tone = 'green', onClick }: {
  label: string; value: string; detail: string; progress?: number;
  tone?: 'green' | 'orange' | 'graphite'; onClick: () => void;
}) {
  const barTone = tone === 'orange' ? 'bg-[#ed5d24]' : tone === 'graphite' ? 'bg-[#52615b]' : 'bg-[#16865b]';
  return (
    <button type="button" onClick={onClick} className="dashboard-module-signal group grid w-full grid-cols-[minmax(7.5rem,.8fr)_minmax(5rem,.45fr)_minmax(9rem,1.2fr)] items-center gap-4 border-t border-[#e5eae7] px-4 py-3 text-left transition hover:bg-[#f7f9f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ed5d24]/35 sm:px-5">
      <span className="text-xs font-bold text-[#25352f]">{label}</span>
      <strong className="text-lg font-black tracking-[-.035em] tabular-nums text-[#101c18]">{value}</strong>
      <span className="min-w-0">
        <span className="block truncate text-[10px] text-[#718087]">{detail}</span>
        {progress !== undefined && <span className="mt-1.5 block h-1 bg-[#e6ebe8]"><span className={'block h-full ' + barTone} style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></span>}
      </span>
    </button>
  );
}

export default function Dashboard({
  abastecimentos, historyLogs, funcionarios, listasPresenca = [], ordensServico = [],
  controlesEquipamentos = [], gruposEquipe = [], presencasLink = [], planejamento = [],
  producao = [], fichasFvs = [], inspecoes = [], naoConformidades = [],
  lancamentosCusto = [], orcamento = [], materiais = [], movimentosMaterial = [],
  frentes = [], onNavigate,
}: DashboardProps) {
  const dashboardRef = useRef<HTMLElement>(null);
  const [periodDays, setPeriodDays] = useState<7 | 14 | 30>(7);
  const [fleetFilter, setFleetFilter] = useState<FleetFilter>('Todos');
  const [selectedDate, setSelectedDate] = useState('');

  /**
   * Janela de calendário, não "os últimos N dias que têm lançamento". Com a
   * segunda leitura, 7d, 14d e 30d desenhavam exatamente o mesmo gráfico
   * sempre que a obra tinha menos dias lançados do que o período pedido — o
   * botão mudava de cor e a visualização não mudava. Dia sem lançamento entra
   * na régua do tempo com `semDados`, para o eixo esticar de verdade sem que
   * o painel invente 0% de disponibilidade onde ninguém apontou nada.
   */
  const fleetSeries = useMemo(() => {
    const comLancamento = Array.from(new Set(controlesEquipamentos.map(item => item.data).filter(Boolean))).sort();
    const fim = comLancamento.at(-1) || new Date().toISOString().slice(0, 10);
    const base = new Date(`${fim}T12:00:00`);
    const dates = Array.from({ length: periodDays }, (_, index) => {
      const dia = new Date(base);
      dia.setDate(dia.getDate() - (periodDays - 1 - index));
      return dia.toISOString().slice(0, 10);
    });
    return dates.map(date => {
      const records = uniqueLatestRecords(controlesEquipamentos.filter(item => item.data === date));
      const operating = records.filter(item => normalizeFleetStatus(item.status) === 'Em operação').length;
      const maintenance = records.filter(item => normalizeFleetStatus(item.status) === 'Em manutenção').length;
      const confirm = records.filter(item => normalizeFleetStatus(item.status) === 'A confirmar').length;
      const available = records.length - operating - maintenance - confirm;
      const availability = records.length ? ((operating + available) / records.length) * 100 : 0;
      return { date, records, operating, maintenance, confirm, available, availability, semDados: records.length === 0 };
    });
  }, [controlesEquipamentos, periodDays]);

  const latest = [...fleetSeries].reverse().find(item => !item.semDados) || fleetSeries.at(-1) || {
    date: '', records: [] as ControleEquipamentoDiario[], operating: 0,
    maintenance: 0, confirm: 0, available: 0, availability: 0,
  };
  const activePoint = fleetSeries.find(item => item.date === selectedDate) || latest;
  const activePointIndex = Math.max(0, fleetSeries.findIndex(item => item.date === activePoint.date));
  const chartWidth = 620;
  const chartHeight = 210;
  const chartPadding = 18;
  const xAt = (index: number) => fleetSeries.length <= 1
    ? chartWidth / 2
    : chartPadding + index * ((chartWidth - chartPadding * 2) / (fleetSeries.length - 1));
  const yAt = (value: number) => chartHeight - chartPadding - (Math.max(0, Math.min(100, value)) / 100) * (chartHeight - chartPadding * 2);
  const pontosMedidos = fleetSeries
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !item.semDados);
  const linePoints = pontosMedidos.map(({ item, index }) => String(xAt(index)) + ',' + String(yAt(item.availability))).join(' ');
  /** Com 30 dias na régua, um rótulo por ponto vira borrão: mostra de N em N. */
  const passoRotulo = Math.max(1, Math.ceil(fleetSeries.length / 8));

  const filteredLatest = useMemo(() => latest.records
    .filter(item => fleetFilter === 'Todos' || normalizeFleetStatus(item.status) === fleetFilter)
    .sort((a, b) => a.prefixo.localeCompare(b.prefixo, 'pt-BR'))
    .slice(0, 7), [latest.records, fleetFilter]);

  const openOrders = ordensServico.filter(item => !['Concluída', 'Cancelada'].includes(item.status));
  const overduePlans = planejamento.filter(item => item.ativo && item.dataFim < new Date().toISOString().slice(0, 10) && item.situacao !== 'Concluído');
  const openQuality = naoConformidades.filter(item => item.ativo && !['Encerrada', 'Cancelada'].includes(item.situacao));
  const fuelToday = abastecimentos.filter(item => item.data === latest.date && item.status !== 'Cancelado')
    .reduce((sum, item) => sum + Number(item.quantidadeLitros || 0), 0);
  const stock = useMemo(() => {
    const balances = new Map<string, number>();
    movimentosMaterial.forEach(item => {
      const current = balances.get(item.materialId) || 0;
      const quantity = Math.abs(Number(item.quantidade || 0));
      balances.set(item.materialId, current + (item.tipo === 'Entrada' ? quantity : item.tipo === 'Saída' ? -quantity : Number(item.quantidade || 0)));
    });
    return balances;
  }, [movimentosMaterial]);
  const criticalMaterials = materiais.filter(item => item.ativo && Number(item.estoqueMinimo || 0) > (stock.get(item.id) || 0));

  const referenceDate = useMemo(() => {
    const dates = [
      ...controlesEquipamentos.map(item => item.data),
      ...abastecimentos.map(item => item.data),
      ...presencasLink.filter(item => !item.inativoEm).map(item => item.data),
      ...listasPresenca.map(item => item.data),
      ...producao.filter(item => item.ativo).map(item => item.data),
      ...movimentosMaterial.map(item => item.data),
    ].filter(Boolean).sort();
    return dates.at(-1) || latest.date || new Date().toISOString().slice(0, 10);
  }, [abastecimentos, controlesEquipamentos, latest.date, listasPresenca, movimentosMaterial, presencasLink, producao]);

  const activeEmployees = funcionarios.filter(item => item.ativo && !['INATIVO', 'DESMOBILIZADO'].includes(item.status || 'ATIVO'));
  const linkedExpected = new Set(gruposEquipe
    .filter(item => item.status === 'ativo')
    .flatMap(item => item.funcionarioIds || []));
  const publicPresenceToday = presencasLink.filter(item => !item.inativoEm && item.data === referenceDate);
  const publicPresentIds = new Set(publicPresenceToday
    .filter(item => ['Presente', 'Atraso', 'Saída antecipada'].includes(item.status))
    .map(item => item.funcionarioId));
  const legacyListsToday = listasPresenca.filter(item => item.data === referenceDate);
  const legacyPresentIds = new Set(legacyListsToday.flatMap(item => item.funcionarios.filter(person => person.presente).map(person => person.funcionarioId)));
  const presentCount = publicPresenceToday.length ? publicPresentIds.size : legacyPresentIds.size;
  const expectedCount = linkedExpected.size || activeEmployees.length;
  const presencePercent = expectedCount ? Math.min(100, (presentCount / expectedCount) * 100) : undefined;

  const productionToday = producao.filter(item => item.ativo && item.data === referenceDate);
  const productionServices = new Set(productionToday.map(item => item.servicoId || item.servicoDescricao));
  const productionUnits = new Set(productionToday.map(item => item.unidade).filter(Boolean));
  const productionTotal = productionToday.reduce((sum, item) => sum + Number(item.quantidade || 0), 0);
  const productionValue = productionToday.length && productionUnits.size === 1
    ? `${productionTotal.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${Array.from(productionUnits)[0]}`
    : `${productionToday.length} registro${productionToday.length === 1 ? '' : 's'}`;

  const fuelOnReferenceDate = abastecimentos.filter(item => item.data === referenceDate && item.status !== 'Cancelado');
  const fuelLiters = fuelOnReferenceDate.reduce((sum, item) => sum + Number(item.quantidadeLitros || 0), 0);
  const fuelPending = fuelOnReferenceDate.filter(item => item.status && !['OK', 'Cancelado'].includes(item.status)).length;
  const executingFronts = frentes.filter(item => item.ativo && item.situacao === 'Em execução');
  const plannedFronts = frentes.filter(item => item.ativo && item.situacao === 'Planejada');

  const activePlans = planejamento.filter(item => item.ativo && item.situacao !== 'Cancelado');
  const plansDone = activePlans.filter(item => item.situacao === 'Concluído').length;
  const planningPercent = activePlans.length ? (plansDone / activePlans.length) * 100 : undefined;
  const openInspections = inspecoes.filter(item => item.ativo && !['Corrigida', 'Cancelada'].includes(item.situacao));
  const pendingFvs = fichasFvs.filter(item => item.ativo && !['Aprovada'].includes(item.situacao));
  const qualityOpen = openQuality.length + openInspections.length + pendingFvs.length;
  const referenceMonth = referenceDate.slice(0, 7);
  const monthCosts = lancamentosCusto.filter(item => item.ativo && item.data.startsWith(referenceMonth)).reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const monthBudget = orcamento.filter(item => item.ativo && item.competencia === referenceMonth).reduce((sum, item) => sum + Number(item.valorOrcado || 0), 0);
  const budgetPercent = monthBudget ? (monthCosts / monthBudget) * 100 : undefined;
  const compactCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(value);

  const activity = historyLogs.slice(0, 6);
  const latestActivityTime = activity[0]?.timestamp || (latest.date ? formatDate(latest.date) : 'Sem sincronização');
  const activeFronts = frentes.filter(item => item.ativo && item.situacao !== 'Concluída').slice(0, 3);

  const chooseFilter = (filter: FleetFilter) => {
    setFleetFilter(filter);
  };

  const statusColor = (status: (typeof FLEET_OPERATIONAL_STATUS)[keyof typeof FLEET_OPERATIONAL_STATUS]) =>
    FLEET_STATUS_DEFINITIONS.find(definition => definition.value === status)?.reportColor || '#5e6c72';
  const fleetSegments: FleetStatusSegment[] = [
    { filter: 'Em operação', label: 'Em operação', icon: Activity, color: statusColor(FLEET_OPERATIONAL_STATUS.operating), value: latest.operating },
    { filter: 'Em manutenção', label: 'Em manutenção', icon: Wrench, color: statusColor(FLEET_OPERATIONAL_STATUS.maintenance), value: latest.maintenance },
    { filter: 'A confirmar', label: 'A confirmar', icon: Clock3, color: statusColor(FLEET_OPERATIONAL_STATUS.pending), value: latest.confirm },
    { filter: 'À disposição', label: 'À disposição', icon: PauseCircle, color: statusColor(FLEET_OPERATIONAL_STATUS.available), value: latest.available },
  ];

  useGSAP(() => {
    const root = dashboardRef.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.registerPlugin(ScrollTrigger);
    const hero = root.querySelector<HTMLElement>('[data-dashboard-hero]');
    const visual = root.querySelector<HTMLElement>('[data-dashboard-visual]');
    const metrics = root.querySelectorAll<HTMLElement>('[data-dashboard-metric]');
    const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-dashboard-section]'));

    const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
    timeline.fromTo(
      hero?.querySelectorAll('[data-dashboard-hero-copy]') || [],
      { autoAlpha: 0, y: 20 },
      { autoAlpha: 1, y: 0, duration: .72, stagger: .09, clearProps: 'transform,opacity,visibility' },
    );
    if (visual) {
      timeline.fromTo(visual, { autoAlpha: 0, scale: 1.08 }, { autoAlpha: 1, scale: 1, duration: 1.1, clearProps: 'transform,opacity,visibility' }, .05);
    }
    timeline.fromTo(metrics, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: .5, stagger: .06, clearProps: 'transform,opacity,visibility' }, visual ? .18 : .1);

    sections.forEach((section, index) => {
      gsap.fromTo(section, { autoAlpha: 0, y: 22 }, {
        autoAlpha: 1,
        y: 0,
        duration: .65,
        ease: 'power3.out',
        clearProps: 'transform,opacity,visibility',
        scrollTrigger: { trigger: section, start: `top ${index < 2 ? '92%' : '88%'}`, once: true },
      });
    });

    if (visual && window.matchMedia('(min-width: 1024px)').matches) {
      const image = visual.querySelector('img');
      if (image) {
        gsap.to(image, {
          yPercent: 10,
          ease: 'none',
          scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: .55 },
        });
        const moveX = gsap.quickTo(image, 'xPercent', { duration: .7, ease: 'power3.out' });
        const moveY = gsap.quickTo(image, 'yPercent', { duration: .7, ease: 'power3.out' });
        const onMove = (event: PointerEvent) => {
          const rect = visual.getBoundingClientRect();
          moveX(((event.clientX - rect.left) / rect.width - .5) * 2.5);
          moveY(10 + ((event.clientY - rect.top) / rect.height - .5) * 2.5);
        };
        const onLeave = () => { moveX(0); moveY(10); };
        visual.addEventListener('pointermove', onMove);
        visual.addEventListener('pointerleave', onLeave);
        return () => {
          visual.removeEventListener('pointermove', onMove);
          visual.removeEventListener('pointerleave', onLeave);
        };
      }
    }
  }, { scope: dashboardRef, dependencies: [periodDays, fleetFilter, referenceDate] });

  return (
    <main ref={dashboardRef} id="dashboard-tab" className="erp-dashboard min-h-full bg-[#eef0ec] pb-14 text-[#172329]">
      <header className="dashboard-command-header dashboard-command-header--command" data-dashboard-hero>
        <div className="dashboard-command-header__copy min-w-0">
          <p className="dashboard-command-header__eyebrow" data-dashboard-hero-copy><span />Central de comando</p>
          <h1 data-dashboard-hero-copy>Visão operacional</h1>
          <p data-dashboard-hero-copy><strong>{PROJECT_NAME}</strong><span>Dados consolidados de campo, frota, pessoas, materiais e custos.</span></p>
        </div>
        <div className="dashboard-command-header__tools" data-dashboard-hero-copy>
          <div className="dashboard-command-header__status" aria-label="Estado da operação">
            <span><i />Operação conectada</span>
            <small>Posição de {formatDate(referenceDate)}</small>
          </div>
          <nav className="dashboard-command-header__actions" aria-label="Ações rápidas do painel">
            <button type="button" onClick={() => onNavigate('controle-equipamentos')}>
              <Plus className="size-4" aria-hidden="true" />Registrar operação
            </button>
            <button type="button" onClick={() => onNavigate('timeline')}>
              <SlidersHorizontal className="size-4" aria-hidden="true" />Linha do tempo
            </button>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-3 pb-8 sm:px-6 lg:px-8">
        <nav className="project-workspace-tabs" aria-label="Módulos da obra">
          {PROJECT_WORKSPACE_TABS.map(({ label, tab, icon: Icon }) => (
            <button
              key={tab}
              type="button"
              aria-current={tab === 'dashboard' ? 'page' : undefined}
              onClick={() => onNavigate(tab)}
              className={tab === 'dashboard' ? 'is-active' : ''}
            >
              <Icon className="size-4" strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <section className="dashboard-metrics grid border-b border-[#cdd6d1] bg-white" data-dashboard-section aria-label="Indicadores da frota">
          <span data-dashboard-metric><Metric icon={Activity} label="Frota ativa" value={String(latest.operating)} detail={(latest.records.length ? (latest.operating / latest.records.length) * 100 : 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '% dos informados'} tone="green" active={fleetFilter === 'Em operação'} onClick={() => chooseFilter('Em operação')} /></span>
          <span data-dashboard-metric><Metric icon={Wrench} label="Em manutenção" value={String(latest.maintenance)} detail={openOrders.length + ' ordens de serviço abertas'} tone="orange" active={fleetFilter === 'Em manutenção'} onClick={() => chooseFilter('Em manutenção')} /></span>
          <span data-dashboard-metric><Metric icon={Clock3} label="A confirmar" value={String(latest.confirm)} detail="aguardando definição operacional" tone="amber" active={fleetFilter === 'A confirmar'} onClick={() => chooseFilter('A confirmar')} /></span>
          <span data-dashboard-metric><Metric icon={Truck} label="Disponibilidade" value={latest.availability.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%'} detail={latest.date ? 'posição de ' + formatDate(latest.date) : 'sem lançamento no período'} tone="green" active={fleetFilter === 'Todos'} onClick={() => chooseFilter('Todos')} /></span>
          <div className="dashboard-metric-cta grid place-items-center px-5 py-6">
            <button type="button" onClick={() => onNavigate('controle-equipamentos')}
              className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-[2px] bg-[#083c2f] px-5 text-sm font-black text-[#ffffff] transition hover:bg-[#07513c] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f26a2e]/50">
              <Plus className="size-5" aria-hidden="true" />Novo lançamento
            </button>
          </div>
        </section>

        <section className="dashboard-integrated mt-4 overflow-hidden border border-[#d5ddd8] bg-white" data-dashboard-section aria-labelledby="integrated-operation-title">
          <header className="flex flex-wrap items-end justify-between gap-2 border-b border-[#dfe5e1] px-4 py-3 sm:px-5">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[.17em] text-[#16805a]">Dados conectados</p>
              <h2 id="integrated-operation-title" className="mt-1 text-base font-black tracking-[-.025em] text-[#10211b]">Pulso integrado da operação</h2>
            </div>
            <span className="text-[10px] font-semibold tabular-nums text-[#718087]">Posição de {formatDate(referenceDate)}</span>
          </header>
          <div className="dashboard-integrated-grid grid">
            <IntegratedMetric icon={Users} eyebrow="Pessoas em campo" value={String(presentCount)} detail={expectedCount ? `${presentCount} de ${expectedCount} previstos` : 'Sem efetivo previsto cadastrado'} progress={presencePercent} featured onClick={() => onNavigate('presenca')} />
            <IntegratedMetric icon={BarChart3} eyebrow="Produção do dia" value={productionValue} detail={`${productionServices.size} serviço(s) apontado(s)`} onClick={() => onNavigate('producao')} />
            <IntegratedMetric icon={Fuel} eyebrow="Combustível" value={`${fuelLiters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`} detail={fuelPending ? `${fuelPending} lançamento(s) pedem conferência` : `${fuelOnReferenceDate.length} abastecimento(s) conferidos`} onClick={() => onNavigate('lancamentos')} />
            <IntegratedMetric icon={HardHat} eyebrow="Frentes ativas" value={String(executingFronts.length)} detail={`${plannedFronts.length} planejada(s) para iniciar`} onClick={() => onNavigate('frentes')} />
          </div>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(23rem,.65fr)]">
          <Panel title="Saúde dos módulos" action={<span className="text-[10px] font-semibold text-[#718087]">Consolidado sem duplicar lançamentos</span>}>
            <ModuleSignal label="Planejamento" value={activePlans.length ? `${plansDone}/${activePlans.length}` : 'Sem base'} detail={activePlans.length ? 'atividades concluídas' : 'nenhuma atividade cadastrada'} progress={planningPercent} onClick={() => onNavigate('planejamento')} />
            <ModuleSignal label="Qualidade e campo" value={String(qualityOpen)} detail="FVS, inspeções e NC em tratamento" tone={qualityOpen ? 'orange' : 'green'} progress={qualityOpen ? undefined : 100} onClick={() => onNavigate(openQuality.length ? 'nao-conformidades' : openInspections.length ? 'inspecoes' : 'fvs')} />
            <ModuleSignal label="Materiais" value={String(criticalMaterials.length)} detail="itens abaixo do estoque mínimo" tone={criticalMaterials.length ? 'orange' : 'green'} progress={criticalMaterials.length ? undefined : 100} onClick={() => onNavigate('materiais')} />
            <ModuleSignal label="Custos do mês" value={monthCosts ? compactCurrency(monthCosts) : 'Sem base'} detail={monthBudget ? `${budgetPercent?.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do orçamento de ${compactCurrency(monthBudget)}` : 'orçamento da competência não informado'} progress={budgetPercent} tone={budgetPercent !== undefined && budgetPercent > 100 ? 'orange' : 'graphite'} onClick={() => onNavigate('custos')} />
          </Panel>

          <Panel title="Leitura executiva" action={<ShieldCheck className="size-4 text-[#16865b]" aria-hidden="true" />}>
            <div className="px-4 pb-5 pt-1 sm:px-5">
              <strong className="block text-3xl font-black tracking-[-.05em] tabular-nums text-[#10211b]">{openOrders.length + overduePlans.length + qualityOpen + criticalMaterials.length}</strong>
              <p className="mt-1 text-xs leading-5 text-[#718087]">pontos abertos somando manutenção, prazo, qualidade e estoque.</p>
              <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden border border-[#dfe5e1] bg-[#dfe5e1]">
                <button type="button" onClick={() => onNavigate('manutencao')} className="bg-white px-3 py-3 text-left transition hover:bg-[#f6f9f7]"><Wrench className="size-4 text-[#d34d18]" /><strong className="mt-2 block text-xl tabular-nums">{openOrders.length}</strong><span className="text-[10px] text-[#718087]">OS abertas</span></button>
                <button type="button" onClick={() => onNavigate('planejamento')} className="bg-white px-3 py-3 text-left transition hover:bg-[#f6f9f7]"><Clock3 className="size-4 text-[#d34d18]" /><strong className="mt-2 block text-xl tabular-nums">{overduePlans.length}</strong><span className="text-[10px] text-[#718087]">fora do prazo</span></button>
                <button type="button" onClick={() => onNavigate('materiais')} className="bg-white px-3 py-3 text-left transition hover:bg-[#f6f9f7]"><PackageSearch className="size-4 text-[#176b4d]" /><strong className="mt-2 block text-xl tabular-nums">{criticalMaterials.length}</strong><span className="text-[10px] text-[#718087]">estoques críticos</span></button>
                <button type="button" onClick={() => onNavigate('custos')} className="bg-white px-3 py-3 text-left transition hover:bg-[#f6f9f7]"><WalletCards className="size-4 text-[#176b4d]" /><strong className="mt-2 block truncate text-xl tabular-nums">{monthCosts ? compactCurrency(monthCosts) : '—'}</strong><span className="text-[10px] text-[#718087]">custo lançado</span></button>
              </div>
            </div>
          </Panel>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.72fr)_minmax(21rem,.78fr)]">
          <Panel title="Disponibilidade da frota" action={<div className="flex items-center gap-3"><span className="text-[10px] font-bold uppercase tracking-[.13em] text-[#748187]">Últimos {periodDays} dias</span><div className="inline-flex border border-[#d7dfda] bg-white" aria-label="Período do painel">{([7, 14, 30] as const).map(days => <button key={days} type="button" onClick={() => setPeriodDays(days)} aria-pressed={periodDays === days} className={'min-h-8 px-2 text-[10px] font-bold ' + (periodDays === days ? 'bg-[#123d31] text-[#ffffff]' : 'text-[#617078] hover:bg-[#f0f3f0]')}>{days}d</button>)}</div></div>}>
            <div className="px-4 pb-5 sm:px-5">
              <div className="flex items-end gap-3">
                <strong className="text-4xl font-semibold tracking-[-0.05em] tabular-nums">{activePoint.availability.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</strong>
                <span className="pb-1 text-xs text-[#758188]">{activePoint.operating} operando de {activePoint.records.length}</span>
              </div>
              {pontosMedidos.length ? (
                <div className="relative mt-5 overflow-hidden border-y border-[#e4e9e6] py-4">
                  <svg viewBox={'0 0 ' + chartWidth + ' ' + chartHeight} className="h-56 w-full" role="img" aria-label="Evolução da disponibilidade da frota">
                    {[25, 50, 75, 100].map(value => (
                      <g key={value}>
                        <line x1="0" x2={chartWidth} y1={yAt(value)} y2={yAt(value)} stroke="#e4e9e6" strokeWidth="1" />
                        <text x="2" y={yAt(value) - 5} fill="#8a969b" fontSize="11">{value}%</text>
                      </g>
                    ))}
                    <polyline key={`${periodDays}-${linePoints}`} className="dashboard-trend-line" points={linePoints} fill="none" stroke="#238657" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" pathLength="1" />
                    {fleetSeries.map((item, index) => (
                      <g key={item.date} className="dashboard-trend-point" style={{ animationDelay: `${260 + index * 65}ms` }}>
                        {item.semDados ? (
                          /* Marca de "não teve lançamento" fica abaixo da linha
                             de base: um ponto em cima dela seria lido como 0%. */
                          <line x1={xAt(index)} x2={xAt(index)} y1={yAt(0) + 3} y2={yAt(0) + 8} stroke="#c7d2cc" strokeWidth="2" strokeLinecap="round" />
                        ) : (
                          <circle cx={xAt(index)} cy={yAt(item.availability)} r={index === activePointIndex ? 6 : 4} fill="#fff" stroke={index === activePointIndex ? '#ed5d24' : '#238657'} strokeWidth="3" />
                        )}
                        {index % passoRotulo === 0 || index === fleetSeries.length - 1 ? (
                          <text x={xAt(index)} y={chartHeight - 2} textAnchor="middle" fill="#78858b" fontSize="11">{shortDate(item.date)}</text>
                        ) : null}
                        <circle cx={xAt(index)} cy={item.semDados ? yAt(0) : yAt(item.availability)} r="15" fill="transparent" className={item.semDados ? '' : 'cursor-pointer'}
                          onClick={() => { if (!item.semDados) setSelectedDate(item.date); }}>
                          <title>{item.semDados
                            ? formatDate(item.date) + ': sem lançamento de frota'
                            : formatDate(item.date) + ': ' + item.availability.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%'}</title>
                        </circle>
                      </g>
                    ))}
                  </svg>
                  <div className="absolute right-3 top-3 border border-[#d7dfda] bg-white px-3 py-2 text-xs shadow-[0_8px_24px_-18px_rgba(19,52,41,.55)]">
                    <strong className="block tabular-nums text-[#172329]">{activePoint.availability.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</strong>
                    <span className="text-[#758188]">{formatDate(activePoint.date)}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-5 flex h-56 items-center justify-center border-y border-[#e4e9e6] text-sm text-[#7a878c]">Sem lançamento de frota nos últimos {periodDays} dias</div>
              )}
            </div>
          </Panel>

          <Panel title="Ocorrências agora" action={<span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.12em] text-[#008b62]"><i className="size-2 rounded-full bg-[#00a875]" />Ao vivo</span>}>
            <div className="divide-y divide-[#edf0ee]">
              {activity.length ? activity.map(log => (
                <button key={log.id} type="button" onClick={() => onNavigate('auditoria')}
                  className="flex w-full gap-3 px-4 py-3 text-left transition hover:bg-[#f7f9f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#f26a2e]/30 sm:px-5">
                  <span className={'mt-1.5 size-2 shrink-0 ' + (log.acao === 'Excluiu' ? 'bg-[#d94f3d]' : log.acao === 'Editou' ? 'bg-[#e4a227]' : 'bg-[#238657]')} />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-xs font-semibold text-[#27353b]">{log.tela}</strong>
                    <span className="mt-1 block line-clamp-2 text-[11px] leading-snug text-[#718087]">{log.descricao}</span>
                  </span>
                  <time className="shrink-0 text-[10px] tabular-nums text-[#8a969b]">{log.timestamp.split(' ')[1]?.slice(0, 5) || '—'}</time>
                </button>
              )) : (
                <div className="grid min-h-64 place-content-center px-5 text-center text-sm text-[#7a878c]">Nenhuma atividade registrada</div>
              )}
            </div>
          </Panel>
        </section>

        <Panel title="Distribuição da frota" className="mt-4" action={<span className="text-[10px] font-bold uppercase tracking-[.13em] text-[#748187]">{latest.date ? 'posição de ' + formatDate(latest.date) : 'sem lançamento'} · {latest.records.length} equipamento(s)</span>}>
          <StatusDistribution segments={fleetSegments} total={latest.records.length} active={fleetFilter} onSelect={chooseFilter} />
        </Panel>

        <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(20rem,.82fr)]">
          <Panel title="Itens críticos" className="border-t-[3px] border-t-[#ed5d24]" action={<ActionLink onClick={() => onNavigate('timeline')}>Ver todos</ActionLink>}>
            <div className="divide-y divide-[#edf0ee]">
              {[
                { value: latest.maintenance, text: 'equipamento(s) em manutenção', detail: openOrders.length + ' OS abertas', target: 'manutencao', tone: 'bg-[#d94f3d]' },
                { value: latest.confirm, text: 'situação(ões) a confirmar', detail: 'fechamento operacional pendente', target: 'controle-equipamentos', tone: 'bg-[#e4a227]' },
                { value: overduePlans.length, text: 'atividade(s) fora do prazo', detail: 'planejamento requer revisão', target: 'planejamento', tone: 'bg-[#ed5d24]' },
                { value: openQuality.length + criticalMaterials.length, text: 'alerta(s) de qualidade ou estoque', detail: 'verificação recomendada', target: openQuality.length ? 'nao-conformidades' : 'materiais', tone: 'bg-[#839096]' },
              ].map(item => (
                <button key={item.text} type="button" onClick={() => onNavigate(item.target)}
                  className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-[#f7f9f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#f26a2e]/30 sm:px-5">
                  <span className={'mt-1.5 size-2 shrink-0 ' + item.tone} />
                  <span className="min-w-0 flex-1">
                    <strong className="block text-xs font-semibold text-[#27353b]">{item.value} {item.text}</strong>
                    <span className="mt-1 block text-[11px] text-[#718087]">{item.detail}</span>
                  </span>
                  <ArrowRight className="mt-1 size-3.5 shrink-0 text-[#9aa5a0]" />
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="Status das frentes" action={<ActionLink onClick={() => onNavigate('frentes')}>Ver frentes</ActionLink>}>
            <div className="divide-y divide-[#edf0ee]">
              {(activeFronts.length ? activeFronts : [{ id: 'empty', nome: 'Nenhuma frente ativa', servico: 'Cadastre as frentes de serviço', situacao: 'Planejada' as const }]).map((frente, index) => (
                <button key={frente.id} type="button" onClick={() => onNavigate('frentes')} className="group grid w-full grid-cols-[4.5rem_1fr_auto] items-center gap-3 px-4 py-3 text-left hover:bg-[#f7f9f7] sm:px-5">
                  <span className="h-11 overflow-hidden bg-[#dfe6e1]"><img src={siteAerial} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-110" style={{ objectPosition: `${35 + index * 22}% center` }} /></span>
                  <span className="min-w-0"><strong className="block truncate text-xs font-bold text-[#172329]">{frente.nome}</strong><small className="mt-1 block truncate text-[10px] text-[#718087]">{frente.servico || frente.situacao}</small></span>
                  <span className="text-[10px] font-black uppercase tracking-[.08em] text-[#087653]">{frente.situacao}</span>
                </button>
              ))}
            </div>
          </Panel>
        </section>

        <Panel title={'Equipamentos em destaque · ' + fleetFilter} className="mt-4" action={<ActionLink onClick={() => onNavigate('controle-equipamentos')}>Ver frota completa</ActionLink>}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-[#f2f4f1] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#738087]">
                <tr>
                  <th className="px-4 py-3 sm:px-5">Prefixo</th><th className="px-4 py-3">Equipamento</th>
                  <th className="px-4 py-3">Situação</th><th className="px-4 py-3">Motorista</th>
                  <th className="px-4 py-3">Saída</th><th className="px-4 py-3">Atualização</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6ebe8]">
                {filteredLatest.map(item => (
                  <tr key={item.id} onClick={() => onNavigate('controle-equipamentos')} className="cursor-pointer bg-white transition hover:bg-[#f7f9f7]">
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#172329] sm:px-5">{item.prefixo || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#5e6c72]">{item.tipoEquipamento || item.familia || 'Equipamento'}</td>
                    <td className="whitespace-nowrap px-4 py-3"><span className="inline-flex items-center gap-2"><i className={'size-2 ' + (normalizeFleetStatus(item.status) === 'Em operação' ? 'bg-[#238657]' : normalizeFleetStatus(item.status) === 'Em manutenção' ? 'bg-[#ed5d24]' : 'bg-[#e4a227]')} />{item.status}</span></td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#5e6c72]">{item.nomeMotorista || 'Não informado'}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-[#5e6c72]">{item.horaSaida || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#7b878c]">{formatDate(item.data)}</td>
                  </tr>
                ))}
                {!filteredLatest.length && (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-[#7a878c]">Nenhum equipamento encontrado neste filtro.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e4e9e6] px-4 py-3 text-[11px] text-[#718087] sm:px-5">
            <span>{filteredLatest.length} registro(s) exibido(s)</span>
            <span className="inline-flex items-center gap-2"><Fuel className="size-3.5 text-[#176b4d]" />{fuelToday.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L abastecidos na data</span>
          </footer>
        </Panel>

        {!controlesEquipamentos.length && (
          <section className="mt-4 flex flex-col items-center justify-center border border-dashed border-[#cbd5cf] bg-white px-6 py-12 text-center">
            <CalendarDays className="size-7 text-[#176b4d]" strokeWidth={1.6} />
            <h2 className="mt-3 text-base font-semibold">A visão operacional começa com o primeiro lançamento</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-[#718087]">Registre a situação da frota para liberar indicadores, evolução e pendências deste painel.</p>
            <button type="button" onClick={() => onNavigate('controle-equipamentos')} className="mt-5 inline-flex min-h-11 items-center gap-2 bg-[#183f32] px-4 text-sm font-semibold text-[#ffffff] hover:bg-[#0f3025]">
              <Plus className="size-4" />Criar lançamento
            </button>
          </section>
        )}

        {(latest.maintenance === 0 && latest.confirm === 0 && overduePlans.length === 0 && openQuality.length === 0) && controlesEquipamentos.length > 0 && (
          <div className="mt-4 flex items-center gap-3 border-l-2 border-[#238657] bg-white px-4 py-3 text-xs text-[#54636a]">
            <CheckCircle2 className="size-4 text-[#238657]" />Nenhuma pendência crítica identificada no retrato mais recente.
          </div>
        )}
      </div>
    </main>
  );
}
