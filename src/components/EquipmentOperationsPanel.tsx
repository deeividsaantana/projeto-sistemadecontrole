import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Gauge,
  Search,
  Settings,
  Truck,
  UserRound,
} from 'lucide-react';
import type {
  Equipamento,
  OrdemServico,
  ParteDiariaEquipamento,
} from '../types';
import { buildEquipmentOperationalSummaries } from '../utils/equipmentOperations';

interface EquipmentOperationsPanelProps {
  equipamentos: Equipamento[];
  ordensServico: OrdemServico[];
  partesDiarias: ParteDiariaEquipamento[];
}

const formatDate = (value?: string) => {
  if (!value) return 'Sem registro';
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const availabilityTone = (value: number | null, belowTarget: boolean) => {
  if (value === null) return 'text-slate-500';
  if (belowTarget) return 'text-rose-300';
  return 'text-emerald-300';
};

export default function EquipmentOperationsPanel({
  equipamentos,
  ordensServico,
  partesDiarias,
}: EquipmentOperationsPanelProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'Todos' | NonNullable<Equipamento['categoriaFrota']>>('Todos');
  const summaries = useMemo(
    () => buildEquipmentOperationalSummaries(equipamentos, partesDiarias, ordensServico),
    [equipamentos, partesDiarias, ordensServico],
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return summaries.filter(item => {
      if (category !== 'Todos' && (item.equipment.categoriaFrota || 'Equipamento') !== category) return false;
      if (!query) return true;
      return [
        item.equipment.prefixo,
        item.equipment.nome,
        item.equipment.familia,
        item.equipment.codigoSge,
        item.equipment.placa,
        item.responsibleOperator,
      ].some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(query));
    });
  }, [category, search, summaries]);
  const totals = useMemo(() => ({
    mobilized: summaries.filter(item => item.equipment.mobilizado).length,
    belowTarget: summaries.filter(item => item.belowTarget).length,
    openWorkOrders: summaries.reduce((total, item) => total + item.openWorkOrders, 0),
  }), [summaries]);

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">
      <div className="flex flex-col gap-4 border-b border-slate-800 p-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-300">
            <Gauge size={18} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Centro Operacional de Frota v2.3</span>
          </div>
          <h3 className="mt-2 text-lg font-black text-white">Equipamentos, veículos e implementos</h3>
          <p className="mt-1 text-xs text-slate-400">
            Disponibilidade consolidada com histórico operacional e ordens de serviço, sem duplicar o cadastro mestre.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {[
            { label: 'Mobilizados', value: totals.mobilized, icon: Truck, tone: 'text-cyan-300' },
            { label: 'Abaixo da meta', value: totals.belowTarget, icon: AlertTriangle, tone: 'text-rose-300' },
            { label: 'OS abertas', value: totals.openWorkOrders, icon: Settings, tone: 'text-amber-300' },
          ].map(card => (
            <div key={card.label} className="min-w-32 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
              <div className={`flex items-center gap-1.5 ${card.tone}`}>
                <card.icon size={14} />
                <strong className="text-lg">{card.value}</strong>
              </div>
              <span className="text-[9px] font-bold uppercase text-slate-500">{card.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b border-slate-800 p-4 md:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Buscar frota</span>
          <Search className="pointer-events-none absolute left-3 top-3 text-slate-500" size={16} />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Buscar prefixo, SGE, placa, família ou operador"
            className="h-10 w-full rounded-xl border border-slate-800 bg-slate-950 pl-9 pr-3 text-xs text-white outline-none focus:border-emerald-500"
          />
        </label>
        <select
          value={category}
          onChange={event => setCategory(event.target.value as typeof category)}
          className="h-10 rounded-xl border border-slate-800 bg-slate-950 px-3 text-xs text-white outline-none focus:border-emerald-500"
        >
          <option>Todos</option>
          <option>Equipamento</option>
          <option>Veículo</option>
          <option>Implemento</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-left text-xs">
          <thead className="bg-slate-900/80 text-[9px] font-black uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Frota</th>
              <th className="px-4 py-3">Categoria / SGE</th>
              <th className="px-4 py-3">Mobilização</th>
              <th className="px-4 py-3">Operador responsável</th>
              <th className="px-4 py-3">Disponibilidade</th>
              <th className="px-4 py-3">Manutenção</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filtered.map(item => (
              <tr key={item.equipment.id} className="hover:bg-slate-900/50">
                <td className="px-4 py-3">
                  <strong className="font-mono text-emerald-300">{item.equipment.prefixo}</strong>
                  <span className="mt-1 block max-w-52 truncate text-slate-300">{item.equipment.nome}</span>
                  {item.equipment.placa && <span className="text-[9px] text-slate-500">Placa {item.equipment.placa}</span>}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full border border-slate-700 px-2 py-1 text-[9px] font-black uppercase text-slate-300">
                    {item.equipment.categoriaFrota || 'Equipamento'}
                  </span>
                  <span className="mt-2 block text-slate-400">{item.equipment.familia || item.equipment.tipo || 'Sem família'}</span>
                  <span className="font-mono text-[9px] text-cyan-300">SGE {item.equipment.codigoSge || 'não vinculado'}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={item.equipment.mobilizado ? 'text-emerald-300' : 'text-slate-500'}>
                    {item.equipment.mobilizado ? 'Mobilizado' : 'Não mobilizado'}
                  </span>
                  <span className="mt-1 block text-[9px] text-slate-500">
                    {formatDate(item.equipment.dataMobilizacao)}
                    {item.equipment.dataDesmobilizacao ? ` → ${formatDate(item.equipment.dataDesmobilizacao)}` : ''}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5 text-slate-300">
                    <UserRound size={14} className="text-slate-500" />
                    {item.responsibleOperator || 'Sem responsável'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <strong className={availabilityTone(item.availabilityPercent, item.belowTarget)}>
                    {item.availabilityPercent === null ? 'Sem dados' : `${item.availabilityPercent.toFixed(1)}%`}
                  </strong>
                  <span className="mt-1 block text-[9px] text-slate-500">
                    Meta {item.targetPercent === null ? 'não definida' : `${item.targetPercent.toFixed(1)}%`} · {item.availabilitySource}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={item.openWorkOrders > 0 ? 'text-amber-300' : 'text-emerald-300'}>
                    {item.openWorkOrders > 0 ? `${item.openWorkOrders} OS aberta(s)` : 'Sem OS aberta'}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                  Nenhum item de frota corresponde aos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
