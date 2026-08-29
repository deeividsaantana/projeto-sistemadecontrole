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
import { assertIdempotencyKey } from './_shared/api-security.js';
import { withIdempotency } from './_shared/idempotency.js';

const VALID_STATUSES = new Set(['Presente', 'Ausente', 'Falta justificada', 'Atestado', 'Férias', 'Afastado', 'Outro']);
const isGeneralToken = token => token.startsWith('geral-');
const todayInSaoPaulo = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());
// A configuração pública pode ser reutilizada por poucos segundos sem perder
// a sensação de tempo real. O cabeçalho no-store continua impedindo cache do
// navegador; esta janela curta evita leituras excessivas no Firestore.
const SNAPSHOT_CACHE_TTL_MS = 3000;
let cachedSnapshot = null;
let cachedSnapshotUntil = 0;
let snapshotRequest = null;

const loadPresenceSnapshot = async database => {
  const now = Date.now();
  if (cachedSnapshot && now < cachedSnapshotUntil) return cachedSnapshot;
  if (!snapshotRequest) {
    snapshotRequest = loadCloudSnapshot(database, ['gruposEquipe', 'funcionarios', 'empresas', 'obras'], {
      cacheTtlMs: SNAPSHOT_CACHE_TTL_MS,
      allowLegacyFallback: true,
      skipIntegrityCheck: true,
    })
      .then(snapshot => {
        cachedSnapshot = snapshot;
        cachedSnapshotUntil = Date.now() + SNAPSHOT_CACHE_TTL_MS;
        return snapshot;
      })
      .finally(() => {
        snapshotRequest = null;
      });
  }
  return snapshotRequest;
};

const activeGroupsForToken = (snapshot, token) => {
  const active = (snapshot.gruposEquipe || []).filter(group => group?.status === 'ativo' && group?.linkAtivo);
  if (active.some(group => group.tokenGeral === token)) return active;
  return active.filter(group => group.token === token);
};

const sanitizeGroup = (group, exposedToken = '') => ({
  id: cleanString(group.id, 160),
  nome: cleanString(group.nome, 160),
  responsavel: cleanString(group.responsavel, 160),
  frenteServico: cleanString(group.frenteServico, 200),
  obraId: cleanString(group.obraId, 160) || undefined,
  funcionarioIds: Array.isArray(group.funcionarioIds) ? group.funcionarioIds.map(id => cleanString(id, 160)).filter(Boolean) : [],
  status: 'ativo',
  token: exposedToken,
  linkAtivo: true,
  createdAt: '',
  updatedAt: '',
});

const resolveGroupEmployeeIds = (groups, employees) => {
  const employeeById = new Map(employees.map(employee => [employee.id, employee]));
  const employeeByRegistration = new Map(employees.map(employee => [cleanString(employee.matricula, 80).toLowerCase(), employee]));
  return groups.map(group => {
    const resolvedIds = new Set((Array.isArray(group.funcionarioIds) ? group.funcionarioIds : []).filter(id => employeeById.has(id)));
    (Array.isArray(group.funcionarioMatriculas) ? group.funcionarioMatriculas : []).forEach(registration => {
      const employee = employeeByRegistration.get(cleanString(registration, 80).toLowerCase());
      if (employee) resolvedIds.add(employee.id);
    });
    return { ...group, funcionarioIds: [...resolvedIds] };
  });
};

const getPublicConfig = (snapshot, token) => {
  const groups = activeGroupsForToken(snapshot, token);
  if (groups.length === 0) return null;
  const allEmployees = (snapshot.funcionarios || []).filter(employee => employee?.ativo);
  const resolvedGroups = resolveGroupEmployeeIds(groups, allEmployees);
  const employeeIds = new Set(resolvedGroups.flatMap(group => group.funcionarioIds));
  const employees = allEmployees
    .filter(employee => employeeIds.has(employee.id))
    .map(employee => ({
      id: cleanString(employee.id, 160),
      nome: cleanString(employee.nome, 180),
      cargo: cleanString(employee.cargo, 120),
      telefone: '',
      empresaId: cleanString(employee.empresaId, 160),
      ativo: true,
    }));
  const companyIds = new Set(employees.map(employee => employee.empresaId).filter(Boolean));
  const companies = (snapshot.empresas || [])
    .filter(company => companyIds.has(company.id))
    .map(company => ({
      id: cleanString(company.id, 160),
      nome: cleanString(company.nome, 180),
      cnpj: '', telefone: '', responsavel: '',
      status: company.status === 'INATIVO' ? 'INATIVO' : 'ATIVO',
    }));
  const workIds = new Set(resolvedGroups.map(group => group.obraId).filter(Boolean));
  const works = (snapshot.obras || [])
    .filter(work => workIds.has(work.id))
    .map(work => ({
      id: cleanString(work.id, 160),
      nome: cleanString(work.nome, 180),
      endereco: cleanString(work.endereco || work.local, 180),
      responsavel: '',
      status: ['Ativa', 'Concluída', 'Planejada'].includes(work.status) ? work.status : 'Ativa',
    }));
  return {
    gruposEquipe: resolvedGroups.map(group => sanitizeGroup(group, isGeneralToken(token) ? '' : token)),
    funcionarios: employees,
    empresas: companies,
    obras: works,
  };
};

