import {
  assertMasterDataEntity,
  assertRoleCan,
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
  getAdminAuth,
  getAdminDb,
  jsonResponse,
  parseJsonBody,
  requireStaffUser,
  serverTimestamp,
} from './_shared/firebase-admin.js';

const ROOT_COLLECTION = 'sistemarenea_master_data';
const ORGANIZATIONS_COLLECTION = 'sistemarenea_organizations';
const USERS_COLLECTION = 'sistemarenea_app_users';
const IMPORT_BATCHES_COLLECTION = 'sistemarenea_import_batches';
const AUDIT_COLLECTION = 'sistemarenea_audit_logs';
const MAX_IMPORT_CHUNK_BYTES = 550_000;

const safeId = (value, label = 'Identificador') => {
  const id = cleanString(value, 128);
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    const error = new Error(label + ' inválido.');
    error.statusCode = 400;
    throw error;
  }
  return id;
};

const entityCollection = (database, organizationId, entity) => database
  .collection(ROOT_COLLECTION)
  .doc(organizationId)
  .collection(entity);

const normalizeSearch = value => cleanString(value, 240)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const createImportChunks = rows => {
  const chunks = [];
  let current = [];
  let currentBytes = 2;
  rows.forEach(row => {
    const serialized = JSON.stringify(row);
    const rowBytes = Buffer.byteLength(serialized || 'null', 'utf8') + 1;
    if (current.length > 0 && currentBytes + rowBytes > MAX_IMPORT_CHUNK_BYTES) {
      chunks.push(current);
      current = [];
      currentBytes = 2;
    }
    current.push(row);
    currentBytes += rowBytes;
  });
  if (current.length > 0) chunks.push(current);
  return chunks;
};

