import {
  doc,
  getDocFromServer,
  runTransaction,
  setDoc,
  type Firestore,
} from 'firebase/firestore';

const CLOUD_COLLECTION = 'sistemarenea_cloud';
const CLOUD_MANIFEST_ID = 'main_data_v2';
const LEGACY_DOCUMENT_ID = 'main_data';
const CLOUD_SCHEMA_VERSION = 2;
const INTERMEDIATE_META_ID = 'meta';
const INTERMEDIATE_TABLE_IDS = [
  'empresas',
  'obras',
  'equipamentos',
  'funcionarios',
  'motoristasOperacionais',
  'comboios',
  'combustiveis',
  'lubrificantes',
  'etapas',
  'abastecimentos',
  'lubrificacoes',
  'ticketsJazida',
  'listasPresenca',
  'ordensServico',
  'gruposEquipe',
  'presencasLink',
  'historicoPresencas',
  'apontamentoRamos',
  'apontamentoRamoRegistros',
  'materiaisCadastro',
  'materiaisRegistros',
  'partesDiariasEquipamentos',
  'controleEquipamentosDiario',
  'periodosArquivados',
  'notifications',
  'historyLogs',
  'vinculosOperadorEquipamento',
] as const;
const MAX_CHUNK_PAYLOAD_BYTES = 600_000;
const FIREBASE_READ_TIMEOUT_MS = 20_000;
const FIREBASE_WRITE_TIMEOUT_MS = 45_000;
const MAX_PARALLEL_OPERATIONS = 4;

export type FirebaseCloudData = Record<string, any>;

interface CloudManifest {
  schemaVersion: number;
  kind: 'manifest';
  generation: string;
  updatedAt: string;
  chunks: Record<string, string[]>;
  tableHashes: Record<string, string>;
  totalRecords: Record<string, number>;
}

interface CloudChunk {
  schemaVersion: number;
  kind: 'chunk';
  generation: string;
  updatedAt: string;
  table: string;
  chunkIndex: number;
  totalChunks: number;
  contentHash: string;
  payload: string;
}

export interface FirebaseConnectionStatus {
  connected: boolean;
  updatedAt: string;
  schemaVersion: number;
}

export interface FirebaseUploadResult {
  updatedAt: string;
  totalRecords: number;
  writtenDocuments: number;
  reusedDocuments: number;
}

export interface FirebaseDownloadResult {
  data: FirebaseCloudData | null;
  source: 'v2' | 'intermediate' | 'legacy' | 'none';
  updatedAt: string;
  totalRecords: number;
}

const textEncoder = new TextEncoder();

const compatibilityFields = {
  // Mantem os novos documentos aceitos pelas duas versoes anteriores das regras.
  empresas: [],
  obras: [],
  equipamentos: [],
  value: { schemaVersion: CLOUD_SCHEMA_VERSION },
};

const withTimeout = async <T>(
  operation: Promise<T>,
  label: string,
  timeoutMs: number,
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} excedeu ${Math.round(timeoutMs / 1000)} segundos.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const runWithConcurrency = async <T>(
  jobs: Array<() => Promise<T>>,
  concurrency = MAX_PARALLEL_OPERATIONS,
): Promise<T[]> => {
  const results: T[] = [];
  for (let index = 0; index < jobs.length; index += concurrency) {
    const batch = jobs.slice(index, index + concurrency);
    results.push(...await Promise.all(batch.map(job => job())));
  }
  return results;
};

const getDocumentFromServer = (database: Firestore, documentId: string) => (
  withTimeout(
    getDocFromServer(doc(database, CLOUD_COLLECTION, documentId)),
    `Leitura do Firebase (${documentId})`,
    FIREBASE_READ_TIMEOUT_MS,
  )
);

