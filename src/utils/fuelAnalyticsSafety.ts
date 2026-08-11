import { Abastecimento } from '../types';

/**
 * Limite de sanidade usado somente nos indicadores operacionais.
 * O registro original nunca é removido: volumes fora da faixa continuam
 * disponíveis nas tabelas e exportações para conferência humana.
 */
export const MAX_OPERATIONAL_FUEL_LITERS = 5_000;

export const parseFuelAnalyticsNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  const cleaned = value.trim().replace(/\s+/g, '').replace(/[^\d,.-]/g, '');
  if (!cleaned) return null;

  let normalized = cleaned;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    normalized = cleaned.replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, '');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getOperationalFuelLiters = (
  record: Pick<Abastecimento, 'quantidadeLitros' | 'status'>,
): number | null => {
  if (String(record.status || '').toLowerCase() === 'cancelado') return null;
  const liters = parseFuelAnalyticsNumber(record.quantidadeLitros);
  if (liters === null || liters <= 0 || liters > MAX_OPERATIONAL_FUEL_LITERS) return null;
  return liters;
};

export const isOperationalFuelRecord = (
  record: Pick<Abastecimento, 'quantidadeLitros' | 'status'>,
) => getOperationalFuelLiters(record) !== null;

export const splitOperationalFuelRecords = (records: Abastecimento[]) => {
  const operational: Abastecimento[] = [];
  const review: Abastecimento[] = [];
  records.forEach(record => {
    (isOperationalFuelRecord(record) ? operational : review).push(record);
  });
  return { operational, review };
};

export const sumOperationalFuelLiters = (records: Abastecimento[]) =>
  records.reduce((sum, record) => sum + (getOperationalFuelLiters(record) || 0), 0);
