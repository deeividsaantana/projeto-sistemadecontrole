import { EventoTicket, TicketJazida, TipoEventoTicket } from '../types';
import { normalizeTicketNumber } from './ticketNumberSequence';

export type TravelDivergenceField = 'prefixo' | 'placa' | 'material' | 'quantidade';
export type TravelPairStatus =
  | 'Conferido'
  | 'Divergência'
  | 'Sem liberação'
  | 'Sem recebimento'
  | 'Ticket duplicado';

export interface TravelDivergence {
  field: TravelDivergenceField;
  label: string;
  releaseValue: string | number;
  receiptValue: string | number;
}

export interface TravelOperation {
  ticketNumber: string;
  release?: TicketJazida;
  receipt?: TicketJazida;
  releases: TicketJazida[];
  receipts: TicketJazida[];
  status: TravelPairStatus;
  divergences: TravelDivergence[];
  durationMinutes: number | null;
  releaseEvent?: EventoTicket;
  receiptEvent?: EventoTicket;
  returnEvents: EventoTicket[];
  printedBatchId?: string;
  equipmentId?: string;
  materialId?: string;
  originLocationId?: string;
  destinationLocationId?: string;
  branchId?: string;
}

export interface TravelOperationControl {
  operations: TravelOperation[];
  totalTickets: number;
  completeTrips: number;
  divergentTrips: number;
  releasesWithoutReceipt: number;
  receiptsWithoutRelease: number;
  duplicateTickets: number;
  returnedPairs: number;
  averageDurationMinutes: number | null;
  linkedEquipment: number;
  linkedMaterials: number;
  linkedDestinations: number;
  linkedBranches: number;
}

const normalizeText = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toUpperCase();

const ticketTimestamp = (ticket: TicketJazida) =>
  ticket.atualizadoEm || ticket.devolvidoEm || ticket.enviadoEm || ticket.criadoEm || '';

const newestTicket = (items: TicketJazida[]) => [...items]
  .sort((left, right) => ticketTimestamp(right).localeCompare(ticketTimestamp(left)))[0];

const operationalDateTime = (ticket: TicketJazida, type: 'Liberação' | 'Recebimento') => {
  const time = type === 'Recebimento'
    ? ticket.horaChegada || ticket.horaSaida
    : ticket.horaSaida;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ticket.data) || !/^\d{1,2}:\d{2}/.test(String(time || ''))) return '';
  const normalizedTime = String(time).slice(0, 5).padStart(5, '0');
  return `${ticket.data}T${normalizedTime}:00`;
};

const buildEvent = (
  ticket: TicketJazida,
  type: TipoEventoTicket,
  occurredAt: string,
  suffix: string,
): EventoTicket | undefined => {
  if (!occurredAt) return undefined;
  return {
    id: `${ticket.id}-${suffix}`,
    tipo: type,
    ocorridoEm: occurredAt,
    responsavel: ticket.conferidoPor || ticket.nomeLegivel || ticket.responsavelLiberacao || undefined,
    origem: ticket.origemRegistro || 'Sistema',
    observacao: ticket.observacao || undefined,
  };
};

export const getTicketOperationalEvents = (ticket: TicketJazida): EventoTicket[] => {
  const type = ticket.tipoTicket || 'Liberação';
  const primary = buildEvent(ticket, type, operationalDateTime(ticket, type), type === 'Liberação' ? 'release' : 'receipt');
  const printed = buildEvent(ticket, 'Impressão', ticket.loteImpressaoCriadoEm || '', 'print');
  const returned = buildEvent(ticket, 'Devolução', ticket.devolvidoEm || '', 'return');
  const existing = ticket.eventos || [];
  const combined = [...existing, primary, printed, returned].filter((event): event is EventoTicket => Boolean(event));
  return [...new Map(combined.map(event => [`${event.tipo}|${event.ocorridoEm}`, event])).values()]
    .sort((left, right) => left.ocorridoEm.localeCompare(right.ocorridoEm));
};

const eventTimeInMinutes = (ticket: TicketJazida, type: 'Liberação' | 'Recebimento') => {
  const time = type === 'Recebimento' ? ticket.horaChegada || ticket.horaSaida : ticket.horaSaida;
  const match = String(time || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match || !/^\d{4}-\d{2}-\d{2}$/.test(ticket.data)) return null;
  const day = Date.parse(`${ticket.data}T00:00:00Z`) / 60000;
  if (!Number.isFinite(day)) return null;
  return day + Number(match[1]) * 60 + Number(match[2]);
};

export const calculateTravelDurationMinutes = (
  release?: TicketJazida,
  receipt?: TicketJazida,
) => {
  if (!release || !receipt) return null;
  const releaseMinutes = eventTimeInMinutes(release, 'Liberação');
  let receiptMinutes = eventTimeInMinutes(receipt, 'Recebimento');
  if (releaseMinutes === null || receiptMinutes === null) return null;
  if (release.data === receipt.data && receiptMinutes < releaseMinutes) receiptMinutes += 24 * 60;
  const duration = receiptMinutes - releaseMinutes;
  return duration >= 0 ? duration : null;
};

