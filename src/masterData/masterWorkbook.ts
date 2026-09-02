import type ExcelJS from 'exceljs';
import type {
  Empresa,
  Equipamento,
  Funcionario,
  ObraLocal,
} from '../types';
import { loadValidatedWorkbook } from '../utils/excelCorporate';
import {
  inferFleetCategory,
  normalizeAvailabilityTarget,
} from '../utils/equipmentOperations';
import type { MasterDataReviewEntity } from '../services/masterDataApi';

export type MasterDataReviewStatus = 'ready' | 'matched' | 'duplicate' | 'invalid';

export interface MasterWorkbookSourceRow {
  sheetName: string;
  rowNumber: number;
  raw: Record<string, string>;
}

export interface MasterWorkbookReviewRow extends MasterWorkbookSourceRow {
  entity: MasterDataReviewEntity;
  canonicalKey: string;
  displayValue: string;
  normalized: Record<string, unknown>;
  aliases: string[];
  candidateRecordIds: string[];
  status: MasterDataReviewStatus;
  issues: string[];
  reviewNote: string;
}

export interface MasterWorkbookEntitySummary {
  entity: MasterDataReviewEntity;
  sheetName: string;
  totalRows: number;
  readyRows: number;
  matchedRows: number;
  duplicateRows: number;
  invalidRows: number;
}

export interface MasterWorkbookDeferredSheet {
  sheetName: string;
  rowCount: number;
  reason: string;
}

export interface MasterWorkbookAnalysis {
  sourceName: string;
  rows: MasterWorkbookReviewRow[];
  summaries: MasterWorkbookEntitySummary[];
  deferredSheets: MasterWorkbookDeferredSheet[];
  totalMasterRows: number;
  totalDeferredRows: number;
}

export type ExistingMasterIndex = Record<MasterDataReviewEntity, Map<string, string[]>>;

const MASTER_SHEETS: Record<string, { entity: MasterDataReviewEntity; label: string }> = {
  CAD_EMPRESAS: { entity: 'companies', label: 'Empresas' },
  CAD_FORNECEDORES: { entity: 'suppliers', label: 'Fornecedores' },
  CAD_LOCAIS: { entity: 'locations', label: 'Locais' },
  CAD_COLABORADORES: { entity: 'collaborators', label: 'Colaboradores' },
  CAD_EQUIPAMENTOS: { entity: 'equipment', label: 'Equipamentos' },
  CAD_VEICULOS: { entity: 'vehicles', label: 'Veículos' },
  SGE: { entity: 'equipment', label: 'Equipamentos SGE' },
};

export const MASTER_DATA_REVIEW_ENTITIES = Object.freeze(
  Array.from(new Set(Object.values(MASTER_SHEETS).map(item => item.entity))),
);

export const MASTER_DATA_ENTITY_LABELS: Record<MasterDataReviewEntity, string> = {
  companies: 'Empresas',
  suppliers: 'Fornecedores',
  locations: 'Locais',
  collaborators: 'Colaboradores',
  equipment: 'Equipamentos',
  vehicles: 'Veículos',
};

export const normalizeMasterText = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const normalizedDigits = (value: unknown) => String(value ?? '').replace(/\D/g, '');

const normalizeHeader = (value: string) => normalizeMasterText(value).replace(/\s+/g, '');

const getValue = (raw: Record<string, string>, aliases: string[]) => {
  const normalizedAliases = aliases.map(normalizeHeader);
  const entry = Object.entries(raw).find(([header]) => normalizedAliases.includes(normalizeHeader(header)));
  return String(entry?.[1] ?? '').trim();
};

const activeFromStatus = (value: string) => {
  const normalized = normalizeMasterText(value);
  return !normalized.includes('inativo') && !normalized.includes('desmobilizado');
};

const booleanFromSource = (value: string) => {
  const normalized = normalizeMasterText(value);
  return ['sim', 'true', '1', 'ativo', 'mobilizado'].includes(normalized);
};

