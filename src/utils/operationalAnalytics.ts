import {
  Abastecimento,
  Comboio,
  Empresa,
  Equipamento,
  TicketJazida,
  TipoCombustivel,
  TipoTicketJazida,
} from '../types';
import { getTicketControlDate, isTicketReturned } from './jazidaDailyControl';
import { normalizeTicketNumber } from './ticketNumberSequence';
import { getOperationalFuelLiters } from './fuelAnalyticsSafety';

export type FuelAnalyticsFilters = {
  startDate?: string;
  endDate?: string;
  companyId?: string;
  equipmentId?: string;
  comboioId?: string;
  fuelTypeId?: string;
  search?: string;
};

export type FuelDetailRow = {
  id: string;
  date: string;
  time: string;
  prefix: string;
  equipment: string;
  company: string;
  comboio: string;
  fuel: string;
  liters: number;
  pumpInitial: number;
  pumpFinal: number;
  pumpDifference: number;
  status: string;
  origin: string;
  responsible: string;
  warnings: string[];
  includedInMetrics: boolean;
  original: Abastecimento;
};

export type FuelAggregateRow = {
  id: string;
  name: string;
  detail?: string;
  liters: number;
  records: number;
  average: number;
  percentage: number;
  warningCount: number;
  lastDate: string;
};

export type FuelAnalytics = {
  details: FuelDetailRow[];
  totalLiters: number;
  totalRecords: number;
  averageLiters: number;
  activeFleets: number;
  activeCompanies: number;
  warningRecords: number;
  excludedRecords: number;
  unknownFleets: number;
  pumpDivergences: number;
  duplicateRecords: number;
  qualityPercentage: number;
  previousLiters: number;
  variationPercentage: number | null;
  daily: Array<{ date: string; label: string; liters: number; records: number; warnings: number }>;
  companies: FuelAggregateRow[];
  fleets: FuelAggregateRow[];
  comboios: FuelAggregateRow[];
  fuels: FuelAggregateRow[];
  peakDay?: { date: string; label: string; liters: number; records: number; warnings: number };
};

export type JazidaAnalyticsFilters = {
  startDate?: string;
  endDate?: string;
  company?: string;
  material?: string;
  destination?: string;
  search?: string;
};

export type JazidaDetailRow = {
  id: string;
  date: string;
  number: string;
  createdAt: string;
  release?: TicketJazida;
  receipt?: TicketJazida;
  releaseReturned: boolean;
  receiptReturned: boolean;
  releaseReturnedAt: string;
  receiptReturnedAt: string;
  prefix: string;
  plate: string;
  equipment: string;
  company: string;
  material: string;
  destination: string;
  volume: number;
  unit: string;
  invoice: string;
  duplicateCount: number;
  issues: string[];
};

export type JazidaAggregateRow = {
  name: string;
  tickets: number;
  volume: number;
  complete: number;
  pending: number;
  percentage: number;
};

export type JazidaAnalytics = {
  details: JazidaDetailRow[];
  totalTickets: number;
  releaseReturned: number;
  receiptReturned: number;
  completePairs: number;
  pendingRelease: number;
  pendingReceipt: number;
  pendingAny: number;
  totalVolume: number;
  conferencePercentage: number;
  duplicateTickets: number;
  incompleteRecords: number;
  qualityPercentage: number;
  daily: Array<{
    date: string;
    label: string;
    tickets: number;
    release: number;
    receipt: number;
    complete: number;
    pending: number;
    volume: number;
  }>;
  companies: JazidaAggregateRow[];
  materials: JazidaAggregateRow[];
  destinations: JazidaAggregateRow[];
};

const normalizeSearch = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

const formatShortDate = (date: string) => {
  const [year, month, day] = date.split('-');
  return year && month && day ? `${day}/${month}` : date;
};

const inRange = (date: string, startDate?: string, endDate?: string) =>
  Boolean(date) && (!startDate || date >= startDate) && (!endDate || date <= endDate);

const safeNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getPreviousPeriod = (startDate?: string, endDate?: string) => {
  if (!startDate || !endDate) return null;
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return null;
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const previousEnd = new Date(start.getTime() - 86_400_000);
  const previousStart = new Date(previousEnd.getTime() - (days - 1) * 86_400_000);
  const toIso = (date: Date) => date.toISOString().slice(0, 10);
  return { startDate: toIso(previousStart), endDate: toIso(previousEnd) };
};

