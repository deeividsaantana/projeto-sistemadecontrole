import crypto from 'node:crypto';

// Regras do link do apontador de materiais que não dependem do Firestore.
// Ficam aqui para os testes cobrirem sem rede e sem credencial.

export const MATERIAL_USE_KIND = 'material-uso';
export const MATERIAL_USE_DOCUMENT_PREFIX = 'material_uso_';
export const MAX_ITEMS_PER_SUBMISSION = 40;
export const MAX_QUANTITY_PER_ITEM = 100_000;

const round = value => Number(Number(value).toFixed(3));

/**
 * O link de materiais tem token próprio. Quando a variável dedicada não
 * existe, ele deriva do token dos tickets: continua secreto, não abre o link
 * de tickets e troca junto se o token dos tickets for rotacionado.
 */
export const resolveMaterialLinkToken = (env = process.env) => {
  const dedicated = String(env.RENEA_PUBLIC_MATERIAL_LINK_TOKEN || '').trim();
  if (dedicated.length >= 24) return dedicated;
  const ticketToken = String(env.RENEA_PUBLIC_TICKET_LINK_TOKEN || '').trim();
  if (ticketToken.length < 24) return '';
  return crypto.createHmac('sha256', ticketToken).update('renea-link-materiais-v1').digest('base64url');
};

export const dateInSaoPaulo = (offsetDays = 0, now = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date(now.getTime() + offsetDays * 86_400_000));

const pieceLength = material => {
  const length = Number(material?.comprimentoPecaM);
  return Number.isFinite(length) && length > 0 ? length : null;
};

const isConsumption = movement => movement?.tipo === 'Saída' && movement?.finalidade === 'Consumo';

/**
 * Monta o que o apontador vê: só ramos com material recebido e vinculado, e em
 * cada ramo só os materiais que chegaram lá. O uso soma o que o ERP já
 * incorporou e o que ainda está na fila, para duas pessoas no mesmo ramo não
 * lançarem a mesma peça sem saber.
 */
