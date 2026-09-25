import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ArrowUpRight, Camera, ImageOff, MapPin } from 'lucide-react';
import { fieldReportTime, type FieldReport } from '../../utils/fieldReports';
import './FieldReports.css';

gsap.registerPlugin(useGSAP);

const formatDay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** As fotos ficam no Storage, que só a equipe logada lê. O pacote do Storage só carrega quando há foto. */
const loadPhotoUrl = async (path: string) => {
  if (/^(data:|https?:)/.test(path)) return path;
  const [{ getDownloadURL, ref }, { storage }] = await Promise.all([import('firebase/storage'), import('../../firebaseStorage')]);
  return getDownloadURL(ref(storage, path));
};

function PhotoThumb({ path, index, ramo }: { path: string; index: number; ramo: string }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    loadPhotoUrl(path).then(value => { if (active) setUrl(value); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [path]);
  if (failed) return <span className="dashboard-field__thumb dashboard-field__thumb--off" title="Foto indisponível"><ImageOff size={16} aria-label="Foto indisponível" /></span>;
  if (!url) return <span className="dashboard-field__thumb dashboard-field__thumb--loading" aria-label="Carregando foto" />;
  return <a className="dashboard-field__thumb" href={url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir foto ${index + 1} de ${ramo}`}><img src={url} alt="" loading="lazy" /></a>;
}

export function FieldReports({ reports, onNavigate }: { reports: FieldReport[]; onNavigate: (target: string) => void }) {
  const scope = useRef<HTMLElement>(null);
  const latest = reports[0];
  const photos = reports.reduce((total, report) => total + report.fotos.length, 0);

  useGSAP(() => {
    if (!scope.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(scope.current.querySelectorAll('[data-field-row]'), { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: .5, stagger: .06, ease: 'power2.out', clearProps: 'transform' });
  }, { scope, dependencies: [reports] });

  return <section ref={scope} className="dashboard-detail-panel dashboard-field" aria-labelledby="dashboard-field-title" data-dashboard-reveal>
    <div className="dashboard-detail-panel__head">
      <div><p className="dashboard-detail-panel__kicker">Link do apontador</p><h2 id="dashboard-field-title">Envios do campo</h2></div>
      <button type="button" className="dashboard-detail-panel__open" onClick={() => onNavigate('materiais')} aria-label="Abrir materiais"><ArrowUpRight size={18} /></button>
    </div>
    <div className="dashboard-team-summary">
      <div><strong>{reports.length}</strong><p>{reports.length === 1 ? 'envio' : 'envios'} no período{photos ? ` · ${photos} ${photos === 1 ? 'foto' : 'fotos'}` : ''}</p></div>
      <div className="dashboard-team-summary__date"><span>Último envio</span><strong>{latest ? `${formatDay(latest.data)} ${fieldReportTime(latest.enviadoEm) ? `às ${fieldReportTime(latest.enviadoEm)}` : ''}` : 'Sem envio'}</strong></div>
    </div>
    {reports.length ? <ul className="dashboard-field__list">{reports.slice(0, 6).map(report => {
      const hora = fieldReportTime(report.enviadoEm);
      return <li key={report.id} className="dashboard-field__row" data-field-row>
        <span className="dashboard-team__badge"><MapPin size={17} /></span>
        <span className="dashboard-field__main">
          <strong>{report.ramo}</strong>
          <span>{formatDay(report.data)}{hora ? ` às ${hora}` : ''}{report.apontador ? ` · ${report.apontador}` : ''}</span>
          <small>{report.itens} {report.itens === 1 ? 'material' : 'materiais'}{report.fotos.length ? '' : ' · sem foto'}</small>
        </span>
        {report.fotos.length > 0 && <span className="dashboard-field__photos" aria-label={`${report.fotos.length} ${report.fotos.length === 1 ? 'foto' : 'fotos'}`}>
          {report.fotos.slice(0, 3).map((path, index) => <PhotoThumb key={path} path={path} index={index} ramo={report.ramo} />)}
        </span>}
      </li>;
    })}</ul> : <div className="dashboard-detail-panel__empty"><span className="dashboard-field__empty"><Camera size={22} />Nenhum envio do link do apontador neste período.</span></div>}
    {reports.length > 6 && <button type="button" className="dashboard-detail-panel__all" onClick={() => onNavigate('materiais')}>Ver os {reports.length} envios em Materiais <ArrowUpRight size={15} /></button>}
  </section>;
}
