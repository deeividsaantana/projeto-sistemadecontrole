import crypto from 'node:crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { extractBearerToken, mergeSecurityHeaders } from './api-security.js';

const FIREBASE_SERVICE_ACCOUNT_KEY = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64
  ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64, 'base64').toString('utf8')
  : process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '';
const FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://sistemaerp-787f6-default-rtdb.firebaseio.com';

const getServiceAccount = () => {
  if (!FIREBASE_SERVICE_ACCOUNT_KEY) {
    throw new Error('Conta de serviço Firebase não configurada no serviço. Defina FIREBASE_SERVICE_ACCOUNT_KEY_BASE64.');
  }
  try {
    return JSON.parse(FIREBASE_SERVICE_ACCOUNT_KEY);
  } catch (error) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_KEY inválida: ${error.message}`);
  }
};

export const getAdminDb = () => {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert(getServiceAccount()),
      databaseURL: FIREBASE_DATABASE_URL,
    });
  }
  return getFirestore();
};

export const getAdminAuth = () => {
  getAdminDb();
  return getAuth();
};

export const requireStaffUser = async event => {
  const token = extractBearerToken(event);
  if (!token) {
    const error = new Error('Faça login no sistema para consultar a integração.');
    error.statusCode = 401;
    throw error;
  }
  // A validação criptográfica e a claim `staff` já protegem a consulta. O modo
  // `checkRevoked` exige uma chamada administrativa adicional ao Google Auth e
  // falha no runtime empacotado do Netlify, embora o token Firebase seja válido.
  const decoded = await getAdminAuth().verifyIdToken(token);
  if (decoded.staff !== true) {
    const error = new Error('Sua conta não possui autorização de equipe.');
    error.statusCode = 403;
    throw error;
  }
  return decoded;
};

export const serverTimestamp = () => FieldValue.serverTimestamp();

export const jsonResponse = (statusCode, payload, extraHeaders = {}) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...mergeSecurityHeaders(extraHeaders),
  },
  body: JSON.stringify(payload),
});

export const parseJsonBody = (event, maxBytes = 250_000) => {
  const encoded = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64')
    : Buffer.from(event.body || '', 'utf8');
  if (encoded.byteLength > maxBytes) {
    const error = new Error('O envio excede o tamanho permitido.');
    error.statusCode = 413;
    throw error;
  }
  try {
    return JSON.parse(encoded.toString('utf8') || '{}');
  } catch {
    const error = new Error('O conteúdo enviado não é um JSON válido.');
    error.statusCode = 400;
    throw error;
  }
};

export const cleanString = (value, maxLength = 200) => String(value ?? '').trim().slice(0, maxLength);

export const isIsoDate = value => {
  const normalized = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return false;
  const [year, month, day] = normalized.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
};

export const stableHash = value => crypto.createHash('sha256').update(String(value)).digest('hex');

export const requestIpHash = event => {
  const forwarded = cleanString(
    event.headers?.['x-nf-client-connection-ip']
      || event.headers?.['x-real-ip']
      || event.headers?.['x-forwarded-for']
      || event.headers?.['client-ip']
      || 'unknown',
    200,
  );
  return stableHash(forwarded.split(',')[0].trim()).slice(0, 24);
};

export const enforceRateLimit = async (database, event, bucket, limit, windowSeconds) => {
  const windowId = Math.floor(Date.now() / (windowSeconds * 1000));
  const documentId = stableHash(`${bucket}|${requestIpHash(event)}|${windowId}`).slice(0, 48);
  const reference = database.collection('sistemarenea_rate_limits').doc(documentId);
  await database.runTransaction(async transaction => {
    const snapshot = await transaction.get(reference);
    const count = Number(snapshot.data()?.count || 0);
    if (count >= limit) {
      const error = new Error('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
      error.statusCode = 429;
      throw error;
    }
    transaction.set(reference, {
      bucket,
      count: count + 1,
      windowId,
      expiresAtIso: new Date((windowId + 2) * windowSeconds * 1000).toISOString(),
      updatedAt: serverTimestamp(),
    });
  });
};

export const functionErrorResponse = error => {
  const statusCode = Number(error?.statusCode) || 500;
  if (statusCode >= 500) console.error('Erro em função pública:', error);
  return jsonResponse(statusCode, {
    success: false,
    message: statusCode >= 500 ? 'O serviço está temporariamente indisponível.' : error.message,
  }, error?.headers || {});
};
