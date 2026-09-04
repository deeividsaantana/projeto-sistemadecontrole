/** Painel executivo do ERP RENEA: ambiente operacional, com dados reais. */
import { useMemo, useRef, useState, type ReactNode } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Activity, ChevronRight, Clock3, Gauge, ListChecks, PieChart, Truck, Wrench } from 'lucide-react';
import type { Abastecimento, Comboio, ControleEstacas, Empresa, Equipamento, Funcionario, HistoryLog, ListaPresenca, Lubrificacao, ObraLocal, OrdemServico, PresencaApontamento, ProdutoLubrificacao, TicketJazida, TipoCombustivel } from '../types';
import { splitOperationalFuelRecords } from '../utils/fuelAnalyticsSafety';
import { PageHeader, StatCard } from '../shared/ui';

interface DashboardProps {
  empresas: Empresa[]; obras: ObraLocal[]; equipamentos: Equipamento[]; funcionarios: Funcionario[]; comboios: Comboio[]; combustiveis: TipoCombustivel[]; lubrificantes: ProdutoLubrificacao[]; abastecimentos: Abastecimento[]; lubrificacoes: Lubrificacao[]; historyLogs: HistoryLog[]; listasPresenca?: ListaPresenca[]; ordensServico?: OrdemServico[]; ticketsJazida?: TicketJazida[]; estacas?: ControleEstacas; presencasLink?: PresencaApontamento[]; onNavigate: (tab: string) => void;
}
const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const ACAO_TONE: Record<HistoryLog['acao'], string> = {
  Criou: 'bg-emerald-50 text-emerald-700',
  Editou: 'bg-sky-50 text-sky-700',
  Sincronizou: 'bg-sky-50 text-sky-700',
  Excluiu: 'bg-rose-50 text-rose-700',
  Inativou: 'bg-amber-50 text-amber-700',
  Desmobilizou: 'bg-amber-50 text-amber-700',
};

const DONUT_RADIUS = 40;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

const SectionTitle = ({ icon: Icon, tone, children }: { icon: typeof Activity; tone: string; children: ReactNode }) => (
  <div className="flex items-center gap-2.5">
    <span className={`grid size-7 shrink-0 place-items-center rounded-lg text-white shadow-md ${tone}`}><Icon size={14} strokeWidth={2.5} /></span>
    <p className="text-sm font-bold text-slate-800">{children}</p>
  </div>
);