const positiveNumberFromSource = (value: string) => {
  if (!value) return null;
  const cleaned = value.replace(/[^\d,.-]/g, '');
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const fleetKind = (category: ReturnType<typeof inferFleetCategory>) => {
  if (category === 'Veículo') return 'vehicle';
  if (category === 'Implemento') return 'implement';
  return 'equipment';
};

const companyRow = (source: MasterWorkbookSourceRow) => {
  const legacyId = getValue(source.raw, ['ID Empresa']);
  const name = getValue(source.raw, ['Nome']);
  const taxId = getValue(source.raw, ['CNPJ']);
  const companyType = getValue(source.raw, ['Tipo(s)', 'Tipo']);
  const status = getValue(source.raw, ['Status']);
  return {
    displayValue: name || taxId || legacyId,
    canonicalKey: normalizedDigits(taxId) || normalizeMasterText(name),
    normalized: {
      legacy_id: legacyId || null,
      name: name || null,
      tax_id: taxId || null,
      company_type_text: companyType || null,
      active: activeFromStatus(status),
      source_status: status || null,
    },
    issues: [
      ...(!name ? ['Nome da empresa não informado.'] : []),
      ...(!taxId ? ['CNPJ ausente; a conferência usará o nome.'] : []),
    ],
  };
};

const supplierRow = (source: MasterWorkbookSourceRow) => {
  const legacyId = getValue(source.raw, ['ID Fornecedor']);
  const name = getValue(source.raw, ['Fornecedor']);
  const taxId = getValue(source.raw, ['CNPJ']);
  const status = getValue(source.raw, ['Status']);
  return {
    displayValue: name || taxId || legacyId,
    canonicalKey: normalizedDigits(taxId) || normalizeMasterText(name),
    normalized: {
      legacy_id: legacyId || null,
      company_name: name || null,
      tax_id: taxId || null,
      active: activeFromStatus(status),
      source_status: status || null,
    },
    issues: [
      ...(!name ? ['Fornecedor não informado.'] : []),
      ...(!taxId ? ['CNPJ ausente; será necessário vincular o fornecedor a uma empresa por nome.'] : []),
    ],
  };
};

const locationRow = (source: MasterWorkbookSourceRow) => {
  const legacyId = getValue(source.raw, ['ID Local']);
  const name = getValue(source.raw, ['Local']);
  const status = getValue(source.raw, ['Status']);
  return {
    displayValue: name || legacyId,
    canonicalKey: normalizeMasterText(name),
    normalized: {
      legacy_id: legacyId || null,
      name: name || null,
      status: status || 'Ativa',
      active: activeFromStatus(status),
      metadata: {
        locationType: getValue(source.raw, ['Tipo']) || null,
      },
    },
    issues: !name ? ['Local não informado.'] : [],
  };
};

const collaboratorRow = (source: MasterWorkbookSourceRow) => {
  const legacyId = getValue(source.raw, ['ID Mestre']);
  const registration = getValue(source.raw, ['Matrícula', 'Matricula']);
  const name = getValue(source.raw, ['Colaborador', 'Nome']);
  const status = getValue(source.raw, ['Status']);
  return {
    displayValue: name || registration || legacyId,
    canonicalKey: normalizeMasterText(registration) || normalizeMasterText(name),
    normalized: {
      legacy_id: legacyId || null,
      registration: registration || null,
      name: name || null,
      job_title: getValue(source.raw, ['Função', 'Funcao']) || null,
      company_name: getValue(source.raw, ['Empresa']) || null,
      leader_registration: getValue(source.raw, ['Matrícula líder', 'Matricula lider']) || null,
      leader_name: getValue(source.raw, ['Nome líder', 'Nome lider']) || null,
      area: getValue(source.raw, ['Área', 'Area']) || null,
      area_responsible: getValue(source.raw, ['Responsável', 'Responsavel']) || null,
      active: activeFromStatus(status),
      metadata: {
        division: getValue(source.raw, ['Divisão', 'Divisao']) || null,
        section: getValue(source.raw, ['Seção', 'Secao']) || null,
        mobilizationDate: getValue(source.raw, ['Data mobilização', 'Data mobilizacao']) || null,
        demobilizationDate: getValue(source.raw, ['Data desmobilização', 'Data desmobilizacao']) || null,
        hrStatus: getValue(source.raw, ['Situação RH', 'Situacao RH']) || null,
        notes: getValue(source.raw, ['Observação', 'Observacao']) || null,
      },
    },
    issues: [
      ...(!name ? ['Nome do colaborador não informado.'] : []),
      ...(!registration ? ['Matrícula ausente; a conferência usará o nome.'] : []),
    ],
  };
};

const equipmentRow = (source: MasterWorkbookSourceRow) => {
  const legacyId = getValue(source.raw, ['ID Mestre']);
  const prefix = getValue(source.raw, ['Prefixo', 'Frota', 'Nº Frota', 'N° Frota']);
  const licensePlate = getValue(source.raw, ['Placa']);
  const name = getValue(source.raw, ['Equipamento', 'Descrição', 'Descricao']);
  const family = getValue(source.raw, ['Família', 'Familia']);
  const status = getValue(source.raw, ['Status']);
  const externalCode = getValue(source.raw, ['Código SGE', 'Codigo SGE', 'Dpara', 'SGE']);
  const mobilizedText = getValue(source.raw, ['Mobilizado']);
  const availabilityText = getValue(source.raw, ['Meta disponibilidade', 'MetaDispMec']);
  const availabilityPercent = normalizeAvailabilityTarget(availabilityText);
  const tankCapacityText = getValue(source.raw, ['Capacidade tanque (L)', 'Capacidade tanque', 'Capacidade']);
  const tankCapacity = positiveNumberFromSource(tankCapacityText);
  const category = inferFleetCategory(name, family, licensePlate, 'equipment');
  return {
    displayValue: prefix || name || legacyId,
    canonicalKey: normalizeMasterText(prefix),
    normalized: {
      legacy_id: legacyId || null,
      prefix: prefix || null,
      name: name || null,
      equipment_type: family || name || null,
      family: family || null,
      fleet_kind: fleetKind(category),
      license_plate: licensePlate || null,
      external_sge_code: externalCode || null,
      status: status || 'Ativo',
      mobilized: booleanFromSource(mobilizedText),
      availability_target: availabilityPercent === null ? null : availabilityPercent / 100,
      mobilized_at: getValue(source.raw, ['Data mobilização', 'Data mobilizacao', 'DataMob']) || null,
      demobilized_at: getValue(source.raw, ['Data desmobilização', 'Data desmobilizacao', 'DataDesmob']) || null,
      responsible_operator_name: getValue(source.raw, ['Operador/Responsável', 'Operador/Responsavel']) || null,
      fuel_name: getValue(source.raw, ['Combustível', 'Combustivel']) || null,
      tank_capacity_liters: tankCapacity,
      active: activeFromStatus(status),
      metadata: {
        companyName: getValue(source.raw, ['Empresa']) || null,
        sourceWorksheet: source.sheetName,
      },
    },
    issues: [
      ...(!prefix ? ['Prefixo do equipamento não informado.'] : []),
      ...(!name ? ['Descrição do equipamento não informada.'] : []),
      ...(!getValue(source.raw, ['Empresa']) ? ['Empresa não informada; o vínculo deverá ser revisado.'] : []),
      ...(availabilityText && availabilityPercent === null ? ['Meta de disponibilidade inválida.'] : []),
      ...(tankCapacityText && tankCapacity === null ? ['Capacidade do tanque deve ser maior que zero.'] : []),
    ],
  };
};

const vehicleRow = (source: MasterWorkbookSourceRow) => {
  const legacyId = getValue(source.raw, ['ID Veículo', 'ID Veiculo']);
  const prefix = getValue(source.raw, ['Prefixo', 'Frota']);
  const licensePlate = getValue(source.raw, ['Placa']);
  const name = getValue(source.raw, ['Equipamento', 'Veículo', 'Veiculo', 'Descrição', 'Descricao']);
  const family = getValue(source.raw, ['Família', 'Familia']);
  const status = getValue(source.raw, ['Status']);
  return {
    displayValue: prefix || licensePlate || name || legacyId,
    canonicalKey: normalizeMasterText(prefix) || normalizeMasterText(licensePlate),
    normalized: {
      legacy_id: legacyId || null,
      prefix: prefix || null,
      license_plate: licensePlate || null,
      name: name || null,
      vehicle_type: family || name || null,
      family: family || null,
      status: status || 'Ativo',
      responsible_operator_name: getValue(source.raw, ['Operador/Responsável', 'Operador/Responsavel']) || null,
      active: activeFromStatus(status),
      metadata: {
        companyName: getValue(source.raw, ['Empresa']) || null,
        sourceWorksheet: source.sheetName,
      },
    },
    issues: [
      ...(!prefix ? ['Prefixo do veículo não informado.'] : []),
      ...(!licensePlate ? ['Placa não informada; manter em revisão antes da promoção.'] : []),
      ...(!name ? ['Descrição do veículo não informada.'] : []),
      ...(!getValue(source.raw, ['Empresa']) ? ['Empresa não informada; o vínculo deverá ser revisado.'] : []),
    ],
  };
};

const mapSourceRow = (entity: MasterDataReviewEntity, source: MasterWorkbookSourceRow) => {
  if (entity === 'companies') return companyRow(source);
  if (entity === 'suppliers') return supplierRow(source);
  if (entity === 'locations') return locationRow(source);
  if (entity === 'collaborators') return collaboratorRow(source);
  if (entity === 'equipment') return equipmentRow(source);
  return vehicleRow(source);
};

const newExistingIndex = (): ExistingMasterIndex => ({
  companies: new Map(),
  suppliers: new Map(),
  locations: new Map(),
  collaborators: new Map(),
  equipment: new Map(),
  vehicles: new Map(),
});

const addExisting = (
  index: ExistingMasterIndex,
  entity: MasterDataReviewEntity,
  key: string,
  id: string,
) => {
  if (!key) return;
  const current = index[entity].get(key) || [];
  if (!current.includes(id)) index[entity].set(key, [...current, id]);
};

export const buildExistingMasterIndex = ({
  empresas,
  obras,
  funcionarios,
  equipamentos,
}: {
  empresas: Empresa[];
  obras: ObraLocal[];
  funcionarios: Funcionario[];
  equipamentos: Equipamento[];
}): ExistingMasterIndex => {
  const index = newExistingIndex();
  empresas.forEach(item => addExisting(
    index,
    'companies',
    normalizedDigits(item.cnpj) || normalizeMasterText(item.nome),
    item.id,
  ));
  obras.forEach(item => addExisting(index, 'locations', normalizeMasterText(item.nome), item.id));
  funcionarios.forEach(item => addExisting(
    index,
    'collaborators',
    normalizeMasterText(item.matricula) || normalizeMasterText(item.nome),
    item.id,
  ));
  equipamentos.forEach(item => {
    const prefix = normalizeMasterText(item.prefixo);
    addExisting(index, 'equipment', prefix, item.id);
    if (item.categoriaFrota === 'Veículo' || item.placa) {
      addExisting(index, 'vehicles', prefix || normalizeMasterText(item.placa), item.id);
    }
  });
  return index;
};

export const analyzeMasterRows = (
  rowsByEntity: Partial<Record<MasterDataReviewEntity, MasterWorkbookSourceRow[]>>,
  existingIndex: ExistingMasterIndex = newExistingIndex(),
): MasterWorkbookReviewRow[] => {
  const provisional = Object.entries(rowsByEntity).flatMap(([entityValue, sourceRows]) => {
    const entity = entityValue as MasterDataReviewEntity;
    return (sourceRows || []).map(source => {
      const mapped = mapSourceRow(entity, source);
      return {
        ...source,
        entity,
        ...mapped,
      };
    });
  });

  const grouped = new Map<string, typeof provisional>();
  provisional.forEach(row => {
    if (!row.canonicalKey) return;
    const groupKey = `${row.entity}|${row.canonicalKey}`;
    grouped.set(groupKey, [...(grouped.get(groupKey) || []), row]);
  });
  const plateGroups = new Map<string, typeof provisional>();
  provisional.forEach(row => {
    if (row.entity !== 'equipment' && row.entity !== 'vehicles') return;
    const plate = normalizeMasterText((row.normalized as Record<string, unknown>).license_plate);
    if (!plate) return;
    const groupKey = `${row.entity}|plate|${plate}`;
    plateGroups.set(groupKey, [...(plateGroups.get(groupKey) || []), row]);
  });

  return provisional.map(row => {
    const group = row.canonicalKey ? grouped.get(`${row.entity}|${row.canonicalKey}`) || [] : [];
    const aliases = Array.from(new Set(group.map(item => item.displayValue).filter(Boolean)));
    const candidateRecordIds = row.canonicalKey ? existingIndex[row.entity].get(row.canonicalKey) || [] : [];
    const normalized = row.normalized as Record<string, unknown>;
    const normalizedPlate = normalizeMasterText(normalized.license_plate);
    const repeatedPlateRows = normalizedPlate
      ? plateGroups.get(`${row.entity}|plate|${normalizedPlate}`) || []
      : [];
    const duplicatePlate = repeatedPlateRows.length > 1;
    const missingCanonicalIdentity = !row.canonicalKey || !row.displayValue;
    const missingRequiredFields = (row.entity === 'companies' && !normalized.name)
      || (row.entity === 'suppliers' && !normalized.company_name)
      || (row.entity === 'locations' && !normalized.name)
      || (row.entity === 'collaborators' && !normalized.name)
      || (row.entity === 'equipment' && (!normalized.prefix || !normalized.name))
      || (row.entity === 'vehicles' && (!normalized.prefix || !normalized.name || !normalized.license_plate));
    const requiredIssue = missingCanonicalIdentity || missingRequiredFields;
    const status: MasterDataReviewStatus = requiredIssue
      ? 'invalid'
      : group.length > 1 || duplicatePlate
        ? 'duplicate'
        : candidateRecordIds.length > 0
          ? 'matched'
          : 'ready';
    const issues = [
      ...row.issues,
      ...(group.length > 1 ? [`Chave repetida em ${group.length} linhas da planilha.`] : []),
      ...(duplicatePlate ? [`Placa repetida em ${repeatedPlateRows.length} linhas da planilha.`] : []),
      ...(candidateRecordIds.length > 0 ? ['Já existe um cadastro operacional com a mesma chave.'] : []),
      ...(missingCanonicalIdentity ? ['Não foi possível formar uma chave canônica segura.'] : []),
      ...(missingRequiredFields ? ['Existem campos obrigatórios pendentes para promoção.'] : []),
    ];
    return {
      ...row,
      aliases,
      candidateRecordIds,
      status,
      issues,
      reviewNote: issues.join(' '),
    };
  });
};

const cellToText = (value: ExcelJS.CellValue) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('text' in value) return String(value.text ?? '').trim();
    if ('result' in value) return String(value.result ?? '').trim();
    if ('richText' in value) return value.richText.map(item => item.text).join('').trim();
    if ('hyperlink' in value) {
      const hyperlink = value as unknown as ExcelJS.CellHyperlinkValue;
      return String(hyperlink.text || hyperlink.hyperlink || '').trim();
    }
  }
  return String(value).trim();
};

