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
  const items = Array.isArray(body.items) ? body.items : [body];
  const errors = [];
  if (!/^SOL-\d{4}-\d{4,}$/.test(String(body.request_number || ''))) errors.push('request_number inválido.');
  if (!String(body.work_front || '').trim()) errors.push('work_front obrigatório.');
  if (!String(body.stake_application || '').trim()) errors.push('stake_application obrigatório.');
  if (!items.length) errors.push('Inclua pelo menos um item.');
  items.forEach((item, index) => {
    const quantity = Number(String(item.quantity_requested ?? item.quantity ?? '').replace(',', '.'));
    if (!TYPES.has(item.item_type ?? item.tipo)) errors.push(`item ${index + 1}: item_type inválido.`);
    if (String(item.technical_description ?? item.descricao ?? '').trim().length < 3) errors.push(`item ${index + 1}: descrição obrigatória.`);
    if (!(quantity > 0) || !Number.isFinite(quantity)) errors.push(`item ${index + 1}: quantidade inválida.`);
    if (!UNITS.has(item.unit ?? item.unidade)) errors.push(`item ${index + 1}: unidade inválida.`);
    if (!isoDate(item.desired_deadline ?? item.prazoDesejado)) errors.push(`item ${index + 1}: prazo inválido.`);
    if (typeof (item.allow_partial ?? item.permiteParcial) !== 'boolean') errors.push(`item ${index + 1}: allow_partial obrigatório.`);
    const partial = item.allow_partial ?? item.permiteParcial;
    const firstDeliveryRaw = item.quantity_first_delivery ?? item.quantidadePrimeiraEntrega;
    const firstDelivery = firstDeliveryRaw === null || firstDeliveryRaw === undefined || firstDeliveryRaw === ''
      ? null
      : Number(String(firstDeliveryRaw).replace(',', '.'));
    if (partial && (!(firstDelivery > 0) || !Number.isFinite(firstDelivery) || firstDelivery > quantity)) {
      errors.push(`item ${index + 1}: a 1ª entrega parcial deve ser maior que zero e não pode exceder a quantidade solicitada.`);
    }
    if (!partial && firstDelivery !== null) errors.push(`item ${index + 1}: 1ª entrega só pode ser informada quando a entrega for parcial.`);
  });
  if (errors.length) { const error = new Error(errors.join(' ')); error.statusCode = 422; throw error; }
  return { ...body, items: items.map((item, index) => ({
    item_number: index + 1,
    item_type: item.item_type ?? item.tipo,
    technical_description: item.technical_description ?? item.descricao,
    quantity_requested: Number(String(item.quantity_requested ?? item.quantity ?? '').replace(',', '.')),
    unit: item.unit ?? item.unidade,
    desired_deadline: item.desired_deadline ?? item.prazoDesejado,
    allow_partial: item.allow_partial ?? item.permiteParcial,
    quantity_first_delivery: item.quantity_first_delivery ?? item.quantidadePrimeiraEntrega ?? null,
    engineering_drawing_ref: item.engineering_drawing_ref ?? '',
  })) };
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
    items: body.items,
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
  assertProcurementPermission(actor, 'view');
  const client = getSupabaseAdmin();
  let request = client.from('erp_requests').select('*, erp_request_items(*)').eq('organization_id', staff.organizationId).order('created_at', { ascending: false }).limit(200);
  if (actor.role === 'solicitante') request = request.eq('requester_user_id', staff.uid);
  if (query.status) request = request.eq('status', cleanString(query.status, 60));
  const { data, error } = await request;
  if (error) throw error;
  const rows = (data || []).map(({ erp_request_items = [], ...header }) => ({ ...header, items: erp_request_items }));
  return jsonResponse(200, { success: true, data: rows });
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
