import React from 'react';
import {
  Activity,
  BadgeCheck,
  CircleHelp,
  Clock3,
  Gauge,
  TimerReset,
  Wrench,
} from 'lucide-react';
import type { FleetMetrics } from '../../fleet/domain';

interface Props {
  metrics: FleetMetrics;
}

const kpis = (metrics: FleetMetrics) => [
  { label: 'Frotas monitoradas', value: metrics.total, icon: Activity, tone: 'text-slate-950', iconTone: 'bg-slate-100 text-slate-700', line: 'bg-slate-300' },
  { label: 'Em operação', value: metrics.operating, icon: BadgeCheck, tone: 'text-emerald-800', iconTone: 'bg-emerald-100 text-emerald-700', line: 'bg-emerald-500' },
  { label: 'Em manutenção', value: metrics.maintenance + metrics.waitingMaintenance, icon: Wrench, tone: 'text-rose-800', iconTone: 'bg-rose-100 text-rose-700', line: 'bg-rose-500' },
  { label: 'À disposição', value: metrics.available, icon: Clock3, tone: 'text-sky-800', iconTone: 'bg-sky-100 text-sky-700', line: 'bg-sky-500' },
  { label: 'A confirmar', value: metrics.pending, icon: CircleHelp, tone: 'text-amber-900', iconTone: 'bg-amber-100 text-amber-700', line: 'bg-amber-400' },
  { label: 'Disponibilidade', value: `${metrics.availabilityRate.toFixed(1).replace('.', ',')}%`, icon: Gauge, tone: 'text-emerald-800', iconTone: 'bg-emerald-100 text-emerald-700', line: 'bg-emerald-700' },
  { label: 'Horas paradas', value: metrics.stoppedDurationLabel, icon: TimerReset, tone: 'text-slate-900', iconTone: 'bg-slate-100 text-slate-700', line: 'bg-slate-400' },
];

export default function FleetKpiStrip({ metrics }: Props) {
  return (
    <section className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.05)] sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7" aria-label="Indicadores da frota">
      {kpis(metrics).map(item => (
        <article key={item.label} className={`group relative min-h-[124px] overflow-hidden border-b border-slate-100 px-4 py-4 transition-colors hover:bg-slate-50 sm:[&:nth-child(odd)]:border-r lg:[&:nth-child(4n)]:border-r-0 2xl:border-b-0 2xl:border-r 2xl:last:border-r-0 ${item.tone}`}>
          <span className={`grid size-9 place-items-center rounded-xl ${item.iconTone}`}><item.icon size={18} strokeWidth={2}/></span>
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.13em] text-slate-500">{item.label}</p>
          <strong className="mt-1 block text-[clamp(1.55rem,2.1vw,2.15rem)] font-black leading-none tracking-tight">{item.value}</strong>
          <span className={`absolute bottom-0 left-0 h-1 w-0 transition-all duration-500 group-hover:w-full ${item.line}`}/>
        </article>
      ))}
    </section>
  );
}
