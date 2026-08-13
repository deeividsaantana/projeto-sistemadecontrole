import type {
  ControleEquipamentoDiario,
  Empresa,
  Equipamento,
  EventoControleEquipamentoDiario,
  Funcionario,
  GrupoEquipe,
} from '../types';
import {
  type DriverIdentity,
  type FleetCurrentState,
  type FleetDataContext,
  type FleetEvent,
  type FleetIdentity,
  type FleetOperationalStatus,
  type FleetPersistedRecord,
  type ReconciliationResult,
} from './domain';
import {
  findCompanyCanonical,
  findEmployeeCanonical,
  findEquipmentCanonical,
  normalizeComparable,
  normalizeEmployeeCode,
  normalizePlate,
  normalizePrefix,
} from '../utils/canonicalIdentity';
import {
  deriveCurrentStatusFromEvents,
  normalizeOperationalStatus,
} from './status';
import {
  calculateStoppedMinutes,
  formatDurationMinutes,
  isValidIsoDate,
  normalizeOperationalTime,
} from './time';

export const isDumpTruck = (equipment: Equipamento): boolean =>
  normalizeComparable(
    `${equipment.familia ?? ''} ${equipment.tipo ?? ''} ${equipment.nome ?? ''}`,
  ).includes('basculante');

export const reconcileCompany = (
  companyId: string | undefined,
  companyName: string | undefined,
  companies: Empresa[],
): ReconciliationResult<Empresa> => {
  if (companyId) {
    const byId = companies.find(company => company.id === companyId);
    if (byId) {
      return { value: byId, matchedBy: 'id', confidence: 'exact', warnings: [] };
    }
  }
  const byName = findCompanyCanonical(companies, {
    id: companyId,
    nome: companyName ?? companyId,
  });
  if (byName) {
    return {
      value: byName,
      matchedBy: 'id',
      confidence: 'normalized',
      warnings: companyId
        ? [`Empresa reconciliada por nome; ID antigo não localizado: ${companyId}.`]
        : [],
    };
  }
  return {
    matchedBy: 'none',
    confidence: 'missing',
    warnings: ['Empresa não localizada no cadastro canônico.'],
  };
};

export const reconcileEquipment = (
  input: {
    equipmentId?: string;
    prefix?: string;
    plate?: string;
  },
  equipment: Equipamento[],
): ReconciliationResult<Equipamento> => {
  if (input.equipmentId) {
    const byId = equipment.find(item => item.id === input.equipmentId);
    if (byId) {
      return { value: byId, matchedBy: 'id', confidence: 'exact', warnings: [] };
    }
  }
  if (input.prefix) {
    const normalized = normalizePrefix(input.prefix);
    const matches = equipment.filter(item => normalizePrefix(item.prefixo) === normalized);
    if (matches.length === 1) {
      return {
        value: matches[0],
        matchedBy: 'prefix',
        confidence: 'normalized',
        warnings: input.equipmentId
          ? [`Equipamento reconciliado por prefixo; ID antigo: ${input.equipmentId}.`]
          : [],
      };
    }
    if (matches.length > 1) {
      return {
        matchedBy: 'prefix',
        confidence: 'missing',
        warnings: [`Prefixo duplicado: ${input.prefix}.`],
      };
    }
  }
  if (input.plate) {
    const normalized = normalizePlate(input.plate);
    const matches = equipment.filter(item =>
      normalizePlate(item.placa || item.seriePlaca) === normalized);
    if (matches.length === 1) {
      return {
        value: matches[0],
        matchedBy: 'plate',
        confidence: 'normalized',
        warnings: ['Equipamento reconciliado por placa.'],
      };
    }
    if (matches.length > 1) {
      return {
        matchedBy: 'plate',
        confidence: 'missing',
        warnings: [`Placa duplicada: ${input.plate}.`],
      };
    }
  }
  const canonical = findEquipmentCanonical(
    equipment,
    {
      id: input.equipmentId,
      prefixo: input.prefix,
      placa: input.plate,
    },
  );
  if (canonical) {
    return {
      value: canonical,
      matchedBy: 'prefix',
      confidence: 'normalized',
      warnings: [],
    };
  }
  return {
    matchedBy: 'none',
    confidence: 'missing',
    warnings: ['Equipamento não localizado no cadastro canônico.'],
  };
};

