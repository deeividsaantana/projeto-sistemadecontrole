import {
  assertMasterDataEntity,
  assertRoleCan,
  assertUuid,
  MASTER_DATA_ENTITY_NAMES,
  normalizeStaffRole,
  resolveOrganizationId,
  sanitizeImportRequest,
  sanitizeListLimit,
  sanitizeMasterImportRequest,
  sanitizeFuelImportRequest,
  sanitizeTravelImportRequest,
  sanitizeMasterDataPayload,
  sanitizeSearchTerm,
} from './_shared/master-data-contract.js';
import {
  cleanString,
  functionErrorResponse,
  jsonResponse,
  parseJsonBody,
  requireStaffUser,
} from './_shared/firebase-admin.js';
import {
  supabaseRestRequest,
} from './_shared/supabase-rest.js';

const loadOrganization = async organizationId => {
  const organizations = await supabaseRestRequest('organizations', {
    query: {
      select: 'id,code,name',
      id: `eq.${organizationId}`,
      deleted_at: 'is.null',
      active: 'eq.true',
      limit: 1,
    },
  });
  if (!Array.isArray(organizations) || organizations.length === 0) {
    const error = new Error('A organização informada ainda não foi criada no Supabase.');
    error.statusCode = 424;
    throw error;
  }
  return organizations[0];
};

const synchronizeStaffUser = async (staff, organizationId, role) => {
  const firebaseUid = cleanString(staff.uid || staff.sub, 160);
  if (!firebaseUid) {
    const error = new Error('O token Firebase não possui um identificador de usuário.');
    error.statusCode = 401;
    throw error;
  }

  const fullName = cleanString(staff.name || staff.email || 'Equipe RENEA', 240);
  const email = cleanString(staff.email, 320).toLowerCase() || null;
  const nowIso = new Date().toISOString();
  const users = await supabaseRestRequest('app_users', {
    method: 'POST',
    query: {
      on_conflict: 'organization_id,firebase_uid',
      select: 'id,organization_id,role,active',
    },
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: {
      organization_id: organizationId,
      firebase_uid: firebaseUid,
      email,
      full_name: fullName,
      role,
      active: true,
      last_seen_at: nowIso,
      deleted_at: null,
    },
  });
  if (!Array.isArray(users) || users.length === 0) {
    const error = new Error('Não foi possível vincular o usuário autenticado ao Supabase.');
    error.statusCode = 502;
    throw error;
  }
  return users[0];
};

const getRequestContext = async event => {
  const staff = await requireStaffUser(event);
  const role = normalizeStaffRole(staff.role);
  const organizationId = resolveOrganizationId(staff, process.env.SUPABASE_DEFAULT_ORGANIZATION_ID);
  const organization = await loadOrganization(organizationId);
  const appUser = await synchronizeStaffUser(staff, organizationId, role);
  return { staff, role, organizationId, organization, appUser };
};

const gatewayStatus = async context => jsonResponse(200, {
  success: true,
  data: {
    configured: true,
    mode: 'firebase-auth-netlify-supabase',
    organization: context.organization,
    role: context.role,
    supportedEntities: MASTER_DATA_ENTITY_NAMES,
  },
});

const listRecords = async (event, context) => {
  assertRoleCan(context.role, 'read');
  const { entity, definition } = assertMasterDataEntity(event.queryStringParameters?.entity);
  const search = sanitizeSearchTerm(event.queryStringParameters?.search);
  const limit = sanitizeListLimit(event.queryStringParameters?.limit);
  const query = {
    select: '*',
    organization_id: `eq.${context.organizationId}`,
    deleted_at: 'is.null',
    order: 'updated_at.desc',
    limit,
  };
  if (search) {
    query.or = `(${definition.searchColumns.map(column => `${column}.ilike.*${search}*`).join(',')})`;
  }
  const records = await supabaseRestRequest(definition.table, { query });
  return jsonResponse(200, {
    success: true,
    data: { entity, records: Array.isArray(records) ? records : [] },
  });
};

const createRecord = async (body, context) => {
  assertRoleCan(context.role, 'create');
  const { entity, definition } = assertMasterDataEntity(body.entity);
  const data = sanitizeMasterDataPayload(entity, body.data, 'create');
  const records = await supabaseRestRequest(definition.table, {
    method: 'POST',
    query: { select: '*' },
    headers: { Prefer: 'return=representation' },
    body: {
      ...data,
      organization_id: context.organizationId,
      created_by: context.appUser.id,
      updated_by: context.appUser.id,
    },
  });
  return jsonResponse(201, {
    success: true,
    data: { entity, record: records?.[0] },
    message: `${definition.label}: cadastro criado.`,
  });
};

const updateRecord = async (body, context) => {
  assertRoleCan(context.role, 'update');
  const { entity, definition } = assertMasterDataEntity(body.entity);
  const id = assertUuid(body.id);
  const data = sanitizeMasterDataPayload(entity, body.data, 'update');
  const query = {
    id: `eq.${id}`,
    organization_id: `eq.${context.organizationId}`,
    deleted_at: 'is.null',
    select: '*',
  };
  if (body.expectedUpdatedAt) {
    const expectedUpdatedAt = cleanString(body.expectedUpdatedAt, 50);
    if (!Number.isFinite(Date.parse(expectedUpdatedAt))) {
      const error = new Error('A versão esperada do cadastro é inválida.');
      error.statusCode = 400;
      throw error;
    }
    query.updated_at = `eq.${expectedUpdatedAt}`;
  }
  const records = await supabaseRestRequest(definition.table, {
    method: 'PATCH',
    query,
    headers: { Prefer: 'return=representation' },
    body: { ...data, updated_by: context.appUser.id },
  });
  if (!Array.isArray(records) || records.length === 0) {
    const error = new Error(body.expectedUpdatedAt
      ? 'O cadastro foi alterado por outra pessoa. Atualize a lista antes de salvar novamente.'
      : 'Cadastro não encontrado.');
    error.statusCode = body.expectedUpdatedAt ? 409 : 404;
    throw error;
  }
  return jsonResponse(200, {
    success: true,
    data: { entity, record: records[0] },
    message: `${definition.label}: cadastro atualizado.`,
  });
};

