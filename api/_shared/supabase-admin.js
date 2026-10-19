import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { extractBearerToken, mergeSecurityHeaders } from './api-security.js';

const url = () => String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const key = () => String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

export const getSupabaseAdmin = () => {
  if (!url() || !key()) throw new Error('Supabase administrativo não configurado no servidor.');
  return createClient(url(), key(), { auth: { autoRefreshToken: false, persistSession: false } });
};

export const requireSupabaseUser = async event => {
  const token = extractBearerToken(event);
  if (!token) { const error = new Error('Faça login no sistema para consultar a integração.'); error.statusCode = 401; throw error; }
  const client = getSupabaseAdmin();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) { const denied = new Error('Sessão inválida.'); denied.statusCode = 401; throw denied; }
  const { data: membership, error: membershipError } = await client
    .from('organization_members').select('organization_id, role').eq('user_id', data.user.id).limit(1).maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) { const denied = new Error('Sua conta não possui autorização de equipe.'); denied.statusCode = 403; throw denied; }
  const role = appRoleFor(membership.role, data.user.app_metadata?.role);
  return { uid: data.user.id, email: data.user.email || '', name: data.user.user_metadata?.full_name || data.user.email || '', role, organizationId: membership.organization_id };
};
export const requireStaffUser = requireSupabaseUser;
/** Zerar o dia e entregar o endereço dos links é de gestor ou administrador (M1). */
export const assertManagerRole = staff => {
  if (staff.role === 'admin' || staff.role === 'gestor') return staff;
  const denied = new Error('Só gestor ou administrador pode fazer isso.');
  denied.statusCode = 403;
  throw denied;
};
export const requireManagerUser = async event => assertManagerRole(await requireSupabaseUser(event));

/**
 * A obra nunca fica sem administrador ativo (M12): a última conta de admin
 * não perde o perfil nem é inativada, senão ninguém mais consegue desfazer.
 */
export const assertKeepsActiveAdmin = async ({ uid, role, active, adminIds, getUser }) => {
  if (role === 'admin' && active) return;
  if (!adminIds.includes(uid)) return;
  for (const id of adminIds) {
    if (id === uid) continue;
    const other = await getUser(id).catch(() => null);
    if (other && !other.disabled) return;
  }
  const error = new Error('Esta é a única conta de administrador ativa. Dê o perfil de administrador a outra pessoa antes de mudar esta.');
  error.statusCode = 409;
  throw error;
};