export const reconcileEmployee = (
  input: {
    employeeId?: string;
    employeeCode?: string;
    employeeName?: string;
  },
  employees: Funcionario[],
): ReconciliationResult<Funcionario> => {
  if (input.employeeId) {
    const byId = employees.find(employee => employee.id === input.employeeId);
    if (byId) {
      return { value: byId, matchedBy: 'id', confidence: 'exact', warnings: [] };
    }
  }
  if (input.employeeCode) {
    const normalized = normalizeEmployeeCode(input.employeeCode);
    const matches = employees.filter(employee =>
      normalizeEmployeeCode(employee.matricula) === normalized);
    if (matches.length === 1) {
      return {
        value: matches[0],
        matchedBy: 'employeeCode',
        confidence: 'normalized',
        warnings: input.employeeId
          ? [`Motorista reconciliado pela matrícula; ID antigo: ${input.employeeId}.`]
          : [],
      };
    }
    if (matches.length > 1) {
      return {
        matchedBy: 'employeeCode',
        confidence: 'missing',
        warnings: [`Matrícula duplicada: ${input.employeeCode}.`],
      };
    }
  }
  const canonical = findEmployeeCanonical(
    employees,
    {
      id: input.employeeId,
      matricula: input.employeeCode,
    },
  );
  if (canonical) {
    return {
      value: canonical,
      matchedBy: input.employeeId ? 'id' : 'employeeCode',
      confidence: 'normalized',
      warnings: [],
    };
  }
  return {
    matchedBy: 'none',
    confidence: 'missing',
    warnings: input.employeeName
      ? [`Motorista "${input.employeeName}" não localizado por ID ou matrícula.`]
      : ['Motorista não informado.'],
  };
};

export const findEmployeeTeam = (
  employee: Funcionario | undefined,
  teams: GrupoEquipe[],
): GrupoEquipe | undefined => {
  if (!employee) return undefined;
  const normalizedCode = normalizeEmployeeCode(employee.matricula);
  return teams.find(team =>
    team.status === 'ativo'
    && (
      team.funcionarioIds.includes(employee.id)
      || (team.funcionarioMatriculas ?? [])
        .some(code => normalizeEmployeeCode(code) === normalizedCode)
    ));
};

const buildFleetIdentity = (
  equipment: Equipamento,
  companies: Empresa[],
): FleetIdentity => {
  const company = reconcileCompany(equipment.empresaId, undefined, companies).value;
  const plate = equipment.placa || equipment.seriePlaca || '';
  return {
    equipmentId: equipment.id,
    prefix: equipment.prefixo,
    normalizedPrefix: normalizePrefix(equipment.prefixo),
    plate,
    normalizedPlate: normalizePlate(plate),
    equipmentName: equipment.nome,
    equipmentType: equipment.tipo,
    family: equipment.familia || equipment.tipo,
    registrationStatus: equipment.status,
    companyId: company?.id || equipment.empresaId || '',
    companyName: company?.nome || 'Empresa não localizada',
  };
};

const buildDriverIdentity = (
  employee: Funcionario | undefined,
  record: FleetPersistedRecord,
  context: FleetDataContext,
): DriverIdentity | undefined => {
  if (!employee && !record.nomeMotorista && !record.codigoFuncionario) return undefined;
  const company = employee
    ? reconcileCompany(employee.empresaId, undefined, context.companies).value
    : undefined;
  const team = findEmployeeTeam(employee, context.teams);
  return {
    employeeId: employee?.id || record.funcionarioId || `temporary-${record.id}`,
    employeeCode: employee?.matricula || record.codigoFuncionario || '',
    normalizedEmployeeCode: normalizeEmployeeCode(
      employee?.matricula || record.codigoFuncionario || '',
    ),
    employeeName: employee?.nome || record.nomeMotorista || 'Motorista temporário',
    companyId: company?.id || record.empresaMotoristaId || '',
    companyName: company?.nome || 'Empresa não localizada',
    teamId: team?.id || record.equipeId,
    teamName: team?.nome,
    temporary: !employee || Boolean(record.motoristaTemporario),
  };
};

const mapLegacyEventKind = (
  event: EventoControleEquipamentoDiario,
): FleetEvent['kind'] => {
  switch (event.tipo) {
    case 'SAIDA_OPERACAO':
      return 'OPERATION_STARTED';
    case 'ENTRADA_MANUTENCAO':
      return 'MAINTENANCE_ENTERED';
    case 'LIBERACAO_MANUTENCAO':
      return 'MAINTENANCE_RELEASED';
    default:
      return 'STATUS_CHANGED';
  }
};

