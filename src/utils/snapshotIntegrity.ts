import type { PeriodoArquivado } from '../types';

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = stableValue((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }
  return value;
};

export const calculateSnapshotChecksum = (dados: PeriodoArquivado['dados']) => {
  const serialized = JSON.stringify(stableValue(dados));
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

export const isSnapshotIntact = (snapshot: PeriodoArquivado) =>
  !snapshot.checksum || snapshot.checksum === calculateSnapshotChecksum(snapshot.dados);
