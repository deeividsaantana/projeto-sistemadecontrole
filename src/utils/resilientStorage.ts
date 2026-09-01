const DATABASE_NAME = 'sistema_renea_recovery';
const DATABASE_VERSION = 1;
const STORE_NAME = 'local_storage_mirror';
const KEY_PREFIX = 'renea_';

const JSON_ARRAY_STORAGE_KEYS = new Set([
  'renea_empresas',
  'renea_obras',
  'renea_equipamentos',
  'renea_funcionarios',
  'renea_motoristas_operacionais',
  'renea_comboios',
  'renea_combustiveis',
  'renea_lubrificantes',
  'renea_etapas',
  'renea_abastecimentos',
  'renea_lubrificacoes',
  'renea_tickets_jazida',
  'renea_listas_presenca',
  'renea_ordens_servico',
  'renea_grupos_equipes',
  'renea_presencas_link',
  'renea_historico_presencas',
  'renea_apontamento_ramos',
  'renea_apontamento_ramo_registros',
  'renea_materiais_cadastro',
  'renea_materiais_registros',
  'renea_partes_diarias_equipamentos',
  'renea_controle_equipamentos_diario',
  'renea_vinculos_operador_equipamento',
  'renea_periodos_arquivados',
  'renea_history_logs',
  'renea_notifications',
  'renea_jazida_printed_batches',
  'renea_ticket_link_drafts_v2',
  'renea_ticket_link_history_v1',
  'renea_offline_queue_fallback',
  'renea_master_data_review_queue',
]);

const JSON_OBJECT_STORAGE_KEYS = new Set([
  'renea_controle_estacas',
  'renea_last_deletion_recovery',
]);

interface MirroredValue {
  key: string;
  value: string;
  updatedAt: string;
}

interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const isStorageQuotaExceededError = (error: unknown): boolean => {
  let current: unknown = error;
  const visited = new Set<unknown>();

  while (current && typeof current === 'object' && !visited.has(current)) {
    visited.add(current);
    const candidate = current as { name?: unknown; message?: unknown; code?: unknown; cause?: unknown };
    const name = String(candidate.name || '').toLowerCase();
    const message = String(candidate.message || '').toLowerCase();
    const code = Number(candidate.code);
    if (
      name.includes('quotaexceeded')
      || message.includes('exceeded the quota')
      || message.includes('quota exceeded')
      || code === 22
      || code === 1014
    ) return true;
    current = candidate.cause;
  }

  return false;
};

export interface StorageBatchEntry {
  key: string;
  value: string;
}

export const commitStorageBatch = (
  storage: StorageAdapter,
  entries: StorageBatchEntry[],
): void => {
  const uniqueEntries = Array.from(new Map(entries.map(entry => [entry.key, entry])).values());
  const previousValues = new Map(uniqueEntries.map(entry => [entry.key, storage.getItem(entry.key)]));
  const appliedKeys: string[] = [];

  try {
    uniqueEntries.forEach(entry => {
      storage.setItem(entry.key, entry.value);
      appliedKeys.push(entry.key);
    });
  } catch (error) {
    const rollbackFailures: string[] = [];
    [...appliedKeys].reverse().forEach(key => {
      try {
        const previous = previousValues.get(key);
        if (previous === null || previous === undefined) storage.removeItem(key);
        else storage.setItem(key, previous);
      } catch {
        rollbackFailures.push(key);
      }
    });
    const detail = rollbackFailures.length
      ? ` A reversão também falhou em: ${rollbackFailures.join(', ')}.`
      : ' Nenhuma alteração parcial foi mantida.';
    throw new Error(`Não foi possível gravar o conjunto completo no navegador.${detail}`, { cause: error });
  }
};

export const isReneaJsonArrayStorageKey = (key: string) => JSON_ARRAY_STORAGE_KEYS.has(key);

export const isReneaStoredValueValid = (key: string, value: string | null): boolean => {
  if (value === null) return false;
  if (!isReneaJsonArrayStorageKey(key) && !JSON_OBJECT_STORAGE_KEYS.has(key)) return true;
  try {
    const parsed = JSON.parse(value);
    if (isReneaJsonArrayStorageKey(key)) return Array.isArray(parsed);
    return Boolean(parsed) && typeof parsed === 'object' && !Array.isArray(parsed);
  } catch {
    return false;
  }
};

export const parseReneaStoredJson = <T,>(rawValue: string | null, fallback: T): T => {
  if (!rawValue) return fallback;
  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
};

const openRecoveryDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    reject(new Error('IndexedDB indisponível.'));
    return;
  }
  const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(STORE_NAME)) {
      database.createObjectStore(STORE_NAME, { keyPath: 'key' });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('Falha ao abrir a recuperação local.'));
});

const requestResult = <T,>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('Falha no armazenamento de recuperação.'));
});

export const mirrorReneaLocalStorage = async () => {
  try {
    const database = await openRecoveryDatabase();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const updatedAt = new Date().toISOString();
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(KEY_PREFIX)) continue;
      const value = localStorage.getItem(key);
      // Nunca troca a última cópia íntegra por um JSON quebrado.
      if (value === null || !isReneaStoredValueValid(key, value)) continue;
      store.put({ key, value, updatedAt } satisfies MirroredValue);
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Falha ao concluir a cópia local.'));
      transaction.onabort = () => reject(transaction.error || new Error('A cópia local foi interrompida.'));
    });
    database.close();
  } catch (error) {
    console.warn('A cópia de recuperação local não pôde ser atualizada:', error);
  }
};

export const restoreMissingReneaLocalStorage = async () => {
  try {
    const database = await openRecoveryDatabase();
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const records = await requestResult(store.getAll()) as MirroredValue[];
    const restoredKeys: string[] = [];

    records.forEach(record => {
      if (!record.key.startsWith(KEY_PREFIX) || !isReneaStoredValueValid(record.key, record.value)) return;
      const currentValue = localStorage.getItem(record.key);
      if (isReneaStoredValueValid(record.key, currentValue)) return;

      // Guarda o conteúdo danificado dentro do IndexedDB para perícia manual e
      // restaura a última cópia íntegra antes que o React hidrate a aplicação.
      if (currentValue !== null) {
        store.put({
          key: `corrupt::${record.key}::${Date.now()}`,
          value: currentValue,
          updatedAt: new Date().toISOString(),
        } satisfies MirroredValue);
      }
      try {
        localStorage.setItem(record.key, record.value);
        restoredKeys.push(record.key);
      } catch (error) {
        console.error(`Não foi possível restaurar ${record.key} no armazenamento local.`, error);
      }
    });

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Falha ao concluir a restauração local.'));
      transaction.onabort = () => reject(transaction.error || new Error('A restauração local foi interrompida.'));
    });
    database.close();
    if (restoredKeys.length > 0) {
      console.warn(`Recuperação automática restaurou ${restoredKeys.length} conjunto(s) de dados: ${restoredKeys.join(', ')}.`);
    }
  } catch (error) {
    console.warn('Nenhuma cópia IndexedDB pôde ser restaurada:', error);
  }
};

export const startReneaStorageMirror = () => {
  void mirrorReneaLocalStorage();
  const interval = window.setInterval(() => void mirrorReneaLocalStorage(), 10_000);
  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') void mirrorReneaLocalStorage();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  return () => {
    window.clearInterval(interval);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
};
