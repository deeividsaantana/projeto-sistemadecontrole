import type { ControleEquipamentoDiario } from '../types';
import {
  type FleetDataContext,
  type FleetImportApplication,
  type FleetImportPreview,
  type FleetImportPreviewRow,
  type FleetImportRawRow,
  type FleetPersistedRecord,
} from './domain';
import {
  normalizeComparable,
  normalizeEmployeeCode,
  normalizePrefix,
  operationalRowKey,
} from '../utils/canonicalIdentity';
import { reconcileEmployee, reconcileEquipment } from './reconciliation';
import { normalizeOperationalStatus, toLegacyDailyStatus } from './status';
import {
  getOperationalNowIso,
  normalizeIsoDate,
  normalizeOperationalTime,
} from './time';

const asText = (value: unknown): string => String(value ?? '').trim();

export const createFleetOperationalKey = (input: {
  date: string;
  equipmentId?: string;
  prefix?: string;
}): string => [
  input.date,
  input.equipmentId || normalizePrefix(input.prefix),
].join('|');

const recordsEqualForImport = (
  left: ControleEquipamentoDiario,
  right: ControleEquipamentoDiario,
): boolean => {
  const comparable = (record: ControleEquipamentoDiario) => ({
    data: record.data,
    funcionarioId: record.funcionarioId,
    codigoFuncionario: normalizeEmployeeCode(record.codigoFuncionario),
    nomeMotorista: normalizeComparable(record.nomeMotorista),
    equipamentoId: record.equipamentoId,
    prefixo: normalizePrefix(record.prefixo),
    familia: normalizeComparable(record.familia),
    status: normalizeOperationalStatus(record.status),
    horaSaida: normalizeOperationalTime(record.horaSaida),
    horaEntradaManutencao: normalizeOperationalTime(record.horaEntradaManutencao),
    horaLiberacao: normalizeOperationalTime(record.horaLiberacao),
    motivoManutencao: normalizeComparable(record.motivoManutencao),
    observacao: normalizeComparable(record.observacao),
  });
  return JSON.stringify(comparable(left)) === JSON.stringify(comparable(right));
};

const mapRawRow = (
  raw: FleetImportRawRow,
  context: FleetDataContext,
  nowIso: string,
): { record?: ControleEquipamentoDiario; messages: string[] } => {
  const messages: string[] = [];
  const date = normalizeIsoDate(raw.date);
  if (!date) messages.push('Data inválida ou não informada.');
  const equipmentResult = reconcileEquipment({
    prefix: asText(raw.prefix),
    plate: asText(raw.plate),
  }, context.equipment);
  messages.push(...equipmentResult.warnings);
  const employeeResult = reconcileEmployee({
    employeeCode: asText(raw.employeeCode),
    employeeName: asText(raw.employeeName),
  }, context.employees);
  if (asText(raw.employeeCode) || asText(raw.employeeName)) {
    messages.push(...employeeResult.warnings);
  }
  const prefix = equipmentResult.value?.prefixo || asText(raw.prefix);
  if (!normalizePrefix(prefix)) messages.push('Prefixo inválido ou não informado.');
  if (!date || !normalizePrefix(prefix)) return { messages: [...new Set(messages)] };
  const status = normalizeOperationalStatus(raw.status);
  const operationalKey = createFleetOperationalKey({
    date,
    equipmentId: equipmentResult.value?.id,
    prefix,
  });
  const rowIdentity = operationalRowKey({
    date,
    prefix,
    employeeCode: asText(raw.employeeCode),
    time: normalizeOperationalTime(raw.departureTime)
      || normalizeOperationalTime(raw.maintenanceEntryTime),
    type: status,
  });
  const record: FleetPersistedRecord = {
    id: `fleet-import-${rowIdentity || `${raw.rowNumber}-${Date.now()}`}`,
    chave: operationalKey,
    data: date,
    funcionarioId: employeeResult.value?.id || '',
    codigoFuncionario: employeeResult.value?.matricula || asText(raw.employeeCode),
    nomeMotorista: employeeResult.value?.nome || asText(raw.employeeName),
    equipamentoId: equipmentResult.value?.id || '',
    prefixo: prefix,
    familia: equipmentResult.value?.familia
      || equipmentResult.value?.tipo
      || 'Caminhão Basculante',
    status: toLegacyDailyStatus(status),
    horaSaida: normalizeOperationalTime(raw.departureTime),
    horaEntradaManutencao: normalizeOperationalTime(raw.maintenanceEntryTime),
    horaLiberacao: normalizeOperationalTime(raw.releaseTime),
    motivoManutencao: asText(raw.maintenanceReason),
    observacao: asText(raw.note),
    local: asText(raw.location),
    origem: 'PLANILHA',
    revisao: [...new Set(messages)],
    criadoEm: nowIso,
    atualizadoEm: nowIso,
    motoristaTemporario: !employeeResult.value
      && Boolean(asText(raw.employeeCode) || asText(raw.employeeName)),
  };
  return { record, messages: [...new Set(messages)] };
};

