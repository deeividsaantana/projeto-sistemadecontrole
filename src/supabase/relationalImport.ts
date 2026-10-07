import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseRelationalExport } from './relationalExport';

type RelationalTable = keyof SupabaseRelationalExport;

export const SUPABASE_RELATIONAL_IMPORT_TABLES = [
  'empresas',
  'obras',
  'equipamentos',
  'funcionarios',
  'materiais',
  'movimentos_materiais',
  'abastecimentos',
] as const satisfies readonly RelationalTable[];

export const SUPABASE_RELATIONAL_DB_TABLES = {
  empresas: 'empresas',
  obras: 'obras',
  equipamentos: 'equipamentos_operacionais',
  funcionarios: 'funcionarios_operacionais',
  materiais: 'materiais_operacionais',
  movimentos_materiais: 'movimentos_materiais_operacionais',
  abastecimentos: 'abastecimentos_operacionais',
} as const satisfies Record<RelationalTable, string>;

export type SupabaseRelationalImportTable = typeof SUPABASE_RELATIONAL_IMPORT_TABLES[number];

export interface SupabaseRelationalImportPlan {
  sourceTable: SupabaseRelationalImportTable;
  dbTable: string;
  rowCount: number;
  conflictTarget: 'organization_id,legacy_id';
}

export interface SupabaseRelationalImportResult extends SupabaseRelationalImportPlan {
  upsertedRows: number;
}

export const buildSupabaseRelationalImportPlan = (
  exported: SupabaseRelationalExport,
): SupabaseRelationalImportPlan[] => SUPABASE_RELATIONAL_IMPORT_TABLES.map(sourceTable => ({
  sourceTable,
  dbTable: SUPABASE_RELATIONAL_DB_TABLES[sourceTable],
  rowCount: exported[sourceTable].length,
  conflictTarget: 'organization_id,legacy_id',
}));

const chunkRows = <T>(rows: readonly T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size) as T[]);
  }
  return chunks;
};

export const importSupabaseRelationalExport = async (
  client: SupabaseClient,
  exported: SupabaseRelationalExport,
  options: { batchSize?: number } = {},
): Promise<SupabaseRelationalImportResult[]> => {
  const batchSize = Math.max(1, options.batchSize || 500);
  const results: SupabaseRelationalImportResult[] = [];

  for (const plan of buildSupabaseRelationalImportPlan(exported)) {
    const rows = exported[plan.sourceTable] as unknown as Array<Record<string, unknown>>;
    let upsertedRows = 0;
    for (const batch of chunkRows(rows, batchSize)) {
      if (batch.length === 0) continue;
      const { error } = await client
        .from(plan.dbTable)
        .upsert(batch, { onConflict: plan.conflictTarget });
      if (error) throw new Error(`Falha ao importar ${plan.dbTable}: ${error.message}`);
      upsertedRows += batch.length;
    }
    results.push({ ...plan, upsertedRows });
  }

  return results;
};
