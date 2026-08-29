import type { StatusControleEquipamentoDiario } from '../types';
import {
  FLEET_OPERATIONAL_STATUS,
  type FleetCurrentState,
  type FleetEvent,
  type FleetOperationalStatus,
} from './domain';
import { normalizeComparable } from '../utils/canonicalIdentity';

export interface FleetStatusDefinition {
  value: FleetOperationalStatus;
  key: keyof typeof FLEET_OPERATIONAL_STATUS;
  shortLabel: string;
  description: string;
  textClass: string;
  backgroundClass: string;
  borderClass: string;
  reportColor: string;
  reportBackground: string;
  isAvailableForOperation: boolean;
  countsAsStopped: boolean;
  requiresDriver: boolean;
  priority: number;
}

export const FLEET_STATUS_DEFINITIONS: FleetStatusDefinition[] = [
  {
    value: FLEET_OPERATIONAL_STATUS.operating,
    key: 'operating',
    shortLabel: 'Operação',
    description: 'Equipamento executando atividade operacional.',
    textClass: 'text-emerald-700',
    backgroundClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200',
    reportColor: '#176B45',
    reportBackground: '#EDF8F2',
    isAvailableForOperation: true,
    countsAsStopped: false,
    requiresDriver: true,
    priority: 1,
  },
  {
    value: FLEET_OPERATIONAL_STATUS.maintenance,
    key: 'maintenance',
    shortLabel: 'Manutenção',
    description: 'Equipamento formalmente entregue à manutenção.',
    textClass: 'text-rose-700',
    backgroundClass: 'bg-rose-50',
    borderClass: 'border-rose-200',
    reportColor: '#9F2D2D',
    reportBackground: '#FDF0F0',
    isAvailableForOperation: false,
    countsAsStopped: true,
    requiresDriver: false,
    priority: 2,
  },
  {
    value: FLEET_OPERATIONAL_STATUS.available,
    key: 'available',
    shortLabel: 'À disposição',
    description: 'Equipamento liberado e disponível para alocação.',
    textClass: 'text-sky-700',
    backgroundClass: 'bg-sky-50',
    borderClass: 'border-sky-200',
    reportColor: '#246786',
    reportBackground: '#EEF7FC',
    isAvailableForOperation: true,
    countsAsStopped: true,
    requiresDriver: false,
    priority: 3,
  },
  {
    value: FLEET_OPERATIONAL_STATUS.pending,
    key: 'pending',
    shortLabel: 'A confirmar',
    description: 'Informação operacional ainda pendente de conferência.',
    textClass: 'text-amber-800',
    backgroundClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
    reportColor: '#B77900',
    reportBackground: '#FFF8E8',
    isAvailableForOperation: false,
    countsAsStopped: false,
    requiresDriver: false,
    priority: 4,
  },
  {
    value: FLEET_OPERATIONAL_STATUS.waitingDriver,
    key: 'waitingDriver',
    shortLabel: 'Sem motorista',
    description: 'Equipamento apto, aguardando condutor.',
    textClass: 'text-cyan-800',
    backgroundClass: 'bg-cyan-50',
    borderClass: 'border-cyan-200',
    reportColor: '#176A70',
    reportBackground: '#EFFAFA',
    isAvailableForOperation: true,
    countsAsStopped: true,
    requiresDriver: false,
    priority: 5,
  },
  {
    value: FLEET_OPERATIONAL_STATUS.waitingMaintenance,
    key: 'waitingMaintenance',
    shortLabel: 'Aguard. manutenção',
    description: 'Equipamento parado aguardando atendimento.',
    textClass: 'text-orange-800',
    backgroundClass: 'bg-orange-50',
    borderClass: 'border-orange-200',
    reportColor: '#8A4B13',
    reportBackground: '#FFF6EC',
    isAvailableForOperation: false,
    countsAsStopped: true,
    requiresDriver: false,
    priority: 6,
  },
  {
    value: FLEET_OPERATIONAL_STATUS.unavailable,
    key: 'unavailable',
    shortLabel: 'Indisponível',
    description: 'Equipamento sem condição operacional.',
    textClass: 'text-slate-800',
    backgroundClass: 'bg-slate-100',
    borderClass: 'border-slate-300',
    reportColor: '#3F4854',
    reportBackground: '#F1F3F5',
    isAvailableForOperation: false,
    countsAsStopped: true,
    requiresDriver: false,
    priority: 7,
  },
  {
    value: FLEET_OPERATIONAL_STATUS.stopped,
    key: 'stopped',
    shortLabel: 'Parado',
    description: 'Equipamento parado por motivo operacional informado.',
    textClass: 'text-amber-800',
    backgroundClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
    reportColor: '#825B17',
    reportBackground: '#FFF8E8',
    isAvailableForOperation: false,
    countsAsStopped: true,
    requiresDriver: false,
    priority: 8,
  },
  {
    value: FLEET_OPERATIONAL_STATUS.unclassified,
    key: 'unclassified',
    shortLabel: 'Não classificado',
    description: 'Status legado ou inválido aguardando revisão.',
    textClass: 'text-violet-800',
    backgroundClass: 'bg-violet-50',
    borderClass: 'border-violet-200',
    reportColor: '#624589',
    reportBackground: '#F6F0FC',
    isAvailableForOperation: false,
    countsAsStopped: false,
    requiresDriver: false,
    priority: 9,
  },
];

