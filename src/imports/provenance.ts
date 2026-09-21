import { cleanImportValue } from '../utils/importHelpers';
import type { ImportLineage, ImportValidationStatus } from './types';

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer)).map(byte => byte.toString(16).padStart(2, '0')).join('');

/** SHA-256 via Web Crypto — disponível no navegador e no Node usado pelos testes, sem dependência nova. */
export const computeSourceHash = async (bytes: Uint8Array): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return toHex(digest);
};

const slugifyFileName = (fileName: string): string => fileName
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 40) || 'arquivo';

/** Determinístico: o mesmo arquivo (mesmo nome + mesmo conteúdo) sempre produz o mesmo lote. */
export const buildImportBatchId = (fileName: string, sourceHash: string): string =>
  `imp-${slugifyFileName(fileName)}-${sourceHash.slice(0, 12)}`;

/**
 * originalData nunca guarda a planilha bruta: cada valor passa por
 * cleanImportValue (mesma normalização usada no restante do app) e ausência
 * vira null, nunca string vazia tratada como dado real.
 */
export const cleanRowForLineage = (raw: Record<string, unknown>): Record<string, string | number | boolean | null> => {
  const cleaned: Record<string, string | number | boolean | null> = {};
  Object.entries(raw).forEach(([key, value]) => {
    const text = cleanImportValue(value);
    cleaned[key] = text === '' ? null : text;
  });
  return cleaned;
};

export const buildRowLineage = (input: {
  sourceFile: string;
  sourceSheet: string;
  sourceRow: number;
  sourceHash: string;
  importBatchId: string;
  importedAt: string;
  validationStatus: ImportValidationStatus;
  validationMessages: readonly string[];
  originalData: Record<string, string | number | boolean | null>;
}): ImportLineage => ({
  sourceFile: input.sourceFile,
  sourceSheet: input.sourceSheet,
  sourceRow: input.sourceRow,
  sourceHash: input.sourceHash,
  importedAt: input.importedAt,
  importBatchId: input.importBatchId,
  validationStatus: input.validationStatus,
  validationMessages: [...new Set(input.validationMessages)],
  originalData: Object.freeze({ ...input.originalData }),
});