const buildDuplicateFuelIds = (records: Abastecimento[]) => {
  const bySignature = new Map<string, string[]>();
  records.forEach(record => {
    const signature = record.integracaoOrigemId
      ? `integracao:${normalizeSearch(record.integracaoOrigemId)}`
      : [
        record.data,
        record.hora,
        normalizeSearch(record.equipamentoId || record.prefixoInformado),
        safeNumber(record.quantidadeLitros).toFixed(3),
        safeNumber(record.bombaInicial).toFixed(3),
        safeNumber(record.bombaFinal).toFixed(3),
      ].join('|');
    const ids = bySignature.get(signature) || [];
    ids.push(record.id);
    bySignature.set(signature, ids);
  });
  return new Set(Array.from(bySignature.values()).filter(ids => ids.length > 1).flat());
};

const aggregateFuelRows = (
  details: FuelDetailRow[],
  keyFor: (row: FuelDetailRow) => { id: string; name: string; detail?: string },
  totalLiters: number,
) => {
  const grouped = new Map<string, FuelAggregateRow>();
  details.filter(row => row.includedInMetrics).forEach(row => {
    const key = keyFor(row);
    const current = grouped.get(key.id) || {
      ...key,
      liters: 0,
      records: 0,
      average: 0,
      percentage: 0,
      warningCount: 0,
      lastDate: '',
    };
    current.liters += row.liters;
    current.records += 1;
    if (row.warnings.length) current.warningCount += 1;
    if (!current.lastDate || row.date > current.lastDate) current.lastDate = row.date;
    grouped.set(key.id, current);
  });
  return Array.from(grouped.values())
    .map(row => ({
      ...row,
      average: row.records ? row.liters / row.records : 0,
      percentage: totalLiters ? (row.liters / totalLiters) * 100 : 0,
    }))
    .sort((a, b) => b.liters - a.liters || a.name.localeCompare(b.name, 'pt-BR'));
};

