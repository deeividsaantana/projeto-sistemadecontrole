import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, ChevronDown, ChevronRight, LocateFixed, Maximize2, Minimize2, Search, UserRound, Users, X } from 'lucide-react';
import type { Empresa, Funcionario } from '../types';
import { BOTAO_SECUNDARIO, CAMPO, FOCO, reduzMovimento } from './cadastros/estilos';

type Props = {
  funcionarios: Funcionario[];
  empresas: Empresa[];
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
const rolar = (): ScrollBehavior => (reduzMovimento() ? 'auto' : 'smooth');

const BOTAO_NO = `flex min-h-11 w-full items-center gap-2 rounded-xl border p-3 text-left ${FOCO}`;

/**
 * Organograma dos colaboradores: empresa → área → responsável → líder →
 * colaborador. Abre dentro de uma janela (Modal) da aba Cadastros; o
 * colaborador escolhido aparece num quadro no alto da própria janela, sem
 * abrir outra janela por cima.
 */
export default function OrganizationChart({ funcionarios, empresas }: Props) {
  const topoRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState('todos');
  const [leader, setLeader] = useState('todos');
  const [responsible, setResponsible] = useState('todos');
  const [company, setCompany] = useState('todos');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Funcionario | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
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
    const ordenar = <T,>(mapa: Map<string, T>) => Array.from(mapa.entries()).sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
    return ordenar(tree).map(([companyNameValue, areaMap]) => [companyNameValue,
      ordenar(areaMap).map(([areaName, responsibleMap]) => [areaName,
        ordenar(responsibleMap).map(([responsibleName, leaderMap]) => [responsibleName, ordenar(leaderMap)] as ResponsibleGroup),
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
    setActiveId(item.id);
    requestAnimationFrame(() => document.getElementById(`org-${item.id}`)?.scrollIntoView({ behavior: rolar(), block: 'center', inline: 'center' }));
  };
  // Tocar no cartão mostra os dados no quadro do alto da janela e leva até ele.
  const escolher = (item: Funcionario) => {
    setSelected(item);
    setActiveId(item.id);
    requestAnimationFrame(() => document.getElementById('organograma-escolhido')?.scrollIntoView({ behavior: rolar(), block: 'center' }));
  };
  useEffect(() => { if (query.trim() && filtered.length === 1) focusEmployee(filtered[0]); }, [query, filtered]);

  const active = filtered.filter(item => item.ativo).length;
  const inactive = filtered.length - active;
  const activeLeader = activeId ? funcionarios.find(candidate => candidate.id === activeId)?.liderNome : undefined;
  const related = (item: Funcionario) => !activeId || activeId === item.id || item.liderNome === activeLeader;
  const centerChart = () => { topoRef.current?.scrollIntoView({ behavior: rolar(), block: 'start' }); setActiveId(null); };
  const descendants = (areasValue: AreaGroup[]) => areasValue.flatMap(([, responsibleGroups]) => responsibleGroups.flatMap(([, leaderGroups]) => leaderGroups.flatMap(([, members]) => members)));

  const resumo: Array<[string, number, 'active' | 'inactive' | null]> = [
    ['Colaboradores', filtered.length, null],
    ['Ativos', active, 'active'],
    ['Inativos', inactive, 'inactive'],
    ['Áreas', unique(filtered.map(item => item.area || '')).length, null],
    ['Líderes', unique(filtered.map(item => item.liderNome || '')).length, null],
    ['Responsáveis', unique(filtered.map(item => item.responsavelArea || '')).length, null],
    ['Empresas', unique(filtered.map(companyName)).length, null],
  ];
  const filtros: Array<[string, string, (value: string) => void, string[]]> = [
    ['Empresa', company, setCompany, companies],
    ['Área', area, setArea, areas],
    ['Responsável', responsible, setResponsible, responsibles],
    ['Líder', leader, setLeader, leaders],
  ];

  const employeeCards = (members: Funcionario[]) => <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{members.map(item => {
    const dimmed = summaryFocus === 'active' ? !item.ativo : summaryFocus === 'inactive' ? item.ativo : !related(item);
    return (
      <button
        id={`org-${item.id}`}
        key={item.id}
        type="button"
        aria-pressed={selected?.id === item.id}
        onMouseEnter={() => setActiveId(item.id)}
        onMouseLeave={() => setActiveId(null)}
        onClick={() => escolher(item)}
        className={`rounded-xl border bg-white p-3 text-left transition motion-reduce:transition-none ${FOCO} ${activeId === item.id ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-emerald-400'} ${dimmed ? 'opacity-40' : 'opacity-100'}`}
      >
        <span className="block truncate text-sm font-bold text-slate-900">{item.nome}</span>
        <span className="block truncate text-xs text-slate-600">{item.cargo || 'Função não definida'}</span>
        <span className="mt-2 flex items-center justify-between gap-2 text-xs">
          <span className="font-mono text-slate-600">{item.matricula || 'Sem matrícula'}</span>
          <span className={item.ativo ? 'font-bold text-emerald-700' : 'font-bold text-rose-700'}>{statusLabel(item)}</span>
        </span>
      </button>
    );
  })}</div>;

  return (
    <div ref={topoRef} className="space-y-4" data-testid="organograma">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">Empresa → área → responsável → líder → colaborador, com os colaboradores da lista de agora.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={centerChart} className={`${BOTAO_SECUNDARIO} px-3`}><LocateFixed className="size-4" aria-hidden="true" />Voltar ao topo</button>
          <button type="button" onClick={() => setExpanded(new Set(allKeys))} className={`${BOTAO_SECUNDARIO} px-3`}><Maximize2 className="size-4" aria-hidden="true" />Abrir tudo</button>
          <button type="button" onClick={() => setExpanded(new Set())} className={`${BOTAO_SECUNDARIO} px-3`}><Minimize2 className="size-4" aria-hidden="true" />Fechar tudo</button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {resumo.map(([label, value, focus]) => (
          <div key={label} className="rounded-xl border border-slate-100 bg-[#f7f8f6] p-2">
            <dt className="text-xs font-bold uppercase text-[#5b6870]">{label}</dt>
            <dd className="flex items-center justify-between gap-2">
              <strong className="text-xl tabular-nums text-slate-900">{value}</strong>
              {focus && (
                <button
                  type="button"
                  aria-pressed={summaryFocus === focus}
                  onClick={() => setSummaryFocus(atual => (atual === focus ? null : focus))}
                  className={`min-h-8 rounded-lg px-2 text-xs font-semibold ${FOCO} ${summaryFocus === focus ? 'bg-[#176b4d] text-white' : 'text-[#176b4d] hover:bg-emerald-50'}`}
                >
                  Destacar
                </button>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <label className="relative">
          <span className="sr-only">Buscar no organograma</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nome, matrícula ou função" className={`${CAMPO} pl-9`} />
        </label>
        {filtros.map(([label, value, setter, options]) => (
          <label key={label}>
            <span className="sr-only">{label}</span>
            <select value={value} onChange={event => setter(event.target.value)} className={`${CAMPO} cursor-pointer`}>
              <option value="todos">{label}: todos</option>
              {options.map(option => <option key={option}>{option}</option>)}
            </select>
          </label>
        ))}
      </div>

      {selected && (
        <section aria-labelledby="organograma-escolhido" className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4" data-testid="organograma-escolhido">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Colaborador</p>
              <h3 id="organograma-escolhido" className="break-words text-lg font-bold text-slate-900">{selected.nome}</h3>
              <p className="text-sm text-slate-600">{selected.cargo || 'Função não definida'}</p>
            </div>
            <button type="button" onClick={() => setSelected(null)} aria-label="Fechar dados do colaborador" className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-white ${FOCO}`}>
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <dl className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {[['Matrícula', selected.matricula || 'Não informada'], ['Situação', statusLabel(selected)], ['Empresa', companyName(selected)], ['Área', selected.area || fallback.area], ['Responsável', selected.responsavelArea || fallback.responsible], ['Líder', selected.liderNome || fallback.leader], ['Divisão', selected.divisao || 'Não informada'], ['Seção', selected.secao || 'Não informada'], ['Mobilização', selected.dataMobilizacao || 'Não informada'], ['Cadastro', selected.criadoEm ? new Date(selected.criadoEm).toLocaleDateString('pt-BR') : 'Não informado']].map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-xl border border-slate-200 bg-white p-2.5">
                <dt className="text-xs font-bold uppercase text-[#5b6870]">{label}</dt>
                <dd className="mt-0.5 break-words text-sm font-semibold text-slate-800">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <Users className="mx-auto mb-2 size-8 text-slate-500" aria-hidden="true" />
          <p className="font-bold text-slate-700">Nenhum colaborador encontrado</p>
          <p className="text-sm text-slate-600">Revise os filtros ou complete os vínculos do cadastro.</p>
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl bg-[#f7f8f6] p-3">
          {groups.map(([companyValue, areaGroups]) => {
            const companyKey = `company:${companyValue}`, openCompany = expanded.has(companyKey), companyItems = descendants(areaGroups);
            return (
              <article key={companyValue} className="rounded-2xl border border-slate-200 bg-white">
                <button type="button" aria-expanded={openCompany} onClick={() => toggle(companyKey)} className={`flex w-full items-center gap-3 rounded-2xl p-4 text-left ${FOCO}`}>
                  <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><Building2 className="size-5" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1"><strong className="block truncate text-slate-900">{companyValue}</strong><span className="text-sm text-slate-600">{companyItems.length} colaborador(es)</span></span>
                  {openCompany ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
                </button>
                {openCompany && (
                  <div className="space-y-3 border-t border-slate-100 p-3 md:pl-8">
                    {areaGroups.map(([areaValue, responsibleGroups]) => {
                      const areaKey = `area:${companyValue}:${areaValue}`, openArea = expanded.has(areaKey);
                      const pessoas = responsibleGroups.reduce((sum, [, leadersValue]) => sum + leadersValue.reduce((count, [, members]) => count + members.length, 0), 0);
                      return (
                        <div key={areaKey} className="relative border-l-2 border-emerald-200 pl-4">
                          <button type="button" aria-expanded={openArea} onClick={() => toggle(areaKey)} className={`${BOTAO_NO} border-slate-200 bg-[#f7f8f6]`}>
                            <span className="flex-1"><strong className="text-sm text-slate-900">{areaValue}</strong><span className="ml-2 text-sm text-slate-600">{pessoas} pessoa(s)</span></span>
                            {openArea ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
                          </button>
                          {openArea && (
                            <div className="space-y-3 py-3 pl-3">
                              {responsibleGroups.map(([responsibleValue, leaderGroups]) => {
                                const responsibleKey = `responsible:${companyValue}:${areaValue}:${responsibleValue}`, openResponsible = expanded.has(responsibleKey);
                                return (
                                  <div key={responsibleKey} className="border-l-2 border-sky-200 pl-4">
                                    <button type="button" aria-expanded={openResponsible} onClick={() => toggle(responsibleKey)} className={`${BOTAO_NO} border-sky-100 bg-sky-50`}>
                                      <UserRound className="size-4 text-sky-700" aria-hidden="true" />
                                      <span className="flex-1"><strong className="block text-sm text-slate-900">{responsibleValue}</strong><span className="text-sm text-slate-600">Responsável da área</span></span>
                                      {openResponsible ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
                                    </button>
                                    {openResponsible && (
                                      <div className="space-y-3 py-3 pl-3">
                                        {leaderGroups.map(([leaderValue, members]) => {
                                          const leaderKey = `leader:${companyValue}:${areaValue}:${responsibleValue}:${leaderValue}`, openLeader = expanded.has(leaderKey);
                                          return (
                                            <div key={leaderKey} className="border-l-2 border-amber-200 pl-4">
                                              <button type="button" aria-expanded={openLeader} onClick={() => toggle(leaderKey)} className={`${BOTAO_NO} mb-2 border-amber-100 bg-amber-50`}>
                                                <Users className="size-4 text-amber-700" aria-hidden="true" />
                                                <span className="flex-1"><strong className="block text-sm text-slate-900">{leaderValue}</strong><span className="text-sm text-slate-600">{members.length} integrante(s)</span></span>
                                                {openLeader ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronRight className="size-4" aria-hidden="true" />}
                                              </button>
                                              {openLeader && employeeCards(members)}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
