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
} from './_shared/firebase-admin.js';

const TICKETS_COLLECTION = 'sistemarenea_public_tickets';
const META_COLLECTION = 'sistemarenea_public_meta';
const COUNTER_ID = 'ticket_counter';
const TICKET_DOCUMENT_PREFIX = 'ticket_public_';
const VALID_TYPES = new Set(['Liberação', 'Recebimento']);
const VALID_FLOW = new Set(['Rascunho', 'Enviado']);
const VALID_UNITS = new Set(['m³', 'caçamba']);

const safeDocumentId = value => cleanString(value, 160).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 140);

const ticketNumber = value => cleanString(value, 32).replace(/[^0-9A-Za-z._/-]/g, '');

const cleanSignature = value => {
  const signature = cleanString(value, 1_600_000);
  if (!signature) return undefined;
  if (!/^data:image\/(png|jpeg);base64,[a-zA-Z0-9+/=]+$/.test(signature)) {
    const error = new Error('A assinatura digital possui formato inválido.');
    error.statusCode = 400;
    throw error;
  }
  return signature;
};

const sanitizeTicket = source => {
  const tipoTicket = cleanString(source.tipoTicket || 'Liberação', 20);
  const statusFluxo = cleanString(source.statusFluxo || 'Rascunho', 20);
  if (!VALID_TYPES.has(tipoTicket) || !VALID_FLOW.has(statusFluxo)) {
    const error = new Error('Tipo ou status do ticket inválido.');
    error.statusCode = 400;
    throw error;
  }
  const numero = ticketNumber(source.ticketNumero);
  const id = safeDocumentId(source.id || `ticket-link-${tipoTicket === 'Liberação' ? 'lib' : 'rec'}-${numero}`);
  const data = cleanString(source.data, 10);
  const quantidade = Number(source.quantidadeM3);
  if (!id || !numero || !isIsoDate(data) || !Number.isFinite(quantidade) || quantidade <= 0 || quantidade > 100000) {
    const error = new Error('Identificação, data ou quantidade do ticket inválida.');
    error.statusCode = 400;
    throw error;
  }
  const unidade = cleanString(source.unidadeQuantidade || 'm³', 20);
  if (!VALID_UNITS.has(unidade)) {
    const error = new Error('Unidade do ticket inválida.');
    error.statusCode = 400;
    throw error;
  }
  const nowIso = new Date().toISOString();
  const ticket = {
    id,
    data,
    tipoTicket,
    ticketNumero: numero,
    prefixo: cleanString(source.prefixo, 64).toUpperCase(),
    placa: cleanString(source.placa, 16).toUpperCase(),
    familiaEquipamento: cleanString(source.familiaEquipamento, 100) || undefined,
    equipamentoNome: cleanString(source.equipamentoNome, 160) || undefined,
    horaChegada: cleanString(source.horaChegada, 5) || undefined,
    horaSaida: cleanString(source.horaSaida, 5),
    tipoMaterial: cleanString(source.tipoMaterial, 80),
    materialOutro: cleanString(source.materialOutro, 160) || undefined,
    quantidadeM3: quantidade,
    unidadeQuantidade: unidade,
    destinoObra: cleanString(source.destinoObra, 160),
    destinoOutro: cleanString(source.destinoOutro, 200) || undefined,
    estaca: cleanString(source.estaca, 100) || undefined,
    responsavelLiberacao: cleanString(source.responsavelLiberacao, 160),
    nomeLegivel: cleanString(source.nomeLegivel, 160),
    empresa: cleanString(source.empresa, 80) || 'RENEA',
    observacao: cleanString(source.observacao, 1500),
    statusFluxo,
    cargaConforme: typeof source.cargaConforme === 'boolean' ? source.cargaConforme : undefined,
    assinaturaDigital: cleanSignature(source.assinaturaDigital),
    assinaturaResponsavel: cleanString(source.assinaturaResponsavel, 160) || undefined,
    origemRegistro: 'Link',
    dispositivoId: cleanString(source.dispositivoId, 160),
    equipamentoId: cleanString(source.equipamentoId, 160) || undefined,
    materialId: cleanString(source.materialId, 160) || undefined,
    localOrigemId: cleanString(source.localOrigemId, 160) || undefined,
    localDestinoId: cleanString(source.localDestinoId, 160) || undefined,
    ramoId: cleanString(source.ramoId, 160) || undefined,
    ticketPareadoId: cleanString(source.ticketPareadoId, 160) || undefined,
    viagemId: cleanString(source.viagemId, 160) || undefined,
    criadoEm: cleanString(source.criadoEm, 40) || nowIso,
    atualizadoEm: nowIso,
    enviadoEm: statusFluxo === 'Enviado' ? (cleanString(source.enviadoEm, 40) || nowIso) : undefined,
  };
  if (statusFluxo === 'Enviado') {
    const requiredTime = tipoTicket === 'Liberação' ? ticket.horaSaida : ticket.horaChegada;
    if (!ticket.prefixo || !ticket.placa || !requiredTime || !ticket.tipoMaterial || !ticket.destinoObra || !ticket.nomeLegivel || !ticket.assinaturaDigital) {
      const error = new Error('Preencha veículo, horário, carga, destino, responsável e assinatura antes de enviar.');
      error.statusCode = 400;
      throw error;
    }
    if (ticket.tipoMaterial === 'Outros' && !ticket.materialOutro) {
      const error = new Error('Descreva o material informado como Outros.');
      error.statusCode = 400;
      throw error;
    }
    if (ticket.destinoObra === 'Outros' && !ticket.destinoOutro) {
      const error = new Error('Descreva o destino informado como Outros.');
      error.statusCode = 400;
      throw error;
    }
    if (tipoTicket === 'Recebimento' && typeof ticket.cargaConforme !== 'boolean') {
      const error = new Error('Informe se a carga recebida está conforme.');
      error.statusCode = 400;
      throw error;
    }
  }
  return ticket;
};