const filterSubmittedGroups = (config, submittedGroupIds) => {
  const submitted = submittedGroupIds instanceof Set ? submittedGroupIds : new Set(submittedGroupIds || []);
  const gruposEquipe = config.gruposEquipe.filter(group => !submitted.has(group.id));
  const employeeIds = new Set(gruposEquipe.flatMap(group => group.funcionarioIds || []));
  const funcionarios = config.funcionarios.filter(employee => employeeIds.has(employee.id));
  const companyIds = new Set(funcionarios.map(employee => employee.empresaId).filter(Boolean));
  const workIds = new Set(gruposEquipe.map(group => group.obraId).filter(Boolean));
  return {
    ...config,
    gruposEquipe,
    funcionarios,
    empresas: config.empresas.filter(company => companyIds.has(company.id)),
    obras: config.obras.filter(work => workIds.has(work.id)),
  };
};

const loadSubmittedGroupIds = async (database, date) => {
  const snapshot = await database.collection('sistemarenea_public_submissions')
    .where('payload.data', '==', date)
    .get();
  return new Set(snapshot.docs.flatMap(document => {
    const data = document.data();
    if (data?.kind !== 'presence') return [];
    const groupId = cleanString(data?.payload?.grupoId, 160);
    return groupId ? [groupId] : [];
  }));
};

const buildPresenceRecords = ({ group, employees, date, items, token, submissionId: requestedSubmissionId = '' }) => {
  const employeeMap = new Map(employees.map(employee => [employee.id, employee]));
  const allowedIds = new Set(group.funcionarioIds || []);
  const expectedIds = new Set([...allowedIds].filter(id => employeeMap.has(id)));
  const submittedIds = items.map(item => cleanString(item?.funcionarioId, 160));
  if (expectedIds.size === 0 || submittedIds.length !== expectedIds.size || new Set(submittedIds).size !== submittedIds.length || submittedIds.some(id => !expectedIds.has(id))) {
    const error = new Error('A lista da equipe mudou ou está incompleta. Recarregue o link antes de enviar.');
    error.statusCode = 409;
    throw error;
  }
  const now = new Date();
  const submissionId = requestedSubmissionId || crypto.randomUUID();
  const horaEnvio = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  const records = items.map((item, index) => {
    const funcionarioId = cleanString(item.funcionarioId, 160);
    if (!allowedIds.has(funcionarioId) || !employeeMap.has(funcionarioId)) {
      const error = new Error('A equipe foi atualizada. Recarregue o link antes de enviar.');
      error.statusCode = 409;
      throw error;
    }
    const status = cleanString(item.status, 40);
    if (!VALID_STATUSES.has(status)) {
      const error = new Error('Existe uma situação de presença inválida.');
      error.statusCode = 400;
      throw error;
    }
    const employee = employeeMap.get(funcionarioId);
    return {
      id: `plink-${submissionId}-${index + 1}`,
      data: date,
      horaEnvio,
      grupoId: group.id,
      grupoNome: cleanString(group.nome, 160),
      responsavel: cleanString(group.responsavel, 160),
      frenteServico: cleanString(group.frenteServico, 200),
      funcionarioId,
      funcionarioNome: cleanString(employee.nome, 180),
      funcao: cleanString(employee.cargo, 120),
      status,
      observacao: cleanString(item.observacao, 500),
      tokenUsado: `validado-${stableHash(token).slice(0, 12)}`,
      createdAt: now.toISOString(),
      submissionDocId: `presence_${submissionId}`,
    };
  });
  return { records, submissionId, createdAtIso: now.toISOString() };
};