export const previewFleetImport = (
  rawRows: FleetImportRawRow[],
  context: FleetDataContext,
  now = new Date(),
): FleetImportPreview => {
  const nowIso = now.toISOString();
  const seen = new Set<string>();
  const rows: FleetImportPreviewRow[] = rawRows.map(raw => {
    const mapped = mapRawRow(raw, context, nowIso);
    if (!mapped.record) {
      return {
        rowNumber: raw.rowNumber,
        disposition: mapped.messages.length ? 'ERROR' : 'IGNORED',
        key: '',
        messages: mapped.messages.length ? mapped.messages : ['Linha vazia ignorada.'],
        raw,
      };
    }
    const key = mapped.record.chave;
    if (seen.has(key)) {
      return {
        rowNumber: raw.rowNumber,
        disposition: 'DUPLICATE',
        key,
        record: mapped.record,
        messages: [...mapped.messages, 'Chave repetida no mesmo arquivo.'],
        raw,
      };
    }
    seen.add(key);
    const existing = context.records.find(record =>
      record.chave === key
      || createFleetOperationalKey({
        date: record.data,
        equipmentId: record.equipamentoId,
        prefix: record.prefixo,
      }) === key);
    if (!existing) {
      return {
        rowNumber: raw.rowNumber,
        disposition: 'NEW',
        key,
        record: mapped.record,
        messages: mapped.messages,
        raw,
      };
    }
    if (recordsEqualForImport(existing, mapped.record)) {
      return {
        rowNumber: raw.rowNumber,
        disposition: 'DUPLICATE',
        key,
        record: mapped.record,
        existingRecordId: existing.id,
        messages: [...mapped.messages, 'Registro já existente sem alterações.'],
        raw,
      };
    }
    return {
      rowNumber: raw.rowNumber,
      disposition: 'UPDATE',
      key,
      record: { ...mapped.record, id: existing.id, criadoEm: existing.criadoEm },
      existingRecordId: existing.id,
      messages: mapped.messages,
      raw,
    };
  });
  const count = (disposition: FleetImportPreviewRow['disposition']) =>
    rows.filter(row => row.disposition === disposition).length;
  return {
    generatedAt: nowIso,
    rows,
    newCount: count('NEW'),
    updateCount: count('UPDATE'),
    duplicateCount: count('DUPLICATE'),
    ignoredCount: count('IGNORED'),
    errorCount: count('ERROR'),
    canApply: rows.some(row => row.disposition === 'NEW' || row.disposition === 'UPDATE'),
  };
};

export const applyFleetImport = (
  current: ControleEquipamentoDiario[],
  preview: FleetImportPreview,
  now = new Date(),
): FleetImportApplication => {
  const next = [...current];
  let created = 0;
  let updated = 0;
  preview.rows.forEach(row => {
    if (!row.record) return;
    if (row.disposition === 'NEW') {
      next.push({ ...row.record });
      created += 1;
      return;
    }
    if (row.disposition === 'UPDATE') {
      const index = next.findIndex(record =>
        record.id === row.existingRecordId || record.chave === row.key);
      if (index >= 0) {
        next[index] = {
          ...row.record,
          id: next[index].id,
          criadoEm: next[index].criadoEm,
          atualizadoEm: now.toISOString(),
        };
        updated += 1;
      }
    }
  });
  return {
    next,
    created,
    updated,
    duplicates: preview.duplicateCount,
    ignored: preview.ignoredCount,
    errors: preview.errorCount,
    appliedAt: getOperationalNowIso(),
  };
};

export const buildFleetImportFeedback = (
  result: Pick<
    FleetImportApplication,
    'created' | 'updated' | 'duplicates' | 'ignored' | 'errors'
  >,
): string => [
  'Importação concluída',
  `${result.created} novo(s)`,
  `${result.updated} atualizado(s)`,
  `${result.duplicates} já existente(s)`,
  `${result.ignored} ignorado(s)`,
  `${result.errors} rejeitado(s)`,
].join(' · ');
