import type { Empresa, Equipamento, Funcionario } from '../types';
import {
  type FleetCurrentState,
  type FleetDataContext,
  type FleetIntegrityIssue,
  type FleetIntegrityReport,
  type FleetIntegritySummary,
} from './domain';
import { reconcileFleetRecords } from './reconciliation';
import { isKnownOperationalStatus } from './status';
import { isChronological, isValidIsoDate, parseOperationalTime } from './time';
import {
  normalizeCompanyName,
  normalizeEmployeeCode,
  normalizePlate,
  normalizePrefix,
} from '../utils/canonicalIdentity';

const groupDuplicates = <T>(
  values: T[],
  getKey: (value: T) => string,
): Map<string, T[]> => {
  const groups = new Map<string, T[]>();
  values.forEach(value => {
    const key = getKey(value);
    if (!key) return;
    groups.set(key, [...(groups.get(key) ?? []), value]);
  });
  return new Map([...groups].filter(([, group]) => group.length > 1));
};

const issue = (
  value: Omit<FleetIntegrityIssue, 'createdAt'>,
  generatedAt: string,
): FleetIntegrityIssue => ({ ...value, createdAt: generatedAt });

const auditCompanies = (
  companies: Empresa[],
  generatedAt: string,
): FleetIntegrityIssue[] => {
  const issues: FleetIntegrityIssue[] = [];
  groupDuplicates(companies, company => normalizeCompanyName(company.nome))
    .forEach(group => {
      issues.push(issue({
        id: `company-name-${normalizeCompanyName(group[0].nome)}`,
        category: 'Cadastro',
        priority: 'Alta',
        title: 'Empresa duplicada por nome normalizado',
        detail: group.map(company => `${company.nome} [${company.id}]`).join(', '),
        companyId: group[0].id,
        resolutionHint: 'Consolidar os vínculos em uma empresa canônica e inativar duplicatas.',
      }, generatedAt));
    });
  groupDuplicates(
    companies.filter(company => company.cnpj),
    company => company.cnpj.replace(/\D/g, ''),
  ).forEach(group => {
    issues.push(issue({
      id: `company-cnpj-${group[0].cnpj.replace(/\D/g, '')}`,
      category: 'Documentação',
      priority: 'Crítica',
      title: 'CNPJ utilizado em mais de uma empresa',
      detail: group.map(company => company.nome).join(', '),
      companyId: group[0].id,
      resolutionHint: 'Revisar o cadastro jurídico antes de novos vínculos.',
    }, generatedAt));
  });
  return issues;
};

const auditEquipment = (
  equipment: Equipamento[],
  companies: Empresa[],
  generatedAt: string,
): FleetIntegrityIssue[] => {
  const issues: FleetIntegrityIssue[] = [];
  const companyIds = new Set(companies.map(company => company.id));
  groupDuplicates(equipment, item => normalizePrefix(item.prefixo)).forEach(group => {
    issues.push(issue({
      id: `equipment-prefix-${normalizePrefix(group[0].prefixo)}`,
      category: 'Equipamento',
      priority: 'Crítica',
      title: 'Prefixo duplicado',
      detail: group.map(item => `${item.prefixo} [${item.id}]`).join(', '),
      equipmentId: group[0].id,
      resolutionHint: 'Definir o equipamento canônico e migrar todos os lançamentos para seu ID.',
    }, generatedAt));
  });
  groupDuplicates(
    equipment.filter(item => item.placa || item.seriePlaca),
    item => normalizePlate(item.placa || item.seriePlaca),
  ).forEach(group => {
    issues.push(issue({
      id: `equipment-plate-${normalizePlate(group[0].placa || group[0].seriePlaca)}`,
      category: 'Documentação',
      priority: 'Alta',
      title: 'Placa duplicada',
      detail: group.map(item => `${item.prefixo}: ${item.placa || item.seriePlaca}`).join(', '),
      equipmentId: group[0].id,
      resolutionHint: 'Revisar placa e série antes de consolidar o cadastro.',
    }, generatedAt));
  });
  equipment.forEach(item => {
    if (!companyIds.has(item.empresaId)) {
      issues.push(issue({
        id: `equipment-company-${item.id}`,
        category: 'Vínculo',
        priority: 'Alta',
        title: `${item.prefixo} está sem empresa válida`,
        detail: `O ID de empresa "${item.empresaId || 'vazio'}" não existe no cadastro canônico.`,
        equipmentId: item.id,
        companyId: item.empresaId,
        resolutionHint: 'Selecionar uma empresa ativa no cadastro do equipamento.',
      }, generatedAt));
    }
    if (!normalizePrefix(item.prefixo)) {
      issues.push(issue({
        id: `equipment-no-prefix-${item.id}`,
        category: 'Cadastro',
        priority: 'Crítica',
        title: 'Equipamento sem prefixo',
        detail: item.nome || item.id,
        equipmentId: item.id,
        resolutionHint: 'Informar o prefixo operacional único.',
      }, generatedAt));
    }
  });
  return issues;
};

