import type { ImportSheetPreview, SpreadsheetImportAdapter } from '../types';
import { stakesAdapter } from './stakesAdapter';

/** Registro heterogêneo dos adaptadores; o pipeline roteia o estado pelo domínio. */
export const IMPORT_ADAPTERS: readonly SpreadsheetImportAdapter<unknown, unknown>[] = [
  stakesAdapter as SpreadsheetImportAdapter<unknown, unknown>,
];

export const findAdapterForSheet = (sheetName: string) =>
  IMPORT_ADAPTERS.find(adapter => adapter.supports(sheetName));

export const classifySheet = (
  sheetName: string,
  headers: readonly string[],
  rowCount: number,
): ImportSheetPreview => {
  const adapter = findAdapterForSheet(sheetName);
  if (!adapter) {
    return {
      sheetName,
      recognized: false,
      rowCount,
      reason: 'Nenhum adaptador reconhece esta aba; revise o nome ou mapeie manualmente.',
    };
  }
  return {
    sheetName,
    recognized: true,
    domain: adapter.domain,
    rowCount,
    columnMapping: adapter.describeColumns(headers),
  };
};
