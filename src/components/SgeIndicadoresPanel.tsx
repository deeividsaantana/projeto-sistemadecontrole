import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  ClipboardX,
  Database,
  Download,
  Gauge,
  LoaderCircle,
  Route,
  Search,
  ShieldCheck,
  Truck,
  Wrench,
} from 'lucide-react';

interface SgeStop {
  codigo: string;
  descricao: string;
  tipo: string;
  horas: number;
}

interface SgeProduction {
  frente: string;
  origem: string;
  destino: string;
  material: string;
  viagens: number;
  equipamentoCarga: string;
}

interface SgeJourney {
  id: string;
  data: string;
  turno: string;
  equipamentoUa: string;
  equipamento: string;
  familia: string;
  empresa: string;
  operadorNome: string;
  horasTrabalhadas: number;
  horasParadas: number;
  paradas: SgeStop[];
  producao: SgeProduction[];
  inconsistencias: string[];
}

interface SgeEquipment {
  ua: string;
  nome: string;
  familia: string;
  empresa: string;
  mobilizado: boolean;
  metaDisponibilidade: number;
}

interface SgePayload {
  origem: { sistema: string; convertidoEm: string };
  resumo: { dataInicial: string; dataFinal: string; jornadas: number };
  equipamentos: SgeEquipment[];
  jornadas: SgeJourney[];
}

type IndicatorView = 'resumo' | 'frota' | 'produtividade' | 'pendencias' | 'terceiros';

interface EquipmentMetric {
  ua: string;
  equipamento: string;
  familia: string;
  empresa: string;
  meta: number;
  jornadas: number;
  trabalhadas: number;
  paradas: number;
  paradasMecanicas: number;
  falhas: number;
  viagens: number;
  carregamentos: number;
  inconsistencias: number;
  ultimaData: string;
}

const normalize = (value: string) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR');

const formatNumber = (value: number, digits = 1) => Number(value || 0).toLocaleString('pt-BR', {
  minimumFractionDigits: digits,
  maximumFractionDigits: digits,
});

const formatDate = (value: string) => value ? value.split('-').reverse().join('/') : '-';
const percentage = (value: number) => `${formatNumber(Math.max(0, Math.min(100, value)), 0)}%`;

const isMechanicalStop = (stop: SgeStop) => {
  const value = normalize(`${stop.tipo} ${stop.descricao}`);
  return value.includes('hpm') || /mecan|manuten|quebra|falha|oficina|prevent|corretiv/.test(value);
};

const availability = (item: EquipmentMetric) => {
  const programmed = item.trabalhadas + item.paradas;
  return programmed > 0 ? (programmed - item.paradasMecanicas) / programmed * 100 : 0;
};

const utilization = (item: EquipmentMetric) => {
  const programmed = item.trabalhadas + item.paradas;
  return programmed > 0 ? item.trabalhadas / programmed * 100 : 0;
};

