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
  const role = membership.role === 'editor' ? 'gestor' : membership.role === 'viewer' ? 'leitura' : membership.role;
  return { uid: data.user.id, email: data.user.email || '', name: data.user.user_metadata?.full_name || data.user.email || '', role, organizationId: membership.organization_id };
};
export const requireStaffUser = requireSupabaseUser;

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

const valueAt = (value, path) => String(path).split('.').reduce((current, key) => current == null ? undefined : current[key], value);
const snapshot = (row, ref) => ({ id: row.id, exists: Boolean(row), ref, data: () => row?.payload || {} });
const rowStore = () => getSupabaseAdmin().from('legacy_documents');
const makeRef = (path, id = crypto.randomUUID()) => ({
  id,
  path: `${path}/${id}`,
  async get() { const { data, error } = await rowStore().select('id,payload').eq('path', `${path}/${id}`).maybeSingle(); if (error) throw error; return snapshot(data ? { ...data, payload: data.payload } : null, makeRef(path, id)); },
  async set(payload, options = {}) { const current = options.merge ? await this.get() : null; const next = options.merge ? { ...(current.data() || {}), ...payload } : payload; const { error } = await rowStore().upsert({ id, organization_id: process.env.SUPABASE_ORGANIZATION_ID || 'renea', collection_path: path, path: `${path}/${id}`, payload: next, updated_at: new Date().toISOString() }); if (error) throw error; },
  async update(payload) { const current = await this.get(); if (!current.exists) throw new Error('Documento não encontrado.'); await this.set({ ...current.data(), ...payload }); },
  async delete() { const { error } = await rowStore().delete().eq('path', `${path}/${id}`); if (error) throw error; },
  collection(child) { return makeCollection(`${path}/${id}/${child}`); },
});
const makeCollection = path => {
  const filters = [];
  const query = { where(field, operator, value) { filters.push({ field, operator, value }); return query; }, orderBy(field, direction = 'asc') { query._order = { field, direction }; return query; }, limit(count) { query._limit = count; return query; }, async get() { let builder = rowStore().select('id,payload').eq('collection_path', path); const { data, error } = await builder; if (error) throw error; let rows = data || []; rows = rows.filter(row => filters.every(filter => { const actual = valueAt(row.payload, filter.field); return filter.operator === '==' ? actual === filter.value : filter.operator === 'in' ? Array.isArray(filter.value) && filter.value.includes(actual) : filter.operator === '>=' ? actual >= filter.value : true; })); if (query._order) rows.sort((a, b) => String(valueAt(a.payload, query._order.field) || '').localeCompare(String(valueAt(b.payload, query._order.field) || '')) * (query._order.direction === 'desc' ? -1 : 1)); if (query._limit) rows = rows.slice(0, query._limit); return { docs: rows.map(row => snapshot(row, makeRef(path, row.id))) }; }, doc(id) { return makeRef(path, id); } }; return query;
};
const makeBatch = () => { const actions = []; return { set(ref, data, options) { actions.push(() => ref.set(data, options)); }, update(ref, data) { actions.push(() => ref.update(data)); }, delete(ref) { actions.push(() => ref.delete()); }, async commit() { for (const action of actions) await action(); } }; };
export const getAdminDb = () => ({ collection: makeCollection, batch: makeBatch, async runTransaction(callback) { const transaction = { get: ref => ref.get(), set: (ref, data, options) => ref.set(data, options), update: (ref, data) => ref.update(data), delete: ref => ref.delete(), create: (ref, data) => ref.set(data) }; return callback(transaction); } });
export const enforceRateLimit = async (_database, _event, _bucket, _limit, _windowSeconds, _identity = '') => {};
export const getAdminAuth = () => { const client = getSupabaseAdmin(); return { async getUserByEmail(email) { const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 }); if (error) throw error; const user = data.users.find(item => item.email?.toLowerCase() === email.toLowerCase()); if (!user) { const error = new Error('Usuário não encontrado.'); error.code = 'auth/user-not-found'; throw error; } return user; }, async getUser(id) { const { data, error } = await client.auth.admin.getUserById(id); if (error) throw error; return data.user; }, async createUser(input) { const { data, error } = await client.auth.admin.createUser(input); if (error) throw error; return data.user; }, async updateUser(id, input) { const { data, error } = await client.auth.admin.updateUserById(id, input); if (error) throw error; return data.user; }, async setCustomUserClaims() {} }; };
export const getAdminBucket = () => ({ file: path => ({ async save(bytes, options = {}) { const { error } = await getSupabaseAdmin().storage.from(process.env.SUPABASE_OPERATIONAL_ATTACHMENTS_BUCKET || 'operational-attachments').upload(path, bytes, { contentType: options.contentType, upsert: true }); if (error) throw error; } }) });
