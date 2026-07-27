import crypto from 'node:crypto';
import {
  cleanString,
  functionErrorResponse,
  getAdminDb,
  jsonResponse,
  parseJsonBody,
  requireStaffUser,
  serverTimestamp,
  stableHash,
} from './_shared/firebase-admin.js';

const COLLECTION = 'sistemarenea_fuel_onedrive';
const MANIFEST_ID = 'current';
const MAX_ROWS = 4_000;
const MAX_CHUNK_BYTES = 500_000;
const SYNC_TOKEN = String(process.env.RENEA_ONEDRIVE_SYNC_TOKEN || '');

const constantTimeEquals = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const requireBridgeToken = event => {
  const authorization = String(event.headers?.authorization || event.headers?.Authorization || '');
  const received = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || '';
  if (!SYNC_TOKEN || !constantTimeEquals(received, SYNC_TOKEN)) {
    const error = new Error('Agente local do OneDrive não autorizado.');
    error.statusCode = 401;
    throw error;
  }
};

const cleanValue = value => {
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  return cleanString(value, 1_000);
};

const sanitizeRow = (source, index) => {
  const row = {};
  Object.entries(source && typeof source === 'object' ? source : {}).slice(0, 40).forEach(([key, value]) => {
    row[cleanString(key, 80)] = cleanValue(value);
  });
  row.rowNumber = Number.isInteger(Number(row.rowNumber)) ? Number(row.rowNumber) : index + 1;
  row.sourceRowId = cleanString(row.sourceRowId, 120) || `onedrive-${stableHash(JSON.stringify(row)).slice(0, 36)}`;
  return row;
};

const serializeChunks = rows => {
  const chunks = [];
  let current = [];
  let currentBytes = 2;
  rows.forEach(row => {
    const serialized = JSON.stringify(row);
    const bytes = Buffer.byteLength(serialized, 'utf8');
    if (current.length && currentBytes + bytes + 1 > MAX_CHUNK_BYTES) {
      chunks.push(current);
      current = [];
      currentBytes = 2;
    }
    current.push(row);
    currentBytes += bytes + (current.length > 1 ? 1 : 0);
  });
  if (current.length) chunks.push(current);
  return chunks;
};

const loadCurrentBatch = async database => {
  const manifestSnapshot = await database.collection(COLLECTION).doc(MANIFEST_ID).get();
  if (!manifestSnapshot.exists) {
    return {
      status: { state: 'waiting', intervalMinutes: 10, message: 'Aguardando a primeira leitura do OneDrive.' },
      rows: [],
    };
  }
  const manifest = manifestSnapshot.data();
  const ids = Array.isArray(manifest.chunkIds) ? manifest.chunkIds : [];
  const snapshots = await Promise.all(ids.map(id => database.collection(COLLECTION).doc(id).get()));
  const rows = snapshots.flatMap(snapshot => {
    const data = snapshot.data();
    return snapshot.exists && Array.isArray(data?.rows) ? data.rows : [];
  });
  const contentHash = stableHash(JSON.stringify(rows));
  if (manifest.contentHash && contentHash !== manifest.contentHash) {
    throw new Error('A carga do OneDrive está incompleta. O agente tentará novamente.');
  }
  return {
    status: {
      state: 'ready',
      intervalMinutes: 10,
      batchId: manifest.batchId,
      fileName: manifest.fileName,
      fileModifiedAt: manifest.fileModifiedAt,
      syncedAt: manifest.syncedAt,
      rowCount: manifest.rowCount,
      warningCount: manifest.warningCount || 0,
      message: manifest.message || 'Planilha lida automaticamente.',
    },
    rows,
  };
};

const receiveBatch = async event => {
  requireBridgeToken(event);
  const body = parseJsonBody(event, 5_500_000);
  if (!Array.isArray(body.rows) || body.rows.length > MAX_ROWS) {
    const error = new Error(`A carga deve conter no máximo ${MAX_ROWS} linhas.`);
    error.statusCode = 400;
    throw error;
  }
  const rows = body.rows.map(sanitizeRow);
  const fileName = cleanString(body.fileName, 240);
  const fileModifiedAt = cleanString(body.fileModifiedAt, 40);
  const contentHash = stableHash(JSON.stringify(rows));
  const batchId = stableHash(`${fileName}|${fileModifiedAt}|${contentHash}`).slice(0, 32);
  const chunks = serializeChunks(rows);
  const database = getAdminDb();
  const chunkIds = chunks.map((_, index) => `batch_${batchId}_${String(index).padStart(3, '0')}`);

  await Promise.all(chunks.map((chunkRows, index) => database.collection(COLLECTION).doc(chunkIds[index]).set({
    kind: 'fuel-onedrive-chunk',
    batchId,
    chunkIndex: index,
    totalChunks: chunks.length,
    rows: chunkRows,
    updatedAt: serverTimestamp(),
  })));

  const syncedAt = new Date().toISOString();
  await database.collection(COLLECTION).doc(MANIFEST_ID).set({
    kind: 'fuel-onedrive-manifest',
    batchId,
    fileName,
    fileModifiedAt,
    syncedAt,
    rowCount: rows.length,
    warningCount: Number(body.warningCount || 0),
    contentHash,
    chunkIds,
    message: cleanString(body.message, 300) || 'Planilha lida automaticamente.',
    updatedAt: serverTimestamp(),
  });

  return jsonResponse(200, { success: true, batchId, rowCount: rows.length, syncedAt });
};

export const handler = async event => {
  try {
    if (event.httpMethod === 'POST') return await receiveBatch(event);
    if (event.httpMethod !== 'GET') return jsonResponse(405, { success: false, message: 'Método não permitido.' });
    await requireStaffUser(event);
    const batch = await loadCurrentBatch(getAdminDb());
    const action = String(event.queryStringParameters?.action || 'status');
    return jsonResponse(200, {
      success: true,
      status: batch.status,
      ...(action === 'payload' ? { rows: batch.rows } : {}),
    });
  } catch (error) {
    return functionErrorResponse(error);
  }
};
