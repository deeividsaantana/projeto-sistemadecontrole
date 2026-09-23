import type { ImportColumnMapping, ImportParseContext, ImportRow, SpreadsheetImportAdapter } from '../types';
import { buildRowLineage, cleanRowForLineage } from '../provenance';
import {
  normalizeImportDateOrNull,
  normalizeImportDecimalOrNull,
  normalizeImportPlateOrNull,
  normalizeImportPrefixOrNull,
  normalizeImportTextOrNull,
  normalizeImportUnitOrNull,
} from '../normalizers';
import { getImportValue, normalizeImportText } from '../../utils/importHelpers';
import { normalizeComparable } from '../../utils/canonicalIdentity';
import { buildImportPreview } from '../preview';
import type { MovimentoMaterial } from '../../types';

// "lançamentos RENEA" também é lançamento de movimento; "resumo geral" é
// agregado e fica deferred de propósito, igual ao adaptador de recebimentos.
// Nomes reais de aba trazem parênteses, underscore/hífen e sufixo de razão
// social ("SPE LTDA") que normalizeComparable sozinho não neutraliza — por
// isso a comparação usa normalizeSheetKey, que também reduz pontuação a
// espaço, em vez de comparar direto contra normalizeComparable.
const normalizeSheetKey = (value: string) => normalizeComparable(value).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

const RECOGNIZED_SHEETS = [
  'rachao', 'macadame', 'solo reforcado', 'bica corrida', 'areia industrial', 'bgs', 'brita 02',
  'bota fora lara', 'bota fora itaquareia',
  'q e sao bento', 'q e sao bento spe ltda', 'faixa', 'lancamentos renea', 'lanc mat renea',
];

const FIELD_ALIASES: Record<string, string[]> = {
  data: ['Data'],
  tipoMovimento: ['Movimento', 'Tipo', 'Tipo Movimento'],
  origem: ['Origem'],
  // Ordem importa: getImportValue tenta cada alias em sequência e para no
  // primeiro que bater. "Local De Descarga" (onde o material foi descarregado
  // de fato) precisa vir antes de "Local De Carregamento" para a aba
  // LANÇ_MAT-RENEA, que tem as duas colunas — senão o destino pegaria o
  // local de carregamento por engano.
  destino: ['Destino', 'Local De Descarga', 'Local/Destino', 'Local De Carregamento', 'Local'],
  quantidade: ['Quantidade', 'Qtd', 'Qtde'],
  unidade: ['Unidade', 'Un', 'UN'],
  placaOuPrefixo: ['Placa', 'Prefixo', 'Placa/Prefixo'],
};

export interface NormalizedMaterialMovementRow {
  readonly material: string;
  readonly data: string | null;
  readonly tipoMovimento: string | null;
  readonly origem: string | null;
  readonly destino: string | null;
  readonly quantidade: number | null;
  readonly unidade: string | null;
  readonly placaOuPrefixo: string | null;
}

const describeColumns = (headers: readonly string[]): readonly ImportColumnMapping[] => headers.map(column => {
  const normalizedColumn = normalizeImportText(column);
  const matched = Object.entries(FIELD_ALIASES).find(([, aliases]) =>
    aliases.some(alias => normalizeImportText(alias) === normalizedColumn));
  return { column, mappedTo: matched ? matched[0] : null };
});

const buildOperationalKey = (row: NormalizedMaterialMovementRow): string | undefined => {
  if (!row.data || !row.destino || row.quantidade === null) return undefined;
  return ['movimento', normalizeComparable(row.material), row.data, normalizeComparable(row.origem || ''), normalizeComparable(row.destino), row.quantidade, row.placaOuPrefixo || ''].join('|');
};

export const materialsAdapter: SpreadsheetImportAdapter<NormalizedMaterialMovementRow, readonly MovimentoMaterial[]> = {
  domain: 'materials-movements',
  supports: sheetName => RECOGNIZED_SHEETS.includes(normalizeSheetKey(sheetName)),
  describeColumns,
  parse: (context: ImportParseContext) => context.rows.map((raw, index) => {
    const sourceRow = index + context.headerRow + 1;
    const placaOuPrefixoRaw = getImportValue(raw, FIELD_ALIASES.placaOuPrefixo);
    const value: NormalizedMaterialMovementRow = {
      material: context.sourceSheet,
      data: normalizeImportDateOrNull(getImportValue(raw, FIELD_ALIASES.data)),
      tipoMovimento: normalizeImportTextOrNull(getImportValue(raw, FIELD_ALIASES.tipoMovimento)),
      origem: normalizeImportTextOrNull(getImportValue(raw, FIELD_ALIASES.origem)),
      destino: normalizeImportTextOrNull(getImportValue(raw, FIELD_ALIASES.destino)),
      quantidade: normalizeImportDecimalOrNull(getImportValue(raw, FIELD_ALIASES.quantidade)),
      unidade: normalizeImportUnitOrNull(getImportValue(raw, FIELD_ALIASES.unidade)),
      placaOuPrefixo: normalizeImportPlateOrNull(placaOuPrefixoRaw) || normalizeImportPrefixOrNull(placaOuPrefixoRaw),
    };
    const messages: string[] = [];
    if (!value.data) messages.push('Data ausente ou não reconhecida.');
    if (!value.destino) messages.push('Destino não identificado.');
    if (value.quantidade === null) messages.push('Quantidade ausente.');
    const operationalKey = buildOperationalKey(value);
    if (!operationalKey) messages.push('Chave operacional incompleta (data + destino + quantidade): linha fica em conferência.');
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
    } satisfies ImportRow<NormalizedMaterialMovementRow>;
  }),
  reconcile: (rows, current) => {
    const seenKeys = new Set<string>();
    const previewRows = rows.map(row => {
      if (!row.operationalKey) return { row, disposition: 'review' as const };
      if (seenKeys.has(row.operationalKey)) return { row, disposition: 'duplicate-in-file' as const };
      seenKeys.add(row.operationalKey);
      const existing = current.find(movimento =>
        normalizeComparable(movimento.materialDescricao) === normalizeComparable(row.value.material)
        && movimento.data === row.value.data
        && normalizeComparable(movimento.destino || '') === normalizeComparable(row.value.destino || '')
        && movimento.quantidade === row.value.quantidade);
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
