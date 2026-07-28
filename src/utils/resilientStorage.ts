const DATABASE_NAME = 'sistema_renea_recovery';
const DATABASE_VERSION = 1;
const STORE_NAME = 'local_storage_mirror';
const KEY_PREFIX = 'renea_';

interface MirroredValue {
  key: string;
  value: string;
  updatedAt: string;
}

const openRecoveryDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (!('indexedDB' in window)) {
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
      if (value === null) continue;
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
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const records = await requestResult(transaction.objectStore(STORE_NAME).getAll()) as MirroredValue[];
    records.forEach(record => {
      if (record.key.startsWith(KEY_PREFIX) && localStorage.getItem(record.key) === null) {
        localStorage.setItem(record.key, record.value);
      }
    });
    database.close();
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
