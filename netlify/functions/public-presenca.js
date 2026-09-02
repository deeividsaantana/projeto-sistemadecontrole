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
  requireStaffUser,
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

// O apontador pode incluir alguém que chegou na frente sem estar na equipe.
// A inclusão nasce nesta coleção para valer no link imediatamente, mesmo com
// o painel administrativo fechado, e segue para a fila pública, que a grava
// definitivamente no cadastro da equipe.
const TEAM_MEMBERS_COLLECTION = 'sistemarenea_presence_team_members';
const teamMemberDocId = (groupId, employeeId) => `member_${stableHash(`${groupId}|${employeeId}`).slice(0, 48)}`;

const loadTeamAdditions = async (database, groupIds) => {
  const ids = [...new Set((groupIds || []).filter(Boolean))];
  if (ids.length === 0) return new Map();
  const chunks = [];
  for (let index = 0; index < ids.length; index += 10) chunks.push(ids.slice(index, index + 10));
  const snapshots = await Promise.all(chunks.map(chunk => database
    .collection(TEAM_MEMBERS_COLLECTION)
    .where('grupoId', 'in', chunk)
    .get()));
  const byGroup = new Map();
  snapshots.forEach(snapshot => snapshot.docs.forEach(document => {
    const data = document.data();
    const groupId = cleanString(data?.grupoId, 160);
    const employeeId = cleanString(data?.funcionarioId, 160);
    if (!groupId || !employeeId) return;
    const current = byGroup.get(groupId) || { additions: [], removals: [] };
    if (data?.removed === true) current.removals.push(employeeId);
    else current.additions.push(employeeId);
    byGroup.set(groupId, current);
  }));
  return byGroup;
};

// A adição só vale para colaboradores ativos do cadastro. Um id que saiu do
// efetivo é simplesmente ignorado, sem quebrar o link da equipe.
const applyTeamAdditions = (groups, additionsByGroup, employees) => {
  if (!additionsByGroup || additionsByGroup.size === 0) return groups;
  const activeIds = new Set(employees.map(employee => employee.id));
  return groups.map(group => {
    const override = additionsByGroup.get(group.id) || [];
    const extras = (Array.isArray(override) ? override : override.additions || []).filter(id => activeIds.has(id));
    const removals = new Set(Array.isArray(override) ? [] : override.removals || []);
    if (extras.length === 0 && removals.size === 0) return group;
    return {
      ...group,
      funcionarioIds: [...new Set([...(group.funcionarioIds || []).filter(id => !removals.has(id)), ...extras])],
    };
  });
};

const sanitizeAvailableEmployee = employee => ({
  id: cleanString(employee.id, 160),
  nome: cleanString(employee.nome, 180),
  cargo: cleanString(employee.cargo, 120),
  matricula: cleanString(employee.matricula, 80),
  empresaId: cleanString(employee.empresaId, 160),
});

// Teto defensivo do catálogo exposto ao link. O efetivo da obra cabe com
// folga; o limite existe para que um cadastro fora de escala não transforme
// a resposta pública em um despejo de dados.
const AVAILABLE_EMPLOYEES_LIMIT = 800;

