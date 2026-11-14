import {
  cleanString,
  functionErrorResponse,
  getSupabaseAdmin,
  jsonResponse,
  parseJsonBody,
  requireSupabaseUser,
} from './_shared/supabase-admin.js';
import { assertHttpMethod } from './_shared/api-security.js';
import { assertProcurementPermission, procurementActorFromStaff } from './_shared/procurement-authorization.js';

const UNITS = new Set(['ton', 'm³', 'm', 'un', 'kg', 'vb', 'h']);
const TYPES = new Set(['Material', 'Serviço']);
const isoDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));

const validateRequest = body => {
  const quantity = Number(String(body.quantity_requested ?? '').replace(',', '.'));
  const errors = [];
  if (!/^SOL-\d{4}-\d{4,}$/.test(String(body.request_number || ''))) errors.push('request_number inválido.');
  if (!String(body.work_front || '').trim()) errors.push('work_front obrigatório.');
  if (!String(body.stake_application || '').trim()) errors.push('stake_application obrigatório.');
  if (!TYPES.has(body.item_type)) errors.push('item_type inválido.');
  if (String(body.technical_description || '').trim().length < 3) errors.push('technical_description obrigatório.');
  if (!(quantity > 0) || !Number.isFinite(quantity)) errors.push('quantity_requested deve ser maior que zero.');
  if (!UNITS.has(body.unit)) errors.push('unit inválida.');
  if (!isoDate(body.desired_deadline)) errors.push('desired_deadline inválido.');
  if (typeof body.allow_partial !== 'boolean') errors.push('allow_partial obrigatório.');
  if (errors.length) { const error = new Error(errors.join(' ')); error.statusCode = 422; throw error; }
  return { ...body, quantity_requested: quantity };
};

const createRequest = async (event, staff, actor) => {
  assertProcurementPermission(actor, 'request');
  const body = validateRequest(parseJsonBody(event, 32_000));
  const client = getSupabaseAdmin();
  const request = {
    organization_id: staff.organizationId,
    request_number: cleanString(body.request_number, 40),
    requester_user_id: staff.uid,
    requester_name: staff.name,
    requester_role: 'ROLE_SOLICITANTE',
    work_front: cleanString(body.work_front, 240),
    stake_application: cleanString(body.stake_application, 240),
    item_type: body.item_type,
    technical_description: cleanString(body.technical_description, 1000),
    quantity_requested: body.quantity_requested,
    unit: body.unit,
    desired_deadline: body.desired_deadline,
    allow_partial: body.allow_partial,
    engineering_drawing_ref: cleanString(body.engineering_drawing_ref, 240),
  };
  const audit = {
    organization_id: staff.organizationId,
    actor_user_id: staff.uid,
    actor_name: staff.name,
    actor_role: actor.role,
    metadata: { source: 'procurement-api' },
  };
  const { data, error } = await client.rpc('create_erp_request', { p_request: request, p_audit: audit });
  if (error) throw error;
  return jsonResponse(201, { success: true, data });
};

const listRequests = async (staff, actor, query = {}) => {
  const client = getSupabaseAdmin();
  let request = client.from('erp_requests').select('*').eq('organization_id', staff.organizationId).order('created_at', { ascending: false }).limit(200);
  if (actor.role === 'solicitante') request = request.eq('requester_user_id', staff.uid);
  if (query.status) request = request.eq('status', cleanString(query.status, 60));
  const { data, error } = await request;
  if (error) throw error;
  return jsonResponse(200, { success: true, data: data || [] });
};

const transitionRequest = async (event, staff, actor) => {
  const body = parseJsonBody(event, 32_000);
  const action = cleanString(body.action, 30);
  const permissions = { approve: 'approve', receive: 'receive', dispatch: 'dispatch' };
  if (!permissions[action]) { const error = new Error('Ação de compras inválida.'); error.statusCode = 422; throw error; }
  assertProcurementPermission(actor, permissions[action]);
  const requestId = cleanString(body.request_id, 64);
  const version = Number(body.version);
  if (!requestId || !Number.isInteger(version) || version < 1) { const error = new Error('request_id e version são obrigatórios.'); error.statusCode = 422; throw error; }
  const actorPayload = { actor_user_id: staff.uid, actor_name: staff.name, actor_role: actor.role };
  const { data, error } = await getSupabaseAdmin().rpc('transition_erp_request', {
    p_request_id: requestId,
    p_expected_version: version,
    p_action: action,
    p_actor: actorPayload,
    p_payload: body.payload && typeof body.payload === 'object' ? body.payload : {},
  });
  if (error) {
    if (String(error.code) === 'P0001') error.statusCode = 409;
    else if (String(error.code) === 'P0003') error.statusCode = 403;
    else if (String(error.code) === 'P0005' || String(error.code) === 'P0004') error.statusCode = 422;
    throw error;
  }
  return jsonResponse(200, { success: true, data });
};

export const handler = async event => {
  try {
    assertHttpMethod(event, ['GET', 'POST', 'PATCH']);
    const staff = await requireSupabaseUser(event);
    const actor = procurementActorFromStaff(staff);
    if (event.httpMethod === 'POST') return await createRequest(event, staff, actor);
    if (event.httpMethod === 'PATCH') return await transitionRequest(event, staff, actor);
    return await listRequests(staff, actor, event.queryStringParameters);
  } catch (error) {
    return functionErrorResponse(error);
  }
};