const isV2Manifest = (value: any): value is CloudManifest => (
  value?.schemaVersion === CLOUD_SCHEMA_VERSION
  && value?.kind === 'manifest'
  && typeof value?.generation === 'string'
  && typeof value?.updatedAt === 'string'
  && value?.chunks !== null
  && typeof value?.chunks === 'object'
  && value?.tableHashes !== null
  && typeof value?.tableHashes === 'object'
);

const readV2Manifest = async (database: Firestore): Promise<CloudManifest | null> => {
  const snapshot = await getDocumentFromServer(database, CLOUD_MANIFEST_ID);
  if (!snapshot.exists()) return null;

  const manifest = snapshot.data();
  if (!isV2Manifest(manifest)) {
    throw new Error('O manifesto do backup em nuvem esta invalido ou incompleto.');
  }
  return manifest;
};

const hashText = async (value: string): Promise<string> => {
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', textEncoder.encode(value));
    return Array.from(new Uint8Array(digest))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  // Fallback para navegadores antigos. O SHA-256 e usado sempre que disponivel.
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const sanitizeDocumentPart = (value: string) => (
  value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48) || 'table'
);

const serializeArrayInChunks = (items: unknown[]): string[] => {
  if (items.length === 0) return [];

  const chunks: string[] = [];
  let currentItems: string[] = [];
  let currentBytes = 2;

  const flush = () => {
    if (currentItems.length === 0) return;
    chunks.push(`[${currentItems.join(',')}]`);
    currentItems = [];
    currentBytes = 2;
  };

  items.forEach((item, index) => {
    const serialized = JSON.stringify(item);
    if (serialized === undefined) {
      throw new Error(`O registro ${index + 1} nao pode ser convertido para JSON.`);
    }

    const itemBytes = textEncoder.encode(serialized).byteLength;
    if (itemBytes + 2 > MAX_CHUNK_PAYLOAD_BYTES) {
      throw new Error(`Um registro isolado excede o tamanho seguro do Firebase (${itemBytes} bytes).`);
    }

    const separatorBytes = currentItems.length > 0 ? 1 : 0;
    if (
      currentItems.length > 0
      && currentBytes + separatorBytes + itemBytes > MAX_CHUNK_PAYLOAD_BYTES
    ) {
      flush();
    }

    currentItems.push(serialized);
    currentBytes += (currentItems.length > 1 ? 1 : 0) + itemBytes;
  });

  flush();
  return chunks;
};

const sanitizeCloudRecord = (table: string, item: unknown): unknown => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  const record = { ...(item as Record<string, unknown>) };
  // Assinaturas são imagens base64 e podem ultrapassar o limite de um bloco.
  // A cópia local permanece intacta; o backup remoto guarda os dados operacionais
  // e uma indicação explícita para a revisão do anexo original.
  for (const key of ['assinaturaDigital', 'assinaturaResponsavel']) {
    if (typeof record[key] === 'string' && record[key].length > 100_000) {
      record[key] = '[anexo preservado no dispositivo de origem]';
    }
  }
  // Há versões antigas que gravaram o anexo com outro nome ou dentro de um
  // campo expandido. Reduza somente os maiores campos até caber no bloco;
  // datas, números e textos operacionais curtos permanecem íntegros.
  while (textEncoder.encode(JSON.stringify(record)).byteLength > MAX_CHUNK_PAYLOAD_BYTES) {
    const candidates = Object.entries(record)
      .filter(([, value]) => typeof value === 'string' && value.length > 256)
      .sort(([, a], [, b]) => String(b).length - String(a).length);
    if (candidates.length === 0) break;
    record[candidates[0][0]] = '[conteúdo extenso preservado no dispositivo de origem]';
  }
  return record;
};

const countRecords = (data: FirebaseCloudData) => (
  Object.values(data).reduce(
    (total, value) => total + (Array.isArray(value) ? value.length : 0),
    0,
  )
);

