import {
  cleanString,
  functionErrorResponse,
  jsonResponse,
  parseJsonBody,
  requireSupabaseUser,
  getSupabaseAdmin,
} from './_shared/supabase-admin.js';

const COLLECTION = 'sistemarenea_usage';
const TAB_LABELS = {
  dashboard: 'Painel de Controle',
  'consulta-geral': 'Consulta Geral',
  periodo: 'Registros por Período',
  reports: 'Relatórios Gerais',
  'controle-equipamentos': 'Controle Operacional de Frotas',
  lancamentos: 'Combustível',
  'tickets-jazida': 'Tickets Jazida',
  estacas: 'Controle de Estacas',
  presenca: 'Presença e Controle',
  cadastros: 'Cadastros Auxiliares',
  usuarios: 'Usuários',
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

  const day = isoDay();
  const client = getSupabaseAdmin();
  const { data: current } = await client.from('usage_telemetry').select('tabs, tab_labels').eq('organization_id', staff.organizationId).eq('day', day).eq('user_id', staff.uid).maybeSingle();
  const tabs = current?.tabs && typeof current.tabs === 'object' ? current.tabs : {};
  const tabLabels = current?.tab_labels && typeof current.tab_labels === 'object' ? current.tab_labels : {};
  const { error } = await client.from('usage_telemetry').upsert({ organization_id: staff.organizationId, day, user_id: staff.uid, user_label: cleanString(staff.name || staff.email || 'Equipe RENEA', 120), tabs: { ...tabs, [key]: Number(tabs[key] || 0) + 1 }, tab_labels: { ...tabLabels, [key]: TAB_LABELS[key] }, last_tab: key, updated_at: new Date().toISOString() }, { onConflict: 'organization_id,day,user_id' });
  if (error) throw error;
  return jsonResponse(200, { success: true });
};

const summarizeUsage = async (event) => {
  const requestedDays = Number(event.queryStringParameters?.days || 30);
  const periodDays = Math.max(1, Math.min(90, Number.isFinite(requestedDays) ? Math.floor(requestedDays) : 30));
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - periodDays + 1);
  const { data: rows, error } = await getSupabaseAdmin().from('usage_telemetry').select('user_id, tabs, updated_at').gte('day', isoDay(start));
  if (error) throw error;
  const counts = {};
  const users = new Set();
  let updatedAt = '';
  (rows || []).forEach(data => {
    if (data.userId) users.add(String(data.userId));
    if (String(data.updated_at || '') > updatedAt) updatedAt = String(data.updated_at);
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
    const staff = await requireSupabaseUser(event);
    if (event.httpMethod === 'POST') return await recordUsage(event, staff);
    if (event.httpMethod === 'GET') return await summarizeUsage(event);
    return jsonResponse(405, { success: false, message: 'Método não permitido.' }, { Allow: 'GET, POST' });
  } catch (error) {
    return functionErrorResponse(error);
  }
};