const STATUS_ALIASES: Record<string, FleetOperationalStatus> = {
  emoperacao: FLEET_OPERATIONAL_STATUS.operating,
  operacao: FLEET_OPERATIONAL_STATUS.operating,
  operando: FLEET_OPERATIONAL_STATUS.operating,
  rodando: FLEET_OPERATIONAL_STATUS.operating,
  trabalhando: FLEET_OPERATIONAL_STATUS.operating,
  emservico: FLEET_OPERATIONAL_STATUS.operating,
  emmanutencao: FLEET_OPERATIONAL_STATUS.maintenance,
  manutencao: FLEET_OPERATIONAL_STATUS.maintenance,
  oficina: FLEET_OPERATIONAL_STATUS.maintenance,
  disponivel: FLEET_OPERATIONAL_STATUS.available,
  adisposicao: FLEET_OPERATIONAL_STATUS.available,
  liberado: FLEET_OPERATIONAL_STATUS.available,
  reserva: FLEET_OPERATIONAL_STATUS.available,
  aconfirmar: FLEET_OPERATIONAL_STATUS.pending,
  pendente: FLEET_OPERATIONAL_STATUS.pending,
  aguardandoconfirmacao: FLEET_OPERATIONAL_STATUS.pending,
  aguardandomotorista: FLEET_OPERATIONAL_STATUS.waitingDriver,
  semmotorista: FLEET_OPERATIONAL_STATUS.waitingDriver,
  esperandomotorista: FLEET_OPERATIONAL_STATUS.waitingDriver,
  aguardandomanutencao: FLEET_OPERATIONAL_STATUS.waitingMaintenance,
  aguardandooficina: FLEET_OPERATIONAL_STATUS.waitingMaintenance,
  indisponivel: FLEET_OPERATIONAL_STATUS.unavailable,
  aguardandoequipamento: FLEET_OPERATIONAL_STATUS.unavailable,
  desmobilizado: FLEET_OPERATIONAL_STATUS.unavailable,
  parado: FLEET_OPERATIONAL_STATUS.stopped,
  inativo: FLEET_OPERATIONAL_STATUS.stopped,
};

export const normalizeStatusKey = (value: unknown): string =>
  normalizeComparable(String(value ?? '')).replace(/[^a-z0-9]/g, '');

export const normalizeOperationalStatus = (
  value: unknown,
  fallback: FleetOperationalStatus = FLEET_OPERATIONAL_STATUS.unclassified,
): FleetOperationalStatus => STATUS_ALIASES[normalizeStatusKey(value)] ?? fallback;

export const toLegacyDailyStatus = (
  value: FleetOperationalStatus,
): StatusControleEquipamentoDiario => {
  switch (value) {
    case FLEET_OPERATIONAL_STATUS.operating:
      return 'Em operação';
    case FLEET_OPERATIONAL_STATUS.maintenance:
      return 'Em manutenção';
    case FLEET_OPERATIONAL_STATUS.available:
      return 'Disponível';
    case FLEET_OPERATIONAL_STATUS.pending:
      return 'A confirmar';
    case FLEET_OPERATIONAL_STATUS.waitingDriver:
      return 'Aguardando motorista';
    case FLEET_OPERATIONAL_STATUS.waitingMaintenance:
      return 'Aguardando manutenção';
    case FLEET_OPERATIONAL_STATUS.unavailable:
      return 'Aguardando equipamento';
    case FLEET_OPERATIONAL_STATUS.stopped:
      return 'Reserva';
    default:
      return 'Reserva';
  }
};

export const getFleetStatusDefinition = (
  status: FleetOperationalStatus,
): FleetStatusDefinition =>
  FLEET_STATUS_DEFINITIONS.find(definition => definition.value === status)
  ?? FLEET_STATUS_DEFINITIONS[FLEET_STATUS_DEFINITIONS.length - 1];

export const isKnownOperationalStatus = (value: unknown): boolean =>
  normalizeStatusKey(value) in STATUS_ALIASES;

export const sortFleetStatesByStatus = (
  left: FleetCurrentState,
  right: FleetCurrentState,
): number => {
  const leftPriority = getFleetStatusDefinition(left.operationalStatus).priority;
  const rightPriority = getFleetStatusDefinition(right.operationalStatus).priority;
  return leftPriority - rightPriority
    || left.equipment.prefix.localeCompare(right.equipment.prefix, 'pt-BR', { numeric: true });
};

export const deriveCurrentStatusFromEvents = (
  events: FleetEvent[],
  fallback: FleetOperationalStatus,
): FleetOperationalStatus => {
  const latest = [...events]
    .filter(event => Number.isFinite(Date.parse(event.occurredAt)))
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
    .at(-1);
  return latest?.nextStatus ?? fallback;
};

export const statusCountsAsStopped = (status: FleetOperationalStatus): boolean =>
  getFleetStatusDefinition(status).countsAsStopped;

export const statusIsOperationallyAvailable = (
  status: FleetOperationalStatus,
): boolean => getFleetStatusDefinition(status).isAvailableForOperation;

export const assertFleetStatusPartition = (
  states: FleetCurrentState[],
): { total: number; classified: number; difference: number } => {
  const total = states.length;
  const classified = FLEET_STATUS_DEFINITIONS.reduce(
    (sum, definition) =>
      sum + states.filter(state => state.operationalStatus === definition.value).length,
    0,
  );
  return { total, classified, difference: total - classified };
};