export const buildFuelAnalytics = ({
  abastecimentos,
  equipamentos,
  empresas,
  comboios,
  combustiveis,
  filters = {},
}: {
  abastecimentos: Abastecimento[];
  equipamentos: Equipamento[];
  empresas: Empresa[];
  comboios: Comboio[];
  combustiveis: TipoCombustivel[];
  filters?: FuelAnalyticsFilters;
}): FuelAnalytics => {
  const equipmentMap = new Map(equipamentos.map(item => [item.id, item]));
  const companyMap = new Map(empresas.map(item => [item.id, item]));
  const comboioMap = new Map(comboios.map(item => [item.id, item]));
  const fuelMap = new Map(combustiveis.map(item => [item.id, item]));
  const duplicateIds = buildDuplicateFuelIds(abastecimentos);
  const search = normalizeSearch(filters.search);

  const matchesNonDateFilters = (record: Abastecimento) => {
    const equipment = equipmentMap.get(record.equipamentoId);
    const company = equipment ? companyMap.get(equipment.empresaId) : undefined;
    if (filters.companyId && equipment?.empresaId !== filters.companyId) return false;
    if (filters.equipmentId && record.equipamentoId !== filters.equipmentId) return false;
    if (filters.comboioId && record.comboioId !== filters.comboioId) return false;
    if (filters.fuelTypeId && record.tipoCombustivelId !== filters.fuelTypeId) return false;
    if (search) {
      const haystack = normalizeSearch([
        equipment?.prefixo,
        record.prefixoInformado,
        equipment?.nome,
        equipment?.placa,
        equipment?.seriePlaca,
        company?.nome,
        comboioMap.get(record.comboioId)?.nome,
        record.responsavel,
        record.observacao,
      ].filter(Boolean).join(' '));
      if (!haystack.includes(search)) return false;
    }
    return true;
  };

  const details = abastecimentos
    .filter(record => inRange(record.data, filters.startDate, filters.endDate) && matchesNonDateFilters(record))
    .map(record => {
      const equipment = equipmentMap.get(record.equipamentoId);
      const company = equipment ? companyMap.get(equipment.empresaId) : undefined;
      const pumpDifference = Math.abs(
        (safeNumber(record.bombaFinal) - safeNumber(record.bombaInicial)) - safeNumber(record.quantidadeLitros),
      );
      const warnings = new Set<string>();
      const operationalLiters = getOperationalFuelLiters(record);
      if (!equipment) warnings.add('Frota sem cadastro');
      if (!record.quantidadeLitros || safeNumber(record.quantidadeLitros) <= 0) warnings.add('Quantidade inválida');
      if (operationalLiters === null) {
        const source = [record.origem, record.integracaoArquivo || record.documentoOrigemNome, record.integracaoLinha ? `linha ${record.integracaoLinha}` : ''].filter(Boolean).join(' · ');
        warnings.add(`INVÁLIDO / NECESSITA REVISÃO: volume "${String(record.quantidadeLitros ?? '')}" excluído dos indicadores${source ? ` (${source})` : ''}`);
      }
      if (pumpDifference > 0.05) warnings.add('Diferença entre bomba e litros');
      if (record.status && record.status !== 'OK') warnings.add(record.status);
      if (duplicateIds.has(record.id) || record.status === 'Duplicado') warnings.add('Possível duplicidade');
      (record.alertas || []).forEach(alert => {
        if (alert.severidade !== 'info') warnings.add(alert.mensagem || alert.codigo);
      });
      return {
        id: record.id,
        date: record.data,
        time: record.hora || '',
        prefix: equipment?.prefixo || record.prefixoInformado || 'Sem prefixo',
        equipment: equipment?.nome || 'Pendente de cadastro',
        company: company?.nome || 'Sem cadastro',
        comboio: comboioMap.get(record.comboioId)?.nome || 'Não informado',
        fuel: fuelMap.get(record.tipoCombustivelId)?.nome || 'Não informado',
        liters: operationalLiters ?? safeNumber(record.quantidadeLitros),
        pumpInitial: safeNumber(record.bombaInicial),
        pumpFinal: safeNumber(record.bombaFinal),
        pumpDifference,
        status: record.status || 'OK',
        origin: record.origem || 'Manual',
        responsible: record.responsavel || 'Não informado',
        warnings: Array.from(warnings),
        includedInMetrics: operationalLiters !== null,
        original: record,
      } satisfies FuelDetailRow;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time) || a.prefix.localeCompare(b.prefix, 'pt-BR'));

  const metricDetails = details.filter(row => row.includedInMetrics);
  const totalLiters = metricDetails.reduce((sum, row) => sum + row.liters, 0);
  const fleetIds = new Set(metricDetails.map(row => row.prefix));
  const companies = aggregateFuelRows(details, row => ({ id: row.company, name: row.company }), totalLiters);
  const fleets = aggregateFuelRows(details, row => ({
    id: row.prefix,
    name: row.prefix,
    detail: `${row.equipment} • ${row.company}`,
  }), totalLiters);
  const comboioRows = aggregateFuelRows(details, row => ({ id: row.comboio, name: row.comboio }), totalLiters);
  const fuelRows = aggregateFuelRows(details, row => ({ id: row.fuel, name: row.fuel }), totalLiters);

  const dailyMap = new Map<string, { date: string; label: string; liters: number; records: number; warnings: number }>();
  metricDetails.forEach(row => {
    const current = dailyMap.get(row.date) || {
      date: row.date,
      label: formatShortDate(row.date),
      liters: 0,
      records: 0,
      warnings: 0,
    };
    current.liters += row.liters;
    current.records += 1;
    if (row.warnings.length) current.warnings += 1;
    dailyMap.set(row.date, current);
  });
  const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const peakDay = [...daily].sort((a, b) => b.liters - a.liters)[0];
  const previousPeriod = getPreviousPeriod(filters.startDate, filters.endDate);
  const previousLiters = previousPeriod
    ? abastecimentos
      .filter(record => inRange(record.data, previousPeriod.startDate, previousPeriod.endDate) && matchesNonDateFilters(record))
      .reduce((sum, record) => sum + (getOperationalFuelLiters(record) || 0), 0)
    : 0;
  const variationPercentage = previousPeriod
    ? previousLiters > 0
      ? ((totalLiters - previousLiters) / previousLiters) * 100
      : totalLiters > 0 ? 100 : 0
    : null;
  const warningRecords = details.filter(row => row.warnings.length > 0).length;
  const excludedRecords = details.filter(row => !row.includedInMetrics).length;

  return {
    details,
    totalLiters,
    totalRecords: details.length,
    averageLiters: metricDetails.length ? totalLiters / metricDetails.length : 0,
    activeFleets: fleetIds.size,
    activeCompanies: companies.length,
    warningRecords,
    excludedRecords,
    unknownFleets: details.filter(row => row.warnings.includes('Frota sem cadastro')).length,
    pumpDivergences: details.filter(row => row.warnings.includes('Diferença entre bomba e litros')).length,
    duplicateRecords: details.filter(row => row.warnings.includes('Possível duplicidade')).length,
    qualityPercentage: details.length ? Math.round(((details.length - warningRecords) / details.length) * 100) : 0,
    previousLiters,
    variationPercentage,
    daily,
    companies,
    fleets,
    comboios: comboioRows,
    fuels: fuelRows,
    peakDay,
  };
};