export const __testing = {
  activeGroupsForToken,
  buildPresenceRecords,
  filterSubmittedGroups,
  getPublicConfig,
  resolveGroupEmployeeIds,
  todayInSaoPaulo,
};

export const handler = async event => {
  try {
    const database = getAdminDb();
    const method = String(event.httpMethod || 'GET').toUpperCase();
    // GET é somente leitura e não deve abrir uma transação de escrita no
    // Firestore a cada carregamento do link. Escritas continuam protegidas.
    if (method !== 'GET') {
      await enforceRateLimit(database, event, `public-presenca-${method}`, 30, 3600);
    }

    if (method === 'GET') {
      const token = cleanString(event.queryStringParameters?.token, 180);
      if (!token) return jsonResponse(400, { success: false, message: 'Token de presença não informado.' });
      const snapshot = await loadPresenceSnapshot(database);
      const config = getPublicConfig(snapshot, token);
      if (!config) return jsonResponse(404, { success: false, message: 'Link de presença inválido ou inativo.' });
      const submittedGroupIds = await loadSubmittedGroupIds(database, todayInSaoPaulo());
      const availableConfig = filterSubmittedGroups(config, submittedGroupIds);
      return jsonResponse(200, { success: true, data: availableConfig }, {
        'Cache-Control': 'no-store',
      });
    }

    if (method !== 'POST') return jsonResponse(405, { success: false, message: 'Método não permitido.' }, { Allow: 'GET, POST' });
    const body = parseJsonBody(event);
    const token = cleanString(body.token, 180);
    const groupId = cleanString(body.grupoId, 160);
    const date = cleanString(body.data, 10);
    if (!token || !groupId || !isIsoDate(date) || !Array.isArray(body.items) || body.items.length === 0 || body.items.length > 500) {
      return jsonResponse(400, { success: false, message: 'Dados de presença incompletos ou inválidos.' });
    }
    if (date !== todayInSaoPaulo()) {
      return jsonResponse(400, { success: false, message: 'O link público aceita somente a presença da data atual.' });
    }
    const idempotencyKey = assertIdempotencyKey(event, { required: true });
    const publicContext = {
      database,
      organizationId: 'public-presenca',
      userId: stableHash(token).slice(0, 32),
      requestId: event.headers?.['x-request-id'] || '',
    };
    return await withIdempotency(event, publicContext, idempotencyKey, async () => {
      const snapshot = await loadPresenceSnapshot(database);
      const employees = (snapshot.funcionarios || []).filter(employee => employee?.ativo);
      const authorizedGroups = resolveGroupEmployeeIds(activeGroupsForToken(snapshot, token), employees);
      const group = authorizedGroups.find(item => item.id === groupId);
      if (!group) return jsonResponse(403, { success: false, message: 'O link não autoriza o grupo selecionado.' });
      const existingSnapshot = await database.collection('sistemarenea_public_submissions')
        .where('payload.grupoId', '==', group.id)
        .get();
      const existingEmployeeIds = new Set(
        existingSnapshot.docs.flatMap(item => {
          if (item.data()?.kind !== 'presence' || item.data()?.payload?.data !== date) return [];
          const records = item.data()?.payload?.records;
          return Array.isArray(records) ? records.map(record => cleanString(record?.funcionarioId, 160)) : [];
        }).filter(Boolean),
      );
      const submittedEmployeeIds = new Set(body.items.map(item => cleanString(item?.funcionarioId, 160)));
      if ([...submittedEmployeeIds].some(id => existingEmployeeIds.has(id))) {
        const error = new Error('Já existe presença registrada para um ou mais colaboradores desta equipe nesta data.');
        error.statusCode = 409;
        throw error;
      }
      const stableSubmissionId = `presence_${stableHash(idempotencyKey).slice(0, 48)}`;
      const { records, submissionId, createdAtIso } = buildPresenceRecords({ group, employees, date, items: body.items, token, submissionId: stableSubmissionId });
      await database.collection('sistemarenea_public_submissions').doc(`presence_${submissionId}`).set({
        kind: 'presence',
        status: 'pending',
        createdAt: serverTimestamp(),
        createdAtIso,
        sourceIpHash: requestIpHash(event),
        payload: { grupoId: group.id, grupoNome: cleanString(group.nome, 160), data: date, records },
      });
      return jsonResponse(201, {
        success: true,
        data: { submissionId, createdAtIso },
        message: `Presença de ${group.nome} enviada com segurança.`,
      });
    });
  } catch (error) {
    return functionErrorResponse(error);
  }
};
