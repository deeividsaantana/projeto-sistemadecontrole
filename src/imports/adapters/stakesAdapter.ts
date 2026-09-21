import type { ImportColumnMapping, ImportParseContext, ImportRow, SpreadsheetImportAdapter } from '../types';
import { buildRowLineage, cleanRowForLineage } from '../provenance';
import { normalizeImportDateOrNull, normalizeImportTextOrNull } from '../normalizers';
import { getImportValue, normalizeImportText } from '../../utils/importHelpers';
import { normalizeComparable } from '../../utils/canonicalIdentity';
import { buildImportPreview } from '../preview';

/**
 * Diferente dos arquivos de recebimentos/materiais, o nome real das abas de
 * estacas não é conhecido linha a linha na especificação (só categorias
 * descritas). Por isso o reconhecimento é por palavra-chave, não lista exata
 * — abas que não batem em nenhuma categoria ficam deferred com o motivo.
 */
const STAKE_SHEET_KEYWORDS = [
  'cadastro', 'veiculo', 'implemento', 'lancamento', 'movimento', 'logistic',
  'cravac', 'conferenc', 'auxiliar', 'lista', 'resumo',
];

const matchesStakeSheet = (sheetName: string): boolean => {
  const normalized = normalizeComparable(sheetName);
  return STAKE_SHEET_KEYWORDS.some(keyword => normalized.includes(keyword));
};

const FIELD_ALIASES: Record<string, string[]> = {
  item: ['Item', 'Perfil', 'Descrição'],
  perfil: ['Perfil', 'Modelo'],
  notaOuLote: ['NF', 'Lote', 'NF/Lote'],
  data: ['Data'],
  observacao: ['Observação', 'Observacao'],
};

export interface NormalizedStakeRow {
  readonly categoria: string;
  readonly item: string | null;
  readonly perfil: string | null;
  readonly notaOuLote: string | null;
  readonly data: string | null;
  readonly observacao: string | null;
}

const describeColumns = (headers: readonly string[]): readonly ImportColumnMapping[] => headers.map(column => {
  const normalizedColumn = normalizeImportText(column);
  const matched = Object.entries(FIELD_ALIASES).find(([, aliases]) =>
    aliases.some(alias => normalizeImportText(alias) === normalizedColumn));
  return { column, mappedTo: matched ? matched[0] : null };
});

const buildOperationalKey = (row: NormalizedStakeRow): string | undefined => {
  if (!row.notaOuLote || !row.item || !row.data) return undefined;
  return ['estaca', row.notaOuLote, normalizeComparable(row.item), row.data].join('|');
};

export const stakesAdapter: SpreadsheetImportAdapter<NormalizedStakeRow, undefined> = {
  domain: 'stakes',
  supports: matchesStakeSheet,
  describeColumns,
  parse: (context: ImportParseContext) => context.rows.map((raw, index) => {
    const sourceRow = index + context.headerRow + 1;
    const value: NormalizedStakeRow = {
      categoria: context.sourceSheet,
      item: normalizeImportTextOrNull(getImportValue(raw, FIELD_ALIASES.item)),
      perfil: normalizeImportTextOrNull(getImportValue(raw, FIELD_ALIASES.perfil)),
      notaOuLote: normalizeImportTextOrNull(getImportValue(raw, FIELD_ALIASES.notaOuLote)),
      data: normalizeImportDateOrNull(getImportValue(raw, FIELD_ALIASES.data)),
      observacao: normalizeImportTextOrNull(getImportValue(raw, FIELD_ALIASES.observacao)),
    };
    const messages: string[] = [];
    if (!value.item) messages.push('Item/perfil não identificado nesta linha.');
    const operationalKey = buildOperationalKey(value);
    if (!operationalKey) messages.push('Chave operacional incompleta (NF/lote + item/perfil + data): linha fica em conferência.');
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
    } satisfies ImportRow<NormalizedStakeRow>;
  }),
  reconcile: rows => {
    const seenKeys = new Set<string>();
    const previewRows = rows.map(row => {
      if (!row.operationalKey) return { row, disposition: 'review' as const };
      if (seenKeys.has(row.operationalKey)) return { row, disposition: 'duplicate-in-file' as const };
      seenKeys.add(row.operationalKey);
      // Fase 1 não recebe o estado atual de lotes/cravações: toda linha com
      // chave completa e inédita no arquivo é "new". A comparação contra
      // lotes/cravações já existentes é adicionada na Fase 3.
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
