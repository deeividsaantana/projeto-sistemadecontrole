import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ArrowUpRight, Fuel, HardHat, Users } from 'lucide-react';
import type { DashboardGeneralViewModel, DashboardMeasure } from '../../utils/dashboardGeneral';
import './TeamActivity.css';

gsap.registerPlugin(useGSAP);

const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value);
const formatDate = (value: string | null) => value ? `${value.slice(8, 10)}/${value.slice(5, 7)}` : 'Sem apontamento';

function ActivityLink({ title, measure, target, onNavigate, icon: Icon }: {
  title: string; measure: DashboardMeasure; target: string;
  onNavigate: (target: string) => void; icon: typeof Fuel;
}) {
  return <button type="button" className="dashboard-activity-link" onClick={() => onNavigate(target)} data-team-row>
    <span className="dashboard-activity-link__icon"><Icon size={19} /></span>
    <span className="dashboard-activity-link__copy"><strong>{title}</strong><small>{measure.value === null ? 'Sem lançamento no período' : 'Registros do período'}</small></span>
    <span className="dashboard-activity-link__value">{measure.value === null ? '—' : `${formatNumber(measure.value)} ${measure.unit}`}</span>
    <ArrowUpRight className="dashboard-activity-link__arrow" size={17} />
  </button>;
}

export function TeamActivity({ view, onNavigate }: { view: DashboardGeneralViewModel; onNavigate: (target: string) => void }) {
  const scope = useRef<HTMLDivElement>(null);
  const maxRecords = Math.max(1, ...view.teams.items.map(team => team.reported));
  const lastDate = view.teams.items.map(team => team.lastDate).filter((date): date is string => Boolean(date)).sort().at(-1) ?? null;

  useGSAP(() => {
    if (!scope.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(scope.current.querySelectorAll('[data-team-row]'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .55, stagger: .055, ease: 'power2.out', clearProps: 'transform' });
    gsap.fromTo(scope.current.querySelectorAll('.dashboard-team__bar-fill'), { scaleX: 0, transformOrigin: 'left center' }, { scaleX: 1, duration: .9, stagger: .06, ease: 'power3.out' });
  }, { scope, dependencies: [view.teams] });

  return <div ref={scope} className="dashboard-detail-grid">
    <section className="dashboard-detail-panel" aria-labelledby="dashboard-teams-title" data-dashboard-reveal>
      <div className="dashboard-detail-panel__head"><div><p className="dashboard-detail-panel__kicker">Pessoas em campo</p><h2 id="dashboard-teams-title">Equipes e apontamentos</h2></div><button type="button" className="dashboard-detail-panel__open" onClick={() => onNavigate('Equipes')} aria-label="Abrir equipes"><ArrowUpRight size={18} /></button></div>
      <div className="dashboard-team-summary"><div><strong>{view.teams.withRecords}<span> / {view.teams.total}</span></strong><p>equipes com registro no período</p></div><div className="dashboard-team-summary__date"><span>Último envio</span><strong>{formatDate(lastDate)}</strong></div></div>
      {view.teams.items.length ? <div className="dashboard-team-list">{view.teams.items.slice(0, 5).map(team => <button key={team.id} type="button" className="dashboard-team" onClick={() => onNavigate('Equipes')} data-team-row>
        <span className="dashboard-team__badge"><Users size={17} /></span>
        <span className="dashboard-team__main"><span className="dashboard-team__top"><strong>{team.name}</strong><small>{formatDate(team.lastDate)}</small></span><span className="dashboard-team__front">{team.front}</span><span className="dashboard-team__bar"><span className="dashboard-team__bar-fill" style={{ width: `${team.reported / maxRecords * 100}%` }} /></span></span>
        <span className="dashboard-team__count"><strong>{team.reported ? team.present : '—'}</strong><small>{team.reported ? 'presenças' : 'sem registro'}</small></span>
      </button>)}</div> : <div className="dashboard-detail-panel__empty">Nenhuma equipe ativa cadastrada nesta obra.</div>}
      {view.teams.items.length > 5 && <button type="button" className="dashboard-detail-panel__all" onClick={() => onNavigate('Equipes')}>Ver todas as {view.teams.total} equipes <ArrowUpRight size={15} /></button>}
    </section>

    <section className="dashboard-detail-panel dashboard-detail-panel--activity" aria-labelledby="dashboard-activity-title" data-dashboard-reveal>
      <div className="dashboard-detail-panel__head"><div><p className="dashboard-detail-panel__kicker">Resumo do período</p><h2 id="dashboard-activity-title">Movimento da operação</h2></div><HardHat size={20} aria-hidden="true" /></div>
      <p className="dashboard-detail-panel__intro">Os valores abaixo vêm dos lançamentos existentes. Abra um módulo para conferir os detalhes.</p>
      <div className="dashboard-activity-list">
        <ActivityLink title="Produção" measure={view.production} target="Produção" onNavigate={onNavigate} icon={HardHat} />
        <ActivityLink title="Combustível" measure={view.fuel} target="Combustível" onNavigate={onNavigate} icon={Fuel} />
        <ActivityLink title="Presenças" measure={view.presence} target="Presença" onNavigate={onNavigate} icon={Users} />
      </div>
      <p className="dashboard-detail-panel__note">Sem lançamento significa que não há registro para o recorte selecionado.</p>
    </section>
  </div>;
}
