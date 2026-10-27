import { useState } from 'react';
import { AlertTriangle, ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import type { Empresa } from '../../types';
import { FLEET_STATUS_DEFINITIONS } from '../../fleet/status';
import type { FleetReportFilters } from '../../fleet/domain';
import { BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO } from '../cadastros/estilos';

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
  /** Pontos para conferir nos lançamentos do dia (horário fora de ordem, motorista repetido...). */
  avisos?: readonly string[];
}

/**
 * Busca, situação e tipo sempre à vista; empresa e grupo em "Mais filtros".
 * O dia fica no topo da tela, junto do botão de lançar. Cada filtro ligado
 * vira uma etiqueta que sai com um toque. Os pontos para conferir moram no
 * fim da mesma linha, num botão âmbar que abre a lista logo abaixo.
 */
export default function FleetFilterBar({
  filters,
  companies,
  groups,
  equipmentTypes,
  activeFilterCount,
  onChange,
  onClear,
  avisos = [],
}: Props) {
  const [mais, setMais] = useState(false);
  // Poucos avisos já abrem à vista; muitos ficam no botão para não empurrar a tabela.
  const [verAvisos, setVerAvisos] = useState(avisos.length > 0 && avisos.length <= 3);
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
    <section aria-label="Filtros da frota" data-fleet-enter className={`${CARTAO} shrink-0 space-y-3 p-3`}>
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
        {avisos.length > 0 && (
          <button
            type="button"
            onClick={() => setVerAvisos(atual => !atual)}
            aria-expanded={verAvisos}
            aria-controls="frota-lista-avisos"
            className={`inline-flex min-h-11 flex-none items-center gap-2 rounded-xl border-2 border-amber-300 bg-amber-50 px-3 text-sm font-bold text-amber-900 transition hover:bg-amber-100 max-sm:w-full lg:min-h-10 ${FOCO}`}
            data-testid="frota-conferencia"
          >
            <AlertTriangle className="size-4 shrink-0 text-amber-700" aria-hidden="true" />
            {avisos.length} {avisos.length === 1 ? 'ponto' : 'pontos'} para conferir
            <ChevronDown className={`size-4 shrink-0 transition duration-300 ${verAvisos ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        )}
      </div>
      {avisos.length > 0 && verAvisos && (
        <ul id="frota-lista-avisos" className="max-h-32 space-y-1 overflow-y-auto rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm text-amber-900">
          {avisos.map(aviso => (
            <li key={aviso} className="flex items-start gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
              {aviso}
            </li>
          ))}
        </ul>
      )}
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
