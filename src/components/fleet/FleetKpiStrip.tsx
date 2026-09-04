import React from 'react';
import type { FleetMetrics } from '../../fleet/domain';

interface Props {
  metrics: FleetMetrics;
}

const kpis = (metrics: FleetMetrics) => [
  { label: 'Frotas', value: metrics.total, tone: 'text-slate-900' },
  { label: 'Em operação', value: metrics.operating, tone: 'text-emerald-700' },
  { label: 'Em manutenção', value: metrics.maintenance + metrics.waitingMaintenance, tone: 'text-rose-700' },
  { label: 'À disposição', value: metrics.available, tone: 'text-sky-700' },
  { label: 'A confirmar', value: metrics.pending, tone: 'text-amber-700' },
  { label: 'Disponibilidade', value: `${metrics.availabilityRate.toFixed(1).replace('.', ',')}%`, tone: 'text-emerald-700' },
  { label: 'Horas paradas', value: metrics.stoppedDurationLabel, tone: 'text-slate-900' },
];

export default function FleetKpiStrip({ metrics }: Props) {
  return (
    <section
      className="grid grid-cols-2 divide-x divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white sm:grid-cols-4 sm:divide-y-0 lg:grid-cols-7"
      aria-label="Indicadores da frota"
    >
      {kpis(metrics).map(item => (
        <div key={item.label} className="px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
          <strong className={`mt-1 block text-xl font-bold leading-none ${item.tone}`}>{item.value}</strong>
        </div>
      ))}
    </section>
  );
}
