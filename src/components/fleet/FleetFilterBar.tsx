import React from 'react';
import { RotateCcw, Search } from 'lucide-react';
import type { Empresa } from '../../types';
import {
  FLEET_STATUS_DEFINITIONS,
} from '../../fleet/status';
import type { FleetReportFilters } from '../../fleet/domain';

interface Props {
  filters: FleetReportFilters;
  companies: Empresa[];
  groups: string[];
  equipmentTypes: string[];
  activeFilterCount: number;
  onChange: <K extends keyof FleetReportFilters>(
    key: K,
    value: FleetReportFilters[K],
  ) => void;
  onClear: () => void;
}

export default function FleetFilterBar({
  filters,
  companies,
  groups,
  equipmentTypes,
  activeFilterCount,
  onChange,
  onClear,
}: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[145px_1fr_150px_180px_180px_auto]">
        <label className="text-[9px] font-black uppercase tracking-wider text-slate-500">
          Data
          <input
            type="date"
            value={filters.date}
            onChange={event => onChange('date', event.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-bold text-slate-800"
          />
        </label>
        <label className="text-[9px] font-black uppercase tracking-wider text-slate-500">
          Empresa
          <select
            value={filters.companyId}
            onChange={event => onChange('companyId', event.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-bold text-slate-800"
          >
            <option value="Todos">Todas as empresas</option>
            {companies
              .filter(company => company.status !== 'INATIVO')
              .sort((left, right) => left.nome.localeCompare(right.nome, 'pt-BR'))
              .map(company => <option key={company.id} value={company.id}>{company.nome}</option>)}
          </select>
        </label>
        <label className="text-[9px] font-black uppercase tracking-wider text-slate-500">
          Grupo
          <select value={filters.group ?? 'Todos'} onChange={event => onChange('group', event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-bold text-slate-800">
            <option value="Todos">Todos os grupos</option>
            {groups.map(group => <option key={group} value={group}>{group}</option>)}
          </select>
        </label>
        <label className="text-[9px] font-black uppercase tracking-wider text-slate-500">
          Tipo
          <select value={filters.equipmentType ?? 'Todos'} onChange={event => onChange('equipmentType', event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-bold text-slate-800">
            <option value="Todos">Todos os tipos</option>
            {equipmentTypes.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label className="text-[9px] font-black uppercase tracking-wider text-slate-500">
          Situação
          <select
            value={filters.status}
            onChange={event => onChange(
              'status',
              event.target.value as FleetReportFilters['status'],
            )}
            className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-xs font-bold text-slate-800"
          >
            <option value="Todos">Todos os status</option>
            {FLEET_STATUS_DEFINITIONS.map(definition => (
              <option key={definition.value} value={definition.value}>{definition.value}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={onClear}
          className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 text-xs font-black text-slate-700 hover:bg-slate-100"
        >
          <RotateCcw size={14} />
          Limpar
        </button>
      </div>
      <label className="relative mt-2 block">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          size={16}
        />
        <input
          value={filters.search}
          onChange={event => onChange('search', event.target.value)}
          placeholder="Buscar prefixo, matrícula, motorista, grupo, tipo, local ou observação..."
          className="h-10 w-full rounded-md border border-slate-300 bg-slate-50 pl-9 pr-24 text-xs text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/10"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase text-emerald-700">
          {activeFilterCount} ativo(s)
        </span>
      </label>
    </section>
  );
}
