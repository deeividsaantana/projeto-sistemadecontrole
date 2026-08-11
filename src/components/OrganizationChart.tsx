import React, { useEffect, useMemo, useState } from 'react';
import { Building2, ChevronDown, ChevronRight, Maximize2, Minimize2, Search, Users, X } from 'lucide-react';
import type { Empresa, Funcionario } from '../types';

type Props = {
  funcionarios: Funcionario[];
  empresas: Empresa[];
  activeId?: string | null;
  onActiveIdChange?: (id: string | null) => void;
};

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
const companyName = (id: string, empresas: Empresa[]) => empresas.find(item => item.id === id)?.nome || 'Empresa não definida';
const statusLabel = (item: Funcionario) => item.status || (item.ativo ? 'ATIVO' : 'INATIVO');

export default function OrganizationChart({ funcionarios, empresas, activeId, onActiveIdChange }: Props) {
  const [area, setArea] = useState('todos');
  const [leader, setLeader] = useState('todos');
  const [responsible, setResponsible] = useState('todos');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Funcionario | null>(null);
  const [summaryFocus, setSummaryFocus] = useState<'active' | 'inactive' | null>(null);

  const areas = useMemo(() => unique(funcionarios.map(item => item.area || 'Sem área definida')), [funcionarios]);
  const leaders = useMemo(() => unique(funcionarios.map(item => item.liderNome || 'Sem líder definido')), [funcionarios]);
  const responsibles = useMemo(() => unique(funcionarios.map(item => item.responsavelArea || 'Sem responsável definido')), [funcionarios]);
  const filtered = useMemo(() => funcionarios.filter(item => {
    if (area !== 'todos' && (item.area || 'Sem área definida') !== area) return false;
    if (leader !== 'todos' && (item.liderNome || 'Sem líder definido') !== leader) return false;
    if (responsible !== 'todos' && (item.responsavelArea || 'Sem responsável definido') !== responsible) return false;
    const search = query.trim().toLocaleLowerCase('pt-BR');
    return !search || [item.nome, item.matricula, item.cargo].some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(search));
  }), [funcionarios, area, leader, responsible, query]);

  const groups = useMemo(() => {
    const result = new Map<string, Map<string, Funcionario[]>>();
    filtered.forEach(item => {
      const areaName = item.area || 'Sem área definida';
      const leaderName = item.liderNome || 'Sem líder definido';
      if (!result.has(areaName)) result.set(areaName, new Map());
      const areaGroup = result.get(areaName)!;
      if (!areaGroup.has(leaderName)) areaGroup.set(leaderName, []);
      areaGroup.get(leaderName)!.push(item);
    });
    return Array.from(result.entries()).sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
  }, [filtered]);

  useEffect(() => {
    if (!query.trim() || filtered.length !== 1) return;
    const item = filtered[0];
    setExpanded(new Set([`area:${item.area || 'Sem área definida'}`, `leader:${item.area || 'Sem área definida'}:${item.liderNome || 'Sem líder definido'}`]));
    onActiveIdChange?.(item.id);
    requestAnimationFrame(() => document.getElementById(`org-${item.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }));
  }, [query, filtered, onActiveIdChange]);

  const allKeys = useMemo(() => groups.flatMap(([areaName, leaderGroups]) => [
    `area:${areaName}`,
    ...Array.from(leaderGroups.keys()).map(leaderName => `leader:${areaName}:${leaderName}`),
  ]), [groups]);
  const toggle = (key: string) => setExpanded(current => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const active = filtered.filter(item => item.ativo).length;
  const inactive = filtered.length - active;
  const areaCount = unique(filtered.map(item => item.area || '')).length;
  const leaderCount = unique(filtered.map(item => item.liderNome || '')).length;
  const responsibleCount = unique(filtered.map(item => item.responsavelArea || '')).length;
  const companyCount = unique(filtered.map(item => item.empresaId)).length;
  const related = (item: Funcionario) => !activeId || activeId === item.id || item.liderNome === funcionarios.find(candidate => candidate.id === activeId)?.liderNome;

  return <section className="mb-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5" aria-label="Organograma de colaboradores">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-700">Estrutura em tempo real</p><h2 className="text-xl font-black text-slate-900">Organograma de colaboradores</h2><p className="text-xs text-slate-500">Empresa → área → líder → colaborador, usando o cadastro atual.</p></div>
      <div className="flex gap-2"><button type="button" onClick={() => setExpanded(new Set(allKeys))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-emerald-400"><Maximize2 className="mr-1 inline h-3.5 w-3.5"/>Expandir tudo</button><button type="button" onClick={() => setExpanded(new Set())} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-emerald-400"><Minimize2 className="mr-1 inline h-3.5 w-3.5"/>Recolher</button></div>
    </div>
    <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-7">{[
      ['Colaboradores', filtered.length, null], ['Ativos', active, 'active'], ['Inativos', inactive, 'inactive'], ['Áreas', areaCount, null], ['Líderes', leaderCount, null], ['Responsáveis', responsibleCount, null], ['Empresas', companyCount, null],
    ].map(([label, value, focus]) => <button key={String(label)} type="button" onMouseEnter={() => setSummaryFocus(focus as any)} onMouseLeave={() => setSummaryFocus(null)} className="rounded-xl border border-slate-100 bg-slate-50 p-2 text-left hover:border-emerald-300"><span className="block text-[9px] font-bold uppercase text-slate-500">{label}</span><strong className="text-xl text-slate-900">{value}</strong></button>)}</div>
    <div className="mb-4 grid gap-2 md:grid-cols-4">
      <label className="relative md:col-span-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Nome ou matrícula" className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-emerald-500"/></label>
      {[['Área', area, setArea, areas], ['Líder', leader, setLeader, leaders], ['Responsável', responsible, setResponsible, responsibles]].map(([label, value, setter, options]: any) => <select key={label} value={value} onChange={event => setter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-500"><option value="todos">{label}: todos</option>{options.map((option: string) => <option key={option}>{option}</option>)}</select>)}
    </div>
    {groups.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center"><Users className="mx-auto mb-2 h-8 w-8 text-slate-300"/><p className="font-bold text-slate-700">Nenhum colaborador encontrado para os filtros aplicados</p><p className="text-xs text-slate-500">Cadastre área, líder e responsável para enriquecer a hierarquia.</p></div> : <div className="max-h-[620px] space-y-3 overflow-auto scroll-smooth rounded-2xl bg-slate-50 p-3">
      {groups.map(([areaName, leaderGroups]) => { const areaKey = `area:${areaName}`; const areaItems = Array.from(leaderGroups.values()).flat(); const open = expanded.has(areaKey); return <div key={areaName} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <button type="button" onClick={() => toggle(areaKey)} className="flex w-full items-center gap-3 p-4 text-left"><span className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><Building2 className="h-5 w-5"/></span><span className="min-w-0 flex-1"><strong className="block truncate text-slate-900">{areaName}</strong><span className="text-xs text-slate-500">{areaItems.length} colaborador(es) · Responsável: {areaItems.find(item => item.responsavelArea)?.responsavelArea || 'não definido'}</span></span>{open ? <ChevronDown/> : <ChevronRight/>}</button>
        {open && <div className="border-t border-slate-100 p-3 md:pl-10">{Array.from(leaderGroups.entries()).map(([leaderName, members]) => { const leaderKey = `leader:${areaName}:${leaderName}`; const leaderOpen = expanded.has(leaderKey); return <div key={leaderName} className="relative mb-3 border-l-2 border-emerald-100 pl-4"><button type="button" onClick={() => toggle(leaderKey)} className="mb-2 flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left hover:border-emerald-300"><Users className="h-4 w-4 text-emerald-700"/><span className="flex-1"><strong className="block text-sm text-slate-800">{leaderName}</strong><span className="text-[10px] text-slate-500">{members.length} integrante(s)</span></span>{leaderOpen ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}</button>{leaderOpen && <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{members.map(item => { const dimmed = summaryFocus === 'active' ? !item.ativo : summaryFocus === 'inactive' ? item.ativo : !related(item); return <button id={`org-${item.id}`} key={item.id} type="button" onMouseEnter={() => onActiveIdChange?.(item.id)} onMouseLeave={() => onActiveIdChange?.(null)} onClick={() => { setSelected(item); onActiveIdChange?.(item.id); document.getElementById(`func-row-${item.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} className={`rounded-xl border bg-white p-3 text-left shadow-sm transition duration-200 motion-reduce:transition-none ${activeId === item.id ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200 hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md'} ${dimmed ? 'opacity-35' : 'opacity-100'}`}><span className="block truncate text-sm font-black text-slate-900">{item.nome}</span><span className="block truncate text-xs text-slate-500">{item.cargo || 'Função não definida'}</span><span className="mt-2 flex items-center justify-between text-[10px]"><span className="font-mono text-slate-500">{item.matricula || 'Sem matrícula'}</span><span className={item.ativo ? 'font-bold text-emerald-700' : 'font-bold text-rose-700'}>{statusLabel(item)}</span></span></button>})}</div>}</div>})}</div>}
      </div>})}
    </div>}
    {selected && <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/25" onClick={() => setSelected(null)}><aside className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl transition motion-reduce:transition-none" onClick={event => event.stopPropagation()}><div className="mb-6 flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Colaborador</p><h3 className="text-2xl font-black text-slate-900">{selected.nome}</h3><p className="text-sm text-slate-500">{selected.cargo}</p></div><button type="button" onClick={() => setSelected(null)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X/></button></div><dl className="grid grid-cols-2 gap-3">{[
      ['Matrícula', selected.matricula || 'Não informada'], ['Status', statusLabel(selected)], ['Empresa', companyName(selected.empresaId, empresas)], ['Área', selected.area || 'Sem área definida'], ['Líder', selected.liderNome || 'Sem líder definido'], ['Responsável', selected.responsavelArea || 'Sem responsável definido'], ['Divisão', selected.divisao || 'Não informada'], ['Seção', selected.secao || 'Não informada'], ['Mobilização', selected.dataMobilizacao || 'Não informada'], ['Cadastro', selected.criadoEm ? new Date(selected.criadoEm).toLocaleDateString('pt-BR') : 'Não informado'],
    ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 p-3"><dt className="text-[9px] font-bold uppercase text-slate-500">{label}</dt><dd className="mt-1 text-sm font-bold text-slate-800">{value}</dd></div>)}</dl></aside></div>}
  </section>;
}