const minimalRelease = ticket => ({
  id: ticket.id,
  data: ticket.data,
  tipoTicket: 'Liberação',
  ticketNumero: ticket.ticketNumero,
  prefixo: ticket.prefixo,
  placa: ticket.placa,
  horaSaida: ticket.horaSaida,
  tipoMaterial: ticket.tipoMaterial,
  materialOutro: ticket.materialOutro,
  quantidadeM3: ticket.quantidadeM3,
  unidadeQuantidade: ticket.unidadeQuantidade,
  destinoObra: ticket.destinoObra,
  destinoOutro: ticket.destinoOutro,
  estaca: ticket.estaca,
  responsavelLiberacao: '',
  nomeLegivel: '',
  empresa: ticket.empresa,
  observacao: '',
  statusFluxo: 'Enviado',
  origemRegistro: 'Link',
});

const loadAllTickets = async database => {
  const snapshot = await database.collection(TICKETS_COLLECTION).limit(5000).get();
  return snapshot.docs.map(document => document.data()?.value).filter(ticket => ticket?.id && ticket?.ticketNumero);
};

const searchPending = async (database, rawQuery) => {
  const query = cleanString(rawQuery, 80).toLocaleLowerCase('pt-BR');
  if (query.length < 2) return [];
  const tickets = await loadAllTickets(database);
  const received = new Set(tickets
    .filter(ticket => ticket.tipoTicket === 'Recebimento' && ticket.statusFluxo === 'Enviado')
    .map(ticket => String(ticket.ticketNumero)));
  return tickets
    .filter(ticket => (ticket.tipoTicket || 'Liberação') === 'Liberação' && ticket.statusFluxo === 'Enviado')
    .filter(ticket => !received.has(String(ticket.ticketNumero)))
    .filter(ticket => [ticket.ticketNumero, ticket.placa, ticket.prefixo]
      .some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(query)))
    .sort((a, b) => Number(b.ticketNumero) - Number(a.ticketNumero))
    .slice(0, 30)
    .map(minimalRelease);
};

const reserveNumber = async database => {
  const metaRef = database.collection(META_COLLECTION).doc(COUNTER_ID);
  const existingTickets = await loadAllTickets(database);
  const highest = existingTickets.reduce((max, ticket) => {
    const numeric = Number.parseInt(String(ticket.ticketNumero).replace(/\D/g, ''), 10);
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 0);
  return database.runTransaction(async transaction => {
    const snapshot = await transaction.get(metaRef);
    const storedNext = Number(snapshot.data()?.nextNumber || 0);
    const nextNumber = Math.max(storedNext, highest + 1, 1);
    transaction.set(metaRef, { nextNumber: nextNumber + 1, updatedAt: serverTimestamp() }, { merge: true });
    return String(nextNumber);
  });
};

const saveTicket = async (database, event, rawTicket) => {
  const ticket = sanitizeTicket(rawTicket || {});
  if (!ticket.dispositivoId) {
    const error = new Error('Identificador do dispositivo não informado.');
    error.statusCode = 400;
    throw error;
  }
  const reference = database.collection(TICKETS_COLLECTION).doc(`${TICKET_DOCUMENT_PREFIX}${safeDocumentId(ticket.id)}`);
  await database.runTransaction(async transaction => {
    const currentSnapshot = await transaction.get(reference);
    const current = currentSnapshot.data()?.value;
    if (current?.dispositivoId && current.dispositivoId !== ticket.dispositivoId) {
      const error = new Error('Este ticket pertence a outro dispositivo.');
      error.statusCode = 409;
      throw error;
    }
    if (current?.statusFluxo === 'Enviado') {
      const error = new Error(`O ticket ${ticket.ticketNumero} já foi enviado e não pode ser sobrescrito pelo link público.`);
      error.statusCode = 409;
      throw error;
    }
    transaction.set(reference, {
      kind: 'ticket_public',
      updatedAt: serverTimestamp(),
      updatedAtIso: ticket.atualizadoEm,
      sourceIpHash: requestIpHash(event),
      value: ticket,
    });
  });
  return ticket;
};

export const handler = async event => {
  try {
    const database = getAdminDb();
    const method = String(event.httpMethod || 'GET').toUpperCase();
    await enforceRateLimit(database, event, `public-tickets-${method}`, method === 'GET' ? 180 : 60, method === 'GET' ? 300 : 3600);

    if (method === 'GET') {
      const results = await searchPending(database, event.queryStringParameters?.q || '');
      return jsonResponse(200, { success: true, data: { tickets: results } });
    }
    if (method !== 'POST') return jsonResponse(405, { success: false, message: 'Método não permitido.' }, { Allow: 'GET, POST' });
    const body = parseJsonBody(event, 2_000_000);
    if (body.action === 'reserve') {
      const number = await reserveNumber(database);
      return jsonResponse(201, { success: true, data: { ticketNumero: number } });
    }
    if (body.action === 'save') {
      const ticket = await saveTicket(database, event, body.ticket);
      return jsonResponse(201, { success: true, data: { ticket }, message: ticket.statusFluxo === 'Rascunho' ? 'Rascunho salvo.' : `Ticket ${ticket.ticketNumero} enviado com segurança.` });
    }
    return jsonResponse(400, { success: false, message: 'Ação de ticket inválida.' });
  } catch (error) {
    return functionErrorResponse(error);
  }
};
