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

// Um envio existente pode ter no máximo um documento por equipe/data, graças
// ao lock transacional criado no POST original. Reaproveitado tanto para
// expor o apontamento já enviado no GET quanto para localizá-lo na edição
// pontual por colaborador (PATCH).
const findGroupSubmissionDocs = async (database, grupoId, date) => {
  const snapshot = await database.collection('sistemarenea_public_submissions')
    .where('payload.grupoId', '==', grupoId)
    .get();
  return snapshot.docs.filter(document => {
    const data = document.data();
    return data?.kind === 'presence' && data?.payload?.data === date;
  });
};

const loadGroupRecordsForDate = async (database, grupoId, date) => {
  const docs = await findGroupSubmissionDocs(database, grupoId, date);
  return docs.flatMap(document => {
    const records = document.data()?.payload?.records;
    return Array.isArray(records) ? records : [];
  });
};

// O responsável precisa reabrir o link e consultar dias anteriores da própria
// equipe. Uma leitura única por grupo devolve o histórico indexado por data,
// evitando uma consulta por dia. Dias anteriores são somente leitura: o PATCH
// continua aceitando apenas a data atual.
const HISTORY_DAYS_LIMIT = 30;

const indexGroupHistory = documents => {
  const byDate = new Map();
  documents.forEach(document => {
    const data = typeof document.data === 'function' ? document.data() : document;
    if (data?.kind !== 'presence') return;
    const date = cleanString(data?.payload?.data, 10);
    if (!isIsoDate(date)) return;
    const records = Array.isArray(data?.payload?.records) ? data.payload.records : [];
    byDate.set(date, [...(byDate.get(date) || []), ...records]);
  });
  const datas = [...byDate.keys()].sort().reverse().slice(0, HISTORY_DAYS_LIMIT);
  return { byDate, datas };
};

const loadGroupHistory = async (database, grupoId) => {
  const snapshot = await database.collection('sistemarenea_public_submissions')
    .where('payload.grupoId', '==', grupoId)
    .get();
  return indexGroupHistory(snapshot.docs);
};

