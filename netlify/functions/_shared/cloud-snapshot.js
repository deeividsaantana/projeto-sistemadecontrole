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

const loadManifestSnapshot = async (database, manifest) => {
  const data = {};
  for (const [table, ids] of Object.entries(manifest.chunks || {})) {
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

export const loadCloudSnapshot = async database => {
  const collection = database.collection(CLOUD_COLLECTION);
  const manifestSnapshot = await collection.doc(MANIFEST_ID).get();
  if (manifestSnapshot.exists) {
    const manifest = manifestSnapshot.data();
    if (manifest?.kind !== 'manifest' || !manifest.chunks) throw new Error('Manifesto de nuvem inválido.');
    return loadManifestSnapshot(database, manifest);
  }

  const metaSnapshot = await collection.doc(INTERMEDIATE_META_ID).get();
  if (metaSnapshot.exists) {
    const tableSnapshots = await loadDocuments(database, INTERMEDIATE_TABLE_IDS);
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