const auditEmployees = (
  employees: Funcionario[],
  companies: Empresa[],
  generatedAt: string,
): FleetIntegrityIssue[] => {
  const issues: FleetIntegrityIssue[] = [];
  const companyIds = new Set(companies.map(company => company.id));
  groupDuplicates(
    employees.filter(employee => employee.matricula),
    employee => normalizeEmployeeCode(employee.matricula),
  ).forEach(group => {
    issues.push(issue({
      id: `employee-code-${normalizeEmployeeCode(group[0].matricula)}`,
      category: 'Motorista',
      priority: 'Crítica',
      title: 'Matrícula duplicada',
      detail: group.map(employee => `${employee.nome} [${employee.id}]`).join(', '),
      employeeId: group[0].id,
      resolutionHint: 'Definir o colaborador canônico e reconciliar vínculos por ID.',
    }, generatedAt));
  });
  employees.forEach(employee => {
    if (!companyIds.has(employee.empresaId)) {
      issues.push(issue({
        id: `employee-company-${employee.id}`,
        category: 'Vínculo',
        priority: employee.ativo ? 'Alta' : 'Média',
        title: `${employee.nome} está sem empresa válida`,
        detail: `Empresa "${employee.empresaId || 'não informada'}" não localizada.`,
        employeeId: employee.id,
        companyId: employee.empresaId,
        resolutionHint: 'Vincular o colaborador a uma empresa canônica.',
      }, generatedAt));
    }
    if (employee.ativo && !normalizeEmployeeCode(employee.matricula)) {
      issues.push(issue({
        id: `employee-no-code-${employee.id}`,
        category: 'Cadastro',
        priority: 'Média',
        title: 'Colaborador ativo sem matrícula',
        detail: employee.nome,
        employeeId: employee.id,
        resolutionHint: 'Informar a matrícula para permitir o lookup operacional.',
      }, generatedAt));
    }
  });
  return issues;
};

const auditFleetStates = (
  context: FleetDataContext,
  states: FleetCurrentState[],
  generatedAt: string,
): FleetIntegrityIssue[] => {
  const issues: FleetIntegrityIssue[] = [];
  const stateIds = new Set(states.map(state => state.recordId));
  context.records.forEach(record => {
    if (!stateIds.has(record.id)) {
      issues.push(issue({
        id: `record-orphan-${record.id}`,
        category: 'Dados inconsistentes',
        priority: 'Alta',
        title: 'Lançamento sem CB canônico',
        detail: `${record.data} · ${record.prefixo || 'prefixo não informado'}`,
        recordId: record.id,
        equipmentId: record.equipamentoId,
        resolutionHint: 'Reconciliar pelo ID, prefixo ou placa sem apagar a linha importada.',
      }, generatedAt));
    }
    if (!isKnownOperationalStatus(record.status)) {
      issues.push(issue({
        id: `record-status-${record.id}`,
        category: 'Operacional',
        priority: 'Alta',
        title: 'Status operacional inválido',
        detail: `${record.prefixo}: "${record.status}"`,
        recordId: record.id,
        resolutionHint: 'Converter o legado usando o mapa central de status.',
      }, generatedAt));
    }
    if (!isValidIsoDate(record.data)) {
      issues.push(issue({
        id: `record-date-${record.id}`,
        category: 'Dados inconsistentes',
        priority: 'Alta',
        title: 'Data operacional inválida',
        detail: `${record.prefixo}: "${record.data}"`,
        recordId: record.id,
        resolutionHint: 'Corrigir a data preservando o valor original no histórico.',
      }, generatedAt));
    }
    [
      ['saída', record.horaSaida],
      ['entrada manutenção', record.horaEntradaManutencao],
      ['liberação', record.horaLiberacao],
    ].forEach(([label, value]) => {
      if (value && !parseOperationalTime(value).valid) {
        issues.push(issue({
          id: `record-time-${record.id}-${label}`,
          category: 'Dados inconsistentes',
          priority: 'Média',
          title: 'Horário operacional inválido',
          detail: `${record.prefixo} · ${label}: "${value}"`,
          recordId: record.id,
          resolutionHint: 'Normalizar para HH:mm antes do cálculo de duração.',
        }, generatedAt));
      }
    });
    const eventTimes = (record.eventos ?? []).map(event => event.ocorridoEm);
    if (!isChronological(eventTimes)) {
      issues.push(issue({
        id: `record-events-${record.id}`,
        category: 'Operacional',
        priority: 'Alta',
        title: 'Eventos fora de ordem cronológica',
        detail: `${record.prefixo} possui ${eventTimes.length} eventos fora de sequência.`,
        recordId: record.id,
        resolutionHint: 'Ordenar eventos por timestamp sem alterar seus valores.',
      }, generatedAt));
    }
  });
  states.forEach(state => {
    if (
      state.operationalStatus === 'Em operação'
      && (!state.driver || state.driver.temporary)
    ) {
      issues.push(issue({
        id: `operating-no-driver-${state.recordId}`,
        category: 'Motorista',
        priority: 'Crítica',
        title: `${state.equipment.prefix} está em operação sem motorista canônico`,
        detail: state.driver?.employeeName || 'Motorista não informado.',
        equipmentId: state.equipment.equipmentId,
        employeeId: state.driver?.employeeId,
        recordId: state.recordId,
        resolutionHint: 'Vincular um colaborador por ID/matrícula ou alterar o estado operacional.',
      }, generatedAt));
    }
    state.reviewMessages.forEach((message, index) => {
      issues.push(issue({
        id: `record-review-${state.recordId}-${index}`,
        category: 'Importação',
        priority: 'Média',
        title: `${state.equipment.prefix} requer conferência`,
        detail: message,
        equipmentId: state.equipment.equipmentId,
        recordId: state.recordId,
        resolutionHint: 'Abrir o lançamento e confirmar os dados reconciliados.',
      }, generatedAt));
    });
  });
  return issues;
};

