import { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import type { Empresa } from '../../types';
import { FLEET_STATUS_DEFINITIONS } from '../../fleet/status';
import type { FleetReportFilters } from '../../fleet/domain';
import { BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO } from '../cadastros/estilos';

interface Props {
  filters: FleetReportFilters;
  companies: Empresa[];
  groups: string[];
  equipmentTypes: string[];
  locations: Array<{ nome: string; total: number }>;
  activeFilterCount: number;
  onChange: <K extends keyof FleetReportFilters>(
    key: K,
    value: FleetReportFilters[K],
  ) => void;
  onClear: () => void;
}

/**
 * Busca, situação e tipo sempre à vista; empresa e grupo em "Mais filtros".
 * O dia fica no topo da tela, junto do botão de lançar. Cada filtro ligado
 * vira uma etiqueta que sai com um toque.
 */
export default function FleetFilterBar({
  filters,
  companies,
  groups,
  equipmentTypes,
  locations,
  activeFilterCount,
  onChange,
  onClear,
}: Props) {
  const [mais, setMais] = useState(false);
  const empresas = companies
    .filter(company => company.status !== 'INATIVO')
    .sort((left, right) => left.nome.localeCompare(right.nome, 'pt-BR'));
  const etiquetas: Array<{ chave: keyof FleetReportFilters; texto: string; vazio: string }> = [
    filters.search.trim() ? { chave: 'search', texto: `Busca: ${filters.search.trim()}`, vazio: '' } : null,
    filters.status !== 'Todos' ? { chave: 'status', texto: filters.status, vazio: 'Todos' } : null,
    filters.equipmentType && filters.equipmentType !== 'Todos' ? { chave: 'equipmentType', texto: filters.equipmentType, vazio: 'Todos' } : null,
    filters.group && filters.group !== 'Todos' ? { chave: 'group', texto: `Grupo: ${filters.group}`, vazio: 'Todos' } : null,
    filters.companyId !== 'Todos' ? { chave: 'companyId', texto: empresas.find(item => item.id === filters.companyId)?.nome || 'Empresa', vazio: 'Todos' } : null,
    filters.location ? { chave: 'location', texto: `Canteiro: ${filters.location}`, vazio: '' } : null,
  ].filter((item): item is { chave: keyof FleetReportFilters; texto: string; vazio: string } => item !== null);

  return (
    <section aria-label="Filtros da frota" data-fleet-enter className={`${CARTAO} space-y-3 p-3 lg:sticky lg:top-0 lg:z-10`}>
      {locations.length > 1 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5" data-testid="frota-canteiros" aria-label="Filtrar por canteiro">
          {[{ nome: '', total: locations.reduce((sum, item) => sum + item.total, 0) }, ...locations].map(item => {
            const ligado = (filters.location || '') === item.nome;
            return (
              <button
                key={item.nome || 'todos'}
                type="button"
                aria-pressed={ligado}
                onClick={() => onChange('location', ligado ? '' : item.nome)}
                data-testid={`frota-canteiro-${item.nome || 'todos'}`}
                className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-bold transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] ${ligado ? 'bg-[#176b4d] text-white shadow-[0_8px_18px_-10px_rgba(23,107,77,0.8)]' : 'bg-[#f7f8f6] text-slate-600 ring-1 ring-slate-200 hover:ring-emerald-300'} ${FOCO}`}
              >
                {item.nome || 'Todos os canteiros'}
                <span className={`rounded-full px-1.5 font-mono text-xs ${ligado ? 'bg-white/20' : 'bg-white text-slate-500'}`}>{item.total}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-[1_1_16rem]">
          <span className="sr-only">Buscar prefixo, motorista, matrícula ou local</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            value={filters.search}
            onChange={event => onChange('search', event.target.value)}
            placeholder="Buscar prefixo, motorista, matrícula ou local"
            className={`${CAMPO} pl-9`}
            data-testid="frota-busca"
          />
        </label>
        <select
          value={filters.status}
          onChange={event => onChange('status', event.target.value as FleetReportFilters['status'])}
          aria-label="Situação"
          className={`${CAMPO} min-w-0 flex-[1_1_10rem] sm:w-auto`}
        >
          <option value="Todos">Todas as situações</option>
          {FLEET_STATUS_DEFINITIONS.map(definition => (
            <option key={definition.value} value={definition.value}>{definition.value}</option>
          ))}
        </select>
        <select
          value={filters.equipmentType ?? 'Todos'}
          onChange={event => onChange('equipmentType', event.target.value)}
          aria-label="Tipo"
          className={`${CAMPO} min-w-0 flex-[1_1_10rem] sm:w-auto`}
        >
          <option value="Todos">Todos os tipos</option>
          {equipmentTypes.map(type => <option key={type} value={type}>{type}</option>)}
        </select>
        <button type="button" onClick={() => setMais(atual => !atual)} aria-expanded={mais} className={`${BOTAO_SECUNDARIO} flex-none`} data-testid="frota-mais-filtros">
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Mais filtros
        </button>
      </div>
      {mais && (
        <div className="grid gap-2 sm:grid-cols-2" data-testid="frota-painel-filtros">
          <select value={filters.companyId} onChange={event => onChange('companyId', event.target.value)} aria-label="Empresa" className={CAMPO}>
            <option value="Todos">Todas as empresas</option>
            {empresas.map(company => <option key={company.id} value={company.id}>{company.nome}</option>)}
          </select>
          <select value={filters.group ?? 'Todos'} onChange={event => onChange('group', event.target.value)} aria-label="Grupo" className={CAMPO}>
            <option value="Todos">Todos os grupos</option>
            {groups.map(group => <option key={group} value={group}>{group}</option>)}
          </select>
        </div>
      )}
      {activeFilterCount > 0 && etiquetas.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" data-testid="frota-etiquetas">
          {etiquetas.map(etiqueta => (
            <button
              key={etiqueta.chave}
              type="button"
              onClick={() => onChange(etiqueta.chave, etiqueta.vazio as never)}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full bg-emerald-50 pl-3 pr-2 text-xs font-bold text-[#176b4d] ring-1 ring-inset ring-emerald-200 transition hover:bg-emerald-100 ${FOCO}`}
              aria-label={`Tirar filtro ${etiqueta.texto}`}
            >
              {etiqueta.texto}
              <X className="size-3.5" aria-hidden="true" />
            </button>
          ))}
          <button type="button" onClick={onClear} className="min-h-9 px-2 text-xs font-semibold text-slate-500 underline-offset-4 hover:text-[#176b4d] hover:underline" data-testid="frota-limpar">
            Limpar tudo
          </button>
        </div>
      )}
    </section>
  );
}
