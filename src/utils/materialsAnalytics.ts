import type { MovimentoMaterial } from '../types';
import { normalizeComparable } from './canonicalIdentity';

export interface MaterialsPeriod {
  from: string;
  to: string;
}

export interface MaterialsSummaryFilters extends MaterialsPeriod {
  material?: string;
  fornecedor?: string;
  local?: string;
  tipo?: string;
}

export interface MaterialSummaryRow {
  material: string;
  unidade: string;
  quantidade: number;
  toneladas: number;
  metrosCubicos: number;
  valorTotal: number;
  viagens: number;
  densidadeMedia: number | null;
  custoMedio: number | null;
}

export interface MaterialLocationSummaryRow {
  local: string;
  material: string;
  quantidade: number;
  unidade: string;
  valorTotal: number;
}

export interface MaterialSupplierSummaryRow {
  fornecedor: string;
  quantidade: number;
  valorTotal: number;
  viagens: number;
}

export interface MaterialTripSummaryRow {
  local: string;
  lixo: number;
  soloContaminado: number;
  solo: number;
}

type MaterialTripKind = 'lixo' | 'soloContaminado' | 'solo';

const asNumber = (value: number | undefined): number => Number.isFinite(value) ? Number(value) : 0;

const normalize = (value: string | undefined): string => normalizeComparable(value || '').trim();

const includes = (value: string | undefined, search: string | undefined): boolean => {
  const normalizedSearch = normalize(search);
  if (!normalizedSearch) return true;
  const normalizedValue = normalize(value);
  if (normalizedValue.includes(normalizedSearch)) return true;
  return normalizedSearch.split(/\s+/).every(token => normalizedValue.includes(token));
};

const addToMap = <T>(map: Map<string, T>, key: string, create: () => T, update: (row: T) => void) => {
  const current = map.get(key) || create();
  update(current);
  map.set(key, current);
};

const destinationKind = (movement: MovimentoMaterial): MaterialTripKind | null => {
  const text = normalize(`${movement.materialDescricao} ${movement.destino || ''} ${movement.observacao || ''}`);
  if (!text.includes('bota fora')) return null;
  if (text.includes('lixo')) return 'lixo';
  if (text.includes('contamin')) return 'soloContaminado';
  if (/\bsolo\b/.test(text)) return 'solo';
  return null;
};

export function getDefaultMaterialsPeriod(referenceDate: string): MaterialsPeriod {
  const [year, month] = referenceDate.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${year}-${String(month).padStart(2, '0')}-01`,
    to: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function buildMaterialsOperationalSummary(
  movimentos: MovimentoMaterial[],
  filters: MaterialsSummaryFilters,
) {
  const filteredMovements = movimentos
    .filter(item => item.data >= filters.from && item.data <= filters.to)
    .filter(item => includes(item.materialDescricao, filters.material))
    .filter(item => includes(item.fornecedorNome, filters.fornecedor))
    .filter(item => includes(`${item.destino || ''} ${item.origem || ''}`, filters.local))
    .filter(item => !filters.tipo || item.tipo === filters.tipo);

  const materials = new Map<string, MaterialSummaryRow>();
  const locations = new Map<string, MaterialLocationSummaryRow>();
  const suppliers = new Map<string, MaterialSupplierSummaryRow>();
  const trips = new Map<string, MaterialTripSummaryRow>();

  filteredMovements.forEach(item => {
    const quantidade = Math.abs(asNumber(item.quantidade));
    const valorTotal = asNumber(item.valorTotal) || (asNumber(item.valorUnitario) * quantidade);
    const fator = asNumber(item.fatorConversao);
    const toneladas = normalize(item.unidade) === 'ton' ? quantidade : 0;
    const metrosCubicos = fator > 0 ? quantidade / fator : 0;

    addToMap(materials, normalize(item.materialDescricao), () => ({
      material: item.materialDescricao,
      unidade: item.unidade,
      quantidade: 0,
      toneladas: 0,
      metrosCubicos: 0,
      valorTotal: 0,
      viagens: 0,
      densidadeMedia: null,
      custoMedio: null,
    }), row => {
      row.quantidade += quantidade;
      row.toneladas += toneladas;
      row.metrosCubicos += metrosCubicos;
      row.valorTotal += valorTotal;
      row.viagens += 1;
      row.densidadeMedia = row.metrosCubicos > 0 ? row.toneladas / row.metrosCubicos : row.densidadeMedia;
      row.custoMedio = row.quantidade > 0 ? row.valorTotal / row.quantidade : null;
    });

    const local = item.destino || item.origem || 'Sem local informado';
    addToMap(locations, `${normalize(local)}|${normalize(item.materialDescricao)}`, () => ({
      local,
      material: item.materialDescricao,
      quantidade: 0,
      unidade: item.unidade,
      valorTotal: 0,
    }), row => {
      row.quantidade += quantidade;
      row.valorTotal += valorTotal;
    });

    const fornecedor = item.fornecedorNome || 'Sem fornecedor informado';
    addToMap(suppliers, normalize(fornecedor), () => ({
      fornecedor,
      quantidade: 0,
      valorTotal: 0,
      viagens: 0,
    }), row => {
      row.quantidade += quantidade;
      row.valorTotal += valorTotal;
      row.viagens += 1;
    });

    const kind = destinationKind(item);
    if (kind) {
      addToMap(trips, normalize(local), () => ({ local, lixo: 0, soloContaminado: 0, solo: 0 }), row => {
        row[kind] += quantidade;
      });
    }
  });

  const totals = filteredMovements.reduce((total, item) => {
    const quantidade = Math.abs(asNumber(item.quantidade));
    const valorTotal = asNumber(item.valorTotal) || (asNumber(item.valorUnitario) * quantidade);
    return {
      quantidade: total.quantidade + quantidade,
      valorTotal: total.valorTotal + valorTotal,
      viagens: total.viagens + 1,
    };
  }, { quantidade: 0, valorTotal: 0, viagens: 0 });

  return {
    filteredMovements,
    totals,
    materials: [...materials.values()].sort((a, b) => b.quantidade - a.quantidade),
    locations: [...locations.values()].sort((a, b) => b.quantidade - a.quantidade),
    suppliers: [...suppliers.values()].sort((a, b) => b.quantidade - a.quantidade),
    trips: [...trips.values()].sort((a, b) => a.local.localeCompare(b.local, 'pt-BR')),
  };
}
