/** Painel executivo do ERP RENEA: ambiente operacional, com dados reais. */
import { useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { AlertTriangle, CalendarDays, ChevronDown, ChevronRight, ClipboardCheck, Clock3, Gauge, ShieldAlert, Truck, Users, Wrench } from 'lucide-react';
import type { Abastecimento, Comboio, ControleEstacas, Empresa, Equipamento, Funcionario, HistoryLog, ListaPresenca, Lubrificacao, ObraLocal, OrdemServico, PresencaApontamento, ProdutoLubrificacao, TicketJazida, TipoCombustivel } from '../types';
import { getOperationalFuelLiters, splitOperationalFuelRecords } from '../utils/fuelAnalyticsSafety';
import { PageHeader, StatCard } from '../shared/ui';

interface DashboardProps {
  empresas: Empresa[]; obras: ObraLocal[]; equipamentos: Equipamento[]; funcionarios: Funcionario[]; comboios: Comboio[]; combustiveis: TipoCombustivel[]; lubrificantes: ProdutoLubrificacao[]; abastecimentos: Abastecimento[]; lubrificacoes: Lubrificacao[]; historyLogs: HistoryLog[]; listasPresenca?: ListaPresenca[]; ordensServico?: OrdemServico[]; ticketsJazida?: TicketJazida[]; estacas?: ControleEstacas; presencasLink?: PresencaApontamento[]; onNavigate: (tab: string) => void;
}
const formatLiters = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const attendees = (list: ListaPresenca) => Array.isArray(list.funcionarios) ? list.funcionarios : [];
const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function Dashboard({ obras, equipamentos, funcionarios, abastecimentos, historyLogs, listasPresenca = [], ordensServico = [], onNavigate }: DashboardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const today = new Date().toISOString().slice(0, 10);
  const formattedToday = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
  const overview = useMemo(() => {
    const { operational, review } = splitOperationalFuelRecords(abastecimentos);
    const totalLiters = operational.reduce((total, row) => total + (getOperationalFuelLiters(row) || 0), 0);
    const active = equipamentos.filter(item => item.status === 'Ativo' || item.status === 'Mobilizado').length;
    const maintenance = equipamentos.filter(item => item.status === 'Manutenção').length;
    const waitingDriver = equipamentos.filter(item => item.status === 'Esperando motorista').length;
    const available = waitingDriver;
    const openOrders = ordensServico.filter(item => ['Aberta', 'Em Andamento', 'Aguardando Peça'].includes(item.status));
    const urgentOrders = openOrders.filter(item => item.prioridade === 'Urgente');
    const activeWorks = obras.filter(item => item.status === 'Ativa');
    const worksWithoutAttendance = activeWorks.filter(work => !listasPresenca.some(list => list.obraId === work.id && list.data === today));
    const latestLists = activeWorks.map(work => listasPresenca.filter(list => list.obraId === work.id).sort((a, b) => b.data.localeCompare(a.data))[0]).filter((item): item is ListaPresenca => Boolean(item));
    const peopleListed = latestLists.reduce((total, list) => total + attendees(list).length, 0);
    const peoplePresent = latestLists.reduce((total, list) => total + attendees(list).filter(person => person.presente).length, 0);
    const teamsInField = Math.max(0, activeWorks.length - worksWithoutAttendance.length);
    return { totalLiters, active, maintenance, waitingDriver, available, openOrders: openOrders.length, urgentOrders: urgentOrders.length, fuelReview: review.length, worksWithoutAttendance, peopleListed, peoplePresent, teamsInField };
  }, [abastecimentos, equipamentos, ordensServico, obras, listasPresenca, today]);
  const presenceRate = overview.peopleListed ? Math.round((overview.peoplePresent / overview.peopleListed) * 100) : 0;
  const totalEquipment = equipamentos.length;
  const operationalRate = totalEquipment ? Math.round((overview.active / totalEquipment) * 100) : 0;
  const fleetSituation = [
    { label: 'Em operação', value: overview.active, color: '#087345' },
    { label: 'Em manutenção', value: overview.maintenance, color: '#d97706' },
    { label: 'À disposição', value: overview.available, color: '#94a3b8' },
  ];
  const fleetDonutGradient = useMemo(() => {
    const total = fleetSituation.reduce((sum, item) => sum + item.value, 0);
    if (!total) return 'conic-gradient(#e1ebe5 0deg 360deg)';
    let cursor = 0;
    const stops = fleetSituation.map(item => {
      const start = cursor;
      cursor += (item.value / total) * 360;
      return `${item.color} ${start}deg ${cursor}deg`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  }, [fleetSituation]);
  // Atividade real (histórico de ações) dos últimos 7 dias — nada fictício, é contagem de eventos já registrados.
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
  const alerts = [
    ...(overview.urgentOrders ? [{ id: 'urgent-os', tone: 'danger' as const, title: `${overview.urgentOrders} ordem(ns) de serviço urgente(s)`, detail: 'Priorize a avaliação dos equipamentos críticos.', badge: overview.urgentOrders, tab: 'controle-equipamentos' }] : []),
    ...(overview.waitingDriver ? [{ id: 'operators', tone: 'warning' as const, title: 'Equipamentos aguardando operador', detail: 'Verifique a escala para evitar indisponibilidade.', badge: overview.waitingDriver, tab: 'controle-equipamentos' }] : []),
    ...(overview.worksWithoutAttendance.length ? [{ id: 'attendance', tone: 'info' as const, title: 'Equipes sem presença hoje', detail: overview.worksWithoutAttendance.slice(0, 2).map(item => item.nome).join(' · '), badge: overview.worksWithoutAttendance.length, tab: 'presenca' }] : []),
    ...(overview.fuelReview ? [{ id: 'fuel', tone: 'warning' as const, title: 'Abastecimentos para conferência', detail: 'Os registros foram preservados e aguardam revisão.', badge: overview.fuelReview, tab: 'lancamentos' }] : []),
    ...(overview.maintenance ? [{ id: 'maintenance', tone: 'neutral' as const, title: 'Equipamentos em manutenção', detail: 'Acompanhe liberação, oficina e horas paradas.', badge: overview.maintenance, tab: 'controle-equipamentos' }] : []),
  ];
  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !dashboardRef.current) return;
    gsap.fromTo(dashboardRef.current.querySelectorAll('[data-erp-enter]'), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.38, stagger: 0.045, ease: 'power2.out', clearProps: 'transform,opacity,visibility' });
  }, { scope: dashboardRef, dependencies: [overview.active, overview.openOrders, historyLogs.length] });
  const activeFleet = equipamentos.filter(item => item.status === 'Ativo' || item.status === 'Mobilizado').slice(0, 5);
  return <div ref={dashboardRef} id="dashboard-tab" className="erp-dashboard min-h-full w-full px-5 pb-12 pt-7 sm:px-7 lg:px-9 2xl:px-10">
    <div data-erp-enter>
      <PageHeader
        title="Painel de Controle"
        description="Visão geral da operação em tempo real"
        actions={<>
          <button type="button" className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"><CalendarDays size={16} /> {formattedToday}</button>
          <button type="button" onClick={() => onNavigate('controle-equipamentos')} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#087345] px-3 text-sm font-semibold text-white"><Truck size={16} /> Abrir frotas</button>
        </>}
      />
    </div>
    <section data-erp-enter className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Equipamentos em operação" value={overview.active} icon={Truck} tone="success" />
      <StatCard label="Em manutenção" value={overview.maintenance} icon={Wrench} tone="warning" />
      <StatCard label="À disposição" value={overview.available} icon={Clock3} tone="info" />
      <StatCard label="Total de equipamentos" value={totalEquipment} icon={Gauge} tone="neutral" />
    </section>
    <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <article data-erp-enter className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Situação da frota</p>
        <div className="mt-4 flex items-center gap-5">
          <div className="relative size-28 shrink-0 rounded-full" style={{ backgroundImage: fleetDonutGradient }}>
            <div className="absolute inset-2 grid place-items-center rounded-full bg-white">
              <strong className="text-2xl font-bold text-slate-900">{operationalRate}%</strong>
              <span className="text-[10px] text-slate-500">operacional</span>
            </div>
          </div>
          <ul className="flex-1 space-y-2">
            {fleetSituation.map(item => (
              <li key={item.label} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 text-slate-600"><span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span>
                <strong className="text-slate-900">{item.value}</strong>
              </li>
            ))}
          </ul>
        </div>
      </article>
      <article data-erp-enter className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Movimentação · últimos 7 dias</p>
          <span className="text-xs text-slate-400">registros de ação</span>
        </div>
        <div className="mt-5 flex h-32 items-end gap-3">
          {weeklyActivity.map(day => (
            <div key={day.label} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-24 w-full items-end">
                <div className="w-full rounded-t bg-[#087345]" style={{ height: `${Math.max(4, day.pct)}%` }} title={`${day.count} registro(s)`} />
              </div>
              <span className="text-[10px] font-medium text-slate-500">{day.label}</span>
            </div>
          ))}
        </div>
      </article>
    </section>
    <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,.85fr)]">
      <article data-erp-enter className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Últimos registros</p>
            <h2 className="mt-1 text-base font-semibold text-slate-900">Frota em campo</h2>
          </div>
          <button type="button" onClick={() => onNavigate('controle-equipamentos')} className="text-sm font-semibold text-[#087345]">Ver todos <ChevronRight className="inline" size={16} /></button>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead><tr><th className="px-5 py-3 font-semibold text-slate-500">Prefixo</th><th className="px-4 py-3 font-semibold text-slate-500">Equipamento</th><th className="px-4 py-3 font-semibold text-slate-500">Responsável</th><th className="px-4 py-3 font-semibold text-slate-500">Status</th><th className="px-5 py-3 text-right font-semibold text-slate-500">Local</th></tr></thead>
            <tbody>{activeFleet.length ? activeFleet.map((equipment, index) => <tr key={equipment.id} className="border-t border-slate-100"><td className="px-5 py-3 font-mono font-bold text-slate-800">{equipment.prefixo}</td><td className="px-4 py-3"><strong className="block text-slate-700">{equipment.tipo || equipment.nome}</strong><span className="text-slate-400">{equipment.nome}</span></td><td className="px-4 py-3 text-slate-600">{equipment.operadorResponsavelNome || 'Sem vínculo informado'}</td><td className="px-4 py-3"><span className="inline-flex rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">{equipment.status}</span></td><td className="px-5 py-3 text-right text-slate-600">{obras.find(work => work.id === equipment.localAtualId)?.nome || `Frente ${index + 1}`}</td></tr>) : <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">Nenhum equipamento ativo foi encontrado para esta leitura.</td></tr>}</tbody>
          </table>
        </div>
      </article>
      <article data-erp-enter className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ação prioritária</p>
            <h2 className="mt-1 text-base font-semibold text-slate-900">Atenção operacional</h2>
          </div>
          <button type="button" onClick={() => setShowDetails(value => !value)} className="inline-flex items-center gap-1 text-xs font-semibold text-[#087345]">{showDetails ? 'Ocultar' : 'Ver tudo'} <ChevronDown className={showDetails ? 'rotate-180 transition-transform' : 'transition-transform'} size={14} /></button>
        </div>
        <div className="mt-3 divide-y divide-slate-100">
          {alerts.length ? alerts.slice(0, showDetails ? alerts.length : 3).map(alert => {
            const critical = alert.tone === 'danger';
            return <button key={alert.id} type="button" onClick={() => onNavigate(alert.tab)} className="group grid w-full grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 py-3 text-left">
              <span className={`grid size-8 place-items-center rounded-lg ${critical ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{critical ? <ShieldAlert size={16} /> : <AlertTriangle size={16} />}</span>
              <span className="min-w-0"><strong className="block truncate text-sm font-semibold text-slate-800">{alert.title}</strong><span className="mt-0.5 block truncate text-xs text-slate-500">{alert.detail}</span></span>
              <span className={`grid min-w-8 place-items-center rounded-md px-2 py-1 font-mono text-xs font-bold ${critical ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{alert.badge}</span>
            </button>;
          }) : <div className="flex items-center gap-3 py-6 text-sm text-slate-500"><span className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><ClipboardCheck size={18} /></span>Nenhuma pendência crítica identificada.</div>}
        </div>
      </article>
    </section>
    <section data-erp-enter className="mt-5 grid divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white md:grid-cols-3 md:divide-x md:divide-y-0">
      {[['Controle de frotas', 'Acompanhe situação, motoristas e relação diária.', 'controle-equipamentos', Truck], ['Presença por equipe', `${presenceRate}% de presença registrada na última relação.`, 'presenca', Users], ['Relatórios operacionais', `${formatLiters.format(overview.totalLiters)} L consolidados para análise.`, 'reports', Wrench]].map(([label, detail, tab, Icon]) => {
        const ActionIcon = Icon as typeof Truck;
        return <button key={String(tab)} type="button" onClick={() => onNavigate(String(tab))} className="group flex items-center gap-4 px-5 py-5 text-left hover:bg-slate-50">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-[#087345]"><ActionIcon size={19} /></span>
          <span className="min-w-0 flex-1"><strong className="block text-sm text-slate-800">{String(label)}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{String(detail)}</span></span>
          <ChevronRight className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" size={18} />
        </button>;
      })}
    </section>
  </div>;
}