const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const SgeIndicadoresPanel: React.FC = () => {
  const [payload, setPayload] = useState<SgePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<IndicatorView>('resumo');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [family, setFamily] = useState('');
  const [company, setCompany] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/legacy-data/sge-operacional.json', { cache: 'no-store' })
      .then(response => {
        if (!response.ok) throw new Error('A base convertida do SGE não foi encontrada.');
        return response.json();
      })
      .then((data: SgePayload) => {
        if (!active) return;
        setPayload(data);
        setStartDate(data.resumo.dataInicial);
        setEndDate(data.resumo.dataFinal);
      })
      .catch(reason => active && setError(reason instanceof Error ? reason.message : 'Falha ao abrir os indicadores SGE.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const families = useMemo(() => [...new Set<string>((payload?.equipamentos || []).map(item => String(item.familia || '')).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR')), [payload]);
  const companies = useMemo(() => [...new Set<string>((payload?.equipamentos || []).map(item => String(item.empresa || '')).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR')), [payload]);

  const filteredJourneys = useMemo(() => {
    const term = normalize(search.trim());
    return (payload?.jornadas || []).filter(item => {
      if (startDate && item.data < startDate) return false;
      if (endDate && item.data > endDate) return false;
      if (family && item.familia !== family) return false;
      if (company && item.empresa !== company) return false;
      return !term || normalize(`${item.equipamentoUa} ${item.equipamento} ${item.familia} ${item.empresa} ${item.operadorNome}`).includes(term);
    });
  }, [payload, startDate, endDate, family, company, search]);

  const equipmentMetrics = useMemo(() => {
    const equipmentByUa = new Map<string, SgeEquipment>((payload?.equipamentos || []).map(item => [item.ua, item]));
    const metrics = new Map<string, EquipmentMetric>();
    filteredJourneys.forEach(journey => {
      const equipment = equipmentByUa.get(journey.equipamentoUa);
      const current = metrics.get(journey.equipamentoUa) || {
        ua: journey.equipamentoUa,
        equipamento: equipment?.nome || journey.equipamento,
        familia: equipment?.familia || journey.familia,
        empresa: equipment?.empresa || journey.empresa,
        meta: Number(equipment?.metaDisponibilidade || 0.8) * 100,
        jornadas: 0,
        trabalhadas: 0,
        paradas: 0,
        paradasMecanicas: 0,
        falhas: 0,
        viagens: 0,
        carregamentos: 0,
        inconsistencias: 0,
        ultimaData: '',
      };
      const mechanicalStops = (journey.paradas || []).filter(isMechanicalStop);
      current.jornadas += 1;
      current.trabalhadas += Number(journey.horasTrabalhadas || 0);
      current.paradas += Number(journey.horasParadas || 0);
      current.paradasMecanicas += mechanicalStops.reduce((sum, item) => sum + Number(item.horas || 0), 0);
      current.falhas += mechanicalStops.length;
      current.viagens += (journey.producao || []).reduce((sum, item) => sum + Number(item.viagens || 0), 0);
      current.inconsistencias += (journey.inconsistencias || []).length + (journey.operadorNome ? 0 : 1);
      current.ultimaData = current.ultimaData > journey.data ? current.ultimaData : journey.data;
      metrics.set(journey.equipamentoUa, current);
    });

    filteredJourneys.forEach(journey => {
      (journey.producao || []).forEach(production => {
        const loaderUa = String(production.equipamentoCarga || '').trim();
        const loader = metrics.get(loaderUa);
        if (loader) loader.carregamentos += Number(production.viagens || 0);
      });
    });
    return [...metrics.values()].sort((a, b) => a.ua.localeCompare(b.ua, 'pt-BR', { numeric: true }));
  }, [payload, filteredJourneys]);

  const totals = useMemo(() => {
    const result = equipmentMetrics.reduce((acc, item) => ({
      worked: acc.worked + item.trabalhadas,
      stopped: acc.stopped + item.paradas,
      mechanical: acc.mechanical + item.paradasMecanicas,
      failures: acc.failures + item.falhas,
      trips: acc.trips + item.viagens,
      inconsistencies: acc.inconsistencies + item.inconsistencias,
    }), { worked: 0, stopped: 0, mechanical: 0, failures: 0, trips: 0, inconsistencies: 0 });
    const programmed = result.worked + result.stopped;
    return {
      ...result,
      availability: programmed ? (programmed - result.mechanical) / programmed * 100 : 0,
      utilization: programmed ? result.worked / programmed * 100 : 0,
      mtbf: result.failures ? result.worked / result.failures : result.worked,
    };
  }, [equipmentMetrics]);

  const stopRanking = useMemo(() => {
    const map = new Map<string, { code: string; label: string; type: string; hours: number; events: number }>();
    filteredJourneys.forEach(journey => (journey.paradas || []).forEach(stop => {
      const key = `${stop.codigo}|${stop.tipo}`;
      const current = map.get(key) || { code: stop.codigo, label: stop.descricao, type: stop.tipo, hours: 0, events: 0 };
      current.hours += Number(stop.horas || 0);
      current.events += 1;
      map.set(key, current);
    }));
    return [...map.values()].sort((a, b) => b.hours - a.hours);
  }, [filteredJourneys]);

  const routeRanking = useMemo(() => {
    const map = new Map<string, { origin: string; destination: string; material: string; trips: number }>();
    filteredJourneys.forEach(journey => (journey.producao || []).forEach(production => {
      const origin = production.origem || production.frente || 'Não informado';
      const destination = production.destino || 'Não informado';
      const material = production.material || 'Não informado';
      const key = `${origin}|${destination}|${material}`;
      const current = map.get(key) || { origin, destination, material, trips: 0 };
      current.trips += Number(production.viagens || 0);
      map.set(key, current);
    }));
    return [...map.values()].sort((a, b) => b.trips - a.trips);
  }, [filteredJourneys]);

  const pendingJourneys = useMemo(() => filteredJourneys.filter(item =>
    !item.operadorNome || (item.inconsistencias || []).length > 0 || (Number(item.horasTrabalhadas || 0) + Number(item.horasParadas || 0) === 0),
  ), [filteredJourneys]);

  const thirdParty = useMemo(() => {
    const map = new Map<string, { company: string; equipment: Set<string>; worked: number; stopped: number; trips: number }>();
    equipmentMetrics.filter(item => !/^renea$/i.test(item.empresa.trim())).forEach(item => {
      const companyName = item.empresa || 'Empresa não informada';
      const current = map.get(companyName) || { company: companyName, equipment: new Set<string>(), worked: 0, stopped: 0, trips: 0 };
      current.equipment.add(item.ua);
      current.worked += item.trabalhadas;
      current.stopped += item.paradas;
      current.trips += item.viagens;
      map.set(companyName, current);
    });
    return [...map.values()].sort((a, b) => b.worked - a.worked);
  }, [equipmentMetrics]);

  const exportIndicators = () => {
    const header = ['UA', 'Equipamento', 'Família', 'Empresa', 'Jornadas', 'HT', 'HP', 'HP mecânica', 'Disponibilidade %', 'Utilização %', 'MTBF h', 'Viagens', 'Alertas'];
    const rows = equipmentMetrics.map(item => [
      item.ua, item.equipamento, item.familia, item.empresa, item.jornadas, item.trabalhadas, item.paradas,
      item.paradasMecanicas, availability(item), utilization(item), item.falhas ? item.trabalhadas / item.falhas : item.trabalhadas,
      item.viagens, item.inconsistencias,
    ]);
    const content = `\uFEFF${[header, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `indicadores-sge-${startDate || 'inicio'}-${endDate || 'fim'}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="grid min-h-96 place-items-center text-sm text-slate-400"><LoaderCircle className="mb-3 animate-spin text-emerald-300" size={30} />Calculando indicadores do SGE...</div>;
  if (error || !payload) return <div className="flex items-start gap-3 border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-200"><AlertTriangle size={20} />{error || 'Base SGE indisponível.'}</div>;

  const viewItems: Array<{ id: IndicatorView; label: string; icon: React.ElementType }> = [
    { id: 'resumo', label: 'Resumo', icon: BarChart3 },
    { id: 'frota', label: 'Disponibilidade e MTBF', icon: Gauge },
    { id: 'produtividade', label: 'Produtividade', icon: Truck },
    { id: 'pendencias', label: `Pendências (${pendingJourneys.length})`, icon: ClipboardX },
    { id: 'terceiros', label: 'Fechamento de terceiros', icon: Building2 },
  ];

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 border-b border-slate-800 pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-emerald-400"><Database size={16} /> SGE redesenhado</div>
          <h2 className="text-2xl font-bold text-white">Indicadores de produção e equipamentos</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">As consultas de HT, HP, disponibilidade, MTBF, produtividade, faltantes e terceiros do Access reunidas em uma tela filtrável.</p>
        </div>
        <button type="button" onClick={exportIndicators} className="inline-flex h-10 items-center justify-center gap-2 bg-emerald-500 px-4 text-sm font-bold text-slate-950"><Download size={17} /> Exportar indicadores</button>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.5fr_repeat(4,1fr)]">
        <label className="relative"><Search className="absolute left-3 top-3 text-slate-500" size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="UA, equipamento, operador..." className="h-11 w-full border border-slate-700 bg-slate-950 pl-10 pr-3 text-sm outline-none focus:border-emerald-500" /></label>
        <input aria-label="Data inicial" type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="h-11 border border-slate-700 bg-slate-950 px-3 text-sm outline-none focus:border-emerald-500" />
        <input aria-label="Data final" type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className="h-11 border border-slate-700 bg-slate-950 px-3 text-sm outline-none focus:border-emerald-500" />
        <select aria-label="Família" value={family} onChange={event => setFamily(event.target.value)} className="h-11 border border-slate-700 bg-slate-950 px-3 text-sm outline-none focus:border-emerald-500"><option value="">Todas as famílias</option>{families.map(item => <option key={item}>{item}</option>)}</select>
        <select aria-label="Empresa" value={company} onChange={event => setCompany(event.target.value)} className="h-11 border border-slate-700 bg-slate-950 px-3 text-sm outline-none focus:border-emerald-500"><option value="">Todas as empresas</option>{companies.map(item => <option key={item}>{item}</option>)}</select>
      </section>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-800">{viewItems.map(item => { const Icon = item.icon; return <button type="button" key={item.id} onClick={() => setView(item.id)} className={`inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold ${view === item.id ? 'border-emerald-400 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}><Icon size={17} />{item.label}</button>; })}</div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          { label: 'Jornadas', value: filteredJourneys.length.toLocaleString('pt-BR'), detail: `${equipmentMetrics.length} equipamentos`, icon: Database, color: 'text-sky-300' },
          { label: 'Horas trabalhadas', value: `${formatNumber(totals.worked)} h`, detail: 'HT apropriada', icon: Activity, color: 'text-emerald-300' },
          { label: 'Horas paradas', value: `${formatNumber(totals.stopped)} h`, detail: `${formatNumber(totals.mechanical)} h mecânicas`, icon: Wrench, color: 'text-amber-300' },
          { label: 'Disp. mecânica', value: percentage(totals.availability), detail: 'Desconta HP mecânica', icon: ShieldCheck, color: 'text-cyan-300' },
          { label: 'Utilização', value: percentage(totals.utilization), detail: 'HT / horas programadas', icon: Gauge, color: 'text-violet-300' },
          { label: 'MTBF', value: `${formatNumber(totals.mtbf)} h`, detail: `${totals.failures} evento(s) mecânico(s)`, icon: BarChart3, color: 'text-rose-300' },
        ].map(item => { const Icon = item.icon; return <article key={item.label} className="border border-slate-800 bg-slate-950 p-4"><div className="flex items-start justify-between"><span className="text-xs font-bold uppercase text-slate-500">{item.label}</span><Icon size={19} className={item.color} /></div><strong className="mt-3 block text-2xl text-white">{item.value}</strong><span className="mt-1 block text-xs text-slate-500">{item.detail}</span></article>; })}
      </section>

      {view === 'resumo' && <div className="grid gap-5 xl:grid-cols-2">
        <RankingCard title="Principais motivos de parada" subtitle="Equivale ao gráfico e mapa de HP do SGE" icon={Wrench} items={stopRanking.slice(0, 10).map(item => ({ key: `${item.code}-${item.type}`, label: `${item.code} · ${item.label}`, detail: `${item.type || 'Sem tipo'} · ${item.events} ocorrência(s)`, value: `${formatNumber(item.hours)} h`, amount: item.hours }))} />
        <RankingCard title="Principais origens e destinos" subtitle="Rotas e materiais por quantidade de viagens" icon={Route} items={routeRanking.slice(0, 10).map(item => ({ key: `${item.origin}-${item.destination}-${item.material}`, label: `${item.origin} → ${item.destination}`, detail: item.material, value: `${item.trips} viagens`, amount: item.trips }))} />
      </div>}

      {view === 'frota' && <DataTable headers={['UA / equipamento', 'Empresa', 'HT', 'HP mecânica', 'Disponibilidade', 'Meta', 'Utilização', 'MTBF', 'Alertas']} empty="Nenhum equipamento no filtro.">{equipmentMetrics.map(item => { const availabilityValue = availability(item); const mtbf = item.falhas ? item.trabalhadas / item.falhas : item.trabalhadas; return <tr key={item.ua} className="hover:bg-slate-900/60"><td className="px-4 py-3"><strong className="font-mono text-cyan-300">UA {item.ua}</strong><span className="block max-w-64 truncate text-xs text-slate-500">{item.equipamento} · {item.familia}</span></td><td className="px-4 py-3">{item.empresa}</td><td className="px-4 py-3 text-emerald-300">{formatNumber(item.trabalhadas)} h</td><td className="px-4 py-3 text-amber-300">{formatNumber(item.paradasMecanicas)} h</td><td className={`px-4 py-3 font-bold ${availabilityValue >= item.meta ? 'text-emerald-300' : 'text-rose-300'}`}>{percentage(availabilityValue)}</td><td className="px-4 py-3 text-slate-400">{percentage(item.meta)}</td><td className="px-4 py-3">{percentage(utilization(item))}</td><td className="px-4 py-3">{formatNumber(mtbf)} h</td><td className="px-4 py-3 text-rose-300">{item.inconsistencias}</td></tr>; })}</DataTable>}

      {view === 'produtividade' && <div className="space-y-5"><DataTable headers={['UA / equipamento', 'HT', 'Viagens transporte', 'Viagens / h', 'Cargas realizadas', 'Cargas / h', 'Última ficha']} empty="Sem produção no filtro.">{equipmentMetrics.filter(item => item.viagens > 0 || item.carregamentos > 0).sort((a, b) => b.viagens - a.viagens).map(item => <tr key={item.ua} className="hover:bg-slate-900/60"><td className="px-4 py-3"><strong className="font-mono text-cyan-300">UA {item.ua}</strong><span className="block text-xs text-slate-500">{item.equipamento}</span></td><td className="px-4 py-3">{formatNumber(item.trabalhadas)} h</td><td className="px-4 py-3 text-emerald-300">{item.viagens}</td><td className="px-4 py-3">{formatNumber(item.trabalhadas ? item.viagens / item.trabalhadas : 0, 2)}</td><td className="px-4 py-3 text-amber-300">{item.carregamentos}</td><td className="px-4 py-3">{formatNumber(item.trabalhadas ? item.carregamentos / item.trabalhadas : 0, 2)}</td><td className="px-4 py-3 text-slate-400">{formatDate(item.ultimaData)}</td></tr>)}</DataTable><p className="text-xs text-slate-500">Produção de perfuração e centrais de concreto permanece identificada no inventário do Access e entrará quando essas tabelas forem incluídas na conversão diária.</p></div>}

      {view === 'pendencias' && <DataTable headers={['Data / turno', 'UA / equipamento', 'Operador', 'HT', 'HP', 'Motivo da pendência']} empty="Nenhuma pendência no filtro.">{pendingJourneys.slice(0, 500).map(item => { const reasons = [...(item.inconsistencias || [])]; if (!item.operadorNome) reasons.push('Operador não vinculado'); if (item.horasTrabalhadas + item.horasParadas === 0) reasons.push('Sem apropriação HT/HP'); return <tr key={item.id} className="hover:bg-slate-900/60"><td className="px-4 py-3"><strong>{formatDate(item.data)}</strong><span className="block text-xs text-slate-500">Turno {item.turno}</span></td><td className="px-4 py-3"><strong className="font-mono text-cyan-300">UA {item.equipamentoUa}</strong><span className="block max-w-60 truncate text-xs text-slate-500">{item.equipamento}</span></td><td className="px-4 py-3">{item.operadorNome || <span className="text-rose-300">Não vinculado</span>}</td><td className="px-4 py-3 text-emerald-300">{formatNumber(item.horasTrabalhadas)} h</td><td className="px-4 py-3 text-amber-300">{formatNumber(item.horasParadas)} h</td><td className="px-4 py-3 text-rose-300">{reasons.join('; ')}</td></tr>; })}</DataTable>}

      {view === 'terceiros' && <DataTable headers={['Empresa', 'Equipamentos', 'HT para fechamento', 'HP', 'Viagens', 'Utilização']} empty="Nenhuma empresa terceira no filtro.">{thirdParty.map(item => { const programmed = item.worked + item.stopped; return <tr key={item.company} className="hover:bg-slate-900/60"><td className="px-4 py-3 font-bold text-white">{item.company}</td><td className="px-4 py-3">{item.equipment.size}<span className="block max-w-72 truncate text-xs text-slate-500">UA {[...item.equipment].join(', ')}</span></td><td className="px-4 py-3 text-emerald-300">{formatNumber(item.worked)} h</td><td className="px-4 py-3 text-amber-300">{formatNumber(item.stopped)} h</td><td className="px-4 py-3">{item.trips}</td><td className="px-4 py-3">{percentage(programmed ? item.worked / programmed * 100 : 0)}</td></tr>; })}</DataTable>}
    </div>
  );
};