export const normalizeFleetEvents = (
  record: ControleEquipamentoDiario,
  equipmentId: string,
): FleetEvent[] =>
  (record.eventos ?? [])
    .map(event => ({
      id: event.id,
      equipmentId,
      employeeId: record.funcionarioId || undefined,
      occurredAt: event.ocorridoEm,
      kind: mapLegacyEventKind(event),
      previousStatus: event.statusAnterior
        ? normalizeOperationalStatus(event.statusAnterior)
        : undefined,
      nextStatus: normalizeOperationalStatus(event.statusNovo),
      reason: event.motivo,
      note: event.observacao,
      maintenanceOrderId: event.ordemServicoId,
      source: record.origem === 'PLANILHA'
        ? ('SPREADSHEET' as const)
        : ('SYSTEM' as const),
    }))
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));

export const reconcileFleetRecord = (
  original: ControleEquipamentoDiario,
  context: FleetDataContext,
  now = new Date(),
): FleetCurrentState | undefined => {
  const record = original as FleetPersistedRecord;
  if (record.excluido) return undefined;
  const equipmentResult = reconcileEquipment(
    { equipmentId: record.equipamentoId, prefix: record.prefixo },
    context.equipment,
  );
  if (!equipmentResult.value || !isDumpTruck(equipmentResult.value)) return undefined;
  const employeeResult = reconcileEmployee(
    {
      employeeId: record.funcionarioId,
      employeeCode: record.codigoFuncionario,
      employeeName: record.nomeMotorista,
    },
    context.employees,
  );
  const equipment = buildFleetIdentity(equipmentResult.value, context.companies);
  const driver = buildDriverIdentity(employeeResult.value, record, context);
  const events = normalizeFleetEvents(record, equipment.equipmentId);
  const fallbackStatus = normalizeOperationalStatus(record.status);
  const operationalStatus = deriveCurrentStatusFromEvents(events, fallbackStatus);
  const maintenanceEntryTime = normalizeOperationalTime(record.horaEntradaManutencao);
  const releaseTime = normalizeOperationalTime(record.horaLiberacao);
  const availableSince = normalizeOperationalTime(record.disponivelDesde);
  const stoppedMinutes = calculateStoppedMinutes(
    record.data,
    maintenanceEntryTime,
    releaseTime,
    availableSince,
    now,
  );
  const reviewMessages = [
    ...(record.revisao ?? []),
    ...equipmentResult.warnings,
    ...employeeResult.warnings.filter(message => record.codigoFuncionario || record.nomeMotorista),
  ];
  if (!isValidIsoDate(record.data)) reviewMessages.push('Data operacional inválida.');
  if (driver?.temporary) reviewMessages.push('Motorista temporário requer conferência cadastral.');
  return {
    recordId: record.id,
    operationalKey: record.chave,
    date: record.data,
    equipment,
    driver,
    operationalStatus,
    departureTime: normalizeOperationalTime(record.horaSaida) || undefined,
    maintenanceEntryTime: maintenanceEntryTime || undefined,
    releaseTime: releaseTime || undefined,
    availableSince: availableSince || undefined,
    location: record.local,
    note: record.observacao,
    maintenanceReason: record.motivoManutencao,
    maintenanceOrderId: record.ordemServicoId,
    stoppedMinutes,
    stoppedDurationLabel: formatDurationMinutes(stoppedMinutes),
    events,
    reviewMessages: [...new Set(reviewMessages.filter(Boolean))],
    source: record.origem === 'PLANILHA' ? 'SPREADSHEET' : 'SYSTEM',
    createdAt: record.criadoEm,
    updatedAt: record.atualizadoEm,
  };
};

export const reconcileFleetRecords = (
  context: FleetDataContext,
  now = new Date(),
): FleetCurrentState[] =>
  context.records
    .map(record => reconcileFleetRecord(record, context, now))
    .filter((record): record is FleetCurrentState => Boolean(record));

export const lookupDriverByCode = (
  code: string,
  employees: Funcionario[],
  companies: Empresa[],
  teams: GrupoEquipe[],
): DriverIdentity | undefined => {
  const result = reconcileEmployee({ employeeCode: code }, employees);
  if (!result.value) return undefined;
  const employee = result.value;
  const company = reconcileCompany(employee.empresaId, undefined, companies).value;
  const team = findEmployeeTeam(employee, teams);
  return {
    employeeId: employee.id,
    employeeCode: employee.matricula || '',
    normalizedEmployeeCode: normalizeEmployeeCode(employee.matricula),
    employeeName: employee.nome,
    companyId: company?.id || employee.empresaId,
    companyName: company?.nome || 'Empresa não localizada',
    teamId: team?.id,
    teamName: team?.nome,
    temporary: false,
  };
};

export const lookupEquipmentByPrefix = (
  prefix: string,
  equipment: Equipamento[],
  companies: Empresa[],
): FleetIdentity | undefined => {
  const result = reconcileEquipment({ prefix }, equipment);
  return result.value ? buildFleetIdentity(result.value, companies) : undefined;
};
