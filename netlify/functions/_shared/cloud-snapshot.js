import crypto from 'node:crypto';

const CLOUD_COLLECTION = 'sistemarenea_cloud';
const MANIFEST_ID = 'main_data_v2';
const LEGACY_ID = 'main_data';
const INTERMEDIATE_META_ID = 'meta';
const INTERMEDIATE_TABLE_IDS = [
  'empresas', 'obras', 'equipamentos', 'funcionarios', 'comboios', 'combustiveis',
  'lubrificantes', 'etapas', 'abastecimentos', 'lubrificacoes', 'ticketsJazida',
  'listasPresenca', 'ordensServico', 'gruposEquipe', 'presencasLink', 'historicoPresencas',
  'apontamentoRamos', 'apontamentoRamoRegistros', 'materiaisCadastro', 'materiaisRegistros',
  'partesDiariasEquipamentos', 'controleEquipamentosDiario', 'periodosArquivados', 'notifications', 'historyLogs',
];

const SNAPSHOT_CACHE_TTL_MS = 30_000;
const snapshotCache = new Map();
const snapshotRequests = new Map();

const hashText = value => crypto.createHash('sha256').update(value).digest('hex');

const loadDocuments = async (database, ids) => {
  const results = [];
  for (let index = 0; index < ids.length; index += 50) {
    const batch = ids.slice(index, index + 50);
    const snapshots = await Promise.all(batch.map(id => database.collection(CLOUD_COLLECTION).doc(id).get()));
    results.push(...snapshots);
  }
  return results;
};

const loadManifestSnapshot = async (database, manifest, requestedTables) => {
  const data = {};
  const allowedTables = requestedTables ? new Set(requestedTables) : null;
  for (const [table, ids] of Object.entries(manifest.chunks || {})) {
    if (allowedTables && !allowedTables.has(table)) continue;
    if (!Array.isArray(ids) || ids.length === 0) {
      data[table] = [];
      continue;
    }
    const snapshots = await loadDocuments(database, ids);
    const rows = [];
    for (const snapshot of snapshots) {
      const chunk = snapshot.data();
      if (!snapshot.exists || chunk?.kind !== 'chunk' || typeof chunk.payload !== 'string') {
        throw new Error(`Bloco de nuvem ausente ou inválido: ${snapshot.id}`);
      }
      const parsed = JSON.parse(chunk.payload);
      if (!Array.isArray(parsed)) throw new Error(`Bloco de nuvem inválido: ${snapshot.id}`);
      rows.push(...parsed);
    }
    const expectedHash = manifest.tableHashes?.[table];
    if (expectedHash && hashText(JSON.stringify(rows)) !== expectedHash) {
      throw new Error(`Falha de integridade na tabela ${table}.`);
    }
    data[table] = rows;
  }
  return data;
};

export const loadCloudSnapshot = async (database, requestedTables, options = {}) => {
  const cacheTtlMs = Number.isFinite(options.cacheTtlMs)
    ? Math.max(0, options.cacheTtlMs)
    : SNAPSHOT_CACHE_TTL_MS;
  const tables = Array.isArray(requestedTables) && requestedTables.length > 0
    ? [...new Set(requestedTables)].sort()
    : null;
  const cacheKey = tables ? tables.join(',') : '*';
  const now = Date.now();
  const cached = snapshotCache.get(cacheKey);
  if (cacheTtlMs > 0 && cached && now < cached.until) return cached.data;
  const pending = snapshotRequests.get(cacheKey);
  if (pending) return pending;

  const request = loadCloudSnapshotUncached(database, tables, options)
    .then(data => {
      if (cacheTtlMs > 0) snapshotCache.set(cacheKey, { data, until: Date.now() + cacheTtlMs });
      return data;
    })
    .finally(() => snapshotRequests.delete(cacheKey));
  snapshotRequests.set(cacheKey, request);
  return request;
};

const loadCloudSnapshotUncached = async (database, requestedTables, options = {}) => {
  const collection = database.collection(CLOUD_COLLECTION);
  const manifestSnapshot = await collection.doc(MANIFEST_ID).get();
  if (manifestSnapshot.exists) {
    const manifest = manifestSnapshot.data();
    if (manifest?.kind !== 'manifest' || !manifest.chunks) throw new Error('Manifesto de nuvem inválido.');
    try {
      return await loadManifestSnapshot(database, manifest, requestedTables);
    } catch (error) {
      // Links públicos não podem ficar indisponíveis por um manifesto novo
      // publicado antes de todos os blocos. O fallback é opt-in e mantém a
      // validação rígida para os demais consumidores do snapshot.
      if (!options.allowLegacyFallback) throw error;
      const legacySnapshot = await collection.doc(LEGACY_ID).get();
      if (legacySnapshot.exists) return legacySnapshot.data() || {};
      throw error;
    }
  }

  const metaSnapshot = await collection.doc(INTERMEDIATE_META_ID).get();
  if (metaSnapshot.exists) {
    const tableIds = requestedTables
      ? INTERMEDIATE_TABLE_IDS.filter(table => requestedTables.includes(table))
      : INTERMEDIATE_TABLE_IDS;
    const tableSnapshots = await loadDocuments(database, tableIds);
    const data = {};
    tableSnapshots.forEach(snapshot => {
      const value = snapshot.data()?.value;
      if (snapshot.exists && Array.isArray(value)) data[snapshot.id] = value;
    });
    if (Object.keys(data).length > 0) return data;
  }

  const legacySnapshot = await collection.doc(LEGACY_ID).get();
  if (legacySnapshot.exists) return legacySnapshot.data() || {};
  return {};
};
