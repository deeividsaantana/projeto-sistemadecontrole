/**
 * Regras da Solicitação de Contratação (SGR-FRH-21-373-01-000-000-0008 Ver. 7).
 * Módulo puro, sem banco e sem node:*, usado pela API (autoridade) e pela tela
 * (só para mostrar o mesmo erro antes de enviar).
 *
 * Fluxo: quem abre só preenche; o pedido ganha um link próprio e passa por 3
 * assinaturas em ordem rígida. Desde 17/11/2026 a ordem é 1ª RH -> 2ª gerente
 * (Bruno) -> 3ª gerente (Marcelo Suegama) -> concluído. Na tela os nomes são
 * "Recursos Humanos" e "Gerência" (18/11/2026) (o link expira). O
 * banco confere de novo (sign_erp_hiring_request).
 */

/** Os 3 tipos de solicitação (17/11/2026). Pedido antigo sem tipo é contratação. */
export const SOLICITACOES = { contratacao: 'Contratação', promocao: 'Promoção', desligamento: 'Desligamento' };
export const tipoDoPedido = form => (Object.hasOwn(SOLICITACOES, form?.solicitacao) ? form.solicitacao : 'contratacao');

/** Promoção: modelo "Solicitação de cargo e salário" (SGR-FRH-21-373-01-000-000-0011). */
export const ALTERACOES = { alteracao_funcional: 'Alteração funcional', promocao: 'Promoção', enquadramento: 'Enquadramento' };

/** Desligamento: modelo "Check list de desligamento" (SGR-FRH-21-373-01-000-000-0027). */
export const MOTIVOS_DESLIGAMENTO = {
  gestor: 'Desligamento solicitado pelo gestor',
  justa_causa: 'Justa Causa',
  pedido: 'Pedido de demissão pelo colaborador',
  termino_antecipado: 'Término antecipado de contrato',
  termino: 'Término de contrato',
};
export const CONVENIOS = {
  medico: 'Termo de convênio médico preenchido',
  odonto: 'Termo de convênio odontológico preenchido',
  nao_possui: 'Não possuía convênio / Não se aplica',
  totalpass: 'TotalPass',
  farmacia: 'Possui descontos de convênio – Farmácia Univers',
};
export const PROCEDIMENTOS = {
  aviso_citrix: 'Emitir aviso Citrix',
  escanear: 'Escanear a carta/documento de desligamento assinado',
  pasta: 'Colocar o documento escaneado na pasta do colaborador',
  ponto_vr: 'Remover cadastro de ponto - (Ferramenta VR) 1 dia após o desligamento',
  email_clinica: 'Enviar e-mail para clínica para agendamento do exame demissional',
  mensagem_exame: 'Enviar mensagem ao ex-colaborador com a data e horário do exame',
  denver: 'Solicitação de Desligamento (Denver)',
  aprovacao: 'Aprovação da solicitação de desligamento',
  cadastro: 'Cadastro do desligamento',
  ponto: 'Fechamento ponto eletrônico',
  envio_email: 'Envio do desligamento por e-mail',
  dez_dias: 'Acompanhamento dos 10 dias',
  calculos: 'Conferência dos cálculos rescisórios',
  impressao: 'Impressão dos documentos',
  agendamento: 'Agendamento com o colaborador',
  termos_operadora: 'Envio dos termos de convênio médico/odontológico para a operadora',
};
export const ACESSOS = { bloqueados: 'E-mail, sistemas e acessos bloqueados', sem_acesso: 'Não possuiu acesso à sistemas' };
export const DEVOLUCAO = { cracha: 'Crachá', notebook: 'Notebook / computador', celular: 'Celular corporativo', chaves: 'Chaves / cartões de acesso', uniforme: 'Uniforme / outros' };

/** Código e título de cada documento, como no papel. */
export const DOCUMENTOS = {
  contratacao: { codigo: 'SGR-FRH-21-373-01-000-000-0008 · Ver. 7', titulo: 'Solicitação de Contratação' },
  promocao: { codigo: 'SGR-FRH-21-373-01-000-000-0011 · Solicitação de cargo e salário · Rev. 0', titulo: 'Solicitação de cargo e salário' },
  desligamento: { codigo: 'SGR-FRH-21-373-01-000-000-0027 · Check list de desligamento · Ver. 02', titulo: 'Check list de desligamento' },
};