const summarize = (issues: FleetIntegrityIssue[]): FleetIntegritySummary => ({
  total: issues.length,
  critical: issues.filter(item => item.priority === 'Crítica').length,
  high: issues.filter(item => item.priority === 'Alta').length,
  medium: issues.filter(item => item.priority === 'Média').length,
  low: issues.filter(item => item.priority === 'Baixa').length,
  orphanRecords: issues.filter(item => item.id.startsWith('record-orphan-')).length,
  duplicatePrefixes: issues.filter(item => item.id.startsWith('equipment-prefix-')).length,
  duplicatePlates: issues.filter(item => item.id.startsWith('equipment-plate-')).length,
  duplicateEmployeeCodes: issues.filter(item => item.id.startsWith('employee-code-')).length,
  invalidStatuses: issues.filter(item => item.id.startsWith('record-status-')).length,
  invalidTimestamps: issues.filter(item =>
    item.id.startsWith('record-date-') || item.id.startsWith('record-time-')).length,
  outOfOrderEvents: issues.filter(item => item.id.startsWith('record-events-')).length,
});

export const auditFleetIntegrity = (
  context: FleetDataContext,
  now = new Date(),
): FleetIntegrityReport => {
  const generatedAt = now.toISOString();
  const states = reconcileFleetRecords(context, now);
  const issues = [
    ...auditCompanies(context.companies, generatedAt),
    ...auditEquipment(context.equipment, context.companies, generatedAt),
    ...auditEmployees(context.employees, context.companies, generatedAt),
    ...auditFleetStates(context, states, generatedAt),
  ].sort((left, right) => {
    const rank = { Crítica: 0, Alta: 1, Média: 2, Baixa: 3 };
    return rank[left.priority] - rank[right.priority]
      || left.title.localeCompare(right.title, 'pt-BR');
  });
  return { generatedAt, issues, summary: summarize(issues) };
};

export const auditFleetPerformance = (
  context: FleetDataContext,
  repetitions = 5,
): {
  records: number;
  repetitions: number;
  averageMilliseconds: number;
  maximumMilliseconds: number;
} => {
  const durations: number[] = [];
  for (let index = 0; index < repetitions; index += 1) {
    const start = performance.now();
    auditFleetIntegrity(context);
    durations.push(performance.now() - start);
  }
  return {
    records: context.records.length,
    repetitions,
    averageMilliseconds: durations.reduce((sum, duration) => sum + duration, 0)
      / Math.max(durations.length, 1),
    maximumMilliseconds: Math.max(...durations, 0),
  };
};
