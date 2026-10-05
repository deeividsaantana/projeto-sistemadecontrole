// src/imports/adapters/travelsAdapter.ts
import type { ImportColumnMapping, ImportParseContext, ImportRow, SpreadsheetImportAdapter } from '../types';
import { buildRowLineage, cleanRowForLineage } from '../provenance';
import {
  normalizeImportDecimalOrNull,
  normalizeImportPlateOrNull,
  normalizeImportPrefixOrNull,
  normalizeImportTextOrNull,
  normalizeImportTimeOrNull,
} from '../normalizers';
import { getImportValue, normalizeImportText } from '../../utils/importHelpers';
import { normalizeComparable } from '../../utils/canonicalIdentity';
import { buildImportPreview } from '../preview';

export interface NormalizedTravelRow {
  readonly via: string;
  readonly ticket: string | null;
  readonly prefixo: string | null;
  readonly material: string | null;
  readonly quantidade: number | null;
  readonly destino: string | null;
  readonly horario: string | null;
}

const RECOGNIZED_SHEETS = [
  'liberacao', 'recebimento', 'cadastro', 'conferencia', 'resumo',
];

const FIELD_ALIASES: Record<string, string[]> = {
  ticket: ['Ticket', 'Nº Ticket', 'Nº do Ticket'],
  prefixo: ['Prefixo', 'Placa'],
  material: ['Material', 'Produto'],
  quantidade: ['Quantidade', 'Qtd', 'Qtde'],
  destino: ['Destino', 'Local'],
  horario: ['Horário', 'Hora'],
};

const describeColumns = (headers: readonly string[]): readonly ImportColumnMapping[] => headers.map(column => {
  const normalizedColumn = normalizeImportText(column);
  const matched = Object.entries(FIELD_ALIASES).find(([, aliases]) =>
    aliases.some(alias => normalizeImportText(alias) === normalizedColumn));
  return { column, mappedTo: matched ? matched[0] : null };
});

const buildOperationalKey = (row: NormalizedTravelRow): string | undefined => {
  if (!row.ticket || !row.via) return undefined;
  return ['viagem', row.ticket, normalizeComparable(row.via)].join('|');
};

export const travelsAdapter: SpreadsheetImportAdapter<NormalizedTravelRow, undefined> = {
  domain: 'travels',
  supports: sheetName => RECOGNIZED_SHEETS.includes(normalizeComparable(sheetName)),
  describeColumns,
  parse: (context: ImportParseContext) => context.rows.map((raw, index) => {
    const sourceRow = index + context.headerRow + 1;
    const value: NormalizedTravelRow = {
      via: normalizeComparable(context.sourceSheet),
      ticket: normalizeImportTextOrNull(getImportValue(raw, FIELD_ALIASES.ticket)),
      prefixo: normalizeImportPlateOrNull(getImportValue(raw, FIELD_ALIASES.prefixo)) ||
                normalizeImportPrefixOrNull(getImportValue(raw, FIELD_ALIASES.prefixo)),
      material: normalizeImportTextOrNull(getImportValue(raw, FIELD_ALIASES.material)),
      quantidade: normalizeImportDecimalOrNull(getImportValue(raw, FIELD_ALIASES.quantidade)),
      destino: normalizeImportTextOrNull(getImportValue(raw, FIELD_ALIASES.destino)),
      horario: normalizeImportTimeOrNull(getImportValue(raw, FIELD_ALIASES.horario)),
    };
    const messages: string[] = [];
    if (!value.ticket) messages.push('Ticket ausente.');
    if (!value.prefixo) messages.push('Prefixo/placa não identificado.');
    if (!value.material) messages.push('Material não identificado.');
    if (value.quantidade === null) messages.push('Quantidade ausente.');
    if (!value.destino) messages.push('Destino não identificado.');
    if (!value.horario) messages.push('Horário ausente.');
    const operationalKey = buildOperationalKey(value);
    if (!operationalKey) messages.push('Chave operacional incompleta (ticket + via): linha fica em conferência.');
    return {
      lineage: buildRowLineage({
        sourceFile: context.sourceFile,
        sourceSheet: context.sourceSheet,
        sourceRow,
        sourceHash: context.sourceHash,
        importBatchId: context.importBatchId,
        importedAt: context.importedAt,
        validationStatus: operationalKey ? 'ready' : 'review',
        validationMessages: messages,
        originalData: cleanRowForLineage(raw),
      }),
      value,
      operationalKey,
      rawRow: raw,
    } satisfies ImportRow<NormalizedTravelRow>;
  }),
  reconcile: rows => {
    const seenKeys = new Set<string>();
    const previewRows = rows.map(row => {
      if (!row.operationalKey) return { row, disposition: 'review' as const };
      if (seenKeys.has(row.operationalKey)) return { row, disposition: 'duplicate-in-file' as const };
      seenKeys.add(row.operationalKey);
      // Fase 1 não recebe o estado atual de viagens: toda linha com
      // chave completa e inédita no arquivo é "new". A comparação contra
      // viagens já existentes é adicionada na Fase 4.
      return { row, disposition: 'new' as const };
    });
    return buildImportPreview({
      batchId: rows[0]?.lineage.importBatchId || '',
      sourceFile: rows[0]?.lineage.sourceFile || '',
      sourceHash: rows[0]?.lineage.sourceHash || '',
      generatedAt: rows[0]?.lineage.importedAt || new Date().toISOString(),
      previewRows,
      sheets: [],
    });
  },
};
