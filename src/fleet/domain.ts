import type {
  ControleEquipamentoDiario,
  Empresa,
  Equipamento,
  EventoControleEquipamentoDiario,
  Funcionario,
  GrupoEquipe,
  OrdemServico,
} from '../types';

export const FLEET_OPERATIONAL_STATUS = {
  operating: 'Em operação',
  maintenance: 'Em manutenção',
  available: 'À disposição',
  waitingDriver: 'Aguardando motorista',
  unavailable: 'Indisponível',
  waitingMaintenance: 'Aguardando manutenção',
  stopped: 'Parado',
  unclassified: 'Não classificado',
} as const;

export type FleetOperationalStatus =
  typeof FLEET_OPERATIONAL_STATUS[keyof typeof FLEET_OPERATIONAL_STATUS];

export type FleetRegistrationStatus =
  | 'Ativo'
  | 'Parado'
  | 'Manutenção'
  | 'Mobilizado'
  | 'Desmobilizado'
  | 'Esperando motorista';

export type FleetEventKind =
  | 'OPERATION_STARTED'
  | 'MAINTENANCE_ENTERED'
  | 'MAINTENANCE_RELEASED'
  | 'RETURNED_TO_OPERATION'
  | 'AVAILABLE_SINCE'
  | 'DRIVER_ASSIGNED'
  | 'DRIVER_REMOVED'
  | 'STATUS_CHANGED'
  | 'NOTE_ADDED'
  | 'IMPORTED';

export type FleetIssuePriority = 'Crítica' | 'Alta' | 'Média' | 'Baixa';

export type FleetIssueCategory =
  | 'Manutenção'
  | 'Cadastro'
  | 'Motorista'
  | 'Equipamento'
  | 'Documentação'
  | 'Vínculo'
  | 'Operacional'
  | 'Importação'
  | 'Dados inconsistentes';

export interface FleetEvent {
  id: string;
  equipmentId: string;
  employeeId?: string;
  occurredAt: string;
  kind: FleetEventKind;
  previousStatus?: FleetOperationalStatus;
  nextStatus: FleetOperationalStatus;
  reason?: string;
  note?: string;
  maintenanceOrderId?: string;
  source: 'SYSTEM' | 'SPREADSHEET' | 'USER';
  createdBy?: string;
}

export interface FleetIdentity {
  equipmentId: string;
  prefix: string;
  normalizedPrefix: string;
  plate: string;
  normalizedPlate: string;
  equipmentName: string;
  equipmentType: string;
  family: string;
  registrationStatus: FleetRegistrationStatus;
  companyId: string;
  companyName: string;
}

export interface DriverIdentity {
  employeeId: string;
  employeeCode: string;
  normalizedEmployeeCode: string;
  employeeName: string;
  companyId: string;
  companyName: string;
  teamId?: string;
  teamName?: string;
  temporary: boolean;
}

export interface FleetCurrentState {
  recordId: string;
  operationalKey: string;
  date: string;
  equipment: FleetIdentity;
  driver?: DriverIdentity;
  operationalStatus: FleetOperationalStatus;
  departureTime?: string;
  maintenanceEntryTime?: string;
  releaseTime?: string;
  availableSince?: string;
  location?: string;
  note?: string;
  maintenanceReason?: string;
  maintenanceOrderId?: string;
  stoppedMinutes?: number;
  stoppedDurationLabel: string;
  events: FleetEvent[];
  reviewMessages: string[];
  source: 'SYSTEM' | 'SPREADSHEET';
  createdAt: string;
  updatedAt: string;
}

export interface FleetReportFilters {
  date: string;
  companyId: string;
  status: FleetOperationalStatus | 'Todos';
  prefix: string;
  driver: string;
  search: string;
}

export interface FleetMetrics {
  total: number;
  operating: number;
  maintenance: number;
  available: number;
  waitingDriver: number;
  unavailable: number;
  waitingMaintenance: number;
  stopped: number;
  unclassified: number;
  stoppedMinutes: number;
  stoppedDurationLabel: string;
  availabilityRate: number;
  operatingRate: number;
  classifiedTotal: number;
  integrityDifference: number;
}

export interface FleetReportSection {
  id: 'operating' | 'maintenance' | 'available' | 'waitingDriver' | 'other';
  title: string;
  emptyMessage: string;
  rows: FleetCurrentState[];
}

