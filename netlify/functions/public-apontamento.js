import crypto from 'node:crypto';
import {
  cleanString,
  enforceRateLimit,
  functionErrorResponse,
  getAdminDb,
  isIsoDate,
  jsonResponse,
  parseJsonBody,
  requestIpHash,
  serverTimestamp,
  stableHash,
} from './_shared/firebase-admin.js';
import { loadCloudSnapshot } from './_shared/cloud-snapshot.js';

const SNAPSHOT_CACHE_TTL_MS = 30_000;
let cachedSnapshot = null;
let cachedSnapshotUntil = 0;
let snapshotRequest = null;

const loadApontamentoSnapshot = async database => {
  const now = Date.now();
  if (cachedSnapshot && now < cachedSnapshotUntil) return cachedSnapshot;
  if (!snapshotRequest) {
    snapshotRequest = loadCloudSnapshot(database, ['apontamentoRamos'])
      .then(snapshot => {
        cachedSnapshot = snapshot;
        cachedSnapshotUntil = Date.now() + SNAPSHOT_CACHE_TTL_MS;
        return snapshot;
      })
      .finally(() => { snapshotRequest = null; });
  }
  return snapshotRequest;
};

const TURNOS = ['Manhã', 'Tarde', 'Noite'];
const CLIMAS = new Set(['Chuvoso', 'Nublado', 'Ensolarado']);
const CONDICOES = new Set(['Praticável', 'Impraticável']);

const activeRamosForToken = (snapshot, token) => (
  (snapshot.apontamentoRamos || []).filter(ramo => ramo?.status === 'ativo' && ramo?.linkAtivo && ramo.token === token)
);

const sanitizeRamo = (ramo, token) => ({
  id: cleanString(ramo.id, 160),
  canteiroNome: cleanString(ramo.canteiroNome, 180),
  ramoNome: cleanString(ramo.ramoNome, 180),
  responsavel: cleanString(ramo.responsavel, 160),
  token,
  status: 'ativo',
  linkAtivo: true,
  observacao: cleanString(ramo.observacao, 300),
});

const cleanQuantityItems = (items, maxItems = 100) => {
  if (!Array.isArray(items) || items.length > maxItems) {
    const error = new Error('A lista de quantidades é inválida.');
    error.statusCode = 400;
    throw error;
  }
  return items.map(item => ({
    nome: cleanString(item.nome, 120),
    quantidade: Math.min(5000, Math.max(0, Number(item.quantidade) || 0)),
  })).filter(item => item.nome);
};

const cleanTurnValues = (source, allowed, label) => {
  const result = {};
  TURNOS.forEach(turno => {
    const value = cleanString(source?.[turno], 40);
    if (!allowed.has(value)) {
      const error = new Error(`${label} inválido no turno ${turno}.`);
      error.statusCode = 400;
      throw error;
    }
    result[turno] = value;
  });
  return result;
};

export const handler = async event => {
  try {
    const database = getAdminDb();
    const method = String(event.httpMethod || 'GET').toUpperCase();
    await enforceRateLimit(database, event, `public-apontamento-${method}`, method === 'GET' ? 120 : 30, method === 'GET' ? 300 : 3600);

    if (method === 'GET') {
      const token = cleanString(event.queryStringParameters?.token, 180);
      if (!token) return jsonResponse(400, { success: false, message: 'Token de apontamento não informado.' });
      const snapshot = await loadApontamentoSnapshot(database);
      const ramos = activeRamosForToken(snapshot, token);
      if (ramos.length === 0) return jsonResponse(404, { success: false, message: 'Link de apontamento inválido ou inativo.' });
      return jsonResponse(200, { success: true, data: { ramos: ramos.map(ramo => sanitizeRamo(ramo, token)) } });
    }

    if (method !== 'POST') return jsonResponse(405, { success: false, message: 'Método não permitido.' }, { Allow: 'GET, POST' });
    const body = parseJsonBody(event);
    const token = cleanString(body.token, 180);
    const ramoId = cleanString(body.ramoId, 160);
    const data = cleanString(body.data, 10);
    const responsavel = cleanString(body.responsavel, 160);
    if (!token || !ramoId || !responsavel || !isIsoDate(data)) {
      return jsonResponse(400, { success: false, message: 'Dados de apontamento incompletos ou inválidos.' });
    }
    const snapshot = await loadApontamentoSnapshot(database);
    const ramo = activeRamosForToken(snapshot, token).find(item => item.id === ramoId);
    if (!ramo) return jsonResponse(403, { success: false, message: 'O link não autoriza o ramo selecionado.' });

    const now = new Date();
    const submissionId = crypto.randomUUID();
    const record = {
      id: `apramo-${submissionId}`,
      data,
      horaEnvio: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
      ramoId: ramo.id,
      canteiroNome: cleanString(ramo.canteiroNome, 180),
      ramoNome: cleanString(ramo.ramoNome, 180),
      empresa: cleanString(body.empresa, 120),
      responsavel,
      funcaoApontador: cleanString(body.funcaoApontador, 120) || 'Apontador',
      funcoes: cleanQuantityItems(body.funcoes),
      equipamentos: cleanQuantityItems(body.equipamentos),
      clima: cleanTurnValues(body.clima, CLIMAS, 'Clima'),
      condicao: cleanTurnValues(body.condicao, CONDICOES, 'Condição'),
      descricaoAtividade: cleanString(body.descricaoAtividade, 3000),
      observacao: cleanString(body.observacao, 1500),
      tokenUsado: `validado-${stableHash(token).slice(0, 12)}`,
      createdAt: now.toISOString(),
    };
    await database.collection('sistemarenea_public_submissions').doc(`apontamento_${submissionId}`).set({
      kind: 'apontamento',
      status: 'pending',
      createdAt: serverTimestamp(),
      createdAtIso: now.toISOString(),
      sourceIpHash: requestIpHash(event),
      payload: { ramoId: ramo.id, data, record },
    });
    return jsonResponse(201, { success: true, submissionId, message: `Apontamento de ${ramo.ramoNome} enviado com segurança.` });
  } catch (error) {
    return functionErrorResponse(error);
  }
};