export const buildFieldView = ({ etapas = [], materiais = [], movimentos = [], pendentes = [], today }) => {
  const catalog = new Map(materiais.filter(item => item && item.id && item.ativo !== false).map(item => [item.id, item]));
  const branchNames = new Map(etapas.filter(item => item?.id).map(item => [item.id, String(item.nome || item.id)]));
  const rows = new Map();
  const incorporated = new Set();
  const todayUses = [];

  const rowFor = (branchId, materialId) => {
    const key = `${branchId}\u0000${materialId}`;
    let row = rows.get(key);
    if (!row) {
      const material = catalog.get(materialId);
      row = {
        ramoId: branchId,
        materialId,
        descricao: String(material?.descricao || ''),
        unidade: String(material?.unidade || ''),
        comprimentoPecaM: pieceLength(material) || undefined,
        recebido: 0,
        usado: 0,
      };
      rows.set(key, row);
    }
    return row;
  };

  for (const movement of movimentos) {
    if (!movement || movement.canceladoEm || !movement.etapaServicoId || !catalog.has(movement.materialId)) continue;
    if (movement.origemApontamentoId) incorporated.add(movement.origemApontamentoId);
    const quantity = Math.abs(Number(movement.quantidade) || 0);
    if (movement.tipo === 'Entrada') rowFor(movement.etapaServicoId, movement.materialId).recebido += quantity;
    else if (isConsumption(movement)) {
      rowFor(movement.etapaServicoId, movement.materialId).usado += quantity;
      if (movement.data === today) {
        todayUses.push({
          id: movement.id,
          ramoId: movement.etapaServicoId,
          materialId: movement.materialId,
          quantidade: quantity,
          apontador: String(movement.apontadoPor || movement.responsavel || ''),
          criadoEm: String(movement.criadoEm || ''),
        });
      }
    }
  }

  for (const submission of pendentes) {
    if (!submission?.id || incorporated.has(submission.id) || submission.status === 'cancelled') continue;
    const payload = submission.payload || {};
    (payload.itens || []).forEach((item, index) => {
      if (!catalog.has(item.materialId)) return;
      const quantity = Math.abs(Number(item.quantidade) || 0);
      rowFor(payload.etapaServicoId, item.materialId).usado += quantity;
      if (payload.data === today) {
        todayUses.push({
          id: `${submission.id}-${index + 1}`,
          ramoId: payload.etapaServicoId,
          materialId: item.materialId,
          quantidade: quantity,
          apontador: String(payload.apontador || ''),
          criadoEm: String(submission.createdAtIso || ''),
        });
      }
    });
  }

  const branches = new Map();
  for (const row of rows.values()) {
    if (row.recebido <= 0) continue;
    let branch = branches.get(row.ramoId);
    if (!branch) {
      branch = { id: row.ramoId, nome: branchNames.get(row.ramoId) || row.ramoId, materiais: [] };
      branches.set(row.ramoId, branch);
    }
    branch.materiais.push({ ...row, recebido: round(row.recebido), usado: round(row.usado), saldo: round(row.recebido - row.usado) });
  }

  const ramos = [...branches.values()]
    .map(branch => ({ ...branch, materiais: branch.materiais.sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR', { numeric: true })) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
  const ramoIds = new Set(ramos.map(item => item.id));
  return {
    dataAtual: today,
    ramos,
    lancamentosHoje: todayUses
      .filter(item => ramoIds.has(item.ramoId))
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)),
  };
};

const badRequest = message => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const clean = (value, max) => String(value ?? '').trim().slice(0, max);

/**
 * Valida o envio contra o que o ERP sabe: ramo existente, material recebido
 * naquele ramo, quantidade positiva e data de hoje ou de ontem. Passar do
 * recebido não é recusado: a peça pode ter vindo de outro ramo, e o excesso
 * aparece na conferência em vez de sumir.
 */
export const sanitizeMaterialUse = (body, view, { today, yesterday }) => {
  const envioId = clean(body?.envioId, 80).replace(/[^a-zA-Z0-9-]/g, '');
  if (envioId.length < 16) throw badRequest('Identificador do envio inválido. Recarregue a página e tente de novo.');
  const data = clean(body?.data, 10);
  if (data !== today && data !== yesterday) throw badRequest('O uso só pode ser lançado para hoje ou ontem.');
  const apontador = clean(body?.apontador, 80).replace(/\s+/g, ' ');
  if (apontador.length < 2) throw badRequest('Informe seu nome antes de salvar.');
  const branch = view.ramos.find(item => item.id === clean(body?.etapaServicoId, 160));
  if (!branch) throw badRequest('Esse ramo não tem material recebido. Atualize a página.');
  const rawItems = Array.isArray(body?.itens) ? body.itens : [];
  if (rawItems.length === 0) throw badRequest('Marque a quantidade de pelo menos um material.');
  if (rawItems.length > MAX_ITEMS_PER_SUBMISSION) throw badRequest('Envio com materiais demais. Divida em dois.');
  const seen = new Set();
  const itens = rawItems.map(raw => {
    const material = branch.materiais.find(item => item.materialId === clean(raw?.materialId, 160));
    if (!material) throw badRequest('Um dos materiais não foi recebido nesse ramo. Atualize a página.');
    if (seen.has(material.materialId)) throw badRequest('O mesmo material apareceu duas vezes no envio.');
    seen.add(material.materialId);
    const quantidade = Number(raw?.quantidade);
    if (!Number.isFinite(quantidade) || quantidade <= 0 || quantidade > MAX_QUANTITY_PER_ITEM) {
      throw badRequest(`Quantidade inválida para ${material.descricao}.`);
    }
    return {
      materialId: material.materialId,
      materialDescricao: material.descricao,
      unidade: material.unidade,
      quantidade: round(quantidade),
    };
  });
  return {
    id: `${MATERIAL_USE_DOCUMENT_PREFIX}${envioId}`,
    payload: {
      data,
      etapaServicoId: branch.id,
      etapaServicoNome: branch.nome,
      apontador,
      itens,
      observacao: clean(body?.observacao, 500) || undefined,
    },
  };
};
