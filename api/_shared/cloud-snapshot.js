import { getSupabaseAdmin } from './supabase-admin.js';

// Os links de campo leem o mesmo retrato que o app publica em erp_snapshots.
// Antes liam o formato antigo do Firestore em legacy_documents, que ninguém
// atualiza desde a mudança para o Supabase (08/10/2026).
const SNAPSHOT_TABLE = 'erp_snapshots';
const SNAPSHOT_CACHE_TTL_MS = 30_000;
const NOME_DE_TABELA = /^[A-Za-z][A-Za-z0-9_]*$/;
const snapshotCache = new Map();
const snapshotRequests = new Map();

const organizationId = () => process.env.SUPABASE_ORGANIZATION_ID || 'renea';

/** Pede ao banco só as chaves do retrato que o link usa, não o JSON inteiro. */
export const selecaoDoRetrato = tables => {
  if (!tables) return 'payload';
  for (const table of tables) {
    if (!NOME_DE_TABELA.test(table)) throw new Error(`Tabela do retrato inválida: ${table}`);
  }
  return tables.map(table => `${table}:payload->${table}`).join(',');
};

const loadCloudSnapshotUncached = async (tables, options = {}) => {
  const client = options.client || getSupabaseAdmin();
  const { data, error } = await client
    .from(SNAPSHOT_TABLE)
    .select(selecaoDoRetrato(tables))
    .eq('organization_id', organizationId())
    .maybeSingle();
  if (error) throw error;
  if (!data) return {};
  if (!tables) return data.payload && typeof data.payload === 'object' ? data.payload : {};
  const snapshot = {};
  for (const table of tables) {
    if (Array.isArray(data[table])) snapshot[table] = data[table];
  }
  return snapshot;
};

export const loadCloudSnapshot = async (_database, requestedTables, options = {}) => {
  const cacheTtlMs = Number.isFinite(options.cacheTtlMs)
    ? Math.max(0, options.cacheTtlMs)
    : SNAPSHOT_CACHE_TTL_MS;
  const tables = Array.isArray(requestedTables) && requestedTables.length > 0
    ? [...new Set(requestedTables)].sort()
    : null;
  const cacheKey = tables ? tables.join(',') : '*';
  const cached = snapshotCache.get(cacheKey);
  if (cacheTtlMs > 0 && cached && Date.now() < cached.until) return cached.data;
  const pending = snapshotRequests.get(cacheKey);
  if (pending) return pending;

  const request = loadCloudSnapshotUncached(tables, options)
    .then(data => {
      if (cacheTtlMs > 0) snapshotCache.set(cacheKey, { data, until: Date.now() + cacheTtlMs });
      return data;
    })
    .finally(() => snapshotRequests.delete(cacheKey));
  snapshotRequests.set(cacheKey, request);
  return request;
};