export const jsonResponse = (statusCode, payload, extraHeaders = {}) => ({ statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...mergeSecurityHeaders(extraHeaders) }, body: JSON.stringify(payload) });
export const parseJsonBody = (event, maxBytes = 250_000) => {
  const encoded = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64') : Buffer.from(event.body || '', 'utf8');
  if (encoded.byteLength > maxBytes) { const error = new Error('O envio excede o tamanho permitido.'); error.statusCode = 413; throw error; }
  try { return JSON.parse(encoded.toString('utf8') || '{}'); } catch { const error = new Error('O conteúdo enviado não é um JSON válido.'); error.statusCode = 400; throw error; }
};
export const cleanString = (value, maxLength = 200) => String(value ?? '').trim().slice(0, maxLength);
export const isIsoDate = value => { const normalized = String(value || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return false; const [year, month, day] = normalized.split('-').map(Number); const parsed = new Date(Date.UTC(year, month - 1, day)); return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day; };
export const serverTimestamp = () => new Date().toISOString();
export const stableHash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
export const requestIpHash = event => {
  const headers = event?.headers || {};
  const forwarded = headers['x-nf-client-connection-ip'] || headers['x-real-ip'] || headers['x-forwarded-for'] || headers['client-ip'] || 'unknown';
  return stableHash(String(forwarded).split(',')[0].trim()).slice(0, 24);
};
export const functionErrorResponse = error => jsonResponse(Number(error?.statusCode) || 500, { success: false, message: Number(error?.statusCode) >= 500 ? 'O serviço está temporariamente indisponível.' : error.message });

/**
 * Igual ao update do Firestore: 'payload.records' troca só o campo de dentro,
 * em vez de criar uma chave solta com ponto no nome e deixar o antigo intacto.
 */
export const applyFieldUpdates = (document, updates) => {
  const next = structuredClone(document || {});
  for (const [path, value] of Object.entries(updates || {})) {
    const keys = path.split('.');
    let target = next;
    for (const key of keys.slice(0, -1)) {
      if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) target[key] = {};
      target = target[key];
    }
    target[keys[keys.length - 1]] = value;
  }
  return next;
};
const valueAt = (value, path) => String(path).split('.').reduce((current, key) => current == null ? undefined : current[key], value);
const snapshot = (row, ref) => ({ id: row?.id, exists: Boolean(row), ref, data: () => row?.payload || {} });
const rowStore = () => getSupabaseAdmin().from('legacy_documents');
const PUBLIC_SUBMISSIONS_COLLECTION = 'sistemarenea_public_submissions';
// A leitura da fila antiga reespelha tudo o que acha (recuperação de envios
// de antes da fila nova). Essa recuperação não pode reabrir o que o painel já
// processou. Já uma gravação de verdade (edição de presença pelo link) volta
// para "pending" de propósito, para o painel incorporar a alteração.
const mirrorPublicSubmission = async (id, document, { reabrir = false } = {}) => {
  const table = getSupabaseAdmin().from('erp_public_submissions');
  const { data: existing, error: existingError } = await table.select('status').eq('id', id).maybeSingle();
  if (existingError) throw existingError;
  if (!reabrir && existing?.status === 'processed' && document?.status === 'pending') return;
  const { error } = await table.upsert({
    id,
    organization_id: process.env.SUPABASE_ORGANIZATION_ID || 'renea',
    kind: cleanString(document?.kind, 80) || 'presence',
    status: cleanString(document?.status, 40) || 'pending',
    created_at: document?.createdAtIso || document?.createdAt || new Date().toISOString(),
    payload: document?.payload || {},
  });
  if (error) throw error;
};
const makeRef = (path, id = crypto.randomUUID()) => ({
  id,
  path: `${path}/${id}`,
  async get() { const { data, error } = await rowStore().select('id,payload').eq('path', `${path}/${id}`).maybeSingle(); if (error) throw error; return snapshot(data ? { ...data, payload: data.payload } : null, makeRef(path, id)); },
  async set(payload, options = {}) { const current = options.merge ? await this.get() : null; const next = options.merge ? { ...(current.data() || {}), ...payload } : payload; const { error } = await rowStore().upsert({ id, organization_id: process.env.SUPABASE_ORGANIZATION_ID || 'renea', collection_path: path, path: `${path}/${id}`, payload: next, updated_at: new Date().toISOString() }); if (error) throw error; if (path === PUBLIC_SUBMISSIONS_COLLECTION) await mirrorPublicSubmission(id, next, { reabrir: true }); },
  async update(payload) { const current = await this.get(); if (!current.exists) throw new Error('Documento não encontrado.'); await this.set(applyFieldUpdates(current.data(), payload)); },
  async delete() { const { error } = await rowStore().delete().eq('path', `${path}/${id}`); if (error) throw error; },
  collection(child) { return makeCollection(`${path}/${id}/${child}`); },
});
const makeCollection = path => {
  const filters = [];
  const query = {
    where(field, operator, value) { filters.push({ field, operator, value }); return query; },
    orderBy(field, direction = 'asc') { query._order = { field, direction }; return query; },
    limit(count) { query._limit = count; return query; },
    async get() {
      const { data, error } = await rowStore().select('id,payload').eq('collection_path', path);
      if (error) throw error;
      let rows = data || [];
      if (path === PUBLIC_SUBMISSIONS_COLLECTION) await Promise.all(rows.map(row => mirrorPublicSubmission(row.id, row.payload)));
      rows = rows.filter(row => filters.every(filter => {
        const actual = valueAt(row.payload, filter.field);
        return filter.operator === '==' ? actual === filter.value : filter.operator === 'in' ? Array.isArray(filter.value) && filter.value.includes(actual) : filter.operator === '>=' ? actual >= filter.value : true;
      }));
      if (query._order) rows.sort((a, b) => String(valueAt(a.payload, query._order.field) || '').localeCompare(String(valueAt(b.payload, query._order.field) || '')) * (query._order.direction === 'desc' ? -1 : 1));
      if (query._limit) rows = rows.slice(0, query._limit);
      return { docs: rows.map(row => snapshot(row, makeRef(path, row.id))) };
    },
    doc(id) { return makeRef(path, id); },
  };
  return query;
};
const makeBatch = () => { const actions = []; return { set(ref, data, options) { actions.push(() => ref.set(data, options)); }, update(ref, data) { actions.push(() => ref.update(data)); }, delete(ref) { actions.push(() => ref.delete()); }, async commit() { for (const action of actions) await action(); } }; };
export const getAdminDb = () => ({ collection: makeCollection, batch: makeBatch, async runTransaction(callback) { const transaction = { get: ref => ref.get(), set: (ref, data, options) => ref.set(data, options), update: (ref, data) => ref.update(data), delete: ref => ref.delete(), create: (ref, data) => ref.set(data) }; return callback(transaction); } });
export const enforceRateLimit = async (_database, _event, _bucket, _limit, _windowSeconds, _identity = '') => {};
// Mantém a forma do antigo Firebase Admin (uid, displayName, disabled e
// claims) para api/master-data.js, traduzindo para o Supabase: e-mail já
// confirmado, nome em user_metadata, bloqueio por ban_duration e o perfil
// gravado em organization_members, que é o que libera o login no app.
// organization_members só aceita admin, editor e viewer (é o que o banco
// confere para gravar). O perfil do app (gestor, operador) fica em app_metadata.
/** Contas com perfil de administrador na organização. */
export const listOrganizationAdminIds = async organizationId => {
  const { data, error } = await getSupabaseAdmin()
    .from('organization_members').select('user_id').eq('organization_id', organizationId).eq('role', 'admin');
  if (error) throw error;
  return (data || []).map(row => row.user_id);
};
export const membershipRoleFor = role => role === 'admin' ? 'admin' : role === 'leitura' ? 'viewer' : 'editor';
export const appRoleFor = (membershipRole, claimedRole) => {
  if (membershipRole === 'admin') return 'admin';
  if (membershipRole === 'editor') return claimedRole === 'operador' ? 'operador' : 'gestor';
  if (membershipRole === 'viewer') return 'leitura';
  return membershipRole;
};
const adaptAuthUser = user => user && Object.assign(user, {
  uid: user.id,
  displayName: user.user_metadata?.full_name || null,
  disabled: Boolean(user.banned_until && new Date(user.banned_until) > new Date()),
  customClaims: user.app_metadata || {},
});
export const getAdminAuth = () => {
  const client = getSupabaseAdmin();
  return {
    async getUserByEmail(email) {
      const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) throw error;
      const user = data.users.find(item => item.email?.toLowerCase() === email.toLowerCase());
      if (!user) { const notFound = new Error('Usuário não encontrado.'); notFound.code = 'auth/user-not-found'; throw notFound; }
      return adaptAuthUser(user);
    },
    async getUser(id) {
      const { data, error } = await client.auth.admin.getUserById(id);
      if (error) throw error;
      return adaptAuthUser(data.user);
    },
    async createUser({ email, password, displayName }) {
      const { data, error } = await client.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: displayName } });
      if (error) throw error;
      return adaptAuthUser(data.user);
    },
    async updateUser(id, { disabled }) {
      const { data, error } = await client.auth.admin.updateUserById(id, { ban_duration: disabled ? '876000h' : 'none' });
      if (error) throw error;
      return adaptAuthUser(data.user);
    },
    async setCustomUserClaims(id, claims = {}) {
      if (!id || !claims.organization_id || !claims.role) throw new Error('Usuário sem organização ou perfil para autorizar.');
      const { error: metadataError } = await client.auth.admin.updateUserById(id, { email_confirm: true, app_metadata: { role: claims.role, organization_id: claims.organization_id } });
      if (metadataError) throw metadataError;
      const { error } = await client.from('organization_members').upsert(
        { organization_id: claims.organization_id, user_id: id, role: membershipRoleFor(claims.role) },
        { onConflict: 'organization_id,user_id' },
      );
      if (error) throw error;
    },
  };
};
export const getAdminBucket = () => ({ file: path => ({ async save(bytes, options = {}) { const { error } = await getSupabaseAdmin().storage.from(process.env.SUPABASE_OPERATIONAL_ATTACHMENTS_BUCKET || 'operational-attachments').upload(path, bytes, { contentType: options.contentType, upsert: true }); if (error) throw error; } }) });
