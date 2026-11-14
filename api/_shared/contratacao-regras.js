/**
 * Regras da Solicitação de Contratação (SGR-FRH-21-373-01-000-000-0008 Ver. 7).
 * Módulo puro, sem banco e sem node:*, usado pela API (autoridade) e pela tela
 * (só para mostrar o mesmo erro antes de enviar).
 *
 * Sequência rígida: solicitante assina ao pedir -> RH assina -> gerente de
 * contrato assina -> aprovada. O banco confere de novo (sign_erp_hiring_request).
 */

export const PRIORIDADES = ['Alta', 'Média', 'Baixa'];
export const MOTIVOS = { aumento: 'Aumento de quadro', transferencia: 'Transferência/Promoção', substituicao: 'Substituição', outro: 'Outro' };
export const TIPOS = { efetivo: 'Efetivo', temp_efetivacao: 'Temporário p/ efetivação', temporario: 'Temporário' };
export const ITENS = { alojamento: 'Alojamento', passagem: 'Passagem', hospedagem: 'Hospedagem', computador: 'Computador', email: 'E-mail/Sistema', celular: 'Celular', nenhum: 'A função não requer nenhum destes itens' };

export const ETAPAS = ['solicitante', 'rh', 'gerente'];
export const NOME_DA_ETAPA = { solicitante: 'Solicitante', rh: 'RH', gerente: 'Gerente de contrato' };
export const SITUACOES = {
  aguardando_rh: 'Aguardando RH',
  aguardando_gerente: 'Aguardando gerente',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
};
/** Papéis que o administrador dá. Quem não tem papel só pede e vê os próprios pedidos. */
export const PAPEIS = { rh: 'RH (assina a 2ª etapa)', gerente: 'Gerente de contrato (assina a 3ª etapa)', auxiliar: 'Auxiliar (só acompanha)' };

const texto = (valor, max) => String(valor ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const textoLongo = (valor, max) => String(valor ?? '').trim().slice(0, max);
const dataValida = valor => {
  const s = String(valor || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [a, m, d] = s.split('-').map(Number);
  const data = new Date(Date.UTC(a, m - 1, d));
  return data.getUTCFullYear() === a && data.getUTCMonth() === m - 1 && data.getUTCDate() === d;
};

/**
 * Confere e limpa o formulário. Devolve { formulario, erros }, com erros por
 * campo, em português simples, para a tela marcar o campo certo.
 */
export const validarFormulario = (entrada = {}) => {
  /** @type {Record<string, string>} */
  const erros = {};
  const itens = Array.isArray(entrada.itens) ? [...new Set(entrada.itens.filter(item => Object.hasOwn(ITENS, item)))] : [];
  const quantidade = Number(String(entrada.quantidade ?? '').replace(',', '.'));
  const formulario = {
    data: String(entrada.data || ''),
    prioridade: PRIORIDADES.includes(entrada.prioridade) ? entrada.prioridade : '',
    motivo: Object.hasOwn(MOTIVOS, entrada.motivo) ? entrada.motivo : '',
    motivoOutro: entrada.motivo === 'outro' ? texto(entrada.motivoOutro, 160) : '',
    tipo: Object.hasOwn(TIPOS, entrada.tipo) ? entrada.tipo : '',
    posicao: texto(entrada.posicao, 120),
    quantidade: Number.isInteger(quantidade) ? quantidade : 0,
    salario: texto(entrada.salario, 40),
    requisitante: texto(entrada.requisitante, 120),
    area: texto(entrada.area, 160),
    itens: itens.includes('nenhum') ? ['nenhum'] : itens,
    obs: textoLongo(entrada.obs, 1500),
    aprovados: textoLongo(entrada.aprovados, 1500),
    comentarios: textoLongo(entrada.comentarios, 1500),
  };
  if (!dataValida(formulario.data)) erros.data = 'Informe a data da solicitação.';
  if (!formulario.prioridade) erros.prioridade = 'Escolha a prioridade.';
  if (!formulario.motivo) erros.motivo = 'Escolha o motivo.';
  else if (formulario.motivo === 'outro' && formulario.motivoOutro.length < 3) erros.motivoOutro = 'Escreva qual é o outro motivo.';
  if (!formulario.tipo) erros.tipo = 'Escolha o tipo de contratação.';
  if (formulario.posicao.length < 2) erros.posicao = 'Informe a posição a contratar.';
  if (!(formulario.quantidade >= 1 && formulario.quantidade <= 999)) erros.quantidade = 'Quantidade é um número inteiro de 1 a 999.';
  if (formulario.requisitante.length < 2) erros.requisitante = 'Informe o requisitante.';
  if (formulario.area.length < 2) erros.area = 'Informe a área ou obra.';
  if (!formulario.itens.length) erros.itens = 'Marque os itens necessários ou "não requer nenhum".';
  return { formulario, erros };
};

/** JSON com as chaves sempre na mesma ordem: a base do código de conferência. */
export const formularioCanonico = formulario => JSON.stringify(Object.keys(formulario).sort().reduce((acc, chave) => {
  acc[chave] = formulario[chave];
  return acc;
}, {}));

/**
 * Até que etapa a pessoa enxerga assinaturas: solicitante 0, RH 1, gerente 2.
 * Auxiliar e administrador acompanham tudo (só leitura).
 */
export const alcanceDoLeitor = leitor => {
  if (leitor.admin || leitor.papeis.includes('auxiliar') || leitor.papeis.includes('gerente')) return 2;
  if (leitor.papeis.includes('rh')) return 1;
  return 0;
};

/** O pedido aparece para quem? Filtro rígido, conferido no servidor. */
export const pedidoVisivel = (pedido, leitor) => {
  if (pedido.requester_user_id === leitor.userId) return true;
  if (leitor.admin || leitor.papeis.includes('auxiliar')) return true;
  if (leitor.papeis.includes('rh')) return true;
  if (leitor.papeis.includes('gerente')) {
    return pedido.status === 'aguardando_gerente' || pedido.status === 'aprovada'
      || (pedido.status === 'recusada' && pedido.rejected_stage === 'gerente');
  }
  return false;
};

/**
 * Assinaturas que a pessoa vê. Com o pedido aprovado, o documento final é
 * de todos que podem vê-lo. Antes disso, quem está numa etapa vê só a
 * assinatura das etapas até a sua; das seguintes vê só "assinado" (nome e
 * hora), sem o traço.
 */
export const assinaturasVisiveis = (pedido, assinaturas, leitor) => {
  const alcance = pedido.status === 'aprovada' ? 2 : alcanceDoLeitor(leitor);
  return ETAPAS
    .map(etapa => assinaturas.find(assinatura => assinatura.stage === etapa))
    .filter(Boolean)
    .map(assinatura => (ETAPAS.indexOf(assinatura.stage) <= alcance || assinatura.signer_user_id === leitor.userId
      ? assinatura
      : { ...assinatura, image_data: null, oculta: true }));
};

/** A etapa que falta, ou null quando o pedido terminou. */
export const etapaPendente = status => (status === 'aguardando_rh' ? 'rh' : status === 'aguardando_gerente' ? 'gerente' : null);

/** A pessoa pode assinar/recusar este pedido agora? (a tela usa; o banco decide). */
export const podeDecidir = (pedido, assinaturas, leitor) => {
  const etapa = etapaPendente(pedido.status);
  if (!etapa || !leitor.papeis.includes(etapa)) return false;
  return !assinaturas.some(assinatura => assinatura.signer_user_id === leitor.userId);
};
