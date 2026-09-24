import { useState, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Activity, ClipboardList, Truck, Users } from 'lucide-react';
import type {
  Abastecimento, Comboio, ControleEquipamentoDiario, ControleEstacas, Empresa,
  Equipamento, FichaVerificacaoServico, FrenteServico, Funcionario, GrupoEquipe,
  HistoryLog, Inspecao, LancamentoCusto, ListaPresenca, Lubrificacao, Material,
  Medicao, MovimentoMaterial, NaoConformidade, ObraLocal, OrcamentoItem,
  OrdemServico, PlanejamentoItem, PresencaApontamento, ProdutoLubrificacao,
  RegistroProducao, TicketJazida, TipoCombustivel,
} from '../types';
import { PeriodFilter, buildPeriod, type PeriodValue } from '../shared/ui';
import { buildDashboardGeneralViewModel } from '../utils/dashboardGeneral';
import { AvailabilityTrend, FleetDonut } from './dashboard/OperationalVisuals';
import { TeamActivity } from './dashboard/TeamActivity';

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
  periodo?: { from: string; to: string };
}

function ExecutiveCard({ label, value, detail, tone, icon: Icon, onClick }: { label: string; value: string | number; detail: string; tone: 'green' | 'blue' | 'orange' | 'slate'; icon: typeof Activity; onClick?: () => void }) {
  const colors = { green: 'border-emerald-200 bg-emerald-950 text-white', blue: 'border-blue-200 bg-blue-900 text-white', orange: 'border-orange-200 bg-orange-700 text-white', slate: 'border-slate-200 bg-white text-slate-950' };
  return <button type="button" onClick={onClick} data-dashboard-reveal className={`dashboard-kpi group min-h-32 min-w-0 rounded-2xl border p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${colors[tone]}`}>
    <div className="flex items-start justify-between gap-3"><span className="text-sm font-bold opacity-80">{label}</span><span className="rounded-xl bg-white/15 p-2"><Icon className="size-5" /></span></div>
    <strong className="mt-3 block break-words text-3xl font-black tabular-nums sm:text-4xl">{value}</strong><span className="mt-1 block text-xs font-semibold opacity-75">{detail}</span>
  </button>;
}

export default function Dashboard(props: DashboardProps) {
  // Period state with default to current month
  const [periodo, setPeriodo] = useState<PeriodValue>(() => buildPeriod('mes'));
  const [obraId, setObraId] = useState('');
  const dashboardRef = useRef<HTMLDivElement>(null);
  const view = useMemo(() => buildDashboardGeneralViewModel({ obraId, from: periodo.from, to: periodo.to }, props),
    [obraId, periodo.from, periodo.to, props.equipamentos, props.controlesEquipamentos, props.producao, props.abastecimentos, props.presencasLink, props.gruposEquipe, props.ordensServico]);
  const display = (value: number | null, unit = '') => value === null ? 'Sem registro' : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)}${unit ? ` ${unit}` : ''}`;

  useGSAP(() => {
    if (!dashboardRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(dashboardRef.current.querySelectorAll('[data-dashboard-reveal]'), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: .72, stagger: .065, ease: 'power3.out', clearProps: 'transform' });
  }, { scope: dashboardRef, dependencies: [obraId, periodo.from, periodo.to] });

  return (
    <div ref={dashboardRef} id="dashboard-tab" className="flex min-w-0 flex-col gap-5 p-4 sm:p-6">
      <h1 className="sr-only">Painel Geral da operação</h1>
      <div data-testid="period-filter" className="flex flex-wrap items-center gap-3">
        <label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600">Obra
          <select value={obraId} onChange={event => setObraId(event.target.value)} className="max-w-48 bg-transparent py-2 text-sm text-slate-900" aria-label="Filtrar por obra">
            <option value="">Todas as obras</option>
            {props.obras.map(obra => <option key={obra.id} value={obra.id}>{obra.nome}</option>)}
          </select>
        </label>
        <PeriodFilter value={periodo} onChange={setPeriodo} />
      </div>

      <div className="grid min-w-0 grid-flow-dense gap-4 xl:grid-cols-2" aria-label="Visualização da operação">
        <FleetDonut fleet={view.fleet} onNavigate={() => props.onNavigate('Controle Operacional de Equipamentos')} />
        <AvailabilityTrend measure={view.availability} onNavigate={() => props.onNavigate('Controle Operacional de Equipamentos')} />
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Indicadores principais">
        <ExecutiveCard label="Frota em operação" value={view.fleet.confirmed ? view.fleet.operating : 'Sem posição'} detail={`${view.fleet.confirmed} posições confirmadas`} tone="green" icon={Truck} onClick={() => props.onNavigate('Controle Operacional de Equipamentos')} />
        <ExecutiveCard label="Disponibilidade" value={view.fleet.availability === null ? 'Sem posição' : `${display(view.fleet.availability)}%`} detail="sobre posições confirmadas" tone="blue" icon={Activity} onClick={() => props.onNavigate('Controle Operacional de Equipamentos')} />
        <ExecutiveCard label="Produção" value={display(view.production.value, view.production.unit)} detail="lançamentos em m³" tone="slate" icon={Activity} onClick={() => props.onNavigate('Produção')} />
        <ExecutiveCard label="Presenças" value={display(view.presence.value)} detail="presenças registradas" tone="slate" icon={Users} onClick={() => props.onNavigate('Presença')} />
        <ExecutiveCard label="OS abertas" value={display(view.maintenance.value)} detail="pendências da frota" tone="orange" icon={ClipboardList} onClick={() => props.onNavigate('Manutenção')} />
      </section>

      <TeamActivity view={view} onNavigate={props.onNavigate} />
    </div>
  );
}
