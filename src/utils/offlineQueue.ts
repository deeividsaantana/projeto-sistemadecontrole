export type OfflineCommand<T = unknown> = {
  id: string;
  idempotencyKey: string;
  kind: string;
  payload: T;
  createdAt: string;
  attempts: number;
  lastError?: string;
};

const DB_NAME = 'renea-erp-offline';
const STORE_NAME = 'commands';
const MEMORY_KEY = 'renea_offline_queue_fallback';

const fallbackRead = (): OfflineCommand[] => {
  try {
    return JSON.parse(localStorage.getItem(MEMORY_KEY) || '[]') as OfflineCommand[];
  } catch {
    return [];
  }
};

const fallbackWrite = (items: OfflineCommand[]) => localStorage.setItem(MEMORY_KEY, JSON.stringify(items));

const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (!('indexedDB' in window)) {
    reject(new Error('IndexedDB indisponível'));
    return;
  }
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('Falha ao abrir fila offline'));
});

export const createIdempotencyKey = (kind: string, payload: unknown) => {
  const raw = `${kind}|${JSON.stringify(payload)}|${Date.now()}|${Math.random()}`;
  let hash = 2166136261;
  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${kind}-${(hash >>> 0).toString(16)}-${Date.now().toString(36)}`;
};

export const listOfflineCommands = async (): Promise<OfflineCommand[]> => {
  try {
    const database = await openDatabase();
    return await new Promise<OfflineCommand[]>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve((request.result || []) as OfflineCommand[]);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return fallbackRead();
  }
};

export const enqueueOfflineCommand = async <T>(kind: string, payload: T) => {
  const existing = (await listOfflineCommands()).find(item => item.kind === kind);
  if (existing) return existing as OfflineCommand<T>;
  const idempotencyKey = createIdempotencyKey(kind, payload);
  const command: OfflineCommand<T> = {
    id: idempotencyKey,
    idempotencyKey,
    kind,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  try {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(command);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    fallbackWrite([...fallbackRead().filter(item => item.id !== command.id), command]);
  }
  window.dispatchEvent(new CustomEvent('renea-offline-queue-change'));
  return command;
};

export const removeOfflineCommand = async (id: string) => {
  try {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    fallbackWrite(fallbackRead().filter(item => item.id !== id));
  }
  window.dispatchEvent(new CustomEvent('renea-offline-queue-change'));
};

export const flushOfflineCommands = async (
  handlers: Record<string, (command: OfflineCommand) => Promise<void>>
) => {
  const commands = await listOfflineCommands();
  const result = { processed: 0, failed: 0, pending: commands.length };
  for (const command of commands) {
    const handler = handlers[command.kind];
    if (!handler) continue;
    try {
      await handler(command);
      await removeOfflineCommand(command.id);
      result.processed += 1;
      result.pending -= 1;
    } catch {
      result.failed += 1;
    }
  }
  return result;
};