export interface FleetReportViewModel {
  generatedAt: string;
  reportDate: string;
  reportDateLabel: string;
  operationName: string;
  companyLabel: string;
  filters: FleetReportFilters;
  metrics: FleetMetrics;
  allRows: FleetCurrentState[];
  operating: FleetCurrentState[];
  maintenance: FleetCurrentState[];
  available: FleetCurrentState[];
  waitingDriver: FleetCurrentState[];
  other: FleetCurrentState[];
  sections: FleetReportSection[];
  history: FleetEvent[];
  integrityWarnings: string[];
}

export interface FleetDataContext {
  records: ControleEquipamentoDiario[];
  equipment: Equipamento[];
  employees: Funcionario[];
  companies: Empresa[];
  teams: GrupoEquipe[];
  maintenanceOrders: OrdemServico[];
}

export interface ReconciliationResult<T> {
  value?: T;
  matchedBy: 'id' | 'prefix' | 'plate' | 'employeeCode' | 'none';
  confidence: 'exact' | 'normalized' | 'missing';
  warnings: string[];
}

export interface FleetIntegrityIssue {
  id: string;
  category: FleetIssueCategory;
  priority: FleetIssuePriority;
  title: string;
  detail: string;
  equipmentId?: string;
  employeeId?: string;
  companyId?: string;
  recordId?: string;
  createdAt: string;
  resolutionHint: string;
}

export interface FleetIntegritySummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  orphanRecords: number;
  duplicatePrefixes: number;
  duplicatePlates: number;
  duplicateEmployeeCodes: number;
  invalidStatuses: number;
  invalidTimestamps: number;
  outOfOrderEvents: number;
}

export interface FleetIntegrityReport {
  generatedAt: string;
  issues: FleetIntegrityIssue[];
  summary: FleetIntegritySummary;
}

export interface FleetImportRawRow {
  rowNumber: number;
  date?: unknown;
  employeeCode?: unknown;
  employeeName?: unknown;
  prefix?: unknown;
  plate?: unknown;
  company?: unknown;
  status?: unknown;
  departureTime?: unknown;
  maintenanceEntryTime?: unknown;
  releaseTime?: unknown;
  location?: unknown;
  note?: unknown;
  maintenanceReason?: unknown;
}

export type FleetImportDisposition =
  | 'NEW'
  | 'UPDATE'
  | 'DUPLICATE'
  | 'IGNORED'
  | 'ERROR';

export interface FleetImportPreviewRow {
  rowNumber: number;
  disposition: FleetImportDisposition;
  key: string;
  record?: ControleEquipamentoDiario;
  existingRecordId?: string;
  messages: string[];
  raw: FleetImportRawRow;
}

export interface FleetImportPreview {
  generatedAt: string;
  rows: FleetImportPreviewRow[];
  newCount: number;
  updateCount: number;
  duplicateCount: number;
  ignoredCount: number;
  errorCount: number;
  canApply: boolean;
}

export interface FleetImportApplication {
  next: ControleEquipamentoDiario[];
  created: number;
  updated: number;
  duplicates: number;
  ignored: number;
  errors: number;
  appliedAt: string;
}

export interface FleetBulkPatch {
  status?: FleetOperationalStatus;
  companyId?: string;
  employeeId?: string;
  location?: string;
  note?: string;
}

export interface FleetMutationAudit {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'BULK_UPDATE' | 'SOFT_DELETE' | 'IMPORT';
  recordIds: string[];
  occurredAt: string;
  actor: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}

export interface FleetSoftDelete {
  deletedAt: string;
  deletedBy: string;
  deletionReason?: string;
}

export type FleetPersistedRecord = ControleEquipamentoDiario & {
  local?: string;
  disponivelDesde?: string;
  motoristaTemporario?: boolean;
  empresaMotoristaId?: string;
  equipeId?: string;
  excluido?: FleetSoftDelete;
  criadoPor?: string;
  atualizadoPor?: string;
};

export const isFleetEvent = (
  event: FleetEvent | EventoControleEquipamentoDiario,
): event is FleetEvent => 'equipmentId' in event && 'occurredAt' in event;

export const createEmptyFleetFilters = (date: string): FleetReportFilters => ({
  date,
  companyId: 'Todos',
  status: 'Todos',
  prefix: '',
  driver: '',
  search: '',
});

export const createEmptyFleetMetrics = (): FleetMetrics => ({
  total: 0,
  operating: 0,
  maintenance: 0,
  available: 0,
  waitingDriver: 0,
  unavailable: 0,
  waitingMaintenance: 0,
  stopped: 0,
  unclassified: 0,
  stoppedMinutes: 0,
  stoppedDurationLabel: '—',
  availabilityRate: 0,
  operatingRate: 0,
  classifiedTotal: 0,
  integrityDifference: 0,
});
