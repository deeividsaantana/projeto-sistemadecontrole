import {
  cleanString,
  jsonResponse,
  serverTimestamp,
  stableHash,
} from './firebase-admin.js';

export const IDEMPOTENCY_COLLECTION = 'sistemarenea_idempotency_keys';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const PROCESSING_TIMEOUT_MS = 2 * 60 * 1000;

const parseJsonBodySafely = body => {
  try {
    return JSON.parse(String(body || '{}'));
  } catch {
    return null;
  }
};

export const buildIdempotencyDocumentId = (context, method, key) => stableHash([
  context.organizationId,
  context.userId,
  method,
  key,
].join('|')).slice(0, 48);

export const buildRequestHash = event => stableHash([
  cleanString(event?.httpMethod || 'GET', 12).toUpperCase(),
  cleanString(event?.path || '', 240),
  event?.body || '',
].join('|'));

const toReplayResponse = response => jsonResponse(response.statusCode, response.payload, {
  'X-Idempotent-Replay': 'true',
});

export const withIdempotency = async (event, context, key, operation) => {
  if (!key) return await operation();

  const method = cleanString(event?.httpMethod || 'GET', 12).toUpperCase();
  const requestHash = buildRequestHash(event);
  const documentId = buildIdempotencyDocumentId(context, method, key);
  const reference = context.database.collection(IDEMPOTENCY_COLLECTION).doc(documentId);
  let replay = null;
  let claimed = false;
  const now = Date.now();

  await context.database.runTransaction(async transaction => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) {
      claimed = true;
      transaction.create(reference, {
        id: documentId,
        organizationId: context.organizationId,
        userId: context.userId,
        method,
        requestHash,
        keyHash: stableHash(key).slice(0, 24),
        status: 'processing',
        requestId: context.requestId || null,
        createdAt: serverTimestamp(),
        createdAtIso: new Date(now).toISOString(),
        expiresAtIso: new Date(now + IDEMPOTENCY_TTL_MS).toISOString(),
      });
      return;
    }

    const data = snapshot.data() || {};
    if (data.requestHash && data.requestHash !== requestHash) {
      const error = new Error('Chave de idempotencia ja usada em outra operacao.');
      error.statusCode = 409;
      throw error;
    }
    if (data.status === 'completed' && data.response) {
      replay = data.response;
      return;
    }
    const createdAtMs = Date.parse(data.createdAtIso || '');
    if (Number.isFinite(createdAtMs) && now - createdAtMs > PROCESSING_TIMEOUT_MS) {
      claimed = true;
      transaction.set(reference, {
        status: 'processing',
        requestId: context.requestId || null,
        retriedAt: serverTimestamp(),
        retriedAtIso: new Date(now).toISOString(),
      }, { merge: true });
      return;
    }
    const error = new Error('Operacao equivalente ainda esta em processamento.');
    error.statusCode = 409;
    throw error;
  });

  if (replay) return toReplayResponse(replay);
  if (!claimed) {
    const error = new Error('Operacao idempotente nao pode ser reivindicada.');
    error.statusCode = 409;
    throw error;
  }

  try {
    const response = await operation();
    await reference.set({
      status: 'completed',
      response: {
        statusCode: Number(response.statusCode || 200),
        payload: parseJsonBodySafely(response.body),
      },
      completedAt: serverTimestamp(),
      completedAtIso: new Date().toISOString(),
    }, { merge: true });
    return response;
  } catch (error) {
    await reference.set({
      status: 'failed',
      errorStatusCode: Number(error?.statusCode) || 500,
      failedAt: serverTimestamp(),
      failedAtIso: new Date().toISOString(),
    }, { merge: true });
    throw error;
  }
};
