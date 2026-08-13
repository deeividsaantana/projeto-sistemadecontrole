import React from 'react';
import type { FleetMetrics } from '../../fleet/domain';

interface Props {
  metrics: FleetMetrics;
}

const kpis = (metrics: FleetMetrics) => [
  { label: 'Total CBs', value: metrics.total, tone: 'border-slate-200 bg-slate-50 text-slate-900' },
  { label: 'Em operação', value: metrics.operating, tone: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  { label: 'Em manutenção', value: metrics.maintenance + metrics.waitingMaintenance, tone: 'border-rose-200 bg-rose-50 text-rose-800' },
  { label: 'À disposição', value: metrics.available, tone: 'border-sky-200 bg-sky-50 text-sky-800' },
  { label: 'Aguard. motorista', value: metrics.waitingDriver, tone: 'border-cyan-200 bg-cyan-50 text-cyan-800' },
  { label: 'Horas paradas', value: metrics.stoppedDurationLabel, tone: 'border-amber-200 bg-amber-50 text-amber-900' },
];

export default function FleetKpiStrip({ metrics }: Props) {
  return (
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6" aria-label="Indicadores da frota">
      {kpis(metrics).map(item => (
        <article key={item.label} className={`min-h-[78px] rounded-lg border px-3 py-3 ${item.tone}`}>
          <p className="text-[9px] font-black uppercase tracking-[0.12em] opacity-70">{item.label}</p>
          <strong className="mt-2 block text-2xl font-black leading-none">{item.value}</strong>
        </article>
      ))}
    </section>
  );
}
