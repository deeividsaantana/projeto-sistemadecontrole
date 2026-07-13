import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  CalendarDays,
  Database,
  Download,
  Gauge,
  LoaderCircle,
  Search,
  ShieldCheck,
  Upload,
  UserRoundX,
  Wrench,
} from 'lucide-react';
import type { Equipamento, ObraLocal, ParteDiariaEquipamento } from '../types';

interface LegacyStop {
  codigo: string;
  descricao: string;
  tipo: string;
  horas: number;
}

interface LegacyWork {
  ua: string;
  horas: number;
}

interface LegacyProduction {
  frente: string;
  origem: string;
  destino: string;
  material: string;
  viagens: number;
  equipamentoCarga: string;
  operador: string;
}

interface LegacyJourney {
  id: string;
  codigo: number;
  data: string;
  turno: string;
  equipamentoUa: string;
  equipamento: string;
  familia: string;
  empresa: string;
  horimetroInicial: number;
  horimetroFinal: number;
  operadorMatricula: string;
  operadorNome: string;
  operadorCargo: string;
  horasTrabalhadas: number;
  horasParadas: number;
  trabalhos: LegacyWork[];
  paradas: LegacyStop[];
  producao: LegacyProduction[];
  observacao: string;
  inconsistencias: string[];
}

interface LegacyPayload {
  origem: { sistema: string; arquivoPrincipal: string; arquivoAplicacao: string; convertidoEm: string };
  resumo: {
    dataInicial: string;
    dataFinal: string;
    equipamentos: number;
    pessoas: number;
    jornadas: number;
    horasTrabalhadas: number;
    horasParadas: number;
    producoes: number;
    inconsistencias: number;
    registrosOrfaos: number;
  };
  jornadas: LegacyJourney[];
}

interface LegadoSgePanelProps {
  registros: ParteDiariaEquipamento[];
  equipamentos: Equipamento[];
  obras: ObraLocal[];
  onImport: (registros: ParteDiariaEquipamento[]) => void;
}

const formatNumber = (value: number, digits = 1) =>
  Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const formatDate = (value: string) => (value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '-');
const normalize = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();

