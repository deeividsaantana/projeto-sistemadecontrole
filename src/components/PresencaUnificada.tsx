import React, { useMemo, useState } from 'react';
import { ClipboardCheck, Radio } from 'lucide-react';
import type { Empresa, Funcionario, ListaPresenca, PresencaApontamento } from '../types';

type Props = { diario: React.ReactNode; tempoReal: React.ReactNode; funcionarios: Funcionario[]; empresas: Empresa[]; listas: ListaPresenca[]; apontamentos: PresencaApontamento[] };

export default function PresencaUnificada({ diario, tempoReal, funcionarios, empresas, listas, apontamentos }: Props) {
  const [view, setView] = useState<'diario' | 'tempo-real'>('diario');
  const [company, setCompany] = useState('');
  const [area, setArea] = useState('');
  const [role, setRole] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const filteredPeople = useMemo(() => funcionarios.filter(person => (!company || person.empresaId === company) && (!area || person.area === area) && (!role || person.cargo === role)), [funcionarios, company, area, role]);
  const presentIds = useMemo(() => {
    const ids = new Set<string>();
    listas.filter(list => list.data === today).forEach(list => list.funcionarios.filter(item => item.presente).forEach(item => ids.add(item.funcionarioId)));
    apontamentos.filter(item => item.data === today && item.status === 'Presente').forEach(item => ids.add(item.funcionarioId));
    return ids;
  }, [listas, apontamentos, today]);
  const active = filteredPeople.filter(person => person.ativo && !['INATIVO', 'DESMOBILIZADO'].includes(person.status || '')).length;
  const present = filteredPeople.filter(person => presentIds.has(person.id)).length;
  const areas = Array.from(new Set(funcionarios.map(item => item.area).filter(Boolean) as string[])).sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const roles = Array.from(new Set(funcionarios.map(item => item.cargo).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'pt-BR'));
  return (
    <div className="space-y-4" id="presenca-unificada">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between"><div><span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-600">Gestão integrada de pessoas</span><h1 className="mt-1 text-2xl font-black text-slate-900">Presença e Controle</h1><p className="mt-1 text-xs text-slate-500">Presença diária, apontamentos por link e histórico na mesma fonte operacional.</p></div><span className="text-xs font-bold text-slate-500">Referência: {new Date(`${today}T12:00:00`).toLocaleDateString('pt-BR')}</span></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3"><select value={company} onChange={event=>setCompany(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"><option value="">Todas as empresas</option>{empresas.map(item=><option key={item.id} value={item.id}>{item.nome}</option>)}</select><select value={area} onChange={event=>setArea(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"><option value="">Todas as áreas</option>{areas.map(item=><option key={item}>{item}</option>)}</select><select value={role} onChange={event=>setRole(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"><option value="">Todas as funções</option>{roles.map(item=><option key={item}>{item}</option>)}</select></div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Colaboradores filtrados',filteredPeople.length],['Ativos / mobilizados',active],['Presentes hoje',present],['Ausentes / sem apontamento',Math.max(0,active-present)]].map(([label,value])=><div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><strong className="block text-2xl font-black text-slate-900">{value}</strong><span className="text-[9px] font-black uppercase tracking-wider text-slate-500">{label}</span></div>)}</div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => setView('diario')} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black transition ${view === 'diario' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-emerald-50'}`}><ClipboardCheck className="h-4 w-4" /> Presença diária</button>
          <button type="button" onClick={() => setView('tempo-real')} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black transition ${view === 'tempo-real' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-emerald-50'}`}><Radio className="h-4 w-4" /> Controle em tempo real</button>
        </div>
      </section>
      {view === 'diario' ? diario : tempoReal}
    </div>
  );
}
