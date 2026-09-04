import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import type { FleetMetrics } from '../../fleet/domain';

interface Props {
  metrics: FleetMetrics;
}

const kpis = (metrics: FleetMetrics) => [
  { label: 'Frotas', value: metrics.total, tone: 'text-slate-900', dot: 'bg-slate-400' },
  { label: 'Em operação', value: metrics.operating, tone: 'text-emerald-700', dot: 'bg-emerald-500' },
  { label: 'Em manutenção', value: metrics.maintenance + metrics.waitingMaintenance, tone: 'text-rose-700', dot: 'bg-rose-500' },
  { label: 'À disposição', value: metrics.available, tone: 'text-sky-700', dot: 'bg-sky-500' },
  { label: 'A confirmar', value: metrics.pending, tone: 'text-amber-700', dot: 'bg-amber-500' },
  { label: 'Disponibilidade', value: `${metrics.availabilityRate.toFixed(1).replace('.', ',')}%`, tone: 'text-emerald-700', dot: 'bg-emerald-500' },
  { label: 'Horas paradas', value: metrics.stoppedDurationLabel, tone: 'text-slate-900', dot: 'bg-slate-400' },
];

export default function FleetKpiStrip({ metrics }: Props) {
  const stripRef = useRef<HTMLElement>(null);
  const items = kpis(metrics);

  useGSAP(() => {
    if (!stripRef.current) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    stripRef.current.querySelectorAll<HTMLElement>('[data-kpi-count]').forEach(node => {
      const target = Number(node.dataset.kpiCount || 0);
      if (reduceMotion) {
        node.textContent = target.toLocaleString('pt-BR');
        return;
      }
      const counter = { current: 0 };
      gsap.to(counter, {
        current: target,
        duration: 0.6,
        ease: 'power2.out',
        onUpdate: () => { node.textContent = Math.round(counter.current).toLocaleString('pt-BR'); },
      });
    });
  }, { scope: stripRef, dependencies: [metrics] });

  return (
    <section
      ref={stripRef}
      className="grid grid-cols-2 divide-x divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white sm:grid-cols-4 sm:divide-y-0 lg:grid-cols-7"
      aria-label="Indicadores da frota"
    >
      {items.map(item => {
        const isNumeric = typeof item.value === 'number';
        return (
          <div key={item.label} className="group px-3 py-3 transition-colors duration-150 hover:bg-slate-50">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <span className={`size-1.5 rounded-full ${item.dot} transition-transform duration-150 group-hover:scale-150`} />
              {item.label}
            </p>
            <strong
              className={`mt-1 block text-xl font-bold leading-none tabular-nums ${item.tone}`}
              {...(isNumeric ? { 'data-kpi-count': item.value } : {})}
            >
              {isNumeric ? 0 : item.value}
            </strong>
          </div>
        );
      })}
    </section>
  );
}