const LegadoSgePanel: React.FC<LegadoSgePanelProps> = ({ registros, equipamentos, obras, onImport }) => {
  const [payload, setPayload] = useState<LegacyPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [equipmentUa, setEquipmentUa] = useState('');
  const [status, setStatus] = useState('');
  const [importMessage, setImportMessage] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/legacy-data/sge-operacional.json', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('O arquivo convertido do SGE não foi encontrado.');
        return response.json();
      })
      .then((data: LegacyPayload) => {
        if (!active) return;
        setPayload(data);
        setDateStart(data.resumo.dataInicial);
        setDateEnd(data.resumo.dataFinal);
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : 'Falha ao abrir o legado SGE.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const equipmentOptions = useMemo(() => {
    const map = new Map<string, string>();
    payload?.jornadas.forEach((item) => map.set(item.equipamentoUa, item.equipamento));
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  }, [payload]);

  const filtered = useMemo(() => {
    const term = normalize(search);
    return (payload?.jornadas || []).filter((item) => {
      if (dateStart && item.data < dateStart) return false;
      if (dateEnd && item.data > dateEnd) return false;
      if (equipmentUa && item.equipamentoUa !== equipmentUa) return false;
      if (status === 'inconsistente' && !item.inconsistencias.length) return false;
      if (status === 'sem-operador' && item.operadorNome) return false;
      return (
        !term ||
        normalize(
          `${item.equipamentoUa} ${item.equipamento} ${item.familia} ${item.empresa} ${item.operadorNome} ${item.observacao}`,
        ).includes(term)
      );
    });
  }, [payload, search, dateStart, dateEnd, equipmentUa, status]);

  const metrics = useMemo(() => {
    const worked = filtered.reduce((sum, item) => sum + item.horasTrabalhadas, 0);
    const stopped = filtered.reduce((sum, item) => sum + item.horasParadas, 0);
    const missingOperator = filtered.filter((item) => !item.operadorNome).length;
    const inconsistent = filtered.filter((item) => item.inconsistencias.length).length;
    const utilization = worked + stopped > 0 ? (worked / (worked + stopped)) * 100 : 0;
    return { worked, stopped, missingOperator, inconsistent, utilization };
  }, [filtered]);

  const stopRanking = useMemo(() => {
    const map = new Map<string, { code: string; label: string; hours: number; events: number }>();
    filtered.forEach((item) =>
      item.paradas.forEach((stop) => {
        const current = map.get(stop.codigo) || { code: stop.codigo, label: stop.descricao, hours: 0, events: 0 };
        current.hours += stop.horas;
        current.events += 1;
        map.set(stop.codigo, current);
      }),
    );
    return [...map.values()].sort((a, b) => b.hours - a.hours).slice(0, 10);
  }, [filtered]);

  const alreadyImported = useMemo(() => new Set(registros.map((item) => item.id)), [registros]);
  const pendingMigration = filtered.filter((item) => !alreadyImported.has(`legacy-${item.id}`));

  const mapJourney = (item: LegacyJourney): ParteDiariaEquipamento => {
    const equipment = equipamentos.find((candidate) => {
      const prefix = normalize(candidate.prefixo);
      return prefix === normalize(item.equipamentoUa) || prefix === normalize(`UA ${item.equipamentoUa}`);
    });
    const mainFront = [...item.trabalhos].sort((a, b) => b.horas - a.horas)[0]?.ua || item.producao[0]?.frente || '';
    const obra = obras.find((candidate) => normalize(candidate.nome).includes(normalize(mainFront)) && Boolean(mainFront));
    const now = new Date().toISOString();
    const activities = [
      ...item.trabalhos.map((work, index) => ({
        id: `legacy-work-${item.id}-${index}`,
        descricao: `Atividade produtiva na UA ${work.ua}`,
        centroCusto: `UA ${work.ua}`,
        codigoPerda: '',
        tipoMarcacao: 'Relógio' as const,
        inicial: '',
        final: '',
        totalHoras: work.horas,
      })),
      ...item.paradas.map((stop, index) => ({
        id: `legacy-stop-${item.id}-${index}`,
        descricao: stop.descricao,
        centroCusto: '',
        codigoPerda: stop.codigo,
        tipoMarcacao: 'Relógio' as const,
        inicial: '',
        final: '',
        totalHoras: stop.horas,
      })),
    ];
    return {
      id: `legacy-${item.id}`,
      numero: `SGE-${String(item.codigo).padStart(6, '0')}`,
      data: item.data,
      obraId: obra?.id || '',
      obraNome: obra?.nome || (mainFront ? `Frente UA ${mainFront}` : 'Legado SGE'),
      equipamentoId: equipment?.id || '',
      prefixo: equipment?.prefixo || `UA ${item.equipamentoUa}`,
      tipoEquipamento: equipment?.tipo || item.familia || item.equipamento,
      jornada: Math.max(8, Math.ceil((item.horasTrabalhadas + item.horasParadas) * 4) / 4),
      operadorId: '',
      operadorNome: item.operadorNome,
      matricula: item.operadorMatricula,
      apontador: 'Importado do SGE',
      encarregado: '',
      horimetroInicial: item.horimetroInicial,
      horimetroFinal: item.horimetroFinal,
      totalHorasTrabalhadas: item.horasTrabalhadas,
      atividades: activities,
      transportes: item.producao.map((production, index) => ({
        id: `legacy-production-${item.id}-${index}`,
        descricao: production.origem ? `${production.origem} → ${production.destino}` : 'Transporte legado',
        centroCusto: production.frente ? `UA ${production.frente}` : '',
        destino: production.destino,
        materialTransportado: production.material,
        quantidadeViagens: production.viagens,
        equipamentoCarga: production.equipamentoCarga,
      })),
      checklist: [],
      outrosProblemas: item.inconsistencias.join('; '),
      status: item.inconsistencias.length ? 'Inconsistente' : 'Pendente',
      observacao: [item.observacao, `Turno ${item.turno}`, `Origem: ${payload?.origem.sistema || 'SGE'}`]
        .filter(Boolean)
        .join(' | '),
      criadoEm: now,
      atualizadoEm: now,
    };
  };

  const migrateFiltered = () => {
    setImportMessage('');
    if (!pendingMigration.length) {
      setImportMessage('Todos os registros deste filtro já foram migrados.');
      return;
    }
    if (pendingMigration.length > 250) {
      setImportMessage('O filtro contém mais de 250 fichas. Reduza o período ou escolha uma frota antes de migrar.');
      return;
    }
    if (!window.confirm(`Migrar ${pendingMigration.length} ficha(s) filtrada(s) para a Parte Diária?`)) return;
    onImport(pendingMigration.map(mapJourney));
    setImportMessage(`${pendingMigration.length} ficha(s) migrada(s) para conferência.`);
  };

  if (loading) {
    return <div className="grid min-h-96 place-items-center text-sm text-slate-400"><LoaderCircle className="mb-3 animate-spin text-emerald-300" size={30} />Abrindo legado SGE...</div>;
  }

  if (error || !payload) {
    return <div className="flex items-start gap-3 border border-rose-500/30 bg-rose-500/10 p-5 text-sm text-rose-200"><AlertTriangle size={20} />{error || 'Legado indisponível.'}</div>;
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 border-b border-slate-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-cyan-300"><Archive size={16} /> Base convertida</div>
          <h2 className="text-2xl font-bold text-white">Legado SGE</h2>
          <p className="mt-1 text-sm text-slate-400">{payload.resumo.dataInicial.split('-').reverse().join('/')} a {payload.resumo.dataFinal.split('-').reverse().join('/')} | {payload.resumo.jornadas.toLocaleString('pt-BR')} jornadas</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/legacy-data/sge-operacional.json" download className="inline-flex h-10 items-center gap-2 border border-slate-700 bg-slate-900 px-3 text-sm font-bold"><Download size={17} /> Backup convertido</a>
          <button type="button" onClick={migrateFiltered} className="inline-flex h-10 items-center gap-2 bg-emerald-500 px-4 text-sm font-bold text-slate-950"><Upload size={17} /> Migrar filtro ({pendingMigration.length})</button>
        </div>
      </section>

      {importMessage && <div className="border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm text-cyan-100">{importMessage}</div>}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <label className="relative xl:col-span-2"><Search className="absolute left-3 top-3 text-slate-500" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="UA, equipamento, operador..." className="h-11 w-full border border-slate-700 bg-slate-950 pl-10 pr-3 text-sm outline-none focus:border-cyan-500" /></label>
        <label className="relative"><CalendarDays className="absolute left-3 top-3 text-slate-500" size={17} /><input type="date" value={dateStart} onChange={(event) => setDateStart(event.target.value)} className="h-11 w-full border border-slate-700 bg-slate-950 pl-10 pr-2 text-sm outline-none focus:border-cyan-500" /></label>
        <label className="relative"><CalendarDays className="absolute left-3 top-3 text-slate-500" size={17} /><input type="date" value={dateEnd} onChange={(event) => setDateEnd(event.target.value)} className="h-11 w-full border border-slate-700 bg-slate-950 pl-10 pr-2 text-sm outline-none focus:border-cyan-500" /></label>
        <select value={equipmentUa} onChange={(event) => setEquipmentUa(event.target.value)} className="h-11 border border-slate-700 bg-slate-950 px-3 text-sm outline-none focus:border-cyan-500"><option value="">Todas as UAs</option>{equipmentOptions.map(([ua, name]) => <option value={ua} key={ua}>UA {ua} - {name}</option>)}</select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 border border-slate-700 bg-slate-950 px-3 text-sm outline-none focus:border-cyan-500"><option value="">Todos os status</option><option value="inconsistente">Com inconsistência</option><option value="sem-operador">Sem operador</option></select>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: 'Jornadas', value: filtered.length.toLocaleString('pt-BR'), detail: `${pendingMigration.length} não migradas`, icon: Database, color: 'text-cyan-300' },
          { label: 'Horas produtivas', value: `${formatNumber(metrics.worked)} h`, detail: 'Apropriação HT', icon: Gauge, color: 'text-emerald-300' },
          { label: 'Horas paradas', value: `${formatNumber(metrics.stopped)} h`, detail: 'Apropriação HP', icon: Wrench, color: 'text-amber-300' },
          { label: 'Aproveitamento', value: `${formatNumber(metrics.utilization, 0)}%`, detail: 'HT sobre HT + HP', icon: ShieldCheck, color: 'text-sky-300' },
          { label: 'Deficiências', value: metrics.inconsistent + metrics.missingOperator, detail: `${metrics.missingOperator} sem operador`, icon: UserRoundX, color: 'text-rose-300' },
        ].map((item) => { const Icon = item.icon; return <article key={item.label} className="border border-slate-800 bg-slate-950 p-4"><div className="flex items-start justify-between"><span className="text-xs font-bold uppercase text-slate-500">{item.label}</span><Icon size={19} className={item.color} /></div><strong className="mt-3 block text-2xl text-white">{item.value}</strong><span className="mt-1 block text-xs text-slate-500">{item.detail}</span></article>; })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <div className="border border-slate-800 bg-slate-950"><div className="border-b border-slate-800 p-4"><h3 className="font-bold text-white">Principais paradas</h3><span className="text-xs text-slate-500">Horas por código legado</span></div><div className="divide-y divide-slate-800">{stopRanking.map((item) => <div key={item.code} className="p-4"><div className="flex items-start justify-between gap-3"><div><strong className="text-amber-300">{item.code}</strong><span className="ml-2 text-sm text-slate-200">{item.label}</span><span className="mt-1 block text-xs text-slate-500">{item.events} ocorrência(s)</span></div><strong className="shrink-0 text-white">{formatNumber(item.hours)} h</strong></div></div>)}{!stopRanking.length && <div className="p-10 text-center text-sm text-slate-500">Sem paradas no filtro.</div>}</div></div>
        <div className="overflow-hidden border border-slate-800 bg-slate-950"><div className="flex items-center justify-between border-b border-slate-800 p-4"><div><h3 className="font-bold text-white">Jornadas recuperadas</h3><span className="text-xs text-slate-500">{filtered.length.toLocaleString('pt-BR')} resultado(s)</span></div><Database className="text-cyan-300" size={20} /></div><div className="max-h-[620px] overflow-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="sticky top-0 bg-slate-900 text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">Data</th><th className="px-3 py-3">UA / equipamento</th><th className="px-3 py-3">Operador</th><th className="px-3 py-3">Horímetro</th><th className="px-3 py-3">HT</th><th className="px-3 py-3">HP</th><th className="px-3 py-3">Produção</th><th className="px-3 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-800">{filtered.slice(0, 500).map((item) => <tr key={item.id} className="hover:bg-slate-900/70"><td className="px-3 py-3"><strong className="text-white">{formatDate(item.data)}</strong><span className="block text-xs text-slate-500">Turno {item.turno}</span></td><td className="px-3 py-3"><strong className="font-mono text-cyan-300">UA {item.equipamentoUa}</strong><span className="block max-w-52 truncate text-xs text-slate-500">{item.equipamento}</span></td><td className="px-3 py-3"><span className="block max-w-48 truncate">{item.operadorNome || 'Não vinculado'}</span><span className="text-xs text-slate-500">{item.operadorMatricula}</span></td><td className="px-3 py-3">{formatNumber(item.horimetroInicial)} → {formatNumber(item.horimetroFinal)}</td><td className="px-3 py-3 text-emerald-300">{formatNumber(item.horasTrabalhadas)} h</td><td className="px-3 py-3 text-amber-300">{formatNumber(item.horasParadas)} h</td><td className="px-3 py-3">{item.producao.reduce((sum, row) => sum + row.viagens, 0)} viagem(ns)</td><td className="px-3 py-3"><span className={`border px-2 py-1 text-xs font-bold ${item.inconsistencias.length ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>{item.inconsistencias.length ? `${item.inconsistencias.length} alerta(s)` : 'Conferido'}</span></td></tr>)}</tbody></table>{filtered.length > 500 && <div className="border-t border-slate-800 p-3 text-center text-xs text-slate-500">Tabela limitada aos primeiros 500 resultados. Use os filtros para detalhar.</div>}</div></div>
      </section>
    </div>
  );
};

export default LegadoSgePanel;
