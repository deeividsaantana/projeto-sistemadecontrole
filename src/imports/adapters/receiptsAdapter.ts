import type { ImportColumnMapping, ImportParseContext, ImportRow, SpreadsheetImportAdapter } from '../types';
import { buildRowLineage, cleanRowForLineage } from '../provenance';
import {
  normalizeImportDateOrNull,
  normalizeImportDecimalOrNull,
  normalizeImportInvoiceOrNull,
  normalizeImportTextOrNull,
  normalizeImportUnitOrNull,
} from '../normalizers';
import { getImportValue, normalizeImportText } from '../../utils/importHelpers';
import { normalizeComparable } from '../../utils/canonicalIdentity';
import { buildImportPreview } from '../preview';
import type { MovimentoMaterial } from '../../types';

// "Resumo Geral" é agregado, não linha de origem — fica deferred de propósito.
const RECOGNIZED_SHEETS = ['tubos de concreto', 'tubos pead/pvc', 'tubos pead', 'madeiras e formas', 'ferramentas e materiais de apoio'];

const FIELD_ALIASES: Record<string, string[]> = {
  data: ['Data', 'Data Recebimento'],
  material: ['Material', 'Descrição', 'Item'],
  especificacao: ['Especificação', 'Especificacao'],
  codigo: ['Código', 'Codigo'],
  quantidadeNota: ['Quantidade Nota', 'Qtd Nota', 'Qtde Nota'],
  quantidadeRecebida: ['Quantidade Recebida', 'Qtd Recebida', 'Recebido'],
  unidade: ['Unidade', 'Un', 'UN'],
  notaFiscal: ['NF', 'Nota Fiscal', 'Nota'],
  localAplicacao: ['Local de Aplicação', 'Local Aplicação', 'Aplicação'],
};

export interface NormalizedReceiptRow {
  readonly data: string | null;
  readonly material: string | null;
  readonly especificacao: string | null;
  readonly codigo: string | null;
  readonly quantidadeNota: number | null;
  readonly quantidadeRecebida: number | null;
  readonly unidade: string | null;
  readonly notaFiscal: string | null;
  readonly localAplicacao: string | null;
}

const describeColumns = (headers: readonly string[]): readonly ImportColumnMapping[] => headers.map(column => {
  const normalizedColumn = normalizeImportText(column);
  const matched = Object.entries(FIELD_ALIASES).find(([, aliases]) =>
    aliases.some(alias => normalizeImportText(alias) === normalizedColumn));
  return { column, mappedTo: matched ? matched[0] : null };
});

const buildOperationalKey = (row: NormalizedReceiptRow): string | undefined => {
  if (!row.notaFiscal || !row.material || !row.data || !row.unidade || row.quantidadeRecebida === null) return undefined;
  return ['recebimento', row.notaFiscal, normalizeComparable(row.material), row.data, row.unidade, row.quantidadeRecebida].join('|');
};

export const receiptsAdapter: SpreadsheetImportAdapter<NormalizedReceiptRow, readonly MovimentoMaterial[]> = {
  domain: 'materials-receipts',
  supports: sheetName => RECOGNIZED_SHEETS.includes(normalizeComparable(sheetName)),
  describeColumns,
  parse: (context: ImportParseContext) => context.rows.map((raw, index) => {
    const sourceRow = index + context.headerRow + 1;
    const value: NormalizedReceiptRow = {
      data: normalizeImportDateOrNull(getImportValue(raw, FIELD_ALIASES.data)),
      material: normalizeImportTextOrNull(getImportValue(raw, FIELD_ALIASES.material)),
      especificacao: normalizeImportTextOrNull(getImportValue(raw, FIELD_ALIASES.especificacao)),
      codigo: normalizeImportTextOrNull(getImportValue(raw, FIELD_ALIASES.codigo)),
      quantidadeNota: normalizeImportDecimalOrNull(getImportValue(raw, FIELD_ALIASES.quantidadeNota)),
      quantidadeRecebida: normalizeImportDecimalOrNull(getImportValue(raw, FIELD_ALIASES.quantidadeRecebida)),
      unidade: normalizeImportUnitOrNull(getImportValue(raw, FIELD_ALIASES.unidade)),
      notaFiscal: normalizeImportInvoiceOrNull(getImportValue(raw, FIELD_ALIASES.notaFiscal)),
      localAplicacao: normalizeImportTextOrNull(getImportValue(raw, FIELD_ALIASES.localAplicacao)),
    };
    const messages: string[] = [];
    if (!value.data) messages.push('Data ausente ou não reconhecida.');
    if (!value.material) messages.push('Material não identificado.');
    if (!value.notaFiscal) messages.push('Nota fiscal ausente.');
    if (value.quantidadeRecebida === null) messages.push('Quantidade recebida ausente.');
    const operationalKey = buildOperationalKey(value);
    if (!operationalKey) messages.push('Chave operacional incompleta: linha fica em conferência até ser corrigida ou confirmada manualmente.');
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
    } satisfies ImportRow<NormalizedReceiptRow>;
  }),
  reconcile: (rows, current) => {
    const seenKeys = new Set<string>();
    const previewRows = rows.map(row => {
      if (!row.operationalKey) return { row, disposition: 'review' as const };
      if (seenKeys.has(row.operationalKey)) return { row, disposition: 'duplicate-in-file' as const };
      seenKeys.add(row.operationalKey);
      const existing = current.find(movimento =>
        normalizeImportInvoiceOrNull(movimento.notaFiscal) === row.value.notaFiscal
        && normalizeComparable(movimento.materialDescricao) === normalizeComparable(row.value.material || '')
        && movimento.data === row.value.data
        && normalizeImportUnitOrNull(movimento.unidade) === row.value.unidade
        && movimento.quantidade === row.value.quantidadeRecebida);
      if (!existing) return { row, disposition: 'new' as const };
      return { row, disposition: 'unchanged' as const, existingReference: existing.id };
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
