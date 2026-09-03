import {
  cleanString,
  enforceRateLimit,
  functionErrorResponse,
  getAdminDb,
  jsonResponse,
  parseJsonBody,
  requireStaffUser,
  serverTimestamp,
} from './_shared/firebase-admin.js';

const COLLECTION = 'sistemarenea_usage';
const TAB_LABELS = {
  dashboard: 'Painel de Controle',
  reports: 'Relatórios Gerais',
  lancamentos: 'Combustível',
  'tickets-jazida': 'Tickets Jazida',
  manutencao: 'Manutenção',
  presenca: 'Presença',
  'controle-presenca': 'Controle de Presença',
  cadastros: 'Cadastros Auxiliares',
  configuracoes: 'Apoio e Configuração',
};

const isoDay = (date = new Date()) => date.toISOString().slice(0, 10);
const safeKey = value => cleanString(value, 64).toLowerCase().replace(/[^a-z0-9_-]/g, '');
const safeDocumentPart = value => cleanString(value, 128).replace(/[^a-zA-Z0-9_-]/g, '_');

const recordUsage = async (event, staff) => {
  const body = parseJsonBody(event, 8_000);
  const kind = body.kind === 'tab_view' ? body.kind : '';
  const key = safeKey(body.key);
  if (!kind || !key || !TAB_LABELS[key]) {
    return jsonResponse(400, { success: false, message: 'Evento de uso inválido.' });
  }

  const database = getAdminDb();
  await enforceRateLimit(database, event, `usage-${staff.uid}`, 600, 3600);
  const day = isoDay();
  const reference = database.collection(COLLECTION).doc(`${day}_${safeDocumentPart(staff.uid)}`);
  await database.runTransaction(async transaction => {
    const snapshot = await transaction.get(reference);
    const current = snapshot.data() || {};
    const tabs = current.tabs && typeof current.tabs === 'object' ? current.tabs : {};
    transaction.set(reference, {
      day,
      userId: staff.uid,
      userLabel: cleanString(staff.name || staff.email || 'Equipe RENEA', 120),
      tabs: { ...tabs, [key]: Number(tabs[key] || 0) + 1 },
      tabLabels: { ...(current.tabLabels || {}), [key]: TAB_LABELS[key] },
      lastTab: key,
      updatedAt: serverTimestamp(),
      updatedAtIso: new Date().toISOString(),
    });
  });
  return jsonResponse(200, { success: true });
};

const summarizeUsage = async (event) => {
  const requestedDays = Number(event.queryStringParameters?.days || 30);
  const periodDays = Math.max(1, Math.min(90, Number.isFinite(requestedDays) ? Math.floor(requestedDays) : 30));
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - periodDays + 1);
  const snapshot = await getAdminDb().collection(COLLECTION).where('day', '>=', isoDay(start)).get();
  const counts = {};
  const users = new Set();
  let updatedAt = '';
  snapshot.docs.forEach(document => {
    const data = document.data();
    if (data.userId) users.add(String(data.userId));
    if (String(data.updatedAtIso || '') > updatedAt) updatedAt = String(data.updatedAtIso);
    Object.entries(data.tabs || {}).forEach(([key, count]) => {
      counts[key] = Number(counts[key] || 0) + Number(count || 0);
    });
  });
  const tabs = Object.entries(counts)
    .map(([id, count]) => ({ id, label: TAB_LABELS[id] || id, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'));
  return jsonResponse(200, {
    success: true,
    summary: {
      periodDays,
      totalViews: tabs.reduce((sum, item) => sum + item.count, 0),
      activeUsers: users.size,
      tabs,
      updatedAt,
    },
  });
};

export const handler = async event => {
  try {
    const staff = await requireStaffUser(event);
    if (event.httpMethod === 'POST') return await recordUsage(event, staff);
    if (event.httpMethod === 'GET') return await summarizeUsage(event);
    return jsonResponse(405, { success: false, message: 'Método não permitido.' }, { Allow: 'GET, POST' });
  } catch (error) {
    return functionErrorResponse(error);
  }
};
