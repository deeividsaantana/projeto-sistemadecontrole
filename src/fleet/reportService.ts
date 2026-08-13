import type { FleetCurrentState, FleetDataContext, FleetMetrics, FleetReportFilters, FleetReportViewModel } from './domain';
import { FLEET_OPERATIONAL_STATUS, createEmptyFleetMetrics } from './domain';
import { reconcileFleetRecords } from './reconciliation';
import { assertFleetStatusPartition, sortFleetStatesByStatus } from './status';
import { formatBrazilianDate, formatDurationMinutes } from './time';
import {
  normalizeComparable,
  normalizeEmployeeCode,
  normalizePlate,
  normalizePrefix,
} from '../utils/canonicalIdentity';

const includesNormalized = (value: unknown, search: string): boolean =>
  normalizeComparable(String(value ?? '')).includes(normalizeComparable(search));

export const filterFleetStates = (
  states: FleetCurrentState[],
  filters: FleetReportFilters,
): FleetCurrentState[] => states.filter(state => {
  if (filters.date && state.date !== filters.date) return false;
  if (filters.companyId !== 'Todos' && state.equipment.companyId !== filters.companyId) {
    return false;
  }
  if (filters.status !== 'Todos' && state.operationalStatus !== filters.status) return false;
  if (filters.prefix && !normalizePrefix(state.equipment.prefix).includes(normalizePrefix(filters.prefix))) {
    return false;
  }
  if (filters.driver) {
    const driverSearch = `${state.driver?.employeeCode ?? ''} ${state.driver?.employeeName ?? ''}`;
    if (!includesNormalized(driverSearch, filters.driver)) return false;
  }
  if (filters.search) {
    const searchable = [
      state.equipment.prefix,
      state.equipment.plate,
      state.equipment.equipmentName,
      state.equipment.companyName,
      state.driver?.employeeCode,
      state.driver?.employeeName,
      state.driver?.teamName,
      state.operationalStatus,
      state.location,
      state.note,
      state.maintenanceReason,
      state.date,
    ].filter(Boolean).join(' ');
    const normalizedMatches =
      normalizePrefix(state.equipment.prefix).includes(normalizePrefix(filters.search))
      || normalizePlate(state.equipment.plate).includes(normalizePlate(filters.search))
      || normalizeEmployeeCode(state.driver?.employeeCode)
        .includes(normalizeEmployeeCode(filters.search));
    if (!normalizedMatches && !includesNormalized(searchable, filters.search)) return false;
  }
  return true;
});

export const selectOperatingCBs = (states: FleetCurrentState[]): FleetCurrentState[] =>
  states.filter(state => state.operationalStatus === FLEET_OPERATIONAL_STATUS.operating);

export const selectMaintenanceCBs = (states: FleetCurrentState[]): FleetCurrentState[] =>
  states.filter(state =>
    state.operationalStatus === FLEET_OPERATIONAL_STATUS.maintenance
    || state.operationalStatus === FLEET_OPERATIONAL_STATUS.waitingMaintenance);

export const selectAvailableCBs = (states: FleetCurrentState[]): FleetCurrentState[] =>
  states.filter(state => state.operationalStatus === FLEET_OPERATIONAL_STATUS.available);

export const selectWaitingDriverCBs = (states: FleetCurrentState[]): FleetCurrentState[] =>
  states.filter(state => state.operationalStatus === FLEET_OPERATIONAL_STATUS.waitingDriver);

export const selectOtherCBs = (states: FleetCurrentState[]): FleetCurrentState[] => {
  const primary = new Set<FleetCurrentState['operationalStatus']>([
    FLEET_OPERATIONAL_STATUS.operating,
    FLEET_OPERATIONAL_STATUS.maintenance,
    FLEET_OPERATIONAL_STATUS.waitingMaintenance,
    FLEET_OPERATIONAL_STATUS.available,
    FLEET_OPERATIONAL_STATUS.waitingDriver,
  ]);
  return states.filter(state => !primary.has(state.operationalStatus));
};

export const calculateFleetMetrics = (
  states: FleetCurrentState[],
): FleetMetrics => {
  if (!states.length) return createEmptyFleetMetrics();
  const count = (status: FleetCurrentState['operationalStatus']) =>
    states.filter(state => state.operationalStatus === status).length;
  const operating = count(FLEET_OPERATIONAL_STATUS.operating);
  const maintenance = count(FLEET_OPERATIONAL_STATUS.maintenance);
  const available = count(FLEET_OPERATIONAL_STATUS.available);
  const waitingDriver = count(FLEET_OPERATIONAL_STATUS.waitingDriver);
  const unavailable = count(FLEET_OPERATIONAL_STATUS.unavailable);
  const waitingMaintenance = count(FLEET_OPERATIONAL_STATUS.waitingMaintenance);
  const stopped = count(FLEET_OPERATIONAL_STATUS.stopped);
  const unclassified = count(FLEET_OPERATIONAL_STATUS.unclassified);
  const stoppedMinutes = states.reduce(
    (sum, state) => sum + (state.stoppedMinutes ?? 0),
    0,
  );
  const partition = assertFleetStatusPartition(states);
  const availableFleet = operating + available + waitingDriver;
  return {
    total: states.length,
    operating,
    maintenance,
    available,
    waitingDriver,
    unavailable,
    waitingMaintenance,
    stopped,
    unclassified,
    stoppedMinutes,
    stoppedDurationLabel: formatDurationMinutes(
      stoppedMinutes > 0 ? stoppedMinutes : undefined,
    ),
    availabilityRate: states.length ? (availableFleet / states.length) * 100 : 0,
    operatingRate: states.length ? (operating / states.length) * 100 : 0,
    classifiedTotal: partition.classified,
    integrityDifference: partition.difference,
  };
};

