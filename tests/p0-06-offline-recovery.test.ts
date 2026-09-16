import assert from 'node:assert/strict';
import test from 'node:test';
import * as offlineQueue from '../src/utils/offlineQueue';

const storage = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
});

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    addEventListener: (type: string, listener: () => void) => {
      const registered = listeners.get(type) ?? new Set();
      registered.add(listener);
      listeners.set(type, registered);
    },
    removeEventListener: (type: string, listener: () => void) => listeners.get(type)?.delete(listener),
    dispatchEvent: (event: { type: string }) => {
      listeners.get(event.type)?.forEach(listener => listener());
      return true;
    },
  },
});

test('conta comandos pendentes antes e depois da recuperação manual', async () => {
  assert.equal(
    typeof (offlineQueue as typeof offlineQueue & { getOfflineCommandCount?: unknown }).getOfflineCommandCount,
    'function',
    'a fila precisa expor sua contagem para a interface informar pendências',
  );

  const getOfflineCommandCount = (offlineQueue as typeof offlineQueue & {
    getOfflineCommandCount: () => Promise<number>;
  }).getOfflineCommandCount;

  await offlineQueue.enqueueOfflineCommand('firebase-backup', { requestedAt: '2026-09-16T10:00:00.000Z' });
  assert.equal(await getOfflineCommandCount(), 1);

  assert.equal(
    typeof (offlineQueue as typeof offlineQueue & { retryOfflineCommands?: unknown }).retryOfflineCommands,
    'function',
    'a tentativa manual precisa usar uma operação nomeada, em vez de duplicar a lógica de flush na interface',
  );

  const retryOfflineCommands = (offlineQueue as typeof offlineQueue & {
    retryOfflineCommands: typeof offlineQueue.flushOfflineCommands;
  }).retryOfflineCommands;
  const result = await retryOfflineCommands({
    'firebase-backup': async () => undefined,
  });

  assert.deepEqual(result, { processed: 1, failed: 0, pending: 0 });
  assert.equal(await getOfflineCommandCount(), 0);
});
