import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import {
  Activity, ArrowRight, BarChart3, CalendarDays, CheckCircle2, ClipboardPenLine,
  Clock3, Fuel, HardHat, PackageSearch, Plus, ShieldCheck,
  Landmark, ListChecks, Package, SlidersHorizontal, Truck, Users, WalletCards, Wrench, type LucideIcon,
} from 'lucide-react';
import type {
  Abastecimento, ControleEquipamentoDiario, Empresa, Equipamento, FrenteServico,
  Funcionario, GrupoEquipe, Inspecao, LancamentoCusto, ListaPresenca, Material,
  Medicao, MovimentoMaterial, NaoConformidade, ObraLocal, OrcamentoItem,
  OrdemServico, PlanejamentoItem, PresencaApontamento, ProdutoLubrificacao,
  RegistroProducao, TicketJazida, TipoCombustivel,
} from '../types';
import siteAerial from '../assets/renea-editorial/rodovia-duplicada-1600.webp';
import { OBRA } from '../config/obra';
import { FLEET_STATUS_DEFINITIONS } from '../fleet/status';
import { CountUp } from '../shared/ui';
import { CardStack, TextReveal, CounterAnimated } from '../shared/AdvancedMotionComponents';
import { BentoGrid, BentoItem, BentoContainer, BentoHeader } from '../shared/BentoGrid';

interface DashboardProps {
  empresas: Empresa[]; obras: ObraLocal[]; equipamentos: Equipamento[];
  funcionarios: Funcionario[]; combustiveis: TipoCombustivel[];
  lubrificantes: ProdutoLubrificacao[]; abastecimentos: Abastecimento[];
  listasPresenca?: ListaPresenca[]; ordensServico?: OrdemServico[];
  ticketsJazida?: TicketJazida[];
  presencasLink?: PresencaApontamento[]; controlesEquipamentos?: ControleEquipamentoDiario[];
  gruposEquipe?: GrupoEquipe[]; planejamento?: PlanejamentoItem[];
  producao?: RegistroProducao[]; medicoes?: Medicao[]; materiais?: Material[];
  movimentosMaterial?: MovimentoMaterial[];
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

const MAINTENANCE_STATUSES = new Set(['Em manutenção', 'Aguardando manutenção', 'Indisponível', 'Parado', 'Aguardando equipamento', 'Reserva', 'Desmobilizado']);
const CONFIRM_STATUSES = new Set(['A confirmar', 'Aguardando motorista', 'Não classificado']);

const formatDate = (value: string) => {
  if (!value) return 'Sem data';
  const [year, month, day] = value.split('-');
  return [day, month, year].filter(Boolean).join('/');
};

const normalizeFleetStatus = (status: string): Exclude<FleetFilter, 'Todos'> | 'À disposição' => {
  if (status === 'Em operação') return 'Em operação';
  if (MAINTENANCE_STATUSES.has(status)) return 'Em manutenção';
  if (CONFIRM_STATUSES.has(status)) return 'A confirmar';
  return 'À disposição';
};

const uniqueLatestRecords = (records: ControleEquipamentoDiario[]) => {
  const byEquipment = new Map<string, ControleEquipamentoDiario>();
  records.forEach(item => {
    const key = item.equipamentoId || item.prefixo || item.id;
    const current = byEquipment.get(key);
    if (!current || String(item.atualizadoEm || item.criadoEm) >= String(current.atualizadoEm || current.criadoEm)) {
      byEquipment.set(key, item);
    }
  });
  return Array.from(byEquipment.values());
};

function PremiumMetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  detail: string;
  tone: 'graphite' | 'green' | 'orange' | 'amber';
  active?: boolean;
  onClick: () => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);

  useGSAP(() => {
    if (!btnRef.current) return;
    const btn = btnRef.current;
    const onEnter = () => gsap.to(btn, { scale: 1.04, duration: 0.35, ease: 'power2.out' });
    const onLeave = () => gsap.to(btn, { scale: 1, duration: 0.35, ease: 'power2.out' });
    btn.addEventListener('mouseenter', onEnter);
    btn.addEventListener('mouseleave', onLeave);
    return () => {
      btn.removeEventListener('mouseenter', onEnter);
      btn.removeEventListener('mouseleave', onLeave);
    };
  }, { scope: btnRef });

  const tones = {
    graphite: 'border-l-slate-400 text-slate-700',
    green: 'border-l-emerald-600 text-emerald-700',
    orange: 'border-l-orange-600 text-orange-700',
    amber: 'border-l-amber-600 text-amber-700',
  };

  return (
    <button
      ref={btnRef}
      type="button"
      onClick={onClick}
      className={`group min-w-0 border-l-4 bg-white px-6 py-6 text-left transition-all duration-300 hover:shadow-lg hover:border-l-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-500 ${tones[tone]} ${active ? 'shadow-md' : ''}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
            <Icon className="size-4" strokeWidth={2} />
            {label}
          </span>
          <strong className="mt-3 block text-4xl font-black leading-tight tracking-tight text-slate-900">
            {value}
          </strong>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{detail}</p>
        </div>
      </div>
    </button>
  );
}

function PremiumPanel({
  title,
  action,
  children,
  className = '',
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md ${className}`} data-stack-card>
      <header className="flex min-h-16 items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">{title}</h2>
        {action}
      </header>
      <div className="p-6">{children}</div>
    </section>
  );
}