const uniqueWarnings = (states: FleetCurrentState[], metrics: FleetMetrics): string[] => {
  const warnings = states.flatMap(state =>
    state.reviewMessages.map(message => `${state.equipment.prefix}: ${message}`));
  if (metrics.integrityDifference !== 0) {
    warnings.push(
      `A soma dos estados difere do total em ${metrics.integrityDifference} registro(s).`,
    );
  }
  if (metrics.unclassified > 0) {
    warnings.push(`${metrics.unclassified} registro(s) possuem status não classificado.`);
  }
  return [...new Set(warnings)];
};

export const createFleetReportViewModel = (
  context: FleetDataContext,
  filters: FleetReportFilters,
  now = new Date(),
): FleetReportViewModel => {
  const reconciled = reconcileFleetRecords(context, now);
  const filtered = filterFleetStates(reconciled, filters).sort(sortFleetStatesByStatus);
  const metrics = calculateFleetMetrics(filtered);
  const operating = selectOperatingCBs(filtered)
    .sort((left, right) =>
      left.equipment.prefix.localeCompare(right.equipment.prefix, 'pt-BR', { numeric: true }));
  const maintenance = selectMaintenanceCBs(filtered)
    .sort((left, right) => (right.stoppedMinutes ?? -1) - (left.stoppedMinutes ?? -1));
  const available = selectAvailableCBs(filtered)
    .sort((left, right) => (right.stoppedMinutes ?? -1) - (left.stoppedMinutes ?? -1));
  const waitingDriver = selectWaitingDriverCBs(filtered)
    .sort((left, right) =>
      left.equipment.prefix.localeCompare(right.equipment.prefix, 'pt-BR', { numeric: true }));
  const other = selectOtherCBs(filtered).sort(sortFleetStatesByStatus);
  const companyNames = [...new Set(filtered.map(state => state.equipment.companyName))];
  const companyLabel = filters.companyId !== 'Todos'
    ? context.companies.find(company => company.id === filters.companyId)?.nome
      || companyNames[0]
      || 'Empresa não localizada'
    : companyNames.length === 1
      ? companyNames[0]
      : companyNames.length > 1
        ? 'Múltiplas empresas'
        : 'Todas as empresas';
  const history = filtered
    .flatMap(state => state.events)
    .filter(event => event.occurredAt.slice(0, 10) === filters.date)
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  return {
    generatedAt: now.toISOString(),
    reportDate: filters.date,
    reportDateLabel: formatBrazilianDate(filters.date),
    operationName: 'Operação - Alto Tietê',
    companyLabel,
    filters: { ...filters },
    metrics,
    allRows: filtered,
    operating,
    maintenance,
    available,
    waitingDriver,
    other,
    sections: [
      {
        id: 'operating',
        title: 'Operação - Alto Tietê',
        emptyMessage: 'Nenhum CB em operação neste período.',
        rows: operating,
      },
      {
        id: 'maintenance',
        title: 'CBs em manutenção',
        emptyMessage: 'Nenhum CB em manutenção.',
        rows: maintenance,
      },
      {
        id: 'available',
        title: 'CBs à disposição',
        emptyMessage: 'Nenhum CB à disposição.',
        rows: available,
      },
      {
        id: 'waitingDriver',
        title: 'CBs aguardando motorista',
        emptyMessage: 'Nenhum CB aguardando motorista.',
        rows: waitingDriver,
      },
      {
        id: 'other',
        title: 'Outros estados',
        emptyMessage: 'Nenhum CB em outros estados.',
        rows: other,
      },
    ],
    history,
    integrityWarnings: uniqueWarnings(filtered, metrics),
  };
};

export const getTotalCBs = (viewModel: FleetReportViewModel): number =>
  viewModel.metrics.total;

export const getOperatingCBs = (viewModel: FleetReportViewModel): number =>
  viewModel.metrics.operating;

export const getMaintenanceCBs = (viewModel: FleetReportViewModel): number =>
  viewModel.metrics.maintenance + viewModel.metrics.waitingMaintenance;

export const getAvailableCBs = (viewModel: FleetReportViewModel): number =>
  viewModel.metrics.available;

export const getStoppedHours = (viewModel: FleetReportViewModel): number =>
  viewModel.metrics.stoppedMinutes / 60;

export const getAvailabilityRate = (viewModel: FleetReportViewModel): number =>
  viewModel.metrics.availabilityRate;

export const getCurrentFleetState = (
  viewModel: FleetReportViewModel,
  equipmentId: string,
): FleetCurrentState | undefined =>
  viewModel.allRows.find(row => row.equipment.equipmentId === equipmentId);