const headerRowNumber = (worksheet: ExcelJS.Worksheet) => {
  for (let rowNumber = 1; rowNumber <= Math.min(10, worksheet.rowCount); rowNumber += 1) {
    let filled = 0;
    worksheet.getRow(rowNumber).eachCell({ includeEmpty: false }, cell => {
      if (cellToText(cell.value)) filled += 1;
    });
    if (filled >= 2) return rowNumber;
  }
  return 1;
};

const worksheetRows = (worksheet: ExcelJS.Worksheet): MasterWorkbookSourceRow[] => {
  const headerNumber = headerRowNumber(worksheet);
  const headers: string[] = [];
  worksheet.getRow(headerNumber).eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    headers[columnNumber - 1] = cellToText(cell.value) || `coluna_${columnNumber}`;
  });
  const rows: MasterWorkbookSourceRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= headerNumber) return;
    const raw: Record<string, string> = {};
    headers.forEach((header, index) => {
      raw[header] = cellToText(row.getCell(index + 1).value);
    });
    if (!Object.values(raw).some(value => value.trim())) return;
    rows.push({ sheetName: worksheet.name, rowNumber, raw });
  });
  return rows;
};

const summarize = (
  entity: MasterDataReviewEntity,
  sheetName: string,
  rows: MasterWorkbookReviewRow[],
): MasterWorkbookEntitySummary => ({
  entity,
  sheetName,
  totalRows: rows.length,
  readyRows: rows.filter(row => row.status === 'ready').length,
  matchedRows: rows.filter(row => row.status === 'matched').length,
  duplicateRows: rows.filter(row => row.status === 'duplicate').length,
  invalidRows: rows.filter(row => row.status === 'invalid').length,
});