/** "R$ 2.500,00" -> 2500. Vazio ou sem número: NaN. */
export const valorEmReais = valor => {
  const limpo = String(valor ?? '').replace(/[^\d,.-]/g, '');
  if (!limpo) return Number.NaN;
  const normal = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  return Number(normal);
};
/** Reajuste do salário atual para o proposto: "12,5%", ou "—" sem os dois valores. */
export const reajuste = (atual, proposto) => {
  const a = valorEmReais(atual);
  const p = valorEmReais(proposto);
  if (!(a > 0) || !Number.isFinite(p)) return '—';
  return `${(((p - a) / a) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
};

/** Para listas e cartões: quem, que cargo, onde, seja qual for o tipo. */
export const resumoDoPedido = form => {
  const tipo = tipoDoPedido(form);
  return {
    tipo,
    nomeDoTipo: SOLICITACOES[tipo],
    pessoa: form?.candidato || '—',
    cargo: (tipo === 'promocao' ? form?.cargoProposto || form?.cargoAtual : form?.posicao) || '—',
    area: form?.area || '',
  };
};

export const PRIORIDADES = ['Alta', 'Média', 'Baixa'];
export const MOTIVOS = { aumento: 'Aumento de quadro', transferencia: 'Transferência/Promoção', substituicao: 'Substituição', outro: 'Outro' };
export const TIPOS = { efetivo: 'Efetivo', temp_efetivacao: 'Temporário p/ efetivação', temporario: 'Temporário' };
export const ITENS = { alojamento: 'Alojamento', passagem: 'Passagem', hospedagem: 'Hospedagem', computador: 'Computador', email: 'E-mail/Sistema', celular: 'Celular', nenhum: 'A função não requer nenhum destes itens' };

/** As 3 assinaturas, na ordem. O índice + 1 é a `etapa_atual` do banco. */
export const ETAPAS = ['rh', 'gerente_1', 'gerente_2'];
/** Nome sério de cada assinatura, igual em todo lugar (18/11/2026). */
export const CARGO_DA_ETAPA = { rh: 'Recursos Humanos', gerente_1: 'Gerência', gerente_2: 'Gerência' };
export const SITUACOES = {
  etapa_1: 'Aguardando Recursos Humanos',
  etapa_2: 'Aguardando Gerência (2ª assinatura)',
  etapa_3: 'Aguardando Gerência (3ª assinatura)',
  concluido: 'Concluído',
  recusada: 'Recusada',
};
/** Papéis que o administrador dá. Quem não tem papel só pede e vê os próprios pedidos. */
export const PAPEIS = {
  rh: '1ª assinatura (Recursos Humanos)',
  gerente_1: '2ª assinatura (Gerência)',
  gerente_2: '3ª assinatura (Gerência)',
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

/** 12345678909 -> 123.456.789-09 */
export const cpfFormatado = valor => {
  const cpf = soDigitos(valor);
  return cpf.length === 11 ? `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}` : cpf;
};

const lista = (valor, opcoes) => (Array.isArray(valor) ? [...new Set(valor.filter(item => Object.hasOwn(opcoes, item)))] : []);
const dataOuVazio = valor => (dataValida(valor) ? String(valor) : '');

const validarContratacao = entrada => {
  /** @type {Record<string, string>} */
  const erros = {};
  const itens = lista(entrada.itens, ITENS);
  const quantidade = Number(String(entrada.quantidade ?? '').replace(',', '.'));
  const formulario = {
    solicitacao: 'contratacao',
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
  if (!formulario.cpf) erros.cpf = 'Informe o CPF do candidato.';
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

const validarPromocao = entrada => {
  /** @type {Record<string, string>} */
  const erros = {};
  const formulario = {
    solicitacao: 'promocao',
    alteracao: Object.hasOwn(ALTERACOES, entrada.alteracao) ? entrada.alteracao : '',
    data: String(entrada.data || ''),
    candidato: texto(entrada.candidato, 120),
    registro: texto(entrada.registro, 40),
    admissao: dataOuVazio(entrada.admissao),
    ultimaAlteracao: dataOuVazio(entrada.ultimaAlteracao),
    area: texto(entrada.area, 160),
    cargoAtual: texto(entrada.cargoAtual, 120),
    cargoProposto: texto(entrada.cargoProposto, 120),
    salarioAtual: texto(entrada.salarioAtual, 40),
    salarioProposto: texto(entrada.salarioProposto, 40),
    nivelAtual: texto(entrada.nivelAtual, 40),
    nivelProposto: texto(entrada.nivelProposto, 40),
    justificativa: textoLongo(entrada.justificativa, 3000),
  };
  if (!formulario.alteracao) erros.alteracao = 'Marque: alteração funcional, promoção ou enquadramento.';
  if (!dataValida(formulario.data)) erros.data = 'Informe a data da solicitação.';
  if (formulario.candidato.length < 3) erros.candidato = 'Informe o nome completo do colaborador.';
  if (formulario.area.length < 2) erros.area = 'Informe o setor ou a obra.';
  if (formulario.cargoProposto.length < 2 && !formulario.salarioProposto) erros.cargoProposto = 'Informe o cargo ou o salário proposto.';
  if (formulario.justificativa.length < 3) erros.justificativa = 'Escreva o motivo da alteração.';
  return { formulario, erros };
};

const validarDesligamento = entrada => {
  /** @type {Record<string, string>} */
  const erros = {};
  const devolucao = lista(entrada.devolucao, DEVOLUCAO);
  const formulario = {
    solicitacao: 'desligamento',
    data: String(entrada.data || ''),
    candidato: texto(entrada.candidato, 120),
    registro: texto(entrada.registro, 40),
    admissao: dataOuVazio(entrada.admissao),
    posicao: texto(entrada.posicao, 160),
    desligamento: String(entrada.desligamento || ''),
    motivoDeslig: Object.hasOwn(MOTIVOS_DESLIGAMENTO, entrada.motivoDeslig) ? entrada.motivoDeslig : '',
    solicitadoPor: texto(entrada.solicitadoPor, 120),
    pagamentoRescisao: dataOuVazio(entrada.pagamentoRescisao),
    convenios: lista(entrada.convenios, CONVENIOS),
    obs: textoLongo(entrada.obs, 1500),
    procedimentos: lista(entrada.procedimentos, PROCEDIMENTOS),
    acessos: lista(entrada.acessos, ACESSOS),
    devolucao,
    devolucaoOutros: devolucao.includes('uniforme') ? texto(entrada.devolucaoOutros, 120) : '',
  };
  if (!dataValida(formulario.data)) erros.data = 'Informe a data da solicitação.';
  if (formulario.candidato.length < 3) erros.candidato = 'Informe o nome completo do colaborador.';
  if (formulario.posicao.length < 2) erros.posicao = 'Informe o cargo e o setor.';
  if (!dataValida(formulario.desligamento)) erros.desligamento = 'Informe a data do desligamento.';
  if (!formulario.motivoDeslig) erros.motivoDeslig = 'Marque o motivo do desligamento.';
  return { formulario, erros };
};

/**
 * Confere e limpa o formulário do tipo pedido. Devolve { formulario, erros },
 * com erros por campo, em português simples, para a tela marcar o campo certo.
 */
export const validarFormulario = (entrada = {}) => {
  const tipo = tipoDoPedido(entrada);
  if (tipo === 'promocao') return validarPromocao(entrada);
  if (tipo === 'desligamento') return validarDesligamento(entrada);
  return validarContratacao(entrada);
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

/** A etapa que falta (rh, gerente_1 ou gerente_2), ou null quando terminou. */
export const etapaPendente = pedido => (emAberto(pedido.status) ? ETAPAS[Number(pedido.etapa_atual) - 1] ?? null : null);

/** "Gerência (2ª assinatura)": o nome da assinatura com a ordem, sem nome de pessoa. */
export const nomeDaEtapa = etapa => `${CARGO_DA_ETAPA[etapa] || etapa} (${ETAPAS.indexOf(etapa) + 1}ª assinatura)`;

/** A pessoa pode assinar/recusar este pedido agora? (a tela usa; o banco decide). */
export const podeDecidir = (pedido, assinaturas, leitor) => {
  const etapa = etapaPendente(pedido);
  if (!etapa || !leitor.papeis.includes(etapa)) return false;
  return !assinaturas.some(assinatura => assinatura.stage !== 'solicitante' && assinatura.signer_user_id === leitor.userId);
};

/** Token do link individual: 64 letras de 0-9a-f, gerado pelo banco. */
export const tokenValido = token => /^[0-9a-f]{64}$/.test(String(token || ''));
