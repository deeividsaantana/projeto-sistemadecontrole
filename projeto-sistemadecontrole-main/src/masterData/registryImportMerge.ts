import type { Empresa, Equipamento, Funcionario } from '../types';

/** Blank spreadsheet cells do not clear fields already held by the master record. */
const mergeProvidedFields = <T extends { id: string }>(saved: T, imported: T): T => {
  const next = { ...saved } as Record<string, unknown>;
  for (const [field, value] of Object.entries(imported)) {
    if (field !== 'id' && field !== 'criadoEm' && value !== undefined && value !== '') next[field] = value;
  }
  return next as T;
};

export const mergeEmpresaImport = (saved: Empresa, imported: Empresa, statusProvided: boolean): Empresa => ({
  ...mergeProvidedFields(saved, imported),
  status: statusProvided ? imported.status : saved.status ?? imported.status,
  tipos: [...new Set([...(saved.tipos ?? []), ...(imported.tipos ?? [])])],
  criadoEm: saved.criadoEm ?? imported.criadoEm,
});

export const mergeEquipamentoImport = (
  saved: Equipamento,
  imported: Equipamento,
  statusProvided: boolean,
  mobilizationProvided: boolean,
): Equipamento => ({
  ...mergeProvidedFields(saved, imported),
  status: statusProvided ? imported.status : saved.status,
  mobilizado: mobilizationProvided ? imported.mobilizado : saved.mobilizado,
});

export const mergeFuncionarioImport = (saved: Funcionario, imported: Funcionario, statusProvided: boolean): Funcionario => ({
  ...mergeProvidedFields(saved, imported),
  status: statusProvided ? imported.status : saved.status ?? imported.status,
  ativo: statusProvided ? imported.ativo : saved.ativo,
  criadoEm: saved.criadoEm ?? imported.criadoEm,
});
