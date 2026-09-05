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

export interface ConsumoAbastecimento {
  /** km/L para veículos, L/h para equipamentos de horímetro. */
  unidade: 'km/L' | 'L/h';
  valor: number;
  /** Distância ou horas percorridas desde o abastecimento anterior. */
  percorrido: number;
}

/**
 * Consumo entre dois abastecimentos do mesmo equipamento. Sem leitura crescente
 * não há como calcular — devolve undefined em vez de número inventado, que é o
 * que a operação precisa para confiar no indicador.
 */
export const calcularConsumo = (
  atual: Pick<Abastecimento, 'quantidadeLitros' | 'horimetroInicial' | 'kmInicial'>,
  anterior?: Pick<Abastecimento, 'horimetroInicial' | 'kmInicial'>,
): ConsumoAbastecimento | undefined => {
  const litros = Number(atual.quantidadeLitros || 0);
  if (!anterior || litros <= 0) return undefined;

  const km = Number(atual.kmInicial || 0) - Number(anterior.kmInicial || 0);
  if (Number(atual.kmInicial) > 0 && Number(anterior.kmInicial) > 0 && km > 0) {
    return { unidade: 'km/L', valor: round(km / litros, 2), percorrido: round(km, 2) };
  }

  const horas = Number(atual.horimetroInicial || 0) - Number(anterior.horimetroInicial || 0);
  if (Number(atual.horimetroInicial) > 0 && Number(anterior.horimetroInicial) > 0 && horas > 0) {
    return { unidade: 'L/h', valor: round(litros / horas, 2), percorrido: round(horas, 2) };
  }

  return undefined;
};

/** Abastecimento anterior do mesmo equipamento, pela data e hora do lançamento. */
export const abastecimentoAnterior = (
  atual: Abastecimento,
  todos: Abastecimento[],
): Abastecimento | undefined => todos
  .filter(item => item.id !== atual.id
    && item.equipamentoId === atual.equipamentoId
    && `${item.data}${item.hora || ''}` <= `${atual.data}${atual.hora || ''}`)
  .sort((a, b) => `${b.data}${b.hora || ''}`.localeCompare(`${a.data}${a.hora || ''}`))[0];

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
