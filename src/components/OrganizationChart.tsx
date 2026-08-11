import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, ChevronDown, ChevronRight, LocateFixed, Maximize2, Minimize2, Search, UserRound, Users, X } from 'lucide-react';
import type { Empresa, Funcionario } from '../types';

type Props = {
  funcionarios: Funcionario[];
  empresas: Empresa[];
  activeId?: string | null;
  onActiveIdChange?: (id: string | null) => void;
};

type LeaderGroup = [string, Funcionario[]];
type ResponsibleGroup = [string, LeaderGroup[]];
type AreaGroup = [string, ResponsibleGroup[]];
type CompanyGroup = [string, AreaGroup[]];

const fallback = {
  company: 'Empresa não definida', area: 'Sem área definida', responsible: 'Sem responsável definido', leader: 'Sem líder definido',
};
const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
const statusLabel = (item: Funcionario) => item.status || (item.ativo ? 'ATIVO' : 'INATIVO');

export default function OrganizationChart({ funcionarios, empresas, activeId, onActiveIdChange }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState('todos');
  const [leader, setLeader] = useState('todos');
  const [responsible, setResponsible] = useState('todos');
  const [company, setCompany] = useState('todos');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Funcionario | null>(null);
  const [summaryFocus, setSummaryFocus] = useState<'active' | 'inactive' | null>(null);

  const companyName = (item: Funcionario) => empresas.find(companyItem => companyItem.id === item.empresaId)?.nome || fallback.company;
  const areas = useMemo(() => unique(funcionarios.map(item => item.area || fallback.area)), [funcionarios]);
  const leaders = useMemo(() => unique(funcionarios.map(item => item.liderNome || fallback.leader)), [funcionarios]);
  const responsibles = useMemo(() => unique(funcionarios.map(item => item.responsavelArea || fallback.responsible)), [funcionarios]);
  const companies = useMemo(() => unique(funcionarios.map(companyName)), [funcionarios, empresas]);
  const filtered = useMemo(() => funcionarios.filter(item => {
    if (company !== 'todos' && companyName(item) !== company) return false;
    if (area !== 'todos' && (item.area || fallback.area) !== area) return false;
    if (leader !== 'todos' && (item.liderNome || fallback.leader) !== leader) return false;
    if (responsible !== 'todos' && (item.responsavelArea || fallback.responsible) !== responsible) return false;
    const search = query.trim().toLocaleLowerCase('pt-BR');
    return !search || [item.nome, item.matricula, item.cargo, companyName(item), item.area, item.responsavelArea, item.liderNome]
      .some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(search));
  }), [funcionarios, empresas, company, area, leader, responsible, query]);

  const groups = useMemo<CompanyGroup[]>(() => {
    const tree = new Map<string, Map<string, Map<string, Map<string, Funcionario[]>>>>();
    filtered.forEach(item => {
      const names = [companyName(item), item.area || fallback.area, item.responsavelArea || fallback.responsible, item.liderNome || fallback.leader] as const;
      if (!tree.has(names[0])) tree.set(names[0], new Map());
      const companyNode = tree.get(names[0])!;
      if (!companyNode.has(names[1])) companyNode.set(names[1], new Map());
      const areaNode = companyNode.get(names[1])!;
      if (!areaNode.has(names[2])) areaNode.set(names[2], new Map());
      const responsibleNode = areaNode.get(names[2])!;
      if (!responsibleNode.has(names[3])) responsibleNode.set(names[3], []);
      responsibleNode.get(names[3])!.push(item);
    });
    return Array.from(tree.entries()).sort(([a], [b]) => a.localeCompare(b, 'pt-BR')).map(([companyNameValue, areaMap]) => [companyNameValue,
      Array.from(areaMap.entries()).sort(([a], [b]) => a.localeCompare(b, 'pt-BR')).map(([areaName, responsibleMap]) => [areaName,
        Array.from(responsibleMap.entries()).sort(([a], [b]) => a.localeCompare(b, 'pt-BR')).map(([responsibleName, leaderMap]) => [responsibleName,
          Array.from(leaderMap.entries()).sort(([a], [b]) => a.localeCompare(b, 'pt-BR')),
        ] as ResponsibleGroup),
      ] as AreaGroup),
    ] as CompanyGroup);
  }, [filtered, empresas]);

  const pathKeys = (item: Funcionario) => {
    const companyValue = companyName(item), areaValue = item.area || fallback.area;
    const responsibleValue = item.responsavelArea || fallback.responsible, leaderValue = item.liderNome || fallback.leader;
    return [`company:${companyValue}`, `area:${companyValue}:${areaValue}`, `responsible:${companyValue}:${areaValue}:${responsibleValue}`, `leader:${companyValue}:${areaValue}:${responsibleValue}:${leaderValue}`];
  };
  const allKeys = useMemo(() => filtered.flatMap(pathKeys), [filtered, empresas]);
  const toggle = (key: string) => setExpanded(current => {
    const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next;
  });
  const focusEmployee = (item: Funcionario) => {
    setExpanded(current => new Set([...current, ...pathKeys(item)]));
    onActiveIdChange?.(item.id);
    requestAnimationFrame(() => document.getElementById(`org-${item.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }));
  };
  useEffect(() => { if (query.trim() && filtered.length === 1) focusEmployee(filtered[0]); }, [query, filtered]);

  const active = filtered.filter(item => item.ativo).length;
  const inactive = filtered.length - active;
  const related = (item: Funcionario) => !activeId || activeId === item.id || item.liderNome === funcionarios.find(candidate => candidate.id === activeId)?.liderNome;
  const centerChart = () => { viewportRef.current?.scrollTo({ top: 0, left: 0, behavior: 'smooth' }); onActiveIdChange?.(null); };
  const descendants = (areasValue: AreaGroup[]) => areasValue.flatMap(([, responsibleGroups]) => responsibleGroups.flatMap(([, leaderGroups]) => leaderGroups.flatMap(([, members]) => members)));

  const employeeCards = (members: Funcionario[]) => <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{members.map(item => {
    const dimmed = summaryFocus === 'active' ? !item.ativo : summaryFocus === 'inactive' ? item.ativo : !related(item);
    return <button id={`org-${item.id}`} key={item.id} type="button" onMouseEnter={() => onActiveIdChange?.(item.id)} onMouseLeave={() => onActiveIdChange?.(null)} onClick={() => { setSelected(item); focusEmployee(item); document.getElementById(`func-row-${item.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} className={`rounded-xl border bg-white p-3 text-left shadow-sm transition motion-reduce:transition-none ${activeId === item.id ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200 hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md'} ${dimmed ? 'opacity-35' : 'opacity-100'}`}>
      <span className="block truncate text-sm font-black text-slate-900">{item.nome}</span><span className="block truncate text-xs text-slate-500">{item.cargo || 'Função não definida'}</span><span className="mt-2 flex items-center justify-between text-[10px]"><span className="font-mono text-slate-500">{item.matricula || 'Sem matrícula'}</span><span className={item.ativo ? 'font-bold text-emerald-700' : 'font-bold text-rose-700'}>{statusLabel(item)}</span></span>
    </button>;
  })}</div>;

  return <section className="mb-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5" aria-label="Organograma de colaboradores">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-700">Estrutura em tempo real</p><h2 className="text-xl font-black text-slate-900">Organograma de colaboradores</h2><p className="text-xs text-slate-500">Empresa → área → responsável → líder → colaborador, usando exclusivamente o cadastro atual.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={centerChart} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-emerald-400"><LocateFixed className="mr-1 inline h-3.5 w-3.5"/>Centralizar</button><button type="button" onClick={() => setExpanded(new Set(allKeys))} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-emerald-400"><Maximize2 className="mr-1 inline h-3.5 w-3.5"/>Expandir tudo</button><button type="button" onClick={() => setExpanded(new Set())} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-emerald-400"><Minimize2 className="mr-1 inline h-3.5 w-3.5"/>Recolher</button></div></div>
    <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-7">{[['Colaboradores', filtered.length, null], ['Ativos', active, 'active'], ['Inativos', inactive, 'inactive'], ['Áreas', unique(filtered.map(item => item.area || '')).length, null], ['Líderes', unique(filtered.map(item => item.liderNome || '')).length, null], ['Responsáveis', unique(filtered.map(item => item.responsavelArea || '')).length, null], ['Empresas', unique(filtered.map(companyName)).length, null]].map(([label, value, focus]) => <button key={String(label)} type="button" onMouseEnter={() => setSummaryFocus(focus as 'active' | 'inactive' | null)} onMouseLeave={() => setSummaryFocus(null)} className="rounded-xl border border-slate-100 bg-slate-50 p-2 text-left hover:border-emerald-300"><span className="block text-[9px] font-bold uppercase text-slate-500">{label}</span><strong className="text-xl text-slate-900">{value}</strong></button>)}</div>
    <div className="mb-4 grid gap-2 md:grid-cols-5"><label className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Nome, matrícula ou função" className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-emerald-500"/></label>{[['Empresa', company, setCompany, companies], ['Área', area, setArea, areas], ['Responsável', responsible, setResponsible, responsibles], ['Líder', leader, setLeader, leaders]].map(([label, value, setter, options]: any) => <select key={label} value={value} onChange={event => setter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-500"><option value="todos">{label}: todos</option>{options.map((option: string) => <option key={option}>{option}</option>)}</select>)}</div>
    {groups.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center"><Users className="mx-auto mb-2 h-8 w-8 text-slate-300"/><p className="font-bold text-slate-700">Nenhum colaborador encontrado</p><p className="text-xs text-slate-500">Revise os filtros ou complete os vínculos do cadastro.</p></div> : <div ref={viewportRef} className="max-h-[680px] space-y-4 overflow-auto scroll-smooth rounded-2xl bg-slate-50 p-3">
      {groups.map(([companyValue, areaGroups]) => { const companyKey = `company:${companyValue}`, openCompany = expanded.has(companyKey), companyItems = descendants(areaGroups); return <article key={companyValue} className="rounded-2xl border border-slate-200 bg-white shadow-sm"><button type="button" onClick={() => toggle(companyKey)} className="flex w-full items-center gap-3 p-4 text-left"><span className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><Building2 className="h-5 w-5"/></span><span className="min-w-0 flex-1"><strong className="block truncate text-slate-900">{companyValue}</strong><span className="text-xs text-slate-500">{companyItems.length} colaborador(es)</span></span>{openCompany ? <ChevronDown/> : <ChevronRight/>}</button>{openCompany && <div className="space-y-3 border-t border-slate-100 p-3 md:pl-8">{areaGroups.map(([areaValue, responsibleGroups]) => { const areaKey = `area:${companyValue}:${areaValue}`, openArea = expanded.has(areaKey); return <div key={areaKey} className="relative border-l-2 border-emerald-200 pl-4"><button type="button" onClick={() => toggle(areaKey)} className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left"><span className="flex-1"><strong className="text-sm text-slate-900">{areaValue}</strong><span className="ml-2 text-[10px] text-slate-500">{responsibleGroups.reduce((sum, [, leadersValue]) => sum + leadersValue.reduce((count, [, members]) => count + members.length, 0), 0)} pessoa(s)</span></span>{openArea ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}</button>{openArea && <div className="space-y-3 py-3 pl-3">{responsibleGroups.map(([responsibleValue, leaderGroups]) => { const responsibleKey = `responsible:${companyValue}:${areaValue}:${responsibleValue}`, openResponsible = expanded.has(responsibleKey); return <div key={responsibleKey} className="border-l-2 border-sky-200 pl-4"><button type="button" onClick={() => toggle(responsibleKey)} className="flex w-full items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 p-3 text-left"><UserRound className="h-4 w-4 text-sky-700"/><span className="flex-1"><strong className="block text-sm text-slate-900">{responsibleValue}</strong><span className="text-[10px] text-slate-500">Responsável da área</span></span>{openResponsible ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}</button>{openResponsible && <div className="space-y-3 py-3 pl-3">{leaderGroups.map(([leaderValue, members]) => { const leaderKey = `leader:${companyValue}:${areaValue}:${responsibleValue}:${leaderValue}`, openLeader = expanded.has(leaderKey); return <div key={leaderKey} className="border-l-2 border-amber-200 pl-4"><button type="button" onClick={() => toggle(leaderKey)} className="mb-2 flex w-full items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 p-3 text-left"><Users className="h-4 w-4 text-amber-700"/><span className="flex-1"><strong className="block text-sm text-slate-900">{leaderValue}</strong><span className="text-[10px] text-slate-500">{members.length} integrante(s)</span></span>{openLeader ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}</button>{openLeader && employeeCards(members)}</div>; })}</div>}</div>; })}</div>}</div>; })}</div>}</article>; })}
    </div>}
    {selected && <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/25" onClick={() => setSelected(null)}><aside className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl" onClick={event => event.stopPropagation()}><div className="mb-6 flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Colaborador</p><h3 className="text-2xl font-black text-slate-900">{selected.nome}</h3><p className="text-sm text-slate-500">{selected.cargo}</p></div><button type="button" onClick={() => setSelected(null)} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><X/></button></div><dl className="grid grid-cols-2 gap-3">{[['Matrícula', selected.matricula || 'Não informada'], ['Status', statusLabel(selected)], ['Empresa', companyName(selected)], ['Área', selected.area || fallback.area], ['Responsável', selected.responsavelArea || fallback.responsible], ['Líder', selected.liderNome || fallback.leader], ['Divisão', selected.divisao || 'Não informada'], ['Seção', selected.secao || 'Não informada'], ['Mobilização', selected.dataMobilizacao || 'Não informada'], ['Cadastro', selected.criadoEm ? new Date(selected.criadoEm).toLocaleDateString('pt-BR') : 'Não informado']].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 p-3"><dt className="text-[9px] font-bold uppercase text-slate-500">{label}</dt><dd className="mt-1 text-sm font-bold text-slate-800">{value}</dd></div>)}</dl></aside></div>}
  </section>;
}