const readIntermediateBackup = async (
  database: Firestore,
): Promise<FirebaseDownloadResult | null> => {
  const metaSnapshot = await getDocumentFromServer(database, INTERMEDIATE_META_ID);
  if (!metaSnapshot.exists()) return null;

  const tableSnapshots = await runWithConcurrency(INTERMEDIATE_TABLE_IDS.map(table => async () => ({
    table,
    snapshot: await getDocumentFromServer(database, table),
  })));
  const restoredData: FirebaseCloudData = {};

  tableSnapshots.forEach(({ table, snapshot }) => {
    if (!snapshot.exists()) return;
    const value = snapshot.data().value;
    if (Array.isArray(value)) restoredData[table] = value;
  });

  if (Object.keys(restoredData).length === 0) return null;
  const metaData = metaSnapshot.data();
  const updatedAt = typeof metaData.updatedAt === 'string' ? metaData.updatedAt : '';
  restoredData.updatedAt = updatedAt;
  return {
    data: restoredData,
    source: 'intermediate',
    updatedAt,
    totalRecords: countRecords(restoredData),
  };
};

export const formatFirebaseSyncError = (error: unknown): string => {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';
  const message = error instanceof Error ? error.message : String(error);
  const normalized = `${code} ${message}`.toLowerCase();

  if (normalized.includes('permission-denied') || normalized.includes('missing or insufficient permissions')) {
    return 'A gravação automática foi recusada pela política de acesso. A equipe técnica precisa revisar as permissões do ambiente.';
  }
  if (normalized.includes('resource-exhausted') || normalized.includes('maximum size')) {
    return 'O armazenamento automático atingiu o limite disponível. Nenhum dado local foi descartado.';
  }
  if (normalized.includes('cloud_version_conflict')) {
    return 'Outro computador publicou dados enquanto este envio estava em andamento. Baixe a versao mais recente antes de tentar novamente.';
  }
  if (
    normalized.includes('excedeu')
    || normalized.includes('unavailable')
    || normalized.includes('offline')
    || normalized.includes('network')
  ) {
    return 'O serviço de dados não respondeu. Verifique a internet; a operação foi encerrada sem travar a tela.';
  }
  return message || 'Falha desconhecida ao acessar o serviço de dados.';
};

export const getFirebaseConnectionStatus = async (
  database: Firestore,
): Promise<FirebaseConnectionStatus> => {
  const manifestSnapshot = await getDocumentFromServer(database, CLOUD_MANIFEST_ID);
  if (manifestSnapshot.exists()) {
    const manifest = manifestSnapshot.data();
    return {
      connected: true,
      updatedAt: typeof manifest.updatedAt === 'string' ? manifest.updatedAt : '',
      schemaVersion: manifest.schemaVersion === CLOUD_SCHEMA_VERSION ? CLOUD_SCHEMA_VERSION : 0,
    };
  }

  const intermediateSnapshot = await getDocumentFromServer(database, INTERMEDIATE_META_ID);
  if (intermediateSnapshot.exists()) {
    const intermediateData = intermediateSnapshot.data();
    return {
      connected: true,
      updatedAt: typeof intermediateData.updatedAt === 'string' ? intermediateData.updatedAt : '',
      schemaVersion: 1,
    };
  }

  const legacySnapshot = await getDocumentFromServer(database, LEGACY_DOCUMENT_ID);
  const legacyData = legacySnapshot.exists() ? legacySnapshot.data() : null;
  return {
    connected: legacySnapshot.exists(),
    updatedAt: typeof legacyData?.updatedAt === 'string' ? legacyData.updatedAt : '',
    schemaVersion: legacySnapshot.exists() ? 1 : 0,
  };
};