export const analyzeMasterWorkbook = async (
  file: File,
  existingIndex: ExistingMasterIndex,
): Promise<MasterWorkbookAnalysis> => {
  const workbook = await loadValidatedWorkbook(file);
  const rowsByEntity: Partial<Record<MasterDataReviewEntity, MasterWorkbookSourceRow[]>> = {};
  const sheetNames: Partial<Record<MasterDataReviewEntity, string>> = {};
  const deferredSheets: MasterWorkbookDeferredSheet[] = [];

  workbook.worksheets.forEach(worksheet => {
    const rows = worksheetRows(worksheet);
    const definition = MASTER_SHEETS[worksheet.name.toLocaleUpperCase('pt-BR')];
    if (definition) {
      rowsByEntity[definition.entity] = rows;
      sheetNames[definition.entity] = worksheet.name;
      return;
    }
    if (rows.length > 0) {
      deferredSheets.push({
        sheetName: worksheet.name,
        rowCount: rows.length,
        reason: worksheet.name.toLocaleUpperCase('pt-BR') === 'CBS'
          ? 'Controle preservado para conciliação com o histórico operacional de equipamentos.'
          : worksheet.name.startsWith('CAD_')
            ? 'Cadastro reservado para a próxima versão modular.'
            : 'Base operacional preservada no arquivo de origem e não promovida como cadastro mestre.',
      });
    }
  });

  const rows = analyzeMasterRows(rowsByEntity, existingIndex);
  const summaries = MASTER_DATA_REVIEW_ENTITIES
    .filter(entity => rowsByEntity[entity])
    .map(entity => summarize(
      entity,
      sheetNames[entity] || entity,
      rows.filter(row => row.entity === entity),
    ));

  return {
    sourceName: file.name,
    rows,
    summaries,
    deferredSheets,
    totalMasterRows: rows.length,
    totalDeferredRows: deferredSheets.reduce((total, item) => total + item.rowCount, 0),
  };
};
