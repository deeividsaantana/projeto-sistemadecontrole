import {
  commitStorageBatch,
  isReneaStoredValueValid,
  parseReneaStoredJson,
  type StorageBatchEntry,
} from '../utils/resilientStorage';

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const writeStorageValue = (
  storage: Pick<Storage, 'setItem'>,
  storageKey: string,
  value: string,
): boolean => {
  try {
    storage.setItem(storageKey, value);
    return true;
  } catch (error) {
    const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.warn(`A cache local não pôde gravar ${storageKey}. O sistema continuará usando os dados em memória e a sincronização remota.`, reason);
    return false;
  }
};

export const parseStoredJson = <T,>(rawValue: string | null, storageKey: string, fallback: T): T => {
  if (!rawValue) return fallback;
  if (!isReneaStoredValueValid(storageKey, rawValue)) {
    console.error(`O dado local ${storageKey} esta corrompido e foi preservado para recuperacao.`);
    return fallback;
  }
  const parsed = parseReneaStoredJson<T | null>(rawValue, null);
  if (parsed !== null) return parsed;
  console.error(`O dado local ${storageKey} esta corrompido e foi preservado para recuperacao.`);
  return fallback;
};

export const readStoredJson = <T,>(
  storage: BrowserStorage,
  storageKey: string,
  fallback: T,
): T => parseStoredJson(storage.getItem(storageKey), storageKey, fallback);

export const writeStoredJson = <T,>(
  storage: BrowserStorage,
  storageKey: string,
  value: T,
): boolean => writeStorageValue(storage, storageKey, JSON.stringify(value));

export const readStoredFlag = (
  storage: BrowserStorage,
  storageKey: string,
): boolean => storage.getItem(storageKey) === 'true';

export const writeStoredFlag = (
  storage: BrowserStorage,
  storageKey: string,
  value: boolean,
): boolean => writeStorageValue(storage, storageKey, value ? 'true' : 'false');

export const writeStoredBatch = (
  storage: BrowserStorage,
  entries: StorageBatchEntry[],
): void => {
  commitStorageBatch(storage, entries);
};