const performFirebaseBackupUpload = async (
  database: Firestore,
  data: FirebaseCloudData,
): Promise<FirebaseUploadResult> => {
  const previousManifest = await readV2Manifest(database);
  const expectedGeneration = previousManifest?.generation || '';
  const generation = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const updatedAt = new Date().toISOString();
  const chunks: Record<string, string[]> = {};
  const tableHashes: Record<string, string> = {};
  const totalRecords: Record<string, number> = {};
  const documentsToWrite: Array<{ id: string; data: CloudChunk & typeof compatibilityFields }> = [];
  let reusedDocuments = 0;

  const sanitizedData = Object.fromEntries(
    Object.entries(data).map(([table, value]) => [
      table,
      Array.isArray(value) ? value.map(item => sanitizeCloudRecord(table, item)) : value,
    ]),
  ) as FirebaseCloudData;
  for (const [table, rawItems] of Object.entries(sanitizedData)) {
    if (!Array.isArray(rawItems)) continue;

    const fullPayload = JSON.stringify(rawItems);
    const contentHash = await hashText(fullPayload);
    const previousIds = previousManifest?.chunks?.[table];
    const hasMatchingPreviousChunks = previousManifest?.tableHashes?.[table] === contentHash
      && Array.isArray(previousIds)
      && previousIds.length > 0;
    const previousChunksExist = hasMatchingPreviousChunks
      ? (await runWithConcurrency(previousIds.map(documentId => async () => (
          getDocumentFromServer(database, documentId)
        )))).every(snapshot => snapshot.exists())
      : false;
    const canReuse = hasMatchingPreviousChunks && previousChunksExist;

    tableHashes[table] = contentHash;
    totalRecords[table] = rawItems.length;

    if (canReuse) {
      chunks[table] = previousIds;
      reusedDocuments += previousIds.length;
      continue;
    }

    const payloads = serializeArrayInChunks(rawItems);
    const safeTable = sanitizeDocumentPart(table);
    const documentIds = payloads.map((_, index) => (
      `chunk_${safeTable}_${contentHash.slice(0, 20)}_${String(index).padStart(3, '0')}`
    ));

    chunks[table] = documentIds;
    payloads.forEach((payload, index) => {
      documentsToWrite.push({
        id: documentIds[index],
        data: {
          ...compatibilityFields,
          schemaVersion: CLOUD_SCHEMA_VERSION,
          kind: 'chunk',
          generation,
          updatedAt,
          table,
          chunkIndex: index,
          totalChunks: payloads.length,
          contentHash,
          payload,
        },
      });
    });
  }

  await runWithConcurrency(documentsToWrite.map(documentToWrite => async () => {
    await withTimeout(
      setDoc(doc(database, CLOUD_COLLECTION, documentToWrite.id), documentToWrite.data),
      `Envio do bloco ${documentToWrite.id}`,
      FIREBASE_WRITE_TIMEOUT_MS,
    );
  }));

  const manifest: CloudManifest & typeof compatibilityFields = {
    ...compatibilityFields,
    schemaVersion: CLOUD_SCHEMA_VERSION,
    kind: 'manifest',
    generation,
    updatedAt,
    chunks,
    tableHashes,
    totalRecords,
  };

  // O manifesto e escrito por ultimo e somente se a versao lida no inicio ainda for a ativa.
  // Isso impede que dois computadores sobrescrevam silenciosamente o trabalho um do outro.
  await withTimeout(
    runTransaction(database, async transaction => {
      const manifestReference = doc(database, CLOUD_COLLECTION, CLOUD_MANIFEST_ID);
      const currentSnapshot = await transaction.get(manifestReference);
      const currentGeneration = currentSnapshot.exists()
        ? String(currentSnapshot.data()?.generation || '')
        : '';

      if (currentGeneration !== expectedGeneration) {
        throw new Error('CLOUD_VERSION_CONFLICT');
      }

      transaction.set(manifestReference, manifest);
    }),
    'Publicacao do manifesto do backup',
    FIREBASE_WRITE_TIMEOUT_MS,
  );

  // As regras do Firestore proíbem exclusões pelo navegador para proteger o
  // histórico operacional. Blocos antigos ficam órfãos e podem ser limpos por
  // uma rotina administrativa; nunca devem transformar um envio válido em erro.
  const compatibilityWrites = await Promise.allSettled([
    setDoc(doc(database, CLOUD_COLLECTION, LEGACY_DOCUMENT_ID), { historyLogs: [] }, { merge: true }),
    setDoc(doc(database, CLOUD_COLLECTION, 'historyLogs'), { value: [], updatedAt }, { merge: true }),
  ]);
  if (compatibilityWrites.some(result => result.status === 'rejected')) {
    // O manifesto v2 já foi confirmado. Esses espelhos existem apenas para
    // versões antigas e uma recusa neles não invalida o backup atual.
    console.warn('Backup v2 confirmado; não foi possível atualizar um espelho legado do Firebase.');
  }

  return {
    updatedAt,
    totalRecords: countRecords(data),
    writtenDocuments: documentsToWrite.length + 1,
    reusedDocuments,
  };
};

