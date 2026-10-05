import type { ImportApplyResult, ImportPreview } from './types';

export const APPLY_BLOCKED_REASON =
  'A persistência de dados reais desta importação não está autorizada nesta rodada. Esta prévia é somente leitura (dry-run).';

/**
 * Fronteira para a futura aplicação transacional (Fases 2-4). Nesta rodada
 * sempre bloqueia: nenhuma linha é gravada em cache local, Firebase ou
 * Supabase a partir daqui.
 */
export const applyImportPreview = <T>(_preview: ImportPreview<T>): ImportApplyResult => ({
  applied: false,
  reason: APPLY_BLOCKED_REASON,
});
