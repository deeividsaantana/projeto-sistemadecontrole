import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, Search, X } from 'lucide-react';
import type { ApontamentoRamo, CravacaoEstaca, ObraLocal } from '../types';

type StatusKey = 'pending' | 'active' | 'done' | 'divergence';
type Props = {
  items: CravacaoEstaca[];
  ramos: ApontamentoRamo[];
  obras: ObraLocal[];
  activeId?: string | null;
  onActiveIdChange?: (id: string | null) => void;
  onVisibleIdsChange?: (ids: string[]) => void;
};

const formatM = (value: number) => `${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;
const formatDate = (value: string) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : 'Não informada';
const statusOf = (item: CravacaoEstaca): { key: StatusKey; label: string; icon: typeof AlertTriangle; iconClass: string; fillClass: string } => {
  const total = Number(item.comprimentoM || 0), driven = Number(item.comprimentoCravadoM || 0);
  if (driven > total) return { key: 'divergence', label: 'Verificar medição', icon: AlertTriangle, iconClass: 'text-rose-600', fillClass: 'bg-rose-500' };
  if (driven <= 0) return { key: 'pending', label: 'Não iniciada', icon: CircleDashed, iconClass: 'text-slate-400', fillClass: 'bg-slate-400' };
  if (driven >= total - 0.01) return { key: 'done', label: 'Cravação concluída', icon: CheckCircle2, iconClass: 'text-emerald-600', fillClass: 'bg-emerald-500' };
  return { key: 'active', label: 'Em cravação', icon: CircleDashed, iconClass: 'text-amber-600', fillClass: 'bg-amber-500' };
};
const sequenceSort = (a: CravacaoEstaca, b: CravacaoEstaca) => a.identificacao.localeCompare(b.identificacao, 'pt-BR', { numeric: true });

const SheetPileProfile = () => <svg viewBox="20 45 755 225" className="h-auto w-full max-w-[310px]" role="img" aria-label="Perfil técnico ilustrativo de estaca-prancha metálica sem dimensões de referência">
  <path d="M35 62h118l148 188h188l148-118h118V62h-74v54h-70L467 250H323L177 62h-68v92H35Z" fill="none" stroke="currentColor" strokeWidth="15" strokeLinejoin="round"/>
</svg>;

export default function StakeDrivingMap({ items, ramos, obras, activeId, onActiveIdChange, onVisibleIdsChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusStatus, setFocusStatus] = useState<StatusKey | null>(null);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [ramoId, setRamoId] = useState('');
  const [trechoId, setTrechoId] = useState('');
  const [profile, setProfile] = useState('');
  const [status, setStatus] = useState<StatusKey | ''>('');
  const profiles = useMemo(() => Array.from(new Set(items.map(item => item.perfil).filter(Boolean))).sort(), [items]);
  const filtered = useMemo(() => items.filter(item => {
    const q = search.trim().toLocaleLowerCase('pt-BR');
    return (!q || [item.identificacao, item.item, item.perfil].some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(q)))
      && (!date || item.data === date) && (!ramoId || item.ramoId === ramoId) && (!trechoId || item.obraLocalId === trechoId)
      && (!profile || item.perfil === profile) && (!status || statusOf(item).key === status);
  }).sort(sequenceSort), [items, search, date, ramoId, trechoId, profile, status]);
  useEffect(() => { onVisibleIdsChange?.(filtered.map(item => item.id)); }, [filtered, onVisibleIdsChange]);
  useEffect(() => {
    if (!search.trim() || filtered.length !== 1) return;
    onActiveIdChange?.(filtered[0].id);
    requestAnimationFrame(() => document.getElementById(`stake-${filtered[0].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }));
  }, [search, filtered, onActiveIdChange]);
  const summary = useMemo(() => filtered.reduce((acc, item) => {
    const current = statusOf(item).key, total = Number(item.comprimentoM || 0), driven = Number(item.comprimentoCravadoM || 0);
    acc.total += 1; acc.planned += total; acc.driven += Math.min(total, Math.max(0, driven)); acc[current] += 1; return acc;
  }, { total: 0, done: 0, active: 0, pending: 0, divergence: 0, planned: 0, driven: 0 }), [filtered]);
  const selected = items.find(item => item.id === selectedId) || null;
  const highlighted = hoveredId || activeId;
  const ramoName = (id?: string) => ramos.find(item => item.id === id)?.ramoNome || 'Não informado';
  const trechoName = (id?: string) => obras.find(item => item.id === id)?.nome || 'Não informado';

  return <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-700">Mapa técnico</p><h2 className="text-xl font-black text-slate-900">Avanço das cravações</h2></div><p className="text-sm text-slate-500">{formatM(summary.driven)} de {formatM(summary.planned)} · {summary.planned ? (summary.driven / summary.planned * 100).toFixed(1) : '0,0'}%</p></div>
    <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">{[
      ['Previstas', summary.total, null], ['Concluídas', summary.done, 'done'], ['Em andamento', summary.active, 'active'], ['Não iniciadas', summary.pending, 'pending'], ['Divergências', summary.divergence, 'divergence'], ['Metros previstos', formatM(summary.planned), null], ['Metros cravados', formatM(summary.driven), null],
    ].map(([label, value, key]) => <button type="button" key={String(label)} onMouseEnter={() => setFocusStatus(key as StatusKey | null)} onMouseLeave={() => setFocusStatus(null)} className="rounded-xl border border-slate-100 bg-slate-50 p-2 text-left hover:border-emerald-300"><span className="block text-[9px] font-bold uppercase text-slate-500">{label}</span><strong className="text-lg text-slate-900">{value}</strong></button>)}</div>
    <div className="mb-4 grid gap-2 md:grid-cols-3 xl:grid-cols-6"><label className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar estaca" className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500"/></label><input type="date" value={date} onChange={event => setDate(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-500"/><select value={ramoId} onChange={event => setRamoId(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"><option value="">Todos os ramos</option>{ramos.map(item => <option key={item.id} value={item.id}>{item.ramoNome}</option>)}</select><select value={trechoId} onChange={event => setTrechoId(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"><option value="">Todos os trechos/obras</option>{obras.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select><select value={profile} onChange={event => setProfile(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"><option value="">Todos os perfis</option>{profiles.map(item => <option key={item}>{item}</option>)}</select><select value={status} onChange={event => setStatus(event.target.value as StatusKey | '')} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"><option value="">Todos os status</option><option value="pending">Não iniciada</option><option value="active">Em cravação</option><option value="done">Concluída</option><option value="divergence">Divergência</option></select></div>
    {filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm font-bold text-slate-500">Nenhuma cravação encontrada para os filtros aplicados.</div> : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-[repeat(auto-fill,minmax(118px,1fr))]">{filtered.map(item => { const total = Math.max(.01, Number(item.comprimentoM || 0)), driven = Math.max(0, Number(item.comprimentoCravadoM || 0)), pct = Math.min(100, driven / total * 100), state = statusOf(item), Icon = state.icon, dimmed = (focusStatus && focusStatus !== state.key) || (highlighted && highlighted !== item.id); return <button id={`stake-${item.id}`} type="button" key={item.id} onMouseEnter={() => { setHoveredId(item.id); onActiveIdChange?.(item.id); }} onMouseLeave={() => { setHoveredId(null); onActiveIdChange?.(null); }} onFocus={() => setHoveredId(item.id)} onBlur={() => setHoveredId(null)} onClick={() => setSelectedId(item.id)} className={`group relative rounded-2xl border bg-white p-3 text-left shadow-sm transition duration-200 motion-reduce:transition-none ${highlighted === item.id ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200 hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md'} ${dimmed ? 'opacity-35' : 'opacity-100'}`}><div className="mb-2 flex items-center justify-between"><span className="truncate text-xs font-black text-slate-800">{item.identificacao}</span><Icon className={`h-4 w-4 ${state.iconClass}`}/></div><div className="relative mx-auto h-28 w-9 overflow-hidden rounded-t border-x border-t border-slate-400 bg-slate-100"><div className={`absolute inset-x-0 bottom-0 transition-all duration-700 motion-reduce:transition-none ${state.fillClass}`} style={{ height: `${pct}%` }}/></div><div className="mt-1 h-0.5 bg-amber-700"/><p className="mt-2 text-[10px] font-bold text-slate-600">{formatM(driven)} / {formatM(total)}</p><div className="mt-1 h-1 overflow-hidden rounded bg-slate-100"><span className={`block h-full ${state.fillClass}`} style={{ width: `${pct}%` }}/></div><p className="mt-1 text-[10px] text-slate-500">{pct.toFixed(1)}% · {state.label}</p>{hoveredId === item.id && <div className="absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl"><strong className="text-sm text-slate-900">Estaca {item.identificacao}</strong><p className="mt-1 text-[11px] leading-5 text-slate-600">Perfil: {item.perfil || 'Estaca-prancha metálica'}<br/>Total: {formatM(total)}<br/>Cravada: {formatM(driven)}<br/>Restante: {formatM(Math.max(0, total-driven))}<br/>Ramo: {ramoName(item.ramoId)}<br/>Data: {formatDate(item.data)}</p></div>}</button>; })}</div>}
    {selected && <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/25" onClick={() => setSelectedId(null)}><aside className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl transition duration-300 motion-reduce:transition-none" onClick={event => event.stopPropagation()}><div className="mb-6 flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Detalhe técnico</p><h3 className="text-2xl font-black text-slate-900">Estaca {selected.identificacao}</h3></div><button type="button" onClick={() => setSelectedId(null)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X/></button></div><div className="mb-6 rounded-2xl bg-slate-50 p-4 text-slate-800"><SheetPileProfile/></div><div className="grid grid-cols-2 gap-3 text-sm">{[
      ['Perfil', selected.perfil || 'Estaca-prancha metálica'], ['Comprimento', formatM(selected.comprimentoM)], ['Cravado', formatM(selected.comprimentoCravadoM)], ['Restante', formatM(Math.max(0, selected.comprimentoM-selected.comprimentoCravadoM))], ['Percentual', `${selected.comprimentoM ? Math.min(100, selected.comprimentoCravadoM / selected.comprimentoM * 100).toFixed(1) : '0,0'}%`], ['Data', formatDate(selected.data)], ['Situação', statusOf(selected).label], ['Ramo', ramoName(selected.ramoId)], ['Trecho/obra', trechoName(selected.obraLocalId)], ['Responsável', selected.responsavel || 'Não informado'], ['Origem', selected.origem], ['Lote', selected.loteId || 'Não associado'],
    ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-200 p-3"><p className="text-[10px] font-bold uppercase text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-800">{value}</p></div>)}</div>{selected.observacao && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{selected.observacao}</p>}</aside></div>}
  </section>;
}
