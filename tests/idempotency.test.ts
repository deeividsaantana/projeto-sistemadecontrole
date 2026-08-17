import assert from 'node:assert/strict';
import test from 'node:test';
import { jsonResponse } from '../netlify/functions/_shared/firebase-admin.js';
import {
  buildIdempotencyDocumentId,
  buildRequestHash,
  IDEMPOTENCY_COLLECTION,
  withIdempotency,
} from '../netlify/functions/_shared/idempotency.js';

const createMemoryDatabase = () => {
  const store = new Map<string, Record<string, unknown>>();
  const refKey = (collection: string, id: string) => `${collection}/${id}`;
  const database = {
    store,
    collection(collectionName: string) {
      return {
        doc(id: string) {
          const key = refKey(collectionName, id);
          return {
            collectionName,
            id,
            key,
            async set(data: Record<string, unknown>, options?: { merge?: boolean }) {
              store.set(key, options?.merge ? { ...(store.get(key) || {}), ...data } : data);
            },
          };
        },
      };
    },
    async runTransaction(operation: (transaction: {
      get: (reference: { key: string }) => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
      create: (reference: { key: string }, data: Record<string, unknown>) => void;
      set: (reference: { key: string }, data: Record<string, unknown>, options?: { merge?: boolean }) => void;
    }) => Promise<void>) {
      await operation({
        async get(reference) {
          const data = store.get(reference.key);
          return { exists: Boolean(data), data: () => data };
        },
        create(reference, data) {
          if (store.has(reference.key)) throw new Error('already exists');
          store.set(reference.key, data);
        },
        set(reference, data, options) {
          store.set(reference.key, options?.merge ? { ...(store.get(reference.key) || {}), ...data } : data);
        },
      });
    },
  };
  return database;
};

const createContext = () => ({
  database: createMemoryDatabase(),
  organizationId: 'renea',
  userId: 'usuario-1',
  requestId: 'req-idempotencia-1',
});

const event = {
  httpMethod: 'POST',
  path: '/.netlify/functions/master-data',
  body: JSON.stringify({ entity: 'equipment', data: { code: 'EQ-01' } }),
};

test('idempotencia cria documento deterministico por organizacao usuario metodo e chave', () => {
  const context = createContext();
  assert.equal(buildIdempotencyDocumentId(context, 'POST', 'operacao:abc-123456'), buildIdempotencyDocumentId(context, 'POST', 'operacao:abc-123456'));
  assert.notEqual(buildIdempotencyDocumentId(context, 'POST', 'operacao:abc-123456'), buildIdempotencyDocumentId(context, 'PATCH', 'operacao:abc-123456'));
  assert.equal(buildRequestHash(event), buildRequestHash(event));
});

test('idempotencia grava resposta e devolve replay para a mesma operacao', async () => {
  const context = createContext();
  let calls = 0;
  const first = await withIdempotency(event, context, 'operacao:cadastro-123', async () => {
    calls += 1;
    return jsonResponse(201, { success: true, data: { id: 'eq-1' } });
  });
  const second = await withIdempotency(event, context, 'operacao:cadastro-123', async () => {
    calls += 1;
    return jsonResponse(201, { success: true, data: { id: 'eq-2' } });
  });

  assert.equal(calls, 1);
  assert.equal(first.statusCode, 201);
  assert.equal(second.statusCode, 201);
  assert.equal(second.headers['X-Idempotent-Replay'], 'true');
  assert.deepEqual(JSON.parse(second.body).data, { id: 'eq-1' });
  assert.equal(context.database.store.size, 1);
  assert.equal([...context.database.store.keys()][0].startsWith(`${IDEMPOTENCY_COLLECTION}/`), true);
});

test('idempotencia rejeita reutilizacao da mesma chave com outro payload', async () => {
  const context = createContext();
  await withIdempotency(event, context, 'operacao:cadastro-456', async () => jsonResponse(201, { success: true }));
  await assert.rejects(
    () => withIdempotency({ ...event, body: JSON.stringify({ outro: true }) }, context, 'operacao:cadastro-456', async () => jsonResponse(201, { success: true })),
    (error: Error & { statusCode?: number }) => error.statusCode === 409,
  );
});
