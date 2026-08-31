import type { ControleEquipamentoDiario } from '../types';
import { normalizePrefix } from '../utils/canonicalIdentity';

export type OperationalFleetReferenceGroup = 'Basculantes' | 'Apoio';

export interface OperationalFleetReferenceItem {
  prefix: string;
  group: OperationalFleetReferenceGroup;
  equipmentType: string;
}

const BASCULANTE_PREFIXES = [
  'CB726', 'CB727', 'CB730', 'CB732', 'CB735', 'CB738', 'CB739', 'CB740',
  'CB743', 'CB748', 'CB749', 'CB754', 'CB755', 'CB758', 'CB765', 'CB767',
  'CB770', 'CB771', 'CB774', 'CB775', 'CB786', 'CB789', 'CB790', 'CB793',
  'CB794', 'CB795', 'CB801', 'CB802', 'CB804', 'CB929', 'CB970', 'CB1005',
] as const;

const SUPPORT_FLEET: readonly OperationalFleetReferenceItem[] = [
  { prefix: 'CP057', group: 'Apoio', equipmentType: 'Caminhão Pipa' },
  { prefix: 'CP075', group: 'Apoio', equipmentType: 'Caminhão Pipa' },
  { prefix: 'CP076', group: 'Apoio', equipmentType: 'Caminhão Pipa' },
  { prefix: 'CP079', group: 'Apoio', equipmentType: 'Caminhão Pipa' },
  { prefix: 'CA019', group: 'Apoio', equipmentType: 'Caminhão Comboio' },
  { prefix: 'CV041', group: 'Apoio', equipmentType: 'Cavalo Mecânico' },
  { prefix: 'CC020', group: 'Apoio', equipmentType: 'Caminhão Carroceria' },
];

export const OPERATIONAL_FLEET_REFERENCE: readonly OperationalFleetReferenceItem[] = [
  ...BASCULANTE_PREFIXES.map(prefix => ({
    prefix,
    group: 'Basculantes' as const,
    equipmentType: 'Caminhão Basculante',
  })),
  ...SUPPORT_FLEET,
];

export interface OperationalFleetReferenceStatus extends OperationalFleetReferenceItem {
  informed: boolean;
  recordCount: number;
  operationalStatus?: string;
  departureTime?: string;
}

export interface OperationalFleetDayReconciliation {
  date: string;
  total: number;
  informed: number;
  missing: number;
  operating: number;
  maintenance: number;
  items: OperationalFleetReferenceStatus[];
  missingItems: OperationalFleetReferenceStatus[];
  unexpectedPrefixes: string[];
  duplicatePrefixes: string[];
}

export const reconcileOperationalFleetDay = (
  records: readonly ControleEquipamentoDiario[],
  date: string,
): OperationalFleetDayReconciliation => {
  const dailyRecords = new Map<string, ControleEquipamentoDiario[]>();

  records
    .filter(record => record.data === date && !(record as ControleEquipamentoDiario & { excluido?: unknown }).excluido)
    .forEach(record => {
      const prefix = normalizePrefix(record.prefixo);
      if (!prefix) return;
      dailyRecords.set(prefix, [...(dailyRecords.get(prefix) || []), record]);
    });

  const expectedPrefixes = new Set(
    OPERATIONAL_FLEET_REFERENCE.map(item => normalizePrefix(item.prefix)),
  );
  const items = OPERATIONAL_FLEET_REFERENCE.map(item => {
    const matchingRecords = dailyRecords.get(normalizePrefix(item.prefix)) || [];
    const latestRecord = [...matchingRecords].sort((left, right) =>
      String(right.atualizadoEm || right.criadoEm).localeCompare(String(left.atualizadoEm || left.criadoEm)))[0];
    return {
      ...item,
      informed: matchingRecords.length > 0,
      recordCount: matchingRecords.length,
      operationalStatus: latestRecord?.status,
      departureTime: latestRecord?.horaSaida,
    };
  });
  const missingItems = items.filter(item => !item.informed);
  const operating = items.filter(item => item.operationalStatus === 'Em operação').length;
  const maintenance = items.filter(item =>
    item.operationalStatus === 'Em manutenção'
    || item.operationalStatus === 'Aguardando manutenção').length;

  return {
    date,
    total: items.length,
    informed: items.length - missingItems.length,
    missing: missingItems.length,
    operating,
    maintenance,
    items,
    missingItems,
    unexpectedPrefixes: [...dailyRecords.keys()]
      .filter(prefix => !expectedPrefixes.has(prefix))
      .sort((left, right) => left.localeCompare(right, 'pt-BR', { numeric: true })),
    duplicatePrefixes: [...dailyRecords.entries()]
      .filter(([, matchingRecords]) => matchingRecords.length > 1)
      .map(([prefix]) => prefix)
      .sort((left, right) => left.localeCompare(right, 'pt-BR', { numeric: true })),
  };
};