const getRequestContext = async event => {
  const staff = await requireStaffUser(event);
  const role = normalizeStaffRole(staff.role);
  const organizationId = safeId(
    resolveOrganizationId(staff, process.env.FIREBASE_DEFAULT_ORGANIZATION_ID || 'renea'),
    'Organização',
  );
  const database = getAdminDb();
  const organizationRef = database.collection(ORGANIZATIONS_COLLECTION).doc(organizationId);
  const organizationSnapshot = await organizationRef.get();
  const organization = organizationSnapshot.exists
    ? organizationSnapshot.data()
    : { id: organizationId, code: organizationId.toUpperCase(), name: 'RENEA Infraestrutura' };
  if (!organizationSnapshot.exists) {
    await organizationRef.set({
      ...organization,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  const userId = safeId(staff.uid || staff.sub, 'Usuário');
  await database.collection(USERS_COLLECTION).doc(organizationId + '_' + userId).set({
    organizationId,
    firebaseUid: userId,
    email: cleanString(staff.email, 320).toLowerCase() || null,
    fullName: cleanString(staff.name || staff.email || 'Equipe RENEA', 240),
    role,
    active: true,
    lastSeenAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return { database, staff, role, organizationId, organization, userId };
};

const writeAudit = async (context, action, entity, recordId, before, after, details = {}) => {
  const reference = context.database.collection(AUDIT_COLLECTION).doc();
  await reference.set({
    id: reference.id,
    organizationId: context.organizationId,
    module: entity,
    recordId,
    action,
    userId: context.userId,
    userEmail: cleanString(context.staff.email, 320).toLowerCase() || null,
    before: before || null,
    after: after || null,
    details,
    createdAt: serverTimestamp(),
    createdAtIso: new Date().toISOString(),
  });
};

const gatewayStatus = async context => jsonResponse(200, {
  success: true,
  data: {
    configured: true,
    mode: 'firebase-auth-netlify-firestore',
    organization: {
      id: context.organizationId,
      code: context.organization.code || context.organizationId.toUpperCase(),
      name: context.organization.name || 'RENEA Infraestrutura',
    },
    role: context.role,
    supportedEntities: [
      'companies', 'locations', 'work_branches', 'equipment', 'vehicles',
      'collaborators', 'suppliers', 'materials', 'convoys', 'fuel_types',
      'lubricant_products', 'service_stages',
    ],
  },
});

const listAudits = async (event, context) => {
  if (context.role !== 'admin') {
    const error = new Error('Somente administradores podem consultar a auditoria completa.');
    error.statusCode = 403;
    throw error;
  }
  const limit = sanitizeListLimit(event.queryStringParameters?.limit);
  const snapshot = await context.database.collection(AUDIT_COLLECTION)
    .where('organizationId', '==', context.organizationId)
    .limit(Math.max(limit * 3, limit))
    .get();
  const records = snapshot.docs
    .map(item => item.data())
    .sort((left, right) => String(right.createdAtIso || '').localeCompare(String(left.createdAtIso || '')))
    .slice(0, limit);
  return jsonResponse(200, { success: true, data: { records } });
};

const assertAdministrator = context => {
  if (context.role === 'admin') return;
  const error = new Error('Somente administradores podem gerenciar usuários.');
  error.statusCode = 403;
  throw error;
};

const sanitizeUserRole = value => {
  const rawRole = cleanString(value, 32).toLowerCase();
  if (!['admin', 'gestor', 'operador', 'leitura'].includes(rawRole)) {
    const error = new Error('Perfil de usuário inválido.');
    error.statusCode = 400;
    throw error;
  }
  return rawRole;
};

const listUsers = async (event, context) => {
  assertAdministrator(context);
  const limit = sanitizeListLimit(event.queryStringParameters?.limit);
  const snapshot = await context.database.collection(USERS_COLLECTION)
    .where('organizationId', '==', context.organizationId)
    .limit(limit)
    .get();
  const users = snapshot.docs
    .map(item => ({ id: item.id, ...item.data() }))
    .sort((left, right) => String(left.fullName || '').localeCompare(String(right.fullName || ''), 'pt-BR'));
  return jsonResponse(200, { success: true, data: { users } });
};

const createUser = async (body, context) => {
  assertAdministrator(context);
  const email = cleanString(body.email, 320).toLowerCase();
  const fullName = cleanString(body.fullName, 240);
  const password = String(body.password || '');
  const role = sanitizeUserRole(body.role);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const error = new Error('E-mail inválido.');
    error.statusCode = 400;
    throw error;
  }
  if (!fullName) {
    const error = new Error('Nome do usuário é obrigatório.');
    error.statusCode = 400;
    throw error;
  }
  if (password.length < 8) {
    const error = new Error('A senha temporária deve ter pelo menos 8 caracteres.');
    error.statusCode = 400;
    throw error;
  }
  const adminAuth = getAdminAuth();
  let user;
  try {
    user = await adminAuth.getUserByEmail(email);
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error;
    user = await adminAuth.createUser({ email, password, displayName: fullName, emailVerified: false });
  }
  await adminAuth.setCustomUserClaims(user.uid, {
    ...(user.customClaims || {}),
    staff: true,
    role,
    organization_id: context.organizationId,
  });
  await context.database.collection(USERS_COLLECTION).doc(context.organizationId + '_' + user.uid).set({
    organizationId: context.organizationId,
    firebaseUid: user.uid,
    email,
    fullName,
    role,
    active: true,
    createdBy: context.userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await writeAudit(context, 'USER_CREATE', 'users', user.uid, null, { email, fullName, role });
  return jsonResponse(201, { success: true, data: { uid: user.uid, email, fullName, role } });
};

const updateUser = async (body, context) => {
  assertAdministrator(context);
  const uid = safeId(body.uid, 'Usuário');
  const role = sanitizeUserRole(body.role);
  const active = body.active !== false;
  const adminAuth = getAdminAuth();
  const user = await adminAuth.getUser(uid);
  const before = {
    email: user.email || null,
    displayName: user.displayName || null,
    role: user.customClaims?.role || 'leitura',
    active: !user.disabled,
  };
  await adminAuth.updateUser(uid, { disabled: !active });
  await adminAuth.setCustomUserClaims(uid, {
    ...(user.customClaims || {}),
    staff: true,
    role,
    organization_id: context.organizationId,
  });
  const after = { email: user.email || null, displayName: user.displayName || null, role, active };
  await context.database.collection(USERS_COLLECTION).doc(context.organizationId + '_' + uid).set({
    organizationId: context.organizationId,
    firebaseUid: uid,
    email: user.email || null,
    fullName: user.displayName || user.email || 'Usuário',
    role,
    active,
    updatedBy: context.userId,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await writeAudit(context, 'USER_UPDATE', 'users', uid, before, after);
  return jsonResponse(200, { success: true, data: { uid, role, active } });
};

const listRecords = async (event, context) => {
  assertRoleCan(context.role, 'read');
  const { entity, definition } = assertMasterDataEntity(event.queryStringParameters?.entity);
  const search = normalizeSearch(sanitizeSearchTerm(event.queryStringParameters?.search));
  const limit = sanitizeListLimit(event.queryStringParameters?.limit);
  const snapshot = await entityCollection(context.database, context.organizationId, entity)
    .where('deletedAt', '==', null)
    .limit(Math.max(limit * 4, limit))
    .get();
  const records = snapshot.docs
    .map(item => ({ id: item.id, ...item.data() }))
    .filter(item => !search || definition.searchColumns.some(column => normalizeSearch(item[column]).includes(search)))
    .sort((left, right) => String(right.updatedAtIso || '').localeCompare(String(left.updatedAtIso || '')))
    .slice(0, limit);
  return jsonResponse(200, { success: true, data: { entity, records } });
};

const createRecord = async (body, context) => {
  assertRoleCan(context.role, 'create');
  const { entity, definition } = assertMasterDataEntity(body.entity);
  const data = sanitizeMasterDataPayload(entity, body.data, 'create');
  const reference = entityCollection(context.database, context.organizationId, entity).doc();
  const nowIso = new Date().toISOString();
  const record = {
    ...data,
    id: reference.id,
    organizationId: context.organizationId,
    active: data.active !== false,
    deletedAt: null,
    createdBy: context.userId,
    updatedBy: context.userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
  };
  await reference.create(record);
  const responseRecord = {
    ...record,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  await writeAudit(context, 'CREATE', entity, reference.id, null, responseRecord);
  return jsonResponse(201, {
    success: true,
    data: { entity, record: responseRecord },
    message: definition.label + ': cadastro criado.',
  });
};

const updateRecord = async (body, context) => {
  assertRoleCan(context.role, 'update');
  const { entity, definition } = assertMasterDataEntity(body.entity);
  const id = safeId(body.id);
  const data = sanitizeMasterDataPayload(entity, body.data, 'update');
  const reference = entityCollection(context.database, context.organizationId, entity).doc(id);
  const nowIso = new Date().toISOString();
  const changed = await context.database.runTransaction(async transaction => {
    const current = await transaction.get(reference);
    if (!current.exists || current.data()?.deletedAt) {
      const error = new Error('Cadastro não encontrado.');
      error.statusCode = 404;
      throw error;
    }
    if (body.expectedUpdatedAt && current.data()?.updatedAtIso !== cleanString(body.expectedUpdatedAt, 50)) {
      const error = new Error('O cadastro foi alterado por outra pessoa. Atualize a lista antes de salvar novamente.');
      error.statusCode = 409;
      throw error;
    }
    const next = {
      ...current.data(),
      ...data,
      id,
      updatedBy: context.userId,
      updatedAt: serverTimestamp(),
      updatedAtIso: nowIso,
    };
    transaction.set(reference, next);
    return { before: current.data(), after: next };
  });
  const responseRecord = {
    ...changed.after,
    updatedAt: nowIso,
  };
  await writeAudit(context, 'UPDATE', entity, id, changed.before, responseRecord);
  return jsonResponse(200, {
    success: true,
    data: { entity, record: responseRecord },
    message: definition.label + ': cadastro atualizado.',
  });
};

const archiveRecord = async (body, context) => {
  assertRoleCan(context.role, 'archive');
  const { entity, definition } = assertMasterDataEntity(body.entity);
  const id = safeId(body.id);
  const reference = entityCollection(context.database, context.organizationId, entity).doc(id);
  const changed = await context.database.runTransaction(async transaction => {
    const current = await transaction.get(reference);
    if (!current.exists || current.data()?.deletedAt) {
      const error = new Error('Cadastro não encontrado.');
      error.statusCode = 404;
      throw error;
    }
    const after = {
      ...current.data(),
      active: false,
      deletedAt: new Date().toISOString(),
      updatedBy: context.userId,
      updatedAt: serverTimestamp(),
      updatedAtIso: new Date().toISOString(),
    };
    transaction.set(reference, after);
    return { before: current.data(), after };
  });
  await writeAudit(context, 'INACTIVATE', entity, id, changed.before, changed.after);
  return jsonResponse(200, {
    success: true,
    data: { entity, id },
    message: definition.label + ': cadastro inativado sem exclusão física.',
  });
};

const preserveImport = async (request, context, mode) => {
  const batchRef = context.database.collection(IMPORT_BATCHES_COLLECTION).doc();
  const chunks = createImportChunks(request.rows);
  const batch = context.database.batch();
  const nowIso = new Date().toISOString();
  batch.set(batchRef, {
    id: batchRef.id,
    organizationId: context.organizationId,
    entity: request.entity,
    sourceName: request.sourceName,
    sourceType: request.sourceType,
    worksheetName: request.worksheetName || null,
    metadata: request.metadata || {},
    mode,
    status: 'Pendente de revisão',
    totalRows: request.rows.length,
    totalChunks: chunks.length,
    createdBy: context.userId,
    createdAt: serverTimestamp(),
    createdAtIso: nowIso,
  });
  chunks.forEach((rows, index) => {
    batch.set(batchRef.collection('chunks').doc(String(index).padStart(5, '0')), {
      index,
      rows,
      createdAt: serverTimestamp(),
    });
  });
  await batch.commit();
  await writeAudit(context, 'IMPORT_STAGE', request.entity, batchRef.id, null, {
    totalRows: request.rows.length,
    totalChunks: chunks.length,
    sourceName: request.sourceName,
    mode,
  });
  return { batchId: batchRef.id, preservedRows: request.rows.length, chunks: chunks.length };
};

const stageMasterImport = async (body, context) => {
  assertRoleCan(context.role, 'import');
  const request = sanitizeMasterImportRequest(body);
  const stored = await preserveImport(request, context, 'master-review');
  return jsonResponse(202, {
    success: true,
    data: { batchId: stored.batchId, entity: request.entity, totalRows: request.rows.length, readyRows: 0, matchedRows: 0, duplicateRows: 0, invalidRows: 0 },
    message: request.rows.length + ' linha(s) preservada(s) para revisão.',
  });
};

const stageOperationalImport = async (body, context, type) => {
  assertRoleCan(context.role, 'import');
  const request = type === 'fuel' ? sanitizeFuelImportRequest(body) : sanitizeTravelImportRequest(body);
  const stored = await preserveImport(request, context, type);
  return jsonResponse(202, {
    success: true,
    data: { batchId: stored.batchId, preservedRows: request.rows.length, reviewRows: request.rows.length, pendingRows: request.rows.length, duplicateRows: 0 },
    message: request.rows.length + ' linha(s) preservada(s) para revisão.',
  });
};

export const handler = async event => {
  try {
    const method = String(event.httpMethod || 'GET').toUpperCase();
    const context = await getRequestContext(event);
    if (method === 'GET') {
      if (event.queryStringParameters?.action === 'audit') return await listAudits(event, context);
      if (event.queryStringParameters?.action === 'users') return await listUsers(event, context);
      return event.queryStringParameters?.entity ? await listRecords(event, context) : await gatewayStatus(context);
    }
    if (!['POST', 'PATCH', 'DELETE'].includes(method)) {
      return jsonResponse(405, { success: false, message: 'Método não permitido.' }, { Allow: 'GET, POST, PATCH, DELETE' });
    }
    const body = parseJsonBody(event, 4_000_000);
    if (method === 'POST' && body.action === 'create-user') return await createUser(body, context);
    if (method === 'PATCH' && body.action === 'update-user') return await updateUser(body, context);
    if (method === 'POST' && body.action === 'stage-master-import') return await stageMasterImport(body, context);
    if (method === 'POST' && body.action === 'stage-fuel-import') return await stageOperationalImport(body, context, 'fuel');
    if (method === 'POST' && body.action === 'stage-travel-import') return await stageOperationalImport(body, context, 'travel');
    if (method === 'POST' && body.action === 'preserve-import') {
      assertRoleCan(context.role, 'import');
      const request = sanitizeImportRequest(body);
      const stored = await preserveImport(request, context, 'raw');
      return jsonResponse(202, { success: true, data: stored, message: request.rows.length + ' linha(s) preservada(s) para validação.' });
    }
    if (method === 'POST') return await createRecord(body, context);
    if (method === 'PATCH') return await updateRecord(body, context);
    return await archiveRecord(body, context);
  } catch (error) {
    return functionErrorResponse(error);
  }
};