const archiveRecord = async (body, context) => {
  assertRoleCan(context.role, 'archive');
  const { entity, definition } = assertMasterDataEntity(body.entity);
  const id = assertUuid(body.id);
  const records = await supabaseRestRequest(definition.table, {
    method: 'PATCH',
    query: {
      id: `eq.${id}`,
      organization_id: `eq.${context.organizationId}`,
      deleted_at: 'is.null',
      select: 'id,deleted_at',
    },
    headers: { Prefer: 'return=representation' },
    body: {
      active: false,
      deleted_at: new Date().toISOString(),
      updated_by: context.appUser.id,
    },
  });
  if (!Array.isArray(records) || records.length === 0) {
    const error = new Error('Cadastro não encontrado.');
    error.statusCode = 404;
    throw error;
  }
  return jsonResponse(200, {
    success: true,
    data: { entity, id },
    message: `${definition.label}: cadastro arquivado sem exclusão física.`,
  });
};

const preserveImport = async (body, context) => {
  assertRoleCan(context.role, 'import');
  const request = sanitizeImportRequest(body);
  const batchId = await supabaseRestRequest('rpc/ingest_import_batch', {
    method: 'POST',
    body: {
      p_organization_id: context.organizationId,
      p_source_name: request.sourceName,
      p_source_type: request.sourceType,
      p_entity_name: request.entity,
      p_worksheet_name: request.worksheetName,
      p_rows: request.rows,
      p_created_by: context.appUser.id,
      p_metadata: request.metadata,
    },
  });
  return jsonResponse(202, {
    success: true,
    data: { batchId, preservedRows: request.rows.length },
    message: `${request.rows.length} linha(s) preservada(s) para validação e revisão.`,
  });
};

const stageMasterImport = async (body, context) => {
  assertRoleCan(context.role, 'import');
  const request = sanitizeMasterImportRequest(body);
  const result = await supabaseRestRequest('rpc/stage_master_data_import', {
    method: 'POST',
    body: {
      p_organization_id: context.organizationId,
      p_entity_name: request.entity,
      p_source_name: request.sourceName,
      p_worksheet_name: request.worksheetName,
      p_rows: request.rows,
      p_created_by: context.appUser.id,
      p_metadata: request.metadata,
    },
  });
  return jsonResponse(202, {
    success: true,
    data: result,
    message: `${request.rows.length} linha(s) de ${request.entity} preservada(s) na fila de revisão.`,
  });
};

const stageFuelImport = async (body, context) => {
  assertRoleCan(context.role, 'import');
  const request = sanitizeFuelImportRequest(body);
  const result = await supabaseRestRequest('rpc/stage_fuel_import', {
    method: 'POST',
    body: {
      p_organization_id: context.organizationId,
      p_source_name: request.sourceName,
      p_source_type: request.sourceType,
      p_worksheet_name: request.worksheetName,
      p_rows: request.rows,
      p_created_by: context.appUser.id,
      p_metadata: request.metadata,
    },
  });
  return jsonResponse(202, {
    success: true,
    data: result,
    message: `${request.rows.length} lançamento(s) preservado(s) na fila gradual de combustível.`,
  });
};

const stageTravelImport = async (body, context) => {
  assertRoleCan(context.role, 'import');
  const request = sanitizeTravelImportRequest(body);
  const result = await supabaseRestRequest('rpc/stage_travel_import', {
    method: 'POST',
    body: {
      p_organization_id: context.organizationId,
      p_source_name: request.sourceName,
      p_source_type: request.sourceType,
      p_worksheet_name: request.worksheetName,
      p_rows: request.rows,
      p_created_by: context.appUser.id,
      p_metadata: request.metadata,
    },
  });
  return jsonResponse(202, {
    success: true,
    data: result,
    message: `${request.rows.length} evento(s) de viagem preservado(s) na fila gradual de revisão.`,
  });
};

export const handler = async event => {
  try {
    const method = String(event.httpMethod || 'GET').toUpperCase();
    const context = await getRequestContext(event);

    if (method === 'GET') {
      return await (event.queryStringParameters?.entity
        ? listRecords(event, context)
        : gatewayStatus(context));
    }

    if (!['POST', 'PATCH', 'DELETE'].includes(method)) {
      return jsonResponse(405, { success: false, message: 'Método não permitido.' }, { Allow: 'GET, POST, PATCH, DELETE' });
    }

    const body = parseJsonBody(event, 4_000_000);
    if (method === 'POST' && body.action === 'stage-travel-import') return await stageTravelImport(body, context);
    if (method === 'POST' && body.action === 'stage-fuel-import') return await stageFuelImport(body, context);
    if (method === 'POST' && body.action === 'stage-master-import') return await stageMasterImport(body, context);
    if (method === 'POST' && body.action === 'preserve-import') return await preserveImport(body, context);
    if (method === 'POST') return await createRecord(body, context);
    if (method === 'PATCH') return await updateRecord(body, context);
    return await archiveRecord(body, context);
  } catch (error) {
    return functionErrorResponse(error);
  }
};