export default function DashboardPremium({
  abastecimentos = [],
  funcionarios = [],
  ordensServico = [],
  controlesEquipamentos = [],
  gruposEquipe = [],
  presencasLink = [],
  planejamento = [],
  producao = [],
  naoConformidades = [],
  materiais = [],
  movimentosMaterial = [],
  frentes = [],
  onNavigate,
}: DashboardProps) {
  const dashboardRef = useRef<HTMLElement>(null);
  const [fleetFilter, setFleetFilter] = useState<FleetFilter>('Todos');

  const fleetSeries = useMemo(() => {
    const periodDays = 7;
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
      return { date, records, operating, maintenance, confirm, available, availability };
    });
  }, [controlesEquipamentos]);

  const latest = [...fleetSeries].reverse()[0] || {
    operating: 0,
    maintenance: 0,
    confirm: 0,
    available: 0,
    availability: 0,
    records: [] as ControleEquipamentoDiario[],
  };

  const openOrders = ordensServico?.filter(item => !['Concluída', 'Cancelada'].includes(item.status)) || [];
  const overduePlans = planejamento?.filter(item => item.ativo && item.dataFim < new Date().toISOString().slice(0, 10) && item.situacao !== 'Concluído') || [];
  const openQuality = naoConformidades?.filter(item => item.ativo && !['Encerrada', 'Cancelada'].includes(item.situacao)) || [];
  const fuelToday = abastecimentos.filter(item => !['Cancelado'].includes(item.status)).reduce((sum, item) => sum + Number(item.quantidadeLitros || 0), 0);
  const criticalMaterials = materiais?.filter(item => item.ativo) || [];

  const referenceDate = new Date().toISOString().slice(0, 10);
  const activeEmployees = funcionarios.filter(item => item.ativo && !['INATIVO', 'DESMOBILIZADO'].includes(item.status || 'ATIVO'));
  const linkedExpected = new Set(gruposEquipe?.flatMap(item => item.funcionarioIds || []) || []);
  const publicPresenceToday = presencasLink?.filter(item => !item.inativoEm && item.data === referenceDate) || [];
  const publicPresentIds = new Set(publicPresenceToday.filter(item => ['Presente', 'Atraso', 'Saída antecipada'].includes(item.status)).map(item => item.funcionarioId));
  const presentCount = publicPresentIds.size;
  const expectedCount = linkedExpected.size || activeEmployees.length;
  const presencePercent = expectedCount ? Math.min(100, (presentCount / expectedCount) * 100) : 0;

  const productionToday = producao?.filter(item => item.ativo && item.data === referenceDate) || [];
  const productionTotal = productionToday.reduce((sum, item) => sum + Number(item.quantidade || 0), 0);

  useGSAP(() => {
    if (!dashboardRef.current) return;

    const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
    const headers = dashboardRef.current.querySelectorAll('[data-header]');
    const metrics = dashboardRef.current.querySelectorAll('[data-metric]');
    const panels = dashboardRef.current.querySelectorAll('[data-stack-card]');

    timeline
      .fromTo(headers, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6 }, 0)
      .fromTo(metrics, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.08 }, 0.2)
      .fromTo(panels, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.12 }, 0.6);
  }, { scope: dashboardRef });

  return (
    <main ref={dashboardRef} className="min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-50 via-white to-slate-50 pb-24">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-40" data-header>
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex items-end justify-between gap-6">
            <div>
              <TextReveal className="text-5xl font-black tracking-tight text-slate-900 max-w-2xl">
                Painel Operacional
              </TextReveal>
              <p className="mt-3 text-lg text-slate-600">
                <strong>{PROJECT_NAME}</strong> — Visão integrada de campo, frota e operação
              </p>
            </div>
            <button
              onClick={() => onNavigate('controle-equipamentos')}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 font-bold text-white transition-all duration-300 hover:scale-105 hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <Plus className="size-5" />
              Novo lançamento
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-7xl flex gap-1 overflow-x-auto">
          {PROJECT_WORKSPACE_TABS.map(({ label, tab, icon: Icon }) => (
            <button
              key={tab}
              onClick={() => onNavigate(tab)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-slate-600 transition-all duration-200 hover:text-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg hover:bg-emerald-50"
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* KPI Grid */}
        <div className="mb-16">
          <CardStack className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div data-metric>
              <PremiumMetricCard
                icon={Truck}
                label="Frota Ativa"
                value={<CountUp value={latest.operating} />}
                detail={`${((latest.operating / (latest.records.length || 1)) * 100).toFixed(1)}% operacional`}
                tone="green"
                onClick={() => setFleetFilter('Em operação')}
              />
            </div>

            <div data-metric>
              <PremiumMetricCard
                icon={Wrench}
                label="Em Manutenção"
                value={<CountUp value={latest.maintenance} />}
                detail={`${openOrders.length} ordens abertas`}
                tone="orange"
                onClick={() => setFleetFilter('Em manutenção')}
              />
            </div>

            <div data-metric>
              <PremiumMetricCard
                icon={Clock3}
                label="A Confirmar"
                value={<CountUp value={latest.confirm} />}
                detail="Aguardando decisão"
                tone="amber"
                onClick={() => setFleetFilter('A confirmar')}
              />
            </div>

            <div data-metric>
              <PremiumMetricCard
                icon={Activity}
                label="Disponibilidade"
                value={`${latest.availability.toFixed(1)}%`}
                detail="Posição atual da frota"
                tone="graphite"
                onClick={() => setFleetFilter('Todos')}
              />
            </div>
          </CardStack>
        </div>

        {/* Main Bento Grid */}
        <BentoContainer>
          <BentoHeader
            title="Dados Consolidados"
            description="Integração de campo, operação e decisão em tempo real"
          />

          <BentoGrid>
            {/* Presença */}
            <BentoItem colSpan={1} rowSpan={1}>
              <div className="flex flex-col justify-between h-full">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">PRESENÇA</p>
                  <strong className="mt-3 block text-3xl font-black text-slate-900">
                    <CounterAnimated from={0} to={presentCount} duration={1} />
                  </strong>
                  <p className="mt-2 text-xs text-slate-600">de {expectedCount} esperados</p>
                </div>
                <div className="mt-4 h-1 bg-emerald-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-600" style={{ width: `${presencePercent}%` }} />
                </div>
              </div>
            </BentoItem>

            {/* Produção */}
            <BentoItem colSpan={1} rowSpan={1}>
              <div className="flex flex-col justify-between h-full">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">PRODUÇÃO</p>
                  <strong className="mt-3 block text-3xl font-black text-slate-900">
                    {productionToday.length}
                  </strong>
                  <p className="mt-2 text-xs text-slate-600">registros hoje</p>
                </div>
              </div>
            </BentoItem>

            {/* Combustível */}
            <BentoItem colSpan={1} rowSpan={1}>
              <div className="flex flex-col justify-between h-full">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">COMBUSTÍVEL</p>
                  <strong className="mt-3 block text-3xl font-black text-slate-900">
                    {fuelToday.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} L
                  </strong>
                  <p className="mt-2 text-xs text-slate-600">abastecido</p>
                </div>
              </div>
            </BentoItem>

            {/* Frentes Ativas */}
            <BentoItem colSpan={1} rowSpan={1}>
              <div className="flex flex-col justify-between h-full">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">FRENTES</p>
                  <strong className="mt-3 block text-3xl font-black text-slate-900">
                    {frentes?.length || 0}
                  </strong>
                  <p className="mt-2 text-xs text-slate-600">em andamento</p>
                </div>
              </div>
            </BentoItem>

            {/* Pendências Críticas - Destaque */}
            <BentoItem colSpan={2} rowSpan={2}>
              <div className="flex flex-col justify-between h-full bg-gradient-to-br from-red-50 to-orange-50 rounded-lg p-6 border border-red-200">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-red-700">PENDÊNCIAS CRÍTICAS</p>
                  <strong className="mt-4 block text-5xl font-black text-red-900">
                    {openOrders.length + overduePlans.length + openQuality.length}
                  </strong>
                  <p className="mt-2 text-sm text-red-700">Manutenção, prazo e qualidade</p>
                </div>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  <button
                    onClick={() => onNavigate('manutencao')}
                    className="flex flex-col items-center gap-2 rounded-lg bg-white p-3 text-center text-xs font-bold text-slate-700 hover:bg-red-100 transition-colors"
                  >
                    <Wrench className="size-5 text-red-600" />
                    {openOrders.length} OS
                  </button>
                  <button
                    onClick={() => onNavigate('planejamento')}
                    className="flex flex-col items-center gap-2 rounded-lg bg-white p-3 text-center text-xs font-bold text-slate-700 hover:bg-red-100 transition-colors"
                  >
                    <Clock3 className="size-5 text-amber-600" />
                    {overduePlans.length} Atraso
                  </button>
                  <button
                    onClick={() => onNavigate('nao-conformidades')}
                    className="flex flex-col items-center gap-2 rounded-lg bg-white p-3 text-center text-xs font-bold text-slate-700 hover:bg-red-100 transition-colors"
                  >
                    <ShieldCheck className="size-5 text-orange-600" />
                    {openQuality.length} NC
                  </button>
                </div>
              </div>
            </BentoItem>

            {/* Materiais Críticos */}
            <BentoItem colSpan={1} rowSpan={1}>
              <div className="flex flex-col justify-between h-full">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">ESTOQUES CRÍTICOS</p>
                  <strong className="mt-3 block text-3xl font-black text-amber-900">
                    {criticalMaterials.length}
                  </strong>
                  <p className="mt-2 text-xs text-slate-600">abaixo do mínimo</p>
                </div>
              </div>
            </BentoItem>
          </BentoGrid>
        </BentoContainer>

        {/* Bottom Panels */}
        <div className="mt-16 grid gap-6 lg:grid-cols-2">
          <PremiumPanel title="Módulos da Operação">
            <div className="space-y-4">
              {[
                { label: 'Planejamento', count: planejamento?.length || 0, tab: 'planejamento' },
                { label: 'Qualidade', count: openQuality.length, tab: 'nao-conformidades' },
                { label: 'Materiais', count: materiais?.length || 0, tab: 'materiais' },
              ].map(({ label, count, tab }) => (
                <button
                  key={tab}
                  onClick={() => onNavigate(tab)}
                  className="flex w-full items-center justify-between rounded-lg p-4 hover:bg-slate-100 transition-colors text-left"
                >
                  <span className="font-bold text-slate-900">{label}</span>
                  <span className="text-2xl font-black text-emerald-600">{count}</span>
                </button>
              ))}
            </div>
          </PremiumPanel>

          <PremiumPanel title="Atalhos Rápidos">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Combustível', tab: 'lancamentos', icon: Fuel },
                { label: 'Frota', tab: 'controle-equipamentos', icon: Truck },
                { label: 'Presença', tab: 'presenca', icon: Users },
                { label: 'Cronograma', tab: 'cronograma', icon: CalendarDays },
              ].map(({ label, tab, icon: Icon }) => (
                <button
                  key={tab}
                  onClick={() => onNavigate(tab)}
                  className="flex flex-col items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 transition-all hover:border-emerald-300 hover:bg-emerald-50"
                >
                  <Icon className="size-6 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-700">{label}</span>
                </button>
              ))}
            </div>
          </PremiumPanel>
        </div>
      </div>
    </main>
  );
}
