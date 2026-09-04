/** Painel executivo do ERP RENEA: ambiente operacional, com dados reais. */
import { useMemo, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ChevronRight, Clock3, Gauge, Truck, Wrench } from 'lucide-react';
import type { Abastecimento, Comboio, ControleEstacas, Empresa, Equipamento, Funcionario, HistoryLog, ListaPresenca, Lubrificacao, ObraLocal, OrdemServico, PresencaApontamento, ProdutoLubrificacao, TicketJazida, TipoCombustivel } from '../types';
import { splitOperationalFuelRecords } from '../utils/fuelAnalyticsSafety';
import { PageHeader, StatCard } from '../shared/ui';

interface DashboardProps {
  empresas: Empresa[]; obras: ObraLocal[]; equipamentos: Equipamento[]; funcionarios: Funcionario[]; comboios: Comboio[]; combustiveis: TipoCombustivel[]; lubrificantes: ProdutoLubrificacao[]; abastecimentos: Abastecimento[]; lubrificacoes: Lubrificacao[]; historyLogs: HistoryLog[]; listasPresenca?: ListaPresenca[]; ordensServico?: OrdemServico[]; ticketsJazida?: TicketJazida[]; estacas?: ControleEstacas; presencasLink?: PresencaApontamento[]; onNavigate: (tab: string) => void;
}
const attendees = (list: ListaPresenca) => Array.isArray(list.funcionarios) ? list.funcionarios : [];
const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const ACAO_TONE: Record<HistoryLog['acao'], string> = {
  Criou: 'bg-emerald-50 text-emerald-700',
  Editou: 'bg-sky-50 text-sky-700',
  Sincronizou: 'bg-sky-50 text-sky-700',
  Excluiu: 'bg-rose-50 text-rose-700',
  Inativou: 'bg-amber-50 text-amber-700',
  Desmobilizou: 'bg-amber-50 text-amber-700',
};

export default function Dashboard({ obras, equipamentos, abastecimentos, historyLogs, listasPresenca = [], ordensServico = [], onNavigate }: DashboardProps) {
  const dashboardRef = useRef<HTMLDivElement>(null);
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
  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !dashboardRef.current) return;
    gsap.fromTo(dashboardRef.current.querySelectorAll('[data-erp-enter]'), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.38, stagger: 0.045, ease: 'power2.out', clearProps: 'transform,opacity,visibility' });
  }, { scope: dashboardRef, dependencies: [overview.active, historyLogs.length] });
  const latestLogs = historyLogs.slice(0, 6);
  return <div ref={dashboardRef} id="dashboard-tab" className="erp-dashboard min-h-full w-full px-5 pb-12 pt-7 sm:px-7 lg:px-9 2xl:px-10">
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
      <article data-erp-enter className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-slate-800">Situação da Frota</p>
        <div className="mt-4 flex items-center gap-5">
          <div className="relative size-28 shrink-0 rounded-full" style={{ backgroundImage: fleetDonutGradient }}>
            <div className="absolute inset-2 grid place-items-center rounded-full bg-white">
              <strong className="text-2xl font-bold text-slate-900">{operationalRate}%</strong>
              <span className="text-[10px] text-slate-500">Operacional</span>
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
          <p className="text-sm font-semibold text-slate-800">Movimentação de Atividades</p>
          <span className="text-xs text-slate-400">Esta semana</span>
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
    <article data-erp-enter className="mt-5 rounded-lg border border-slate-200 bg-white overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <p className="text-sm font-semibold text-slate-800">Últimos Registros</p>
        <button type="button" onClick={() => onNavigate('reports')} className="text-sm font-semibold text-[#087345]">Ver todos <ChevronRight className="inline" size={16} /></button>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead><tr><th className="px-5 py-3 font-semibold text-slate-500">Horário</th><th className="px-4 py-3 font-semibold text-slate-500">Equipamento</th><th className="px-4 py-3 font-semibold text-slate-500">Descrição</th><th className="px-5 py-3 font-semibold text-slate-500">Status</th></tr></thead>
          <tbody>{latestLogs.length ? latestLogs.map(log => <tr key={log.id} className="border-t border-slate-100">
            <td className="px-5 py-3 font-mono text-slate-600">{log.timestamp.split(' ')[1] || log.timestamp}</td>
            <td className="px-4 py-3 text-slate-700">{log.tela}</td>
            <td className="px-4 py-3 text-slate-600">{log.descricao}</td>
            <td className="px-5 py-3"><span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold ${ACAO_TONE[log.acao]}`}>{log.acao}</span></td>
          </tr>) : <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-500">Nenhum registro encontrado.</td></tr>}</tbody>
        </table>
      </div>
    </article>
  </div>;
}
