import type { ControleEstacas, GrupoEquipe, ListaPresenca } from '../types';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

export const normalizeRuntimeCollection = <T,>(value: unknown): T[] => (
  Array.isArray(value) ? value.filter(item => item !== null && item !== undefined) as T[] : []
);

export const normalizePresenceLists = (value: unknown): ListaPresenca[] => (
  normalizeRuntimeCollection<unknown>(value)
    .filter(isRecord)
    .map(item => ({
      ...item,
      funcionarios: normalizeRuntimeCollection(item.funcionarios),
    } as unknown as ListaPresenca))
);

export const normalizeTeamGroups = (value: unknown): GrupoEquipe[] => (
  normalizeRuntimeCollection<unknown>(value)
    .filter(isRecord)
    .map(item => ({
      ...item,
      funcionarioIds: normalizeRuntimeCollection<string>(item.funcionarioIds).filter(Boolean),
      funcionarioMatriculas: normalizeRuntimeCollection<string>(item.funcionarioMatriculas).filter(Boolean),
    } as unknown as GrupoEquipe))
);

export const normalizeStakeControl = (value: unknown): ControleEstacas => {
  const source = isRecord(value) ? value : {};
  return {
    lotes: normalizeRuntimeCollection(source.lotes),
    cravacoes: normalizeRuntimeCollection(source.cravacoes),
  };
};