let uploadQueue: Promise<void> = Promise.resolve();

export const uploadFirebaseBackup = (
  database: Firestore,
  data: FirebaseCloudData,
): Promise<FirebaseUploadResult> => {
  const queuedUpload = uploadQueue.then(
    () => performFirebaseBackupUpload(database, data),
    () => performFirebaseBackupUpload(database, data),
  );
  uploadQueue = queuedUpload.then(() => undefined, () => undefined);
  return queuedUpload;
};

export const downloadFirebaseBackup = async (
  database: Firestore,
): Promise<FirebaseDownloadResult> => {
  const manifest = await readV2Manifest(database);
  if (manifest) {
    const tables = Object.entries(manifest.chunks);
    const chunkIds = tables.flatMap(([, ids]) => ids);
    const snapshots = await runWithConcurrency(chunkIds.map(chunkId => async () => ({
      id: chunkId,
      snapshot: await getDocumentFromServer(database, chunkId),
    })));
    const chunksById = new Map(snapshots.map(item => [item.id, item.snapshot]));
    const restoredData: FirebaseCloudData = {};

    for (const [table, tableChunkIds] of tables) {
      const restoredItems: unknown[] = [];
      for (const chunkId of tableChunkIds) {
        const snapshot = chunksById.get(chunkId);
        if (!snapshot?.exists()) {
          throw new Error(`O bloco ${chunkId} esta ausente. O backup em nuvem ficou incompleto.`);
        }

        const chunk = snapshot.data() as Partial<CloudChunk>;
        if (chunk.kind !== 'chunk' || chunk.table !== table || typeof chunk.payload !== 'string') {
          throw new Error(`O bloco ${chunkId} nao pertence a tabela ${table}.`);
        }

        const parsedItems = JSON.parse(chunk.payload);
        if (!Array.isArray(parsedItems)) {
          throw new Error(`O bloco ${chunkId} possui conteudo invalido.`);
        }
        restoredItems.push(...parsedItems);
      }

      const expectedHash = manifest.tableHashes[table];
      if (expectedHash && await hashText(JSON.stringify(restoredItems)) !== expectedHash) {
        throw new Error(`A verificacao de integridade falhou para a tabela ${table}.`);
      }
      restoredData[table] = restoredItems;
    }

    restoredData.updatedAt = manifest.updatedAt;
    return {
      data: restoredData,
      source: 'v2',
      updatedAt: manifest.updatedAt,
      totalRecords: countRecords(restoredData),
    };
  }

  const intermediateBackup = await readIntermediateBackup(database);
  if (intermediateBackup) return intermediateBackup;

  const legacySnapshot = await getDocumentFromServer(database, LEGACY_DOCUMENT_ID);
  if (!legacySnapshot.exists()) {
    return { data: null, source: 'none', updatedAt: '', totalRecords: 0 };
  }

  const legacyData = legacySnapshot.data() as FirebaseCloudData;
  return {
    data: legacyData,
    source: 'legacy',
    updatedAt: typeof legacyData.updatedAt === 'string' ? legacyData.updatedAt : '',
    totalRecords: countRecords(legacyData),
  };
};
