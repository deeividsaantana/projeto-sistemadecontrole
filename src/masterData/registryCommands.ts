import type { Empresa, Equipamento, Funcionario } from '../types';

/** Preserves the existing entity identity and creation timestamp on edits. */
export const normalizeEmpresa = (item: Empresa, previous: Empresa | undefined, now: string): Empresa => ({
  ...item,
  tipos: item.tipos?.length ? item.tipos : previous?.tipos || ['EMPRESA'],
  status: item.status || previous?.status || 'ATIVO',
  criadoEm: previous?.criadoEm || item.criadoEm || now,
  atualizadoEm: now,
});

export const normalizeFuncionario = (item: Funcionario, previous: Funcionario | undefined, now: string): Funcionario => ({
  ...item,
  ativo: !['INATIVO', 'DESMOBILIZADO'].includes(item.status || (item.ativo ? 'ATIVO' : 'INATIVO')),
  status: item.status || (item.ativo ? 'ATIVO' : 'INATIVO'),
  criadoEm: previous?.criadoEm || item.criadoEm || now,
  atualizadoEm: now,
});

export const saveRegistryItem = <T extends { id: string }>(items: readonly T[], item: T, isNew: boolean): T[] =>
  isNew ? [...items, item] : items.map(existing => existing.id === item.id ? item : existing);

export const inactivateEmpresa = (item: Empresa, now: string): Empresa => ({ ...item, status: 'INATIVO', atualizadoEm: now });

export const inactivateFuncionario = (item: Funcionario, now: string): Funcionario => ({
  ...item,
  status: 'DESMOBILIZADO',
  ativo: false,
  atualizadoEm: now,
});

export const inactivateEquipamento = (item: Equipamento): Equipamento => ({ ...item, status: 'Desmobilizado', mobilizado: false });
