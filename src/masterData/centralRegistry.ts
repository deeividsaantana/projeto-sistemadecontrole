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

export type EmpresaTipo = NonNullable<Empresa['tipos']>[number];

const SUBAREAS_FORNECEDOR: readonly EmpresaTipo[] = ['LOCACAO_EQUIPAMENTOS', 'MATERIAIS', 'SUBFORNECEDOR'];

// Toda subárea de fornecedor também conta como fornecedor, mesmo que o
// registro tenha sido gravado só com a subárea.
export const isSupplier = (item: Empresa): boolean => (
  item.tipos?.some(tipo => tipo === 'FORNECEDOR' || SUBAREAS_FORNECEDOR.includes(tipo)) === true
);
export const isEquipmentRentalSupplier = (item: Empresa): boolean => item.tipos?.includes('LOCACAO_EQUIPAMENTOS') === true;
export const isMaterialSupplier = (item: Empresa): boolean => item.tipos?.includes('MATERIAIS') === true;
export const isSubSupplier = (item: Empresa): boolean => item.tipos?.includes('SUBFORNECEDOR') === true;
// Terceira contratada presta serviço na obra (Tecnogeo, Rivoli) — diferente
// de fornecedor de material (Pedraforte, Dovalle). Uma empresa pode ser as
// duas coisas ao mesmo tempo (tipos aceita mais de um valor).
export const isThirdPartyContractor = (item: Empresa): boolean => item.tipos?.includes('TERCEIRA') === true;
export const isVehicle = (item: Equipamento): boolean => item.categoriaFrota === 'Veículo';

/** Classes que a tela de empresa deixa marcar, na ordem em que aparecem. */
export const EMPRESA_CLASSES: readonly { tipo: EmpresaTipo; label: string }[] = [
  { tipo: 'EMPRESA', label: 'Empresa (mão de obra)' },
  { tipo: 'TERCEIRA', label: 'Terceira (serviço na obra)' },
  { tipo: 'FORNECEDOR', label: 'Fornecedor' },
  { tipo: 'LOCACAO_EQUIPAMENTOS', label: 'Locação de equipamentos' },
  { tipo: 'MATERIAIS', label: 'Materiais' },
  { tipo: 'SUBFORNECEDOR', label: 'Subfornecedor' },
];

export const empresaTipoLabel = (tipo: EmpresaTipo): string => (
  EMPRESA_CLASSES.find(item => item.tipo === tipo)?.label
  ?? tipo.charAt(0) + tipo.slice(1).toLowerCase()
);

/**
 * Empresas que podem ter gente em equipe: de mão de obra, terceiras e as ainda sem
 * classe (para nenhuma sumir antes de ser classificada). Uma empresa só de
 * fornecimento continua na lista quando já tem colaborador vinculado a ela,
 * porque esconder essa empresa esconderia quem já trabalha na equipe.
 */
export const companiesForTeams = (empresas: Empresa[], funcionarios: Funcionario[] = []): Empresa[] => {
  const comColaborador = new Set(funcionarios.map(item => item.empresaId).filter(Boolean));
  return empresas.filter(item => {
    const tipos = item.tipos ?? [];
    return tipos.length === 0
      || tipos.includes('EMPRESA')
      || tipos.includes('TERCEIRA')
      || comColaborador.has(item.id);
  });
};

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
  // Equipamentos e veículos são contados separadamente, mas os dois cartões
  // precisam usar o mesmo critério de atividade — antes "Veículos" somava
  // inclusive os inativos e desmobilizados, inflando o total da frota.
  equipamentosAtivos: equipamentos.filter(item => !isVehicle(item) && item.status === 'Ativo').length,
  veiculos: equipamentos.filter(item => isVehicle(item) && item.status === 'Ativo').length,
  fornecedores: empresas.filter(isSupplier).length,
  locais: obras.length,
  inconsistencias: funcionarios.filter(item => !item.matricula || !item.nome || !item.cargo).length
    + equipamentos.filter(item => !item.prefixo || !item.nome).length
    + empresas.filter(item => !item.nome).length,
});
