import {
  enforceRateLimit,
  functionErrorResponse,
  getAdminBucket,
  getAdminDb,
  jsonResponse,
  parseJsonBody,
  requestIpHash,
  requireStaffUser,
  serverTimestamp,
} from './_shared/firebase-admin.js';
import { constantTimeEquals } from './_shared/public-access.js';
import { loadCloudSnapshot } from './_shared/cloud-snapshot.js';
import {
  MATERIAL_USE_KIND,
  buildFieldView,
  dateInSaoPaulo,
  materialUsePhotoPath,
  resolveMaterialLinkToken,
  sanitizeMaterialPhotos,
  sanitizeMaterialUse,
} from './_shared/material-usage.js';

// Link do apontador de materiais: sem login, protegido por token, só lê o
// necessário (ramos, materiais e movimentos) e grava na fila pública. Quem
// transforma o envio em movimento é o ERP aberto, como na presença.
const SUBMISSIONS_COLLECTION = 'sistemarenea_public_submissions';
const ACCESS_HEADER = 'x-renea-material-access';
const SNAPSHOT_TABLES = ['etapas', 'materiaisCadastro', 'materiaisMovimentos'];

const accessToken = (event, body = {}) => String(
  event.headers?.[ACCESS_HEADER]
    || event.headers?.[ACCESS_HEADER.toUpperCase()]
    || body.accessToken
    || '',
).trim();

const requireMaterialAccess = (event, body) => {
  const expected = resolveMaterialLinkToken();
  if (!expected) {
    const error = new Error('O link de materiais ainda não foi configurado pelo administrador.');
    error.statusCode = 503;
    throw error;
  }
  if (!constantTimeEquals(accessToken(event, body), expected)) {
    const error = new Error('Este link de materiais é inválido ou foi substituído. Peça um novo ao escritório.');
    error.statusCode = 403;
    throw error;
  }
};

/**
 * Envios que ainda contam no saldo do link: os pendentes de qualquer dia e os
 * de hoje já processados (o retrato da nuvem pode levar alguns segundos para
 * trazer o movimento incorporado; `buildFieldView` descarta os repetidos).
 */
const loadOpenSubmissions = async (database, today) => {
  const [pending, ofToday] = await Promise.all([
    database.collection(SUBMISSIONS_COLLECTION).where('status', '==', 'pending').get(),
    database.collection(SUBMISSIONS_COLLECTION).where('payload.data', '==', today).get(),
  ]);
  const byId = new Map();
  for (const document of [...pending.docs, ...ofToday.docs]) {
    const value = document.data();
    if (value?.kind !== MATERIAL_USE_KIND) continue;
    byId.set(document.id, { id: document.id, ...value });
  }
  return [...byId.values()];
};

const loadView = async database => {
  const today = dateInSaoPaulo(0);
  const [snapshot, pendentes] = await Promise.all([
    loadCloudSnapshot(database, SNAPSHOT_TABLES, { cacheTtlMs: 5_000, allowLegacyFallback: true }),
    loadOpenSubmissions(database, today),
  ]);
  return buildFieldView({
    etapas: snapshot.etapas || [],
    materiais: snapshot.materiaisCadastro || [],
    movimentos: snapshot.materiaisMovimentos || [],
    pendentes,
    today,
  });
};

/**
 * Grava as fotos antes do envio. Se o Storage falhar, o uso de material não
 * se perde: salva sem as fotos e o celular avisa que elas não foram.
 */
const uploadPhotos = async (submissionId, photos) => {
  if (photos.length === 0) return { paths: [], failed: false };
  try {
    const bucket = getAdminBucket();
    const paths = await Promise.all(photos.map(async (bytes, index) => {
      const path = materialUsePhotoPath(submissionId, index);
      await bucket.file(path).save(bytes, { contentType: 'image/jpeg', resumable: false, metadata: { cacheControl: 'private, max-age=31536000' } });
      return path;
    }));
    return { paths, failed: false };
  } catch (error) {
    console.error('Fotos do apontador não foram gravadas:', error?.message || error);
    return { paths: [], failed: true };
  }
};

const saveSubmission = async (database, event, body) => {
  const view = await loadView(database);
  const submission = sanitizeMaterialUse(body, view, { today: view.dataAtual, yesterday: dateInSaoPaulo(-1) });
  const photos = sanitizeMaterialPhotos(body);
  const reference = database.collection(SUBMISSIONS_COLLECTION).doc(submission.id);
  // Mesmo envio de novo (toque duplo, rede caiu depois de gravar): devolve o
  // que já está salvo em vez de contar o uso duas vezes nem subir as fotos de novo.
  if ((await reference.get()).exists) return { id: submission.id, replay: true, fotos: photos.length, fotosFalharam: false };
  const uploaded = await uploadPhotos(submission.id, photos);
  const createdAtIso = new Date().toISOString();
  let replay = false;
  await database.runTransaction(async transaction => {
    const current = await transaction.get(reference);
    if (current.exists) {
      replay = true;
      return;
    }
    transaction.create(reference, {
      kind: MATERIAL_USE_KIND,
      status: 'pending',
      createdAtIso,
      createdAt: serverTimestamp(),
      sourceIpHash: requestIpHash(event),
      payload: JSON.parse(JSON.stringify({ ...submission.payload, fotos: uploaded.paths.length ? uploaded.paths : undefined })),
    });
  });
  return { id: submission.id, replay, createdAtIso, fotos: uploaded.paths.length, fotosFalharam: uploaded.failed };
};

export const handler = async event => {
  try {
    const method = String(event.httpMethod || 'GET').toUpperCase();
    const action = String(event.queryStringParameters?.action || '');
    if (method === 'GET' && action === 'link') {
      await requireStaffUser(event);
      const token = resolveMaterialLinkToken();
      if (!token) {
        return jsonResponse(503, { success: false, message: 'O link de materiais ainda não foi configurado no servidor.' });
      }
      return jsonResponse(200, { success: true, data: { path: `/material-link/${encodeURIComponent(token)}` } });
    }

    const body = method === 'POST' ? parseJsonBody(event, 1_900_000) : {};
    requireMaterialAccess(event, body);
    const database = getAdminDb();

    if (method === 'GET') {
      await enforceRateLimit(database, event, 'public-materiais-GET', 240, 300);
      return jsonResponse(200, { success: true, data: await loadView(database) });
    }
    if (method !== 'POST') return jsonResponse(405, { success: false, message: 'Método não permitido.' }, { Allow: 'GET, POST' });
    await enforceRateLimit(database, event, 'public-materiais-POST', 180, 3600);
    const saved = await saveSubmission(database, event, body);
    return jsonResponse(saved.replay ? 200 : 201, {
      success: true,
      message: saved.fotosFalharam ? 'Uso salvo, mas as fotos não foram. Avise o escritório.' : 'Uso salvo.',
      data: { ...saved, view: await loadView(database) },
    });
  } catch (error) {
    return functionErrorResponse(error);
  }
};