const comparePair = (release: TicketJazida, receipt: TicketJazida): TravelDivergence[] => {
  const divergences: TravelDivergence[] = [];
  const add = (
    field: TravelDivergenceField,
    label: string,
    releaseValue: string | number,
    receiptValue: string | number,
  ) => divergences.push({ field, label, releaseValue, receiptValue });

  const releaseEquipment = release.equipamentoId || normalizeText(release.prefixo);
  const receiptEquipment = receipt.equipamentoId || normalizeText(receipt.prefixo);
  if (releaseEquipment !== receiptEquipment) add('prefixo', 'Prefixo', release.prefixo, receipt.prefixo);
  if (normalizeText(release.placa) !== normalizeText(receipt.placa)) add('placa', 'Placa', release.placa, receipt.placa);

  const releaseMaterial = release.materialId || normalizeText(release.tipoMaterial);
  const receiptMaterial = receipt.materialId || normalizeText(receipt.tipoMaterial);
  if (releaseMaterial !== receiptMaterial) add('material', 'Material', release.tipoMaterial, receipt.tipoMaterial);

  if (Math.abs((Number(release.quantidadeM3) || 0) - (Number(receipt.quantidadeM3) || 0)) > 0.001) {
    add('quantidade', 'Quantidade', Number(release.quantidadeM3) || 0, Number(receipt.quantidadeM3) || 0);
  }
  return divergences;
};

const selectMasterId = (
  release: TicketJazida | undefined,
  receipt: TicketJazida | undefined,
  key: 'equipamentoId' | 'materialId' | 'localOrigemId' | 'localDestinoId' | 'ramoId',
) => receipt?.[key] || release?.[key] || undefined;

export const buildTravelOperationControl = (tickets: TicketJazida[]): TravelOperationControl => {
  const grouped = new Map<string, { releases: TicketJazida[]; receipts: TicketJazida[] }>();
  tickets.forEach(ticket => {
    const ticketNumber = normalizeTicketNumber(ticket.ticketNumero);
    if (!ticketNumber) return;
    const group = grouped.get(ticketNumber) || { releases: [], receipts: [] };
    if ((ticket.tipoTicket || 'Liberação') === 'Liberação') group.releases.push(ticket);
    else group.receipts.push(ticket);
    grouped.set(ticketNumber, group);
  });

  const operations = [...grouped.entries()].map(([ticketNumber, group]): TravelOperation => {
    const release = newestTicket(group.releases);
    const receipt = newestTicket(group.receipts);
    const divergences = release && receipt ? comparePair(release, receipt) : [];
    const duplicate = group.releases.length > 1 || group.receipts.length > 1;
    const status: TravelPairStatus = duplicate
      ? 'Ticket duplicado'
      : !release
        ? 'Sem liberação'
        : !receipt
          ? 'Sem recebimento'
          : divergences.length
            ? 'Divergência'
            : 'Conferido';
    const releaseEvent = release
      ? getTicketOperationalEvents(release).find(event => event.tipo === 'Liberação')
      : undefined;
    const receiptEvent = receipt
      ? getTicketOperationalEvents(receipt).find(event => event.tipo === 'Recebimento')
      : undefined;
    const returnEvents = [release, receipt]
      .flatMap(ticket => ticket ? getTicketOperationalEvents(ticket) : [])
      .filter(event => event.tipo === 'Devolução');

    return {
      ticketNumber,
      release,
      receipt,
      releases: group.releases,
      receipts: group.receipts,
      status,
      divergences,
      durationMinutes: calculateTravelDurationMinutes(release, receipt),
      releaseEvent,
      receiptEvent,
      returnEvents,
      printedBatchId: release?.loteImpressaoId || receipt?.loteImpressaoId,
      equipmentId: selectMasterId(release, receipt, 'equipamentoId'),
      materialId: selectMasterId(release, receipt, 'materialId'),
      originLocationId: selectMasterId(release, receipt, 'localOrigemId'),
      destinationLocationId: selectMasterId(release, receipt, 'localDestinoId'),
      branchId: selectMasterId(release, receipt, 'ramoId'),
    };
  }).sort((left, right) => right.ticketNumber.localeCompare(left.ticketNumber, 'pt-BR', { numeric: true }));

  const validDurations = operations
    .map(operation => operation.durationMinutes)
    .filter((duration): duration is number => duration !== null);
  const returnedPairs = operations.filter(operation => operation.returnEvents.length >= 2).length;

  return {
    operations,
    totalTickets: operations.length,
    completeTrips: operations.filter(operation => operation.status === 'Conferido').length,
    divergentTrips: operations.filter(operation => operation.status === 'Divergência').length,
    releasesWithoutReceipt: operations.filter(operation => operation.status === 'Sem recebimento').length,
    receiptsWithoutRelease: operations.filter(operation => operation.status === 'Sem liberação').length,
    duplicateTickets: operations.filter(operation => operation.status === 'Ticket duplicado').length,
    returnedPairs,
    averageDurationMinutes: validDurations.length
      ? Math.round(validDurations.reduce((sum, duration) => sum + duration, 0) / validDurations.length)
      : null,
    linkedEquipment: operations.filter(operation => operation.equipmentId).length,
    linkedMaterials: operations.filter(operation => operation.materialId).length,
    linkedDestinations: operations.filter(operation => operation.destinationLocationId).length,
    linkedBranches: operations.filter(operation => operation.branchId).length,
  };
};

export const formatTravelDuration = (minutes: number | null) => {
  if (minutes === null) return '—';
  const days = Math.floor(minutes / (24 * 60));
  const remaining = minutes % (24 * 60);
  const hours = Math.floor(remaining / 60);
  const mins = remaining % 60;
  return [days ? `${days}d` : '', hours ? `${hours}h` : '', `${mins}min`].filter(Boolean).join(' ');
};