const getPublicConfig = (snapshot, token, additionsByGroup = new Map()) => {
  const groups = activeGroupsForToken(snapshot, token);
  if (groups.length === 0) return null;
  const allEmployees = (snapshot.funcionarios || []).filter(employee => employee?.ativo);
  const resolvedGroups = applyTeamAdditions(resolveGroupEmployeeIds(groups, allEmployees), additionsByGroup, allEmployees);
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
  // Catálogo para a inclusão em campo: o efetivo ativo que ainda não está em
  // nenhuma equipe do link. Vai sem telefone e sem dados sensíveis — só o
  // suficiente para o apontador reconhecer e escolher a pessoa certa.
  const funcionariosDisponiveis = allEmployees
    .filter(employee => !employeeIds.has(employee.id))
    .map(sanitizeAvailableEmployee)
    .filter(employee => employee.id && employee.nome)
    .sort((first, second) => first.nome.localeCompare(second.nome, 'pt-BR'))
    .slice(0, AVAILABLE_EMPLOYEES_LIMIT);
  const availableCompanyIds = new Set(funcionariosDisponiveis.map(employee => employee.empresaId).filter(Boolean));
  const allCompanies = [
    ...companies,
    ...(snapshot.empresas || [])
      .filter(company => availableCompanyIds.has(company.id) && !companyIds.has(company.id))
      .map(company => ({
        id: cleanString(company.id, 160),
        nome: cleanString(company.nome, 180),
        cnpj: '', telefone: '', responsavel: '',
        status: company.status === 'INATIVO' ? 'INATIVO' : 'ATIVO',
      })),
  ];
  return {
    gruposEquipe: resolvedGroups.map(group => sanitizeGroup(group, isGeneralToken(token) ? '' : token)),
    funcionarios: employees,
    funcionariosDisponiveis,
    empresas: allCompanies,
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

// Observação do dia inteiro, da equipe: chuva, parada de frente, acidente.
// Vive no envio, não no colaborador, porque não é sobre ninguém em especial.
const findDayNote = documents => {
  for (const document of documents) {
    const data = typeof document.data === 'function' ? document.data() : document;
    if (data?.kind !== 'presence') continue;
    const nota = cleanString(data?.payload?.observacaoDia, 600);
    if (nota) return nota;
  }
  return '';
};

const PRESENCE_LOCKS_COLLECTION = 'sistemarenea_presence_locks';
const presenceLockId = (grupoId, date) => `presence_${stableHash(`${grupoId}|${date}`).slice(0, 48)}`;

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
  const notesByDate = new Map();
  documents.forEach(document => {
    const data = typeof document.data === 'function' ? document.data() : document;
    if (data?.kind !== 'presence') return;
    const date = cleanString(data?.payload?.data, 10);
    if (!isIsoDate(date)) return;
    const records = Array.isArray(data?.payload?.records) ? data.payload.records : [];
    byDate.set(date, [...(byDate.get(date) || []), ...records]);
    const nota = cleanString(data?.payload?.observacaoDia, 600);
    if (nota) notesByDate.set(date, nota);
  });
  const datas = [...byDate.keys()].sort().reverse().slice(0, HISTORY_DAYS_LIMIT);
  return { byDate, notesByDate, datas };
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
  applyTeamAdditions,
  indexGroupHistory,
  buildPresenceRecords,
  filterSubmittedGroups,
  presenceLockId,
  getPublicConfig,
  resolveGroupEmployeeIds,
  teamMemberDocId,
  todayInSaoPaulo,
};

export const handler = async event => {
  try {
    const database = getAdminDb();
    const method = String(event.httpMethod || 'GET').toUpperCase();
    // GET é somente leitura e não deve abrir uma transação de escrita no
    // Firestore a cada carregamento do link. Escritas continuam protegidas.
    if (method !== 'GET' && method !== 'DELETE') {
      await enforceRateLimit(database, event, `public-presenca-${method}`, 30, 3600);
    }

    if (method === 'GET') {
      const token = cleanString(event.queryStringParameters?.token, 180);
      if (!token) return jsonResponse(400, { success: false, message: 'Token de presença não informado.' });
      const snapshot = await loadPresenceSnapshot(database);
      const tokenGroupIds = activeGroupsForToken(snapshot, token).map(group => group.id);
      const additionsByGroup = await loadTeamAdditions(database, tokenGroupIds);
      const config = getPublicConfig(snapshot, token, additionsByGroup);
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
      let observacaoDia = '';
      let historicoPorData = {};
      let observacoesPorData = {};
      if (meuGrupo) {
        const history = await loadGroupHistory(database, meuGrupo.id);
        datasDisponiveis = history.datas;
        dataSelecionada = isIsoDate(requestedDate) && history.byDate.has(requestedDate) ? requestedDate : today;
        meusRegistros = history.byDate.get(dataSelecionada) || [];
        observacaoDia = history.notesByDate.get(dataSelecionada) || '';
        historicoPorData = Object.fromEntries(history.datas.map(date => [date, history.byDate.get(date) || []]));
        historicoPorData[today] ??= [];
        observacoesPorData = Object.fromEntries(history.datas.map(date => [date, history.notesByDate.get(date) || '']));
        observacoesPorData[today] ??= '';
      }
      return jsonResponse(200, {
        success: true,
        data: {
          gruposEquipe: availableConfig.gruposEquipe,
          funcionarios: config.funcionarios,
          funcionariosDisponiveis: config.funcionariosDisponiveis,
          empresas: config.empresas,
          obras: config.obras,
          meuGrupo,
          meusRegistros,
          datasDisponiveis,
          dataSelecionada,
          observacaoDia,
          historicoPorData,
          observacoesPorData,
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

      // A observação do dia muda ao longo do turno — a chuva chega às 14h.
      // Editá-la não toca em situação de ninguém.
      if (cleanString(body.action, 40) === 'observacao-dia') {
        const observacaoDia = cleanString(body.observacaoDia, 600);
        if (!token || !groupId) {
          return jsonResponse(400, { success: false, message: 'Dados da observação incompletos.' });
        }
        const idempotencyKeyNota = assertIdempotencyKey(event, { required: true });
        const contextoNota = {
          database,
          organizationId: 'public-presenca',
          userId: stableHash(token).slice(0, 32),
          requestId: event.headers?.['x-request-id'] || '',
        };
        return await withIdempotency(event, contextoNota, idempotencyKeyNota, async () => {
          const date = todayInSaoPaulo();
          const snapshot = await loadPresenceSnapshot(database);
          if (!activeGroupsForToken(snapshot, token).some(item => item.id === groupId)) {
            return jsonResponse(403, { success: false, message: 'O link não autoriza o grupo selecionado.' });
          }
          const docs = await findGroupSubmissionDocs(database, groupId, date);
          if (docs.length === 0) {
            return jsonResponse(404, { success: false, message: 'Envie o apontamento da equipe antes de registrar a observação do dia.' });
          }
          await docs[0].ref.update({
            'payload.observacaoDia': observacaoDia,
            status: 'pending',
            updatedAt: serverTimestamp(),
            updatedAtIso: new Date().toISOString(),
          });
          return jsonResponse(200, {
            success: true,
            data: { observacaoDia },
            message: observacaoDia ? 'Observação do dia registrada.' : 'Observação do dia removida.',
          });
        });
      }

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
        const tokenGroups = activeGroupsForToken(snapshot, token);
        const additionsByGroup = await loadTeamAdditions(database, tokenGroups.map(item => item.id));
        const authorizedGroups = applyTeamAdditions(resolveGroupEmployeeIds(tokenGroups, employees), additionsByGroup, employees);
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

    // Zerar o dia de uma equipe. Diferente do restante deste arquivo, que é
    // público e autenticado por token de link, esta ação exige conta de equipe:
    // ela remove a reserva do dia e libera um novo envio pelo link.
    if (method === 'DELETE') {
      const staff = await requireStaffUser(event);
      const grupoId = cleanString(event.queryStringParameters?.grupoId, 160);
      const date = cleanString(event.queryStringParameters?.data, 10);
      if (!grupoId || !isIsoDate(date)) {
        return jsonResponse(400, { success: false, message: 'Informe a equipe e a data a zerar.' });
      }
      const docs = await findGroupSubmissionDocs(database, grupoId, date);
      const registrosRemovidos = docs.reduce(
        (total, document) => total + (Array.isArray(document.data()?.payload?.records) ? document.data().payload.records.length : 0),
        0,
      );
      // A reserva sai junto com os envios. Apagar só os envios deixaria a
      // equipe travada: o link continuaria recusando o dia por duplicidade.
      const batch = database.batch();
      docs.forEach(document => batch.delete(document.ref));
      batch.delete(database.collection(PRESENCE_LOCKS_COLLECTION).doc(presenceLockId(grupoId, date)));
      await batch.commit();
      return jsonResponse(200, {
        success: true,
        data: { grupoId, data: date, enviosRemovidos: docs.length, registrosRemovidos, zeradoPor: cleanString(staff.email, 320) },
        message: docs.length
          ? `Dia ${date} zerado: ${registrosRemovidos} registro(s) removido(s). A equipe pode enviar de novo.`
          : `Nenhum envio encontrado em ${date}; a reserva do dia foi liberada mesmo assim.`,
      });
    }

    if (method !== 'POST') return jsonResponse(405, { success: false, message: 'Método não permitido.' }, { Allow: 'GET, POST, PATCH, DELETE' });
    const body = parseJsonBody(event);

    // Remoção do vínculo da equipe. O cadastro do colaborador permanece ativo;
    // somente a participação nesta equipe deixa de valer a partir de agora.
    if (cleanString(body.action, 40) === 'remover-colaborador') {
      const token = cleanString(body.token, 180);
      const groupId = cleanString(body.grupoId, 160);
      const funcionarioId = cleanString(body.funcionarioId, 160);
      if (!token || !groupId || !funcionarioId) {
        return jsonResponse(400, { success: false, message: 'Dados da remoção incompletos ou inválidos.' });
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
        const employees = (snapshot.funcionarios || []).filter(item => item?.ativo);
        const tokenGroups = activeGroupsForToken(snapshot, token);
        const overridesByGroup = await loadTeamAdditions(database, tokenGroups.map(item => item.id));
        const authorizedGroups = applyTeamAdditions(resolveGroupEmployeeIds(tokenGroups, employees), overridesByGroup, employees);
        const group = authorizedGroups.find(item => item.id === groupId);
        if (!group) return jsonResponse(403, { success: false, message: 'O link não autoriza o grupo selecionado.' });
        const employee = employees.find(item => item.id === funcionarioId);
        if (!employee || !group.funcionarioIds.includes(funcionarioId)) {
          return jsonResponse(400, { success: false, message: 'Este colaborador não pertence mais à equipe.' });
        }
        const nowIso = new Date().toISOString();
        const funcionarioNome = cleanString(employee.nome, 180);
        const funcao = cleanString(employee.cargo, 120);
        const memberRef = database.collection(TEAM_MEMBERS_COLLECTION).doc(teamMemberDocId(groupId, funcionarioId));
        const submissionRef = database.collection('sistemarenea_public_submissions')
          .doc(`team_${stableHash(idempotencyKey).slice(0, 48)}`);
        await database.runTransaction(async transaction => {
          transaction.set(memberRef, {
            grupoId: group.id,
            funcionarioId,
            funcionarioNome,
            funcao,
            removed: true,
            origem: 'link-publico',
            tokenUsado: `validado-${stableHash(token).slice(0, 12)}`,
            updatedAt: serverTimestamp(),
            updatedAtIso: nowIso,
          });
          transaction.create(submissionRef, {
            kind: 'equipe',
            status: 'pending',
            createdAt: serverTimestamp(),
            createdAtIso: nowIso,
            sourceIpHash: requestIpHash(event),
            payload: {
              operacao: 'remover',
              grupoId: group.id,
              grupoNome: cleanString(group.nome, 160),
              data: todayInSaoPaulo(),
              funcionarioId,
              funcionarioNome,
              funcao,
            },
          });
        });
        return jsonResponse(200, {
          success: true,
          data: { funcionarioId },
          message: `${funcionarioNome} removido da equipe ${group.nome}.`,
        });
      });
    }

    // Inclusão de colaborador direto da frente de serviço. O link continua sem
    // poder criar, editar ou desativar cadastro: ele apenas vincula alguém que
    // já existe no efetivo ativo à equipe daquele token.
    if (cleanString(body.action, 40) === 'adicionar-colaborador') {
      const token = cleanString(body.token, 180);
      const groupId = cleanString(body.grupoId, 160);
      const funcionarioId = cleanString(body.funcionarioId, 160);
      if (!token || !groupId || !funcionarioId) {
        return jsonResponse(400, { success: false, message: 'Dados da inclusão incompletos ou inválidos.' });
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
        const employees = (snapshot.funcionarios || []).filter(item => item?.ativo);
        const tokenGroups = activeGroupsForToken(snapshot, token);
        const additionsByGroup = await loadTeamAdditions(database, tokenGroups.map(item => item.id));
        const authorizedGroups = applyTeamAdditions(resolveGroupEmployeeIds(tokenGroups, employees), additionsByGroup, employees);
        const group = authorizedGroups.find(item => item.id === groupId);
        if (!group) return jsonResponse(403, { success: false, message: 'O link não autoriza o grupo selecionado.' });
        const employee = employees.find(item => item.id === funcionarioId);
        if (!employee) {
          return jsonResponse(400, { success: false, message: 'Este colaborador não está no efetivo ativo da obra.' });
        }
        if (group.funcionarioIds.includes(funcionarioId)) {
          return jsonResponse(409, { success: false, message: `${employee.nome} já está nesta equipe.` });
        }
        // Ninguém pode ficar em duas equipes no mesmo dia: seria contado duas
        // vezes no efetivo da obra. A checagem varre todas as equipes ativas,
        // não só as visíveis por este token.
        const otherGroups = resolveGroupEmployeeIds(
          (snapshot.gruposEquipe || []).filter(item => item?.status === 'ativo' && item?.linkAtivo && item?.id !== groupId),
          employees,
        );
        const otherAdditions = await database.collection(TEAM_MEMBERS_COLLECTION)
          .where('funcionarioId', '==', funcionarioId)
          .get();
        const conflictingGroupIds = new Set([
          ...otherGroups.filter(item => item.funcionarioIds.includes(funcionarioId)).map(item => item.id),
          ...otherAdditions.docs
            .map(document => cleanString(document.data()?.grupoId, 160))
            .filter(id => id && id !== groupId),
        ]);
        if (conflictingGroupIds.size > 0) {
          const [conflictingId] = [...conflictingGroupIds];
          const conflictingName = (snapshot.gruposEquipe || []).find(item => item?.id === conflictingId)?.nome || 'outra equipe';
          return jsonResponse(409, {
            success: false,
            message: `${employee.nome} já está na equipe ${conflictingName}. Peça ao administrativo para transferir antes de incluir aqui.`,
          });
        }
        const now = new Date();
        const nowIso = now.toISOString();
        const funcionarioNome = cleanString(employee.nome, 180);
        const funcao = cleanString(employee.cargo, 120);
        const memberRef = database.collection(TEAM_MEMBERS_COLLECTION).doc(teamMemberDocId(groupId, funcionarioId));
        const submissionRef = database.collection('sistemarenea_public_submissions')
          .doc(`team_${stableHash(idempotencyKey).slice(0, 48)}`);
        try {
          // O vínculo e o aviso para o painel nascem juntos. Se a fila falhar,
          // a inclusão não fica valendo só no link, invisível para a obra.
          await database.runTransaction(async transaction => {
            const existing = await transaction.get(memberRef);
            if (existing.exists && existing.data()?.removed !== true) {
              const error = new Error(`${funcionarioNome} já foi incluído nesta equipe.`);
              error.statusCode = 409;
              throw error;
            }
            transaction.set(memberRef, {
              grupoId: group.id,
              funcionarioId,
              funcionarioNome,
              funcao,
              removed: false,
              origem: 'link-publico',
              tokenUsado: `validado-${stableHash(token).slice(0, 12)}`,
              createdAt: serverTimestamp(),
              createdAtIso: nowIso,
            });
            transaction.create(submissionRef, {
              kind: 'equipe',
              status: 'pending',
              createdAt: serverTimestamp(),
              createdAtIso: nowIso,
              sourceIpHash: requestIpHash(event),
              payload: {
                operacao: 'adicionar',
                grupoId: group.id,
                grupoNome: cleanString(group.nome, 160),
                data: todayInSaoPaulo(),
                funcionarioId,
                funcionarioNome,
                funcao,
              },
            });
          });
        } catch (error) {
          if (error?.statusCode) throw error;
          throw new Error('Não foi possível incluir este colaborador com segurança.');
        }
        return jsonResponse(201, {
          success: true,
          data: { funcionario: { id: funcionarioId, nome: funcionarioNome, cargo: funcao, empresaId: cleanString(employee.empresaId, 160), ativo: true } },
          message: `${funcionarioNome} incluído na equipe ${group.nome}.`,
        });
      });
    }

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
      const tokenGroups = activeGroupsForToken(snapshot, token);
      const additionsByGroup = await loadTeamAdditions(database, tokenGroups.map(item => item.id));
      const authorizedGroups = applyTeamAdditions(resolveGroupEmployeeIds(tokenGroups, employees), additionsByGroup, employees);
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
      const lockId = presenceLockId(group.id, date);
      const lockRef = database.collection('sistemarenea_presence_locks').doc(lockId);
      const submissionRef = database.collection('sistemarenea_public_submissions').doc(`presence_${submissionId}`);
      const submission = {
        kind: 'presence',
        status: 'pending',
        createdAt: serverTimestamp(),
        createdAtIso,
        sourceIpHash: requestIpHash(event),
        payload: {
        grupoId: group.id,
        grupoNome: cleanString(group.nome, 160),
        data: date,
        observacaoDia: cleanString(body.observacaoDia, 600),
        records,
      },
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