const ticketEventTime = (ticket?: TicketJazida) => {
  if (!ticket || !isTicketReturned(ticket)) return '';
  return ticket.devolvidoEm || ticket.enviadoEm || ticket.atualizadoEm || ticket.criadoEm || '';
};

const pickLatestTicket = (tickets: TicketJazida[]) => [...tickets].sort((a, b) => {
  if (isTicketReturned(a) !== isTicketReturned(b)) return isTicketReturned(a) ? -1 : 1;
  const dateA = a.atualizadoEm || a.devolvidoEm || a.enviadoEm || a.criadoEm || '';
  const dateB = b.atualizadoEm || b.devolvidoEm || b.enviadoEm || b.criadoEm || '';
  return dateB.localeCompare(dateA);
})[0];

const aggregateJazida = (details: JazidaDetailRow[], keyFor: (row: JazidaDetailRow) => string) => {
  const grouped = new Map<string, JazidaAggregateRow>();
  details.forEach(row => {
    const key = keyFor(row) || 'Não informado';
    const current = grouped.get(key) || { name: key, tickets: 0, volume: 0, complete: 0, pending: 0, percentage: 0 };
    current.tickets += 1;
    current.volume += row.volume;
    if (row.releaseReturned && row.receiptReturned) current.complete += 1;
    else current.pending += 1;
    grouped.set(key, current);
  });
  return Array.from(grouped.values())
    .map(row => ({ ...row, percentage: row.tickets ? (row.tickets / details.length) * 100 : 0 }))
    .sort((a, b) => b.tickets - a.tickets || b.volume - a.volume || a.name.localeCompare(b.name, 'pt-BR'));
};