export default function Dashboard({ obras, equipamentos, abastecimentos, historyLogs, listasPresenca = [], onNavigate }: DashboardProps) {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const donutGroupRef = useRef<SVGGElement>(null);
  const percentRef = useRef<HTMLElement>(null);
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const formattedToday = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(now);
  const formattedWeekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(now);
  const overview = useMemo(() => {
    const { operational } = splitOperationalFuelRecords(abastecimentos);
    const active = equipamentos.filter(item => item.status === 'Ativo' || item.status === 'Mobilizado').length;
    const maintenance = equipamentos.filter(item => item.status === 'Manutenção').length;
    const waitingDriver = equipamentos.filter(item => item.status === 'Esperando motorista').length;
    const activeWorks = obras.filter(item => item.status === 'Ativa');
    const worksWithoutAttendance = activeWorks.filter(work => !listasPresenca.some(list => list.obraId === work.id && list.data === today));
    return { active, maintenance, available: waitingDriver, worksWithoutAttendance, operationalCount: operational.length };
  }, [abastecimentos, equipamentos, obras, listasPresenca, today]);
  const totalEquipment = equipamentos.length;
  const operationalRate = totalEquipment ? Math.round((overview.active / totalEquipment) * 100) : 0;
  const fleetSituation = [
    { label: 'Em operação', value: overview.active, color: '#087345' },
    { label: 'Em manutenção', value: overview.maintenance, color: '#d97706' },
    { label: 'À disposição', value: overview.available, color: '#94a3b8' },
  ];
  const fleetTotal = fleetSituation.reduce((sum, item) => sum + item.value, 0);
  const donutSegments = useMemo(() => {
    let offset = 0;
    return fleetSituation.map(item => {
      const length = fleetTotal ? (item.value / fleetTotal) * DONUT_CIRCUMFERENCE : 0;
      const pct = fleetTotal ? Math.round((item.value / fleetTotal) * 100) : 0;
      const segment = { ...item, length, offset, pct };
      offset += length;
      return segment;
    });
  }, [fleetSituation, fleetTotal]);
  const visibleSegmentCount = donutSegments.filter(segment => segment.length > 0).length;
  const donutGap = visibleSegmentCount > 1 ? 1.5 : 0;
  const centerLabel = hoveredSegment !== null ? donutSegments[hoveredSegment] : null;
  // Atividade real (histórico de ações) da semana — nada fictício, é contagem de eventos já registrados.
  const weeklyActivity = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      return date;
    });
    const counts = days.map(date => {
      const key = date.toLocaleDateString('pt-BR');
      return historyLogs.filter(log => log.timestamp.startsWith(key)).length;
    });
    const max = Math.max(1, ...counts);
    return days.map((date, index) => ({ label: WEEKDAY_LABELS[date.getDay()], count: counts[index], pct: Math.round((counts[index] / max) * 100) }));
  }, [historyLogs]);
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useGSAP(() => {
    if (reduceMotion || !dashboardRef.current) return;
    gsap.fromTo(dashboardRef.current.querySelectorAll('[data-erp-enter]'), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.38, stagger: 0.045, ease: 'power2.out', clearProps: 'transform,opacity,visibility' });
  }, { scope: dashboardRef, dependencies: [overview.active, historyLogs.length] });
  useGSAP(() => {
    if (!barsRef.current) return;
    const bars = barsRef.current.querySelectorAll<HTMLElement>('[data-bar]');
    if (reduceMotion) {
      bars.forEach(bar => { bar.style.height = `${bar.dataset.pct}%`; });
      return;
    }
    gsap.fromTo(bars, { height: '4%' }, {
      height: (index, target) => `${target.dataset.pct}%`,
      duration: 0.65,
      ease: 'power3.out',
      stagger: 0.06,
      delay: 0.25,
    });
  }, { scope: barsRef, dependencies: [weeklyActivity] });
  useGSAP(() => {
    if (!donutGroupRef.current) return;
    if (reduceMotion) {
      gsap.set(donutGroupRef.current, { scale: 1, opacity: 1 });
    } else {
      gsap.fromTo(donutGroupRef.current, { scale: 0.4, opacity: 0, transformOrigin: '50% 50%' }, { scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(1.6)', delay: 0.15 });
    }
    if (percentRef.current) {
      if (reduceMotion) {
        percentRef.current.textContent = `${operationalRate}%`;
      } else {
        const counter = { current: 0 };
        gsap.to(counter, {
          current: operationalRate, duration: 0.9, ease: 'power2.out', delay: 0.2,
          onUpdate: () => { if (percentRef.current) percentRef.current.textContent = `${Math.round(counter.current)}%`; },
        });
      }
    }
  }, { scope: dashboardRef, dependencies: [operationalRate, donutSegments.length] });
  const latestLogs = historyLogs.slice(0, 6);
  return <div ref={dashboardRef} id="dashboard-tab" className="erp-dashboard min-h-full w-full bg-[#f7f8f6] px-5 pb-12 pt-7 sm:px-7 lg:px-9 2xl:px-10">
    <div data-erp-enter>
      <PageHeader
        title="Painel de Controle"
        actions={<div className="text-right">
          <p className="text-sm font-semibold text-slate-700">Hoje, {formattedToday}</p>
          <p className="text-xs capitalize text-slate-400">{formattedWeekday}</p>
        </div>}
      />
    </div>
    <section data-erp-enter className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Equipamentos em Operação" value={overview.active} icon={Truck} tone="success" />
      <StatCard label="Em Manutenção" value={overview.maintenance} icon={Wrench} tone="warning" />
      <StatCard label="À Disposição" value={overview.available} icon={Clock3} tone="info" />
      <StatCard label="Total de Equipamentos" value={totalEquipment} icon={Gauge} tone="neutral" />
    </section>
    <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <article data-erp-enter className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-[0_12px_28px_-16px_rgba(15,23,42,0.25)]">
        <SectionTitle icon={PieChart} tone="bg-gradient-to-br from-emerald-500 to-emerald-700">Situação da Frota</SectionTitle>
        <div className="mt-5 flex items-center gap-6">
          <div className="relative size-36 shrink-0">
            <svg viewBox="0 0 100 100" className="size-36 -rotate-90 drop-shadow-sm">
              <circle cx="50" cy="50" r={DONUT_RADIUS} fill="none" stroke="#eef2f0" strokeWidth="13" />
              <g ref={donutGroupRef}>
                {donutSegments.map((segment, index) => segment.length > 0 && (
                  <circle
                    key={segment.label}
                    cx="50" cy="50" r={DONUT_RADIUS} fill="none"
                    stroke={segment.color}
                    strokeWidth={hoveredSegment === index ? 16 : 13}
                    strokeLinecap="round"
                    strokeDasharray={`${Math.max(0, segment.length - donutGap)} ${DONUT_CIRCUMFERENCE - segment.length + donutGap}`}
                    strokeDashoffset={-segment.offset}
                    opacity={hoveredSegment !== null && hoveredSegment !== index ? 0.35 : 1}
                    onMouseEnter={() => setHoveredSegment(index)}
                    onMouseLeave={() => setHoveredSegment(null)}
                    className="cursor-pointer transition-[stroke-width,opacity] duration-200 ease-out"
                  />
                ))}
              </g>
            </svg>
            <div className="pointer-events-none absolute inset-3 grid place-items-center rounded-full bg-white text-center shadow-inner">
              {centerLabel ? (
                <>
                  <strong className="text-2xl font-black leading-none text-slate-900">{centerLabel.value}</strong>
                  <span className="mt-1.5 max-w-[80px] text-[10px] font-semibold leading-tight text-slate-500">{centerLabel.label}</span>
                  <span className="mt-0.5 text-[10px] font-bold" style={{ color: centerLabel.color }}>{centerLabel.pct}%</span>
                </>
              ) : (
                <>
                  <strong ref={percentRef} className="text-3xl font-black leading-none text-slate-900">0%</strong>
                  <span className="mt-1.5 text-[10px] font-semibold text-slate-500">Operacional</span>
                </>
              )}
            </div>
          </div>
          <ul className="flex-1 space-y-1.5">
            {fleetSituation.map((item, index) => (
              <li
                key={item.label}
                onMouseEnter={() => setHoveredSegment(index)}
                onMouseLeave={() => setHoveredSegment(null)}
                className={`flex cursor-default items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm transition-all duration-150 ${hoveredSegment === index ? 'bg-slate-50 shadow-sm' : ''}`}
              >
                <span className="flex items-center gap-2.5 font-medium text-slate-600"><span className="size-2.5 shrink-0 rounded-full ring-4 ring-offset-0" style={{ backgroundColor: item.color, boxShadow: `0 0 0 4px ${item.color}1a` }} />{item.label}</span>
                <strong className="tabular-nums text-slate-900">{item.value}</strong>
              </li>
            ))}
          </ul>
        </div>
      </article>
      <article data-erp-enter className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-[0_12px_28px_-16px_rgba(15,23,42,0.25)]">
        <div className="flex items-center justify-between">
          <SectionTitle icon={Activity} tone="bg-gradient-to-br from-sky-500 to-sky-700">Movimentação de Atividades</SectionTitle>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Esta semana</span>
        </div>
        <div ref={barsRef} className="relative mt-7 flex h-36 items-end gap-3 border-b border-slate-100">
          {weeklyActivity.map((day, index) => (
            <div key={day.label} className="flex flex-1 flex-col items-center gap-2">
              <div className="relative flex h-28 w-full items-end justify-center">
                <span className={`absolute -top-6 text-[11px] font-black tabular-nums transition-colors duration-150 ${hoveredDay === index ? 'text-[#087345]' : 'text-slate-400'}`}>{day.count}</span>
                <div
                  data-bar
                  data-pct={Math.max(4, day.pct)}
                  onMouseEnter={() => setHoveredDay(index)}
                  onMouseLeave={() => setHoveredDay(null)}
                  className={`w-full cursor-pointer rounded-t-md bg-gradient-to-t transition-[filter] duration-150 ${hoveredDay === index ? 'from-[#065f3c] to-[#0fae6a] brightness-110' : 'from-[#065f3c] to-[#10b981]'}`}
                />
              </div>
              <span className={`text-[10px] font-bold transition-colors duration-150 ${hoveredDay === index ? 'text-slate-800' : 'text-slate-500'}`}>{day.label}</span>
            </div>
          ))}
        </div>
      </article>
    </section>
    <article data-erp-enter className="mt-5 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <SectionTitle icon={ListChecks} tone="bg-gradient-to-br from-slate-600 to-slate-800">Últimos Registros</SectionTitle>
        <button type="button" onClick={() => onNavigate('consulta-geral')} className="inline-flex items-center gap-1 text-sm font-semibold text-[#087345] transition-colors hover:text-[#065f3c]">Ver todos <ChevronRight size={16} /></button>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead><tr className="bg-slate-50/80"><th className="px-5 py-3 font-semibold text-slate-500">Horário</th><th className="px-4 py-3 font-semibold text-slate-500">Equipamento</th><th className="px-4 py-3 font-semibold text-slate-500">Descrição</th><th className="px-5 py-3 font-semibold text-slate-500">Status</th></tr></thead>
          <tbody>{latestLogs.length ? latestLogs.map(log => <tr key={log.id} className="border-t border-slate-100 transition-colors duration-150 hover:bg-emerald-50/40">
            <td className="px-5 py-3 font-mono text-slate-600">{log.timestamp.split(' ')[1] || log.timestamp}</td>
            <td className="px-4 py-3 font-medium text-slate-700">{log.tela}</td>
            <td className="px-4 py-3 text-slate-600">{log.descricao}</td>
            <td className="px-5 py-3"><span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold ${ACAO_TONE[log.acao]}`}>{log.acao}</span></td>
          </tr>) : <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-500">Nenhum registro encontrado.</td></tr>}</tbody>
        </table>
      </div>
    </article>
  </div>;
}
