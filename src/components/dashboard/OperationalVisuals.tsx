import { useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ArrowUpRight, TrendingUp } from 'lucide-react';
import type { DashboardMeasure } from '../../utils/dashboardGeneral';
import './OperationalVisuals.css';

gsap.registerPlugin(useGSAP);

interface FleetCounts {
  operating: number;
  available: number;
  maintenance: number;
  pending: number;
  unknown: number;
  total: number;
  coverage: number | null;
}

export function FleetDonut({ fleet, onNavigate }: { fleet: FleetCounts; onNavigate: () => void }) {
  const entries = [
    { label: 'Em operação', value: fleet.operating, color: '#0c6b4e' },
    { label: 'Disponível', value: fleet.available, color: '#65bd91' },
    { label: 'Em manutenção', value: fleet.maintenance, color: '#dc7d45' },
    { label: 'Sem posição', value: fleet.pending + fleet.unknown, color: '#d5ded8' },
  ];
  let offset = 0;
  return <section className="dashboard-visual dashboard-visual--fleet" data-dashboard-reveal aria-labelledby="dashboard-fleet-title">
    <div className="dashboard-visual__heading"><div><p className="dashboard-visual__kicker">Frota</p><h2 id="dashboard-fleet-title">Situação dos equipamentos</h2></div><button type="button" onClick={onNavigate} aria-label="Abrir controle de equipamentos" className="dashboard-visual__link"><ArrowUpRight size={18} /></button></div>
    {fleet.total ? <div className="dashboard-donut-layout">
      <div className="dashboard-donut" role="img" aria-label={`Frota: ${entries.map(entry => `${entry.value} ${entry.label.toLowerCase()}`).join(', ')}`}>
        <svg viewBox="0 0 200 200" aria-hidden="true"><circle className="dashboard-donut__track" cx="100" cy="100" r="76" pathLength="100" />
          {entries.filter(entry => entry.value > 0).map(entry => {
            const share = entry.value / fleet.total * 100;
            const start = offset;
            offset += share;
            return <circle key={entry.label} className="dashboard-donut__segment" cx="100" cy="100" r="76" pathLength="100" stroke={entry.color} strokeDasharray={`${Math.max(0, share - .7)} ${100 - Math.max(0, share - .7)}`} strokeDashoffset={-start}><title>{entry.label}: {entry.value}</title></circle>;
          })}
        </svg>
        <div className="dashboard-donut__center"><strong>{fleet.total}</strong><span>equipamentos</span></div>
      </div>
      <div className="dashboard-donut-legend">{entries.map(entry => <button key={entry.label} type="button" onClick={onNavigate} className="dashboard-donut-legend__item"><span className="dashboard-donut-legend__dot" style={{ backgroundColor: entry.color }} /><span>{entry.label}</span><strong>{entry.value}</strong></button>)}</div>
    </div> : <div className="dashboard-visual__empty">Nenhum equipamento cadastrado neste recorte.</div>}
    <p className="dashboard-visual__foot">{fleet.coverage === null ? 'Sem posição diária confirmada' : `${fleet.coverage.toFixed(0)}% da frota com posição diária confirmada`}</p>
  </section>;
}

export function AvailabilityTrend({ measure, onNavigate }: { measure: DashboardMeasure; onNavigate: () => void }) {
  const scope = useRef<HTMLElement>(null);
  const points = measure.series.slice(-14);
  const [selected, setSelected] = useState<number | null>(null);
  const selectedPoint = selected === null ? [...points].reverse().find(point => point.value !== null) : points[selected];
  const x = (index: number) => 28 + index * (584 / Math.max(points.length - 1, 1));
  const y = (value: number) => 186 - Math.max(0, Math.min(100, value)) * 1.5;
  const runs: Array<Array<{ index: number; value: number }>> = [];
  points.forEach((point, index) => {
    if (point.value === null) return;
    if (index > 0 && points[index - 1].value !== null && runs.length) runs[runs.length - 1].push({ index, value: point.value });
    else runs.push([{ index, value: point.value }]);
  });

  useGSAP(() => {
    if (!scope.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(scope.current.querySelectorAll('.dashboard-trend__path'), { strokeDasharray: 1000, strokeDashoffset: 1000 }, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.out', stagger: .12 });
    gsap.fromTo(scope.current.querySelectorAll('.dashboard-trend__point'), { opacity: 0, scale: .3, transformOrigin: 'center center' }, { opacity: 1, scale: 1, duration: .45, ease: 'back.out(1.7)', stagger: .045, delay: .45 });
  }, { scope, dependencies: [measure] });

  return <section ref={scope} className="dashboard-visual dashboard-visual--trend" data-dashboard-reveal aria-labelledby="dashboard-trend-title">
    <div className="dashboard-visual__heading"><div><p className="dashboard-visual__kicker">Evolução</p><h2 id="dashboard-trend-title">Disponibilidade da frota</h2></div><TrendingUp size={20} aria-hidden="true" /></div>
    <div className="dashboard-trend__summary"><strong>{measure.value === null ? 'Sem posição' : `${measure.value.toFixed(1).replace('.', ',')}%`}</strong><span>{selectedPoint?.value === null || !selectedPoint ? 'Sem registro comparável' : `${selectedPoint.label} · ${selectedPoint.value.toFixed(1).replace('.', ',')}%`}</span></div>
    {runs.length ? <div className="dashboard-trend__plot">
      <svg viewBox="0 0 640 220" preserveAspectRatio="none" role="img" aria-label="Evolução diária da disponibilidade da frota">
        {[25, 50, 75, 100].map(value => <g key={value}><line className="dashboard-trend__grid" x1="28" x2="612" y1={y(value)} y2={y(value)} /><text className="dashboard-trend__axis" x="0" y={y(value) + 4}>{value}</text></g>)}
        {runs.map((run, runIndex) => run.length > 1 ? <polyline key={runIndex} className="dashboard-trend__path" points={run.map(point => `${x(point.index)},${y(point.value)}`).join(' ')} /> : null)}
        {points.map((point, index) => point.value === null ? null : <circle key={point.date} className="dashboard-trend__point" cx={x(index)} cy={y(point.value)} r={selected === index ? 8 : 5} tabIndex={0} role="button" aria-label={`${point.label}: ${point.value.toFixed(1)}%. Abrir controle de equipamentos`} onMouseEnter={() => setSelected(index)} onFocus={() => setSelected(index)} onClick={onNavigate} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onNavigate(); } }} />)}
      </svg>
      <div className="dashboard-trend__dates"><span>{points[0]?.label}</span><span>{points.at(-1)?.label}</span></div>
    </div> : <div className="dashboard-visual__empty">Registre a posição diária da frota para acompanhar a evolução.</div>}
    <button type="button" onClick={onNavigate} className="dashboard-trend__action">Investigar na frota <ArrowUpRight size={16} /></button>
  </section>;
}