export const buildJazidaAnalytics = ({
  tickets,
  filters = {},
}: {
  tickets: TicketJazida[];
  filters?: JazidaAnalyticsFilters;
}): JazidaAnalytics => {
  const grouped = new Map<string, TicketJazida[]>();
  tickets.forEach(ticket => {
    const date = getTicketControlDate(ticket);
    const number = normalizeTicketNumber(ticket.ticketNumero);
    if (!date || !number || !inRange(date, filters.startDate, filters.endDate)) return;
    const key = `${date}:${number}`;
    const current = grouped.get(key) || [];
    current.push(ticket);
    grouped.set(key, current);
  });

  const search = normalizeSearch(filters.search);
  const details = Array.from(grouped.entries()).map(([id, groupedTickets]) => {
    const releaseCandidates = groupedTickets.filter(ticket => (ticket.tipoTicket || 'Liberação') === 'Liberação');
    const receiptCandidates = groupedTickets.filter(ticket => ticket.tipoTicket === 'Recebimento');
    const release = pickLatestTicket(releaseCandidates);
    const receipt = pickLatestTicket(receiptCandidates);
    const base = receipt || release || groupedTickets[0];
    const date = getTicketControlDate(base);
    const number = normalizeTicketNumber(base.ticketNumero);
    const issues = new Set<string>();
    if (!release) issues.add('Via de liberação não cadastrada');
    if (!receipt) issues.add('Via de recebimento não cadastrada');
    if (releaseCandidates.length > 1 || receiptCandidates.length > 1) issues.add('Número duplicado na mesma via');
    if (!base.prefixo) issues.add('Prefixo não informado');
    if (!base.placa) issues.add('Placa não informada');
    if (!base.tipoMaterial) issues.add('Material não informado');
    if (!base.destinoObra) issues.add('Destino não informado');
    const duplicateCount = Math.max(0, releaseCandidates.length - 1) + Math.max(0, receiptCandidates.length - 1);
    const releaseReturned = isTicketReturned(release);
    const receiptReturned = isTicketReturned(receipt);
    return {
      id,
      date,
      number,
      createdAt: base.loteImpressaoCriadoEm || base.criadoEm || base.data || '',
      release,
      receipt,
      releaseReturned,
      receiptReturned,
      releaseReturnedAt: ticketEventTime(release),
      receiptReturnedAt: ticketEventTime(receipt),
      prefix: base.prefixo || 'Não informado',
      plate: base.placa || 'Não informada',
      equipment: base.equipamentoNome || base.familiaEquipamento || 'Não informado',
      company: base.empresa || 'Não informada',
      material: base.tipoMaterial || 'Não informado',
      destination: base.destinoOutro || base.destinoObra || 'Não informado',
      volume: safeNumber(base.quantidadeM3),
      unit: base.unidadeQuantidade || 'm³',
      invoice: base.notaFiscalNumero || 'Não lançada',
      duplicateCount,
      issues: Array.from(issues),
    } satisfies JazidaDetailRow;
  }).filter(row => {
    if (filters.company && row.company !== filters.company) return false;
    if (filters.material && row.material !== filters.material) return false;
    if (filters.destination && row.destination !== filters.destination) return false;
    if (search) {
      const haystack = normalizeSearch([
        row.number,
        row.prefix,
        row.plate,
        row.equipment,
        row.company,
        row.material,
        row.destination,
        row.invoice,
      ].join(' '));
      if (!haystack.includes(search)) return false;
    }
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number, 'pt-BR', { numeric: true }));

  const dailyMap = new Map<string, JazidaAnalytics['daily'][number]>();
  details.forEach(row => {
    const current = dailyMap.get(row.date) || {
      date: row.date,
      label: formatShortDate(row.date),
      tickets: 0,
      release: 0,
      receipt: 0,
      complete: 0,
      pending: 0,
      volume: 0,
    };
    current.tickets += 1;
    if (row.releaseReturned) current.release += 1;
    if (row.receiptReturned) current.receipt += 1;
    if (row.releaseReturned && row.receiptReturned) current.complete += 1;
    else current.pending += 1;
    current.volume += row.volume;
    dailyMap.set(row.date, current);
  });
  const releaseReturned = details.filter(row => row.releaseReturned).length;
  const receiptReturned = details.filter(row => row.receiptReturned).length;
  const completePairs = details.filter(row => row.releaseReturned && row.receiptReturned).length;
  const incompleteRecords = details.filter(row => row.issues.some(issue => !issue.includes('duplicado'))).length;
  const duplicateTickets = details.filter(row => row.duplicateCount > 0).length;
  const qualityIssues = details.filter(row => row.issues.length > 0).length;

  return {
    details,
    totalTickets: details.length,
    releaseReturned,
    receiptReturned,
    completePairs,
    pendingRelease: details.filter(row => !row.releaseReturned).length,
    pendingReceipt: details.filter(row => !row.receiptReturned).length,
    pendingAny: details.length - completePairs,
    totalVolume: details.reduce((sum, row) => sum + row.volume, 0),
    conferencePercentage: details.length ? Math.round(((releaseReturned + receiptReturned) / (details.length * 2)) * 100) : 0,
    duplicateTickets,
    incompleteRecords,
    qualityPercentage: details.length ? Math.round(((details.length - qualityIssues) / details.length) * 100) : 0,
    daily: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    companies: aggregateJazida(details, row => row.company),
    materials: aggregateJazida(details, row => row.material),
    destinations: aggregateJazida(details, row => row.destination),
  };
};