const RankingCard = ({ title, subtitle, icon: Icon, items }: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  items: Array<{ key: string; label: string; detail: string; value: string; amount: number }>;
}) => {
  const maximum = items[0]?.amount || 1;
  return <section className="border border-slate-800 bg-slate-950"><div className="flex items-center justify-between border-b border-slate-800 p-4"><div><h3 className="font-bold text-white">{title}</h3><span className="text-xs text-slate-500">{subtitle}</span></div><Icon className="text-emerald-300" size={20} /></div><div className="space-y-4 p-4">{items.map(item => <div key={item.key}><div className="mb-1 flex items-start justify-between gap-4 text-sm"><div className="min-w-0"><span className="block truncate text-slate-200">{item.label}</span><span className="block truncate text-xs text-slate-500">{item.detail}</span></div><strong className="shrink-0 text-white">{item.value}</strong></div><div className="h-1.5 bg-slate-800"><div className="h-full bg-emerald-500" style={{ width: `${Math.max(4, item.amount / maximum * 100)}%` }} /></div></div>)}{!items.length && <div className="p-10 text-center text-sm text-slate-500">Sem dados no filtro.</div>}</div></section>;
};

const DataTable = ({ headers, empty, children }: { headers: string[]; empty: string; children: React.ReactNode }) => {
  const hasRows = React.Children.count(children) > 0;
  return <section className="overflow-hidden border border-slate-800 bg-slate-950"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-900 text-xs uppercase text-slate-500"><tr>{headers.map(item => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{hasRows ? children : <tr><td colSpan={headers.length} className="px-4 py-14 text-center text-slate-500">{empty}</td></tr>}</tbody></table></div></section>;
};

export default SgeIndicadoresPanel;