// Aplica a alteração de um único colaborador sobre o array de registros já
// enviados, sem tocar nos demais. Cria o registro (upsert) se a equipe ganhou
// um colaborador depois do envio original. O histórico de edições nunca é
// apagado, apenas acrescentado.
const applyRecordEdit = ({ records, group, employee, funcionarioId, status, observacao, token, date, nowIso, horaEnvio, submissionDocId }) => {
  if (!VALID_STATUSES.has(status)) {
    const error = new Error('Existe uma situação de presença inválida.');
    error.statusCode = 400;
    throw error;
  }
  const list = Array.isArray(records) ? records : [];
  const index = list.findIndex(record => cleanString(record?.funcionarioId, 160) === funcionarioId);
  const previous = index >= 0 ? list[index] : null;
  const historyEntry = {
    statusAnterior: previous?.status || '',
    statusNovo: status,
    observacaoAnterior: previous?.observacao || '',
    observacaoNova: observacao,
    editadoEm: nowIso,
    origem: 'link-publico',
  };
  const updatedRecord = previous
    ? {
      ...previous,
      status,
      observacao,
      updatedAt: nowIso,
      historicoEdicoes: [...(Array.isArray(previous.historicoEdicoes) ? previous.historicoEdicoes : []), historyEntry],
    }
    : {
      id: `plink-${stableHash(`${group.id}|${date}|${funcionarioId}`).slice(0, 24)}`,
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
      observacao,
      tokenUsado: `validado-${stableHash(token).slice(0, 12)}`,
      createdAt: nowIso,
      updatedAt: nowIso,
      submissionDocId,
      historicoEdicoes: [historyEntry],
    };
  const nextRecords = index >= 0
    ? list.map((record, position) => (position === index ? updatedRecord : record))
    : [...list, updatedRecord];
  return { records: nextRecords, record: updatedRecord };
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
  applyRecordEdit,
  indexGroupHistory,
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
      const today = todayInSaoPaulo();
      const submittedGroupIds = await loadSubmittedGroupIds(database, today);
      const availableConfig = filterSubmittedGroups(config, submittedGroupIds);
      // O link individual (não-geral) sempre reabre a própria equipe, mesmo já
      // enviada: o responsável precisa continuar acessando a lista e editando
      // situações pontuais depois do primeiro envio, sem ficar bloqueado.
      const meuGrupo = !isGeneralToken(token) ? (config.gruposEquipe[0] || null) : null;
      // O link pode pedir um dia anterior da própria equipe; sem parâmetro,
      // abre sempre no dia atual de São Paulo.
      const requestedDate = cleanString(event.queryStringParameters?.data, 10);
      let meusRegistros = [];
      let datasDisponiveis = [];
      let dataSelecionada = today;
      if (meuGrupo) {
        const history = await loadGroupHistory(database, meuGrupo.id);
        datasDisponiveis = history.datas;
        dataSelecionada = isIsoDate(requestedDate) && history.byDate.has(requestedDate) ? requestedDate : today;
        meusRegistros = history.byDate.get(dataSelecionada) || [];
      }
      return jsonResponse(200, {
        success: true,
        data: {
          gruposEquipe: availableConfig.gruposEquipe,
          funcionarios: config.funcionarios,
          empresas: config.empresas,
          obras: config.obras,
          meuGrupo,
          meusRegistros,
          datasDisponiveis,
          dataSelecionada,
          dataAtual: today,
        },
      }, {
        'Cache-Control': 'no-store',
      });
    }

    if (method === 'PATCH') {
      const body = parseJsonBody(event);
      const token = cleanString(body.token, 180);
      const groupId = cleanString(body.grupoId, 160);
      const funcionarioId = cleanString(body.funcionarioId, 160);
      const status = cleanString(body.status, 40);
      const observacao = cleanString(body.observacao, 500);
      if (!token || !groupId || !funcionarioId || !status) {
        return jsonResponse(400, { success: false, message: 'Dados de atualização incompletos ou inválidos.' });
      }
      const idempotencyKey = assertIdempotencyKey(event, { required: true });
      const publicContext = {
        database,
        organizationId: 'public-presenca',
        userId: stableHash(token).slice(0, 32),
        requestId: event.headers?.['x-request-id'] || '',
      };
      return await withIdempotency(event, publicContext, idempotencyKey, async () => {
        const date = todayInSaoPaulo();
        const snapshot = await loadPresenceSnapshot(database);
        const employees = (snapshot.funcionarios || []).filter(item => item?.ativo);
        const authorizedGroups = resolveGroupEmployeeIds(activeGroupsForToken(snapshot, token), employees);
        const group = authorizedGroups.find(item => item.id === groupId);
        if (!group) return jsonResponse(403, { success: false, message: 'O link não autoriza o grupo selecionado.' });
        const employee = employees.find(item => item.id === funcionarioId);
        if (!employee || !group.funcionarioIds.includes(funcionarioId)) {
          return jsonResponse(400, { success: false, message: 'Este colaborador não pertence à equipe do link.' });
        }
        const docs = await findGroupSubmissionDocs(database, groupId, date);
        if (docs.length === 0) {
          return jsonResponse(404, { success: false, message: 'Envie o apontamento completo da equipe antes de editar uma situação individual.' });
        }
        const submissionRef = docs[0].ref;
        const now = new Date();
        const nowIso = now.toISOString();
        const horaEnvio = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
        let updatedRecord = null;
        try {
          // A leitura e a escrita do array de registros acontecem na mesma
          // transação. Se dois dispositivos editarem colaboradores diferentes
          // da mesma equipe ao mesmo tempo, o Firestore serializa e reexecuta
          // a transação perdedora automaticamente — nenhuma edição é perdida.
          await database.runTransaction(async transaction => {
            const document = await transaction.get(submissionRef);
            if (!document.exists) {
              const error = new Error('Envie o apontamento completo da equipe antes de editar uma situação individual.');
              error.statusCode = 404;
              throw error;
            }
            const data = document.data();
            const { records, record } = applyRecordEdit({
              records: data?.payload?.records,
              group,
              employee,
              funcionarioId,
              status,
              observacao,
              token,
              date,
              nowIso,
              horaEnvio,
              submissionDocId: document.id,
            });
            updatedRecord = record;
            transaction.update(submissionRef, {
              'payload.records': records,
              // Volta para "pending" para que a assinatura em tempo real do
              // painel administrativo reabra e incorpore a alteração — a
              // mesma fila que já processa o envio original.
              status: 'pending',
              updatedAt: serverTimestamp(),
              updatedAtIso: nowIso,
            });
          });
        } catch (error) {
          if (error?.statusCode) throw error;
          throw new Error('Não foi possível salvar esta alteração com segurança.');
        }
        return jsonResponse(200, {
          success: true,
          data: { record: updatedRecord },
          message: `Situação de ${updatedRecord.funcionarioNome} atualizada.`,
        });
      });
    }

    if (method !== 'POST') return jsonResponse(405, { success: false, message: 'Método não permitido.' }, { Allow: 'GET, POST, PATCH' });
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
      const lockId = `presence_${stableHash(`${group.id}|${date}`).slice(0, 48)}`;
      const lockRef = database.collection('sistemarenea_presence_locks').doc(lockId);
      const submissionRef = database.collection('sistemarenea_public_submissions').doc(`presence_${submissionId}`);
      const submission = {
        kind: 'presence',
        status: 'pending',
        createdAt: serverTimestamp(),
        createdAtIso,
        sourceIpHash: requestIpHash(event),
        payload: { grupoId: group.id, grupoNome: cleanString(group.nome, 160), data: date, records },
      };
      try {
        // O bloqueio e a submissão nascem na mesma transação. Assim não existe
        // reserva órfã se a gravação do registro falhar.
        await database.runTransaction(async transaction => {
          const lock = await transaction.get(lockRef);
          if (lock.exists) {
            const error = new Error('Já existe presença registrada para esta equipe nesta data.');
            error.statusCode = 409;
            throw error;
          }
          transaction.create(lockRef, { grupoId: group.id, data: date, submissionId, createdAt: serverTimestamp() });
          transaction.create(submissionRef, submission);
        });
      } catch (error) {
        if (error?.statusCode === 409) throw error;
        throw new Error('Não foi possível registrar a presença desta equipe com segurança.');
      }
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
