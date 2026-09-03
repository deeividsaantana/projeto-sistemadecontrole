export const SYSTEM_BACKUP_ARRAY_KEYS = [
  'empresas',
  'obras',
  'equipamentos',
  'funcionarios',
  'motoristasOperacionais',
  'comboios',
  'combustiveis',
  'lubrificantes',
  'etapas',
  'abastecimentos',
  'lubrificacoes',
  'ticketsJazida',
  'listasPresenca',
  'ordensServico',
  'gruposEquipe',
  'presencasLink',
  'historicoPresencas',
  'apontamentoRamos',
  'apontamentoRamoRegistros',
  'materiaisCadastro',
  'materiaisRegistros',
  'controleEquipamentosDiario',
  'periodosArquivados',
  'notifications',
  'historyLogs',
  'masterDataReviewQueue',
] as const;

export type SystemBackupArrayKey = typeof SYSTEM_BACKUP_ARRAY_KEYS[number];

export interface SystemBackupValidation {
  valid: boolean;
  invalidKeys: SystemBackupArrayKey[];
  missingCoreKeys: SystemBackupArrayKey[];
}

const CORE_BACKUP_KEYS: SystemBackupArrayKey[] = ['empresas', 'equipamentos', 'abastecimentos'];

export const isRecordValue = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export const validateSystemBackup = (
  value: unknown,
  requireCoreKeys = true,
): SystemBackupValidation => {
  if (!isRecordValue(value)) {
    return { valid: false, invalidKeys: [], missingCoreKeys: requireCoreKeys ? [...CORE_BACKUP_KEYS] : [] };
  }

  const invalidKeys = SYSTEM_BACKUP_ARRAY_KEYS.filter(key => (
    Object.prototype.hasOwnProperty.call(value, key) && !Array.isArray(value[key])
  ));
  const missingCoreKeys = requireCoreKeys
    ? CORE_BACKUP_KEYS.filter(key => !Array.isArray(value[key]))
    : [];

  return {
    valid: invalidKeys.length === 0 && missingCoreKeys.length === 0,
    invalidKeys,
    missingCoreKeys,
  };
};

export const describeInvalidBackup = (validation: SystemBackupValidation): string => {
  if (validation.invalidKeys.length > 0) {
    return `O backup possui tabelas em formato inválido: ${validation.invalidKeys.join(', ')}.`;
  }
  if (validation.missingCoreKeys.length > 0) {
    return `O arquivo não contém as tabelas mínimas: ${validation.missingCoreKeys.join(', ')}.`;
  }
  return '';
};
