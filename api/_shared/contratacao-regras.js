/**
 * Regras da Solicitação de Contratação (SGR-FRH-21-373-01-000-000-0008 Ver. 7).
 * Módulo puro, sem banco e sem node:*, usado pela API (autoridade) e pela tela
 * (só para mostrar o mesmo erro antes de enviar).
 *
 * Fluxo (16/11/2026): quem abre só preenche; o pedido ganha um link próprio
 * e passa por 3 assinaturas em ordem rígida: 1ª gerente (Bruno) -> 2ª gerente
 * (Marcelo Suegama) -> 3ª RH -> concluído (o link expira). O banco confere de
 * novo (sign_erp_hiring_request).
 */

export const PRIORIDADES = ['Alta', 'Média', 'Baixa'];
export const MOTIVOS = { aumento: 'Aumento de quadro', transferencia: 'Transferência/Promoção', substituicao: 'Substituição', outro: 'Outro' };
export const TIPOS = { efetivo: 'Efetivo', temp_efetivacao: 'Temporário p/ efetivação', temporario: 'Temporário' };
export const ITENS = { alojamento: 'Alojamento', passagem: 'Passagem', hospedagem: 'Hospedagem', computador: 'Computador', email: 'E-mail/Sistema', celular: 'Celular', nenhum: 'A função não requer nenhum destes itens' };

/** As 3 assinaturas, na ordem. O índice + 1 é a `etapa_atual` do banco. */
export const ETAPAS = ['gerente_1', 'gerente_2', 'rh'];
export const CARGO_DA_ETAPA = { gerente_1: 'Gerente', gerente_2: 'Gerente', rh: 'RH' };
/** Nome de quem assina quando o administrador ainda não marcou ninguém. */
export const TITULARES_PADRAO = { gerente_1: 'Bruno', gerente_2: 'Marcelo Suegama', rh: 'RH' };
export const SITUACOES = {
  etapa_1: 'Aguardando 1ª assinatura',
  etapa_2: 'Aguardando 2ª assinatura',
  etapa_3: 'Aguardando RH',
  concluido: 'Concluído',
  recusada: 'Recusada',
};
/** Papéis que o administrador dá. Quem não tem papel só pede e vê os próprios pedidos. */
export const PAPEIS = {
  gerente_1: '1ª assinatura (Gerente)',
  gerente_2: '2ª assinatura (Gerente)',
  rh: '3ª assinatura (RH)',
  auxiliar: 'Auxiliar (acompanha)',
};

const texto = (valor, max) => String(valor ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const textoLongo = (valor, max) => String(valor ?? '').trim().slice(0, max);
const dataValida = valor => {
  const s = String(valor || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [a, m, d] = s.split('-').map(Number);
  const data = new Date(Date.UTC(a, m - 1, d));
  return data.getUTCFullYear() === a && data.getUTCMonth() === m - 1 && data.getUTCDate() === d;
};

const soDigitos = valor => String(valor ?? '').replace(/\D/g, '');

/** CPF com os dois dígitos verificadores certos (e sem ser 111.111.111-11). */
export const cpfValido = valor => {
  const cpf = soDigitos(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digito = tamanho => {
    let soma = 0;
    for (let i = 0; i < tamanho; i += 1) soma += Number(cpf[i]) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
};

/** 12345678909 -> 123.456.789-09 */
export const cpfFormatado = valor => {
  const cpf = soDigitos(valor);
  return cpf.length === 11 ? `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}` : cpf;
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
    candidato: texto(entrada.candidato, 120),
    cpf: soDigitos(entrada.cpf).slice(0, 11),
    inicio: String(entrada.inicio || ''),
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
  if (formulario.candidato.length < 3) erros.candidato = 'Informe o nome completo do candidato.';
  if (!cpfValido(formulario.cpf)) erros.cpf = 'CPF inválido. Confira os 11 números.';
  if (!dataValida(formulario.inicio)) erros.inicio = 'Informe a data prevista de início.';
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

/** Quem tem algum papel na contratação (ou é admin) vê todos os pedidos. */
const temPapel = leitor => leitor.admin || leitor.papeis.length > 0;

/** O pedido aparece para quem? Quem abriu, o administrador e quem tem papel. */
export const pedidoVisivel = (pedido, leitor) => pedido.requester_user_id === leitor.userId || temPapel(leitor);

/** O pedido ainda está correndo (link vale)? */
export const emAberto = status => status === 'etapa_1' || status === 'etapa_2' || status === 'etapa_3';

/** A etapa que falta (gerente_1, gerente_2 ou rh), ou null quando terminou. */
export const etapaPendente = pedido => (emAberto(pedido.status) ? ETAPAS[Number(pedido.etapa_atual) - 1] ?? null : null);

/**
 * "Bruno Luscher (Gerente)". `titulares` vem do servidor: nomes marcados em
 * "Quem assina". O RH pode ter mais de uma pessoa, então aparece só "RH".
 */
export const nomeDaEtapa = (etapa, titulares = {}) => {
  if (etapa === 'rh') return 'RH';
  const nome = (titulares[etapa] || [])[0] || TITULARES_PADRAO[etapa] || etapa;
  return `${nome} (${CARGO_DA_ETAPA[etapa] || ''})`;
};

/** A pessoa pode assinar/recusar este pedido agora? (a tela usa; o banco decide). */
export const podeDecidir = (pedido, assinaturas, leitor) => {
  const etapa = etapaPendente(pedido);
  if (!etapa || !leitor.papeis.includes(etapa)) return false;
  return !assinaturas.some(assinatura => assinatura.stage !== 'solicitante' && assinatura.signer_user_id === leitor.userId);
};

/** Token do link individual: 64 letras de 0-9a-f, gerado pelo banco. */
export const tokenValido = token => /^[0-9a-f]{64}$/.test(String(token || ''));
