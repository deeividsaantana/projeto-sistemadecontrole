import type { FleetCurrentState } from './domain';
import { FLEET_OPERATIONAL_STATUS } from './domain';
import { normalizeComparable } from '../utils/canonicalIdentity';

export type FleetCategoryKey = 'dumpTruck' | 'waterTruck' | 'tractor' | 'fuelTruck' | 'flatbed' | 'other';

export interface FleetCategorySummary {
  key: FleetCategoryKey;
  label: string;
  total: number;
  operating: number;
  maintenance: number;
  available: number;
  pending: number;
  prefixes: string[];
}

const CATEGORY_LABELS: Record<FleetCategoryKey, string> = {
  dumpTruck: 'Caminhões basculantes',
  waterTruck: 'Caminhões-pipa',
  tractor: 'Cavalo mecânico',
  fuelTruck: 'Caminhão comboio',
  flatbed: 'Caminhão carroceria',
  other: 'Outras frotas',
};

export const classifyFleetCategory = (state: FleetCurrentState): FleetCategoryKey => {
  const value = normalizeComparable([
    state.equipment.prefix,
    state.equipment.family,
    state.equipment.equipmentType,
    state.equipment.equipmentName,
  ].join(' '));
  if (value.includes('basculante')) return 'dumpTruck';
  if (value.includes('pipa')) return 'waterTruck';
  if (value.includes('cavalo mecanico')) return 'tractor';
  if (value.includes('comboio')) return 'fuelTruck';
  if (value.includes('carroceria')) return 'flatbed';
  return 'other';
};

export const summarizeFleetCategories = (rows: FleetCurrentState[]): FleetCategorySummary[] => {
  const order: FleetCategoryKey[] = ['dumpTruck', 'waterTruck', 'tractor', 'fuelTruck', 'flatbed', 'other'];
  return order.map(key => {
    const categoryRows = rows.filter(row => classifyFleetCategory(row) === key);
    const operating = categoryRows.filter(row => row.operationalStatus === FLEET_OPERATIONAL_STATUS.operating).length;
    const maintenance = categoryRows.filter(row =>
      row.operationalStatus === FLEET_OPERATIONAL_STATUS.maintenance
      || row.operationalStatus === FLEET_OPERATIONAL_STATUS.waitingMaintenance).length;
    const available = categoryRows.filter(row =>
      row.operationalStatus === FLEET_OPERATIONAL_STATUS.available).length;
    const pending = categoryRows.filter(row =>
      row.operationalStatus === FLEET_OPERATIONAL_STATUS.pending).length;
    return {
      key,
      label: CATEGORY_LABELS[key],
      total: categoryRows.length,
      operating,
      maintenance,
      available,
      pending,
      prefixes: categoryRows.map(row => row.equipment.prefix).filter(Boolean)
        .sort((left, right) => left.localeCompare(right, 'pt-BR', { numeric: true })),
    };
  }).filter(category => category.total > 0);
};
