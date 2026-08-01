import type { Empresa, Equipamento, Funcionario, ObraLocal } from '../types';

export const normalizeRegistryKey = (value: unknown): string => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]/g, '')
  .toUpperCase();

export const nextMasterId = (prefix: string, existingIds: string[]): string => {
  const normalizedPrefix = prefix.trim().toUpperCase();
  const greatest = existingIds.reduce((max, id) => {
    const match = String(id).toUpperCase().match(new RegExp(`^${normalizedPrefix}-(\\d+)$`));
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `${normalizedPrefix}-${String(greatest + 1).padStart(4, '0')}`;
};

export const duplicateRecordId = <T extends { id: string }>(
  records: T[],
  value: unknown,
  selector: (record: T) => unknown,
  ignoredId?: string,
): string | undefined => {
  const key = normalizeRegistryKey(value);
  if (!key) return undefined;
  return records.find(record => record.id !== ignoredId && normalizeRegistryKey(selector(record)) === key)?.id;
};

export const validateCentralRecord = ({
  empresas,
  equipamentos,
  funcionarios,
  obras,
  record,
}: {
  empresas: Empresa[];
  equipamentos: Equipamento[];
  funcionarios: Funcionario[];
  obras: ObraLocal[];
  record: Empresa | Equipamento | Funcionario | ObraLocal;
}): string[] => {
  const errors: string[] = [];
  if ('matricula' in record) {
    if (!record.matricula?.trim()) errors.push('Matrícula é obrigatória.');
    if (!record.nome.trim()) errors.push('Nome completo é obrigatório.');
    if (!record.cargo.trim()) errors.push('Função é obrigatória.');
    if (duplicateRecordId(funcionarios, record.matricula, item => item.matricula, record.id)) {
      errors.push('Já existe um colaborador com esta matrícula.');
    }
  } else if ('prefixo' in record) {
    if (!record.prefixo.trim()) errors.push('Prefixo/código do equipamento é obrigatório.');
    if (!record.nome.trim()) errors.push('Descrição do equipamento é obrigatória.');
    if (duplicateRecordId(equipamentos, record.prefixo, item => item.prefixo, record.id)) {
      errors.push('Já existe um equipamento ou veículo com este prefixo.');
    }
    if (record.placa && duplicateRecordId(equipamentos, record.placa, item => item.placa || item.seriePlaca, record.id)) {
      errors.push('Já existe um equipamento ou veículo com esta placa.');
    }
  } else if ('cnpj' in record) {
    if (!record.nome.trim()) errors.push('Nome da empresa/fornecedor é obrigatório.');
    if (record.cnpj && duplicateRecordId(empresas, record.cnpj, item => item.cnpj, record.id)) {
      errors.push('Já existe uma empresa ou fornecedor com este CNPJ.');
    }
    if (duplicateRecordId(empresas, record.nome, item => item.nome, record.id)) {
      errors.push('Já existe uma empresa ou fornecedor com este nome.');
    }
  } else {
    if (!record.nome.trim()) errors.push('Nome do local é obrigatório.');
    if (duplicateRecordId(obras, record.nome, item => item.nome, record.id)) {
      errors.push('Já existe um local com este nome.');
    }
  }
  return errors;
};

export const isActiveCollaborator = (item: Funcionario): boolean => (
  item.ativo !== false && !['INATIVO', 'DESMOBILIZADO'].includes(item.status || 'ATIVO')
);

export const isSupplier = (item: Empresa): boolean => item.tipos?.includes('FORNECEDOR') === true;
export const isVehicle = (item: Equipamento): boolean => item.categoriaFrota === 'Veículo';

export const registrySummary = ({
  empresas,
  equipamentos,
  funcionarios,
  obras,
}: {
  empresas: Empresa[];
  equipamentos: Equipamento[];
  funcionarios: Funcionario[];
  obras: ObraLocal[];
}) => ({
  colaboradoresAtivos: funcionarios.filter(isActiveCollaborator).length,
  colaboradoresDesmobilizados: funcionarios.filter(item => item.status === 'DESMOBILIZADO').length,
  equipamentosAtivos: equipamentos.filter(item => item.categoriaFrota !== 'Veículo' && item.status === 'Ativo').length,
  veiculos: equipamentos.filter(isVehicle).length,
  fornecedores: empresas.filter(isSupplier).length,
  locais: obras.length,
  inconsistencias: funcionarios.filter(item => !item.matricula || !item.nome || !item.cargo).length
    + equipamentos.filter(item => !item.prefixo || !item.nome).length
    + empresas.filter(item => !item.nome).length,
});
