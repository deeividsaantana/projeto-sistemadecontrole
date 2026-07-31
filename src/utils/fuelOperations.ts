import type { Abastecimento, Equipamento } from '../types';
import { isValidFuelDate } from './combustivelValidation';

const round = (value: number, decimalPlaces = 2) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  const factor = 10 ** decimalPlaces;
  return Math.round((numeric + Number.EPSILON) * factor) / factor;
};

export const getFuelCompetence = (date: string) =>
  isValidFuelDate(date) ? date.slice(0, 7) : '';

export const getFuelCostTotal = (liters: number, costPerLiter?: number) => {
  const quantity = Number(liters || 0);
  const unitCost = Number(costPerLiter || 0);
  return quantity > 0 && unitCost > 0 ? round(quantity * unitCost, 2) : 0;
};

export const getFuelTankCapacity = (
  record: Pick<Abastecimento, 'capacidadeTanqueLitros'>,
  equipment?: Pick<Equipamento, 'capacidadeTanqueLitros'>,
) => {
  const snapshot = Number(record.capacidadeTanqueLitros || 0);
  if (snapshot > 0) return snapshot;
  const currentCapacity = Number(equipment?.capacidadeTanqueLitros || 0);
  return currentCapacity > 0 ? currentCapacity : 0;
};

export const getFuelTankFillPercentage = (liters: number, capacity: number) =>
  capacity > 0 && liters > 0 ? round((liters / capacity) * 100, 2) : 0;

export const enrichFuelRecord = (
  record: Abastecimento,
  equipment?: Equipamento,
): Abastecimento => {
  const competencia = getFuelCompetence(record.data);
  const capacidadeTanqueLitros = getFuelTankCapacity(record, equipment);
  const custoTotal = getFuelCostTotal(record.quantidadeLitros, record.custoLitro);
  const percentualTanque = getFuelTankFillPercentage(record.quantidadeLitros, capacidadeTanqueLitros);

  return {
    ...record,
    competencia,
    custoLitro: Number(record.custoLitro || 0),
    custoTotal,
    capacidadeTanqueLitros,
    percentualTanque,
  };
};

export const enrichFuelDataset = (
  records: Abastecimento[],
  equipamentos: Equipamento[],
) => records.map(record => enrichFuelRecord(
  record,
  equipamentos.find(item => item.id === record.equipamentoId),
));
