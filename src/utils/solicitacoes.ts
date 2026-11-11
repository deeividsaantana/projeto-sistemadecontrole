/**
 * Solicitações → Suprimentos → Aprovação → Logística (pedido de 11/11/2026).
 *
 * Regras puras do ciclo de uma requisição de campo. A tela só chama
 * `aplicarAcao` e mostra o erro que volta: quem pode o quê, campos
 * obrigatórios, atraso automático e o registro de reagendamentos moram aqui,
 * num lugar só e com teste.
 *
 * Perfis do módulo (por pessoa, não por perfil do app):
 * - solicitante: abre requisições e acompanha as suas;
 * - suprimentos: assume, cota, monta o pedido de compra, despacha e é o ÚNICO
 *   que mexe em prazo de entrega (reagendamento com motivo e registro);
 * - aprovador: aprova, aprova com condição ou rejeita o pedido com parecer;
 * - recebedor: confirma a chegada no destino e confere com a nota fiscal;
 * - dev: faz tudo o que os quatro fazem (pedido de 11/11/2026: o login do
 *   dono do sistema enxerga e opera o módulo inteiro). O administrador do app
 *   entra como dev quando não está ligado a outra pessoa.
 *
 * Isto é regra de interface, como o resto do app (src/utils/permissoes.ts): o
 * banco ainda não confere o papel de quem grava.
 */

export const PAPEIS_SUPRIMENTOS = ['solicitante', 'suprimentos', 'aprovador', 'recebedor', 'dev'] as const;
export type PapelSuprimentos = typeof PAPEIS_SUPRIMENTOS[number];

export const NOME_DO_PAPEL: Record<PapelSuprimentos, string> = {
  solicitante: 'Solicitante (campo)',
  suprimentos: 'Suprimentos',
  aprovador: 'Aprovador (gerência)',
  recebedor: 'Recebimento (almoxarifado)',
  dev: 'Acesso total (dev)',
};

export interface PessoaSuprimentos {
  id: string;
  nome: string;
  /** E-mail do login. Sem ele, a pessoa é reconhecida pelo nome. */
  email?: string;
  papel: PapelSuprimentos;
  ativo: boolean;
}

/** Equipe da obra do Complexo Viário Alto Tietê, como veio no pedido. */
export const PESSOAS_INICIAIS: PessoaSuprimentos[] = [
  { id: 'sup-jose-augusto', nome: 'José Augusto', papel: 'solicitante', ativo: true },
  { id: 'sup-thiago', nome: 'Thiago', papel: 'solicitante', ativo: true },
  { id: 'sup-alvaro', nome: 'Alvaro', papel: 'solicitante', ativo: true },
  { id: 'sup-jose-augusto-mineiro', nome: 'José Augusto Mineiro', papel: 'solicitante', ativo: true },
  { id: 'sup-cassia', nome: 'Cássia', papel: 'suprimentos', ativo: true },
  { id: 'sup-sergio', nome: 'Sérgio', papel: 'suprimentos', ativo: true },
  { id: 'sup-bruno', nome: 'Bruno', papel: 'aprovador', ativo: true },
];

export const UNIDADES = ['ton', 'm³', 'm', 'un', 'kg', 'vb', 'h'] as const;
export type Unidade = typeof UNIDADES[number];
export type TipoItem = 'Material' | 'Serviço';

export const ETAPAS = [
  'Pendente Suprimentos',
  'Em Cotação',
  'Aguardando Aprovação',
  'Aprovado',
  'Em Trânsito',
  'Entregue',
  'Cancelado',
] as const;
export type Etapa = typeof ETAPAS[number];
/** O que a tela mostra: a etapa, ou "Em Atraso" quando a janela passou. */
export type SituacaoSolicitacao = Etapa | 'Em Atraso';

export type StatusLogistico = 'Aguardando Envio' | 'Em Trânsito' | 'Chegou ao Local' | 'Chegou ao Local de Descarte';
export type TipoChegada = 'Chegou ao Local' | 'Chegou ao Local de Descarte';

export const DESTINOS_SUGERIDOS = [
  'Canteiro Padre Eustáquio',
  'Almoxarifado Central',
  'Bota-Fora Lara',
  'Bota-Fora Itaquareia',
] as const;

export interface ItemSolicitado {
  itemId: number;
  tipo: TipoItem;
  descricao: string;
  quantidade: number;
  unidade: Unidade;
  prazoDesejado: string;
  permiteParcial: boolean;
  /** Quanto entra neste pedido de compra (Suprimentos fraciona se parcial = sim). */
  quantidadePedido?: number;
  /** Soma do que já chegou ao destino. */
  quantidadeRecebida?: number;
}

export interface CotacaoFornecedor {
  fornecedor: string;
  valor: number;
  observacao?: string;
}

export interface Reagendamento {
  data: string;
  usuario: string;
  anterior: string;
  nova: string;
  motivo: string;
}

export interface EventoSolicitacao {
  data: string;
  usuario: string;
  acao: string;
  detalhe?: string;
}

export interface Solicitacao {
  id: string;
  /** SOL-AAAA-NNNN */
  numero: string;
  abertaEm: string;
  solicitante: string;
  frente: string;
  estacamento?: string;
  itens: ItemSolicitado[];
  etapa: Etapa;
  // Suprimentos
  comprador?: string;
  assumidaEm?: string;
  numeroPedido?: string;
  fornecedor?: string;
  valorTotal?: number;
  condicaoPagamento?: string;
  janelaInicio?: string;
  janelaFim?: string;
  cotacoes?: CotacaoFornecedor[];
  enviadaAprovacaoEm?: string;
  // Aprovação
  aprovador?: string;
  statusAprovacao: 'Pendente' | 'Aprovado' | 'Rejeitado';
  decisaoEm?: string;
  parecer?: string;
  aprovacaoCondicional?: boolean;
  rejeicoes?: number;
  // Logística
  statusLogistico: StatusLogistico;
  localDestino?: string;
  chegadaEm?: string;
  notaFiscal?: string;
  divergencia?: string;
  /** Log que só cresce: nenhuma ação apaga ou altera uma linha antiga. */
  reagendamentos: Reagendamento[];
  eventos: EventoSolicitacao[];
  canceladaMotivo?: string;
  atualizadoEm: string;
}

export interface Ator {
  nome: string;
  papel: PapelSuprimentos | null;
}

/** A pessoa exerce este papel? O dev exerce todos. */
export const exerce = (ator: Ator, papel: Exclude<PapelSuprimentos, 'dev'>) => ator.papel === papel || ator.papel === 'dev';

export const MENSAGEM_PRAZO_NEGADO = 'Permissão negada. A alteração de prazos logísticos e reagendamento de entregas é de alçada exclusiva dos operadores de Suprimentos (Cássia e Sérgio).';

const normalizar = (texto: string) => texto
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

/** Papel de quem está logado: pelo e-mail cadastrado, senão pelo nome. */
export const pessoaDoUsuario = (
  pessoas: readonly PessoaSuprimentos[],
  usuario: { nome?: string | null; email?: string | null },
): PessoaSuprimentos | null => {
  const ativas = pessoas.filter(pessoa => pessoa.ativo);
  const email = normalizar(usuario.email || '');
  if (email) {
    const porEmail = ativas.find(pessoa => pessoa.email && normalizar(pessoa.email) === email);
    if (porEmail) return porEmail;
  }
  const nome = normalizar(usuario.nome || '');
  return nome ? ativas.find(pessoa => normalizar(pessoa.nome) === nome) ?? null : null;
};

/** Próximo número do ano: SOL-2026-0001, PC-2026-0001... */
export const proximoNumero = (prefixo: 'SOL' | 'PC', existentes: readonly (string | undefined)[], ano: number): string => {
  const inicio = `${prefixo}-${ano}-`;
  const maior = existentes.reduce((max, numero) => {
    if (!numero?.startsWith(inicio)) return max;
    const valor = Number(numero.slice(inicio.length));
    return Number.isFinite(valor) && valor > max ? valor : max;
  }, 0);
  return `${inicio}${String(maior + 1).padStart(4, '0')}`;
};

/**
 * Rigor técnico: aço, drenagem e pavimentação só passam com o parâmetro de
 * engenharia escrito na descrição. Volta a frase que a pessoa lê, ou null.
 */
export const faltaEspecificacao = (descricao: string): string | null => {
  const texto = normalizar(descricao);
  const temMedida = /\d+([.,]\d+)?\s*mm\b/.test(texto) || /(ø|φ|phi|bitola|diametro)\s*:?\s*\d/.test(texto) || /[øφ]/.test(descricao);
  if (/\b(aco|vergalh|varao|varoes|ca-?50|ca-?60|tela soldada|armadura)/.test(texto) && !temMedida) {
    return 'Aço: informe a bitola (ø em mm), por exemplo "Vergalhão CA-50 ø 12,5 mm".';
  }
  if (/\b(tubo|manilha|bueiro|dreno|pead|aduela)/.test(texto) && !(temMedida || /\bdn\s*\d/.test(texto) || /\d+\s*cm\b/.test(texto))) {
    return 'Drenagem: informe o diâmetro do tubo (DN ou ø em mm), por exemplo "Tubo de concreto DN 800".';
  }
  if (/\b(cbuq|asfalt|brita|bgs|bgtc|binder|pmf|emulsao|cap ?50|agregado|rachao|po de pedra)/.test(texto)
    && !/(faixa|tipo|graduad|\bn[o°º]?\s*\d|\bcap ?\d|rr-|rm-|\d\s*\/\s*\d|\d+\s*mm\b|\bclasse)/.test(texto)) {
    return 'Pavimentação: informe a faixa ou o tipo do material, por exemplo "CBUQ faixa C" ou "Brita nº 1".';
  }
  return null;
};

export interface ItemDigitado {
  tipo?: string;
  descricao?: string;
  quantidade?: number | string;
  unidade?: string;
  prazoDesejado?: string;
  permiteParcial?: boolean | null;
}

/** Problemas de um item, na ordem em que aparecem no formulário. */
export const problemasDoItem = (item: ItemDigitado): string[] => {
  const problemas: string[] = [];
  if (item.tipo !== 'Material' && item.tipo !== 'Serviço') problemas.push('Escolha se é material ou serviço.');
  const descricao = (item.descricao || '').trim();
  if (descricao.length < 3) problemas.push('Descreva o item.');
  const quantidade = Number(String(item.quantidade ?? '').replace(',', '.'));
  if (!(quantidade > 0)) problemas.push('Informe a quantidade (maior que zero).');
  if (!UNIDADES.includes(item.unidade as Unidade)) problemas.push(`Unidade fora do padrão (${UNIDADES.join(', ')}).`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.prazoDesejado || '')) problemas.push('Informe o prazo desejado.');
  if (typeof item.permiteParcial !== 'boolean') problemas.push('Diga se aceita entrega parcial.');
  if (descricao.length >= 3) {
    const falta = faltaEspecificacao(descricao);
    if (falta) problemas.push(falta);
  }
  return problemas;
};

const dia = (iso: string) => iso.slice(0, 10);

/**
 * Atraso automático: passou o fim da janela prometida e a entrega não foi
 * confirmada por inteiro (entrega parcial com saldo continua contando). Calculado na hora, sem gravar, para nunca ficar desatualizado.
 */
export const estaEmAtraso = (sol: Solicitacao, hoje: string): boolean =>
  (sol.etapa === 'Aprovado' || sol.etapa === 'Em Trânsito')
  && Boolean(sol.janelaFim)
  && dia(hoje) > (sol.janelaFim as string);

export const situacaoDe = (sol: Solicitacao, hoje: string): SituacaoSolicitacao =>
  (estaEmAtraso(sol, hoje) ? 'Em Atraso' : sol.etapa);

export const saldoDoItem = (item: ItemSolicitado) =>
  Math.max(0, (item.quantidadePedido ?? item.quantidade) - (item.quantidadeRecebida ?? 0));

export const saldoTotal = (sol: Solicitacao) => sol.itens.reduce((soma, item) => soma + saldoDoItem(item), 0);

// ---------------------------------------------------------------------------
// Ações do fluxo

export interface DadosAbertura {
  solicitante: string;
  frente: string;
  estacamento?: string;
  itens: ItemDigitado[];
}

export interface DadosPedido {
  fornecedor: string;
  valorTotal: number;
  condicaoPagamento?: string;
  janelaInicio: string;
  janelaFim: string;
  cotacoes?: CotacaoFornecedor[];
  /** Quantidade do pedido por itemId; só muda quando o item aceita parcial. */
  quantidades?: Record<number, number>;
}

export interface DadosRecebimento {
  tipo: TipoChegada;
  local: string;
  notaFiscal: string;
  /** Quantidade que chegou agora, por itemId. */
  quantidades: Record<number, number>;
}

export type Acao =
  | { tipo: 'assumir' }
  | { tipo: 'enviarParaAprovacao'; pedido: DadosPedido }
  | { tipo: 'aprovar'; parecer?: string; condicional?: boolean }
  | { tipo: 'rejeitar'; parecer: string }
  | { tipo: 'despachar' }
  | { tipo: 'receber'; recebimento: DadosRecebimento }
  | { tipo: 'reagendar'; novaData: string; motivo: string }
  | { tipo: 'cancelar'; motivo: string };

export type Resultado = { ok: true; solicitacao: Solicitacao } | { ok: false; erro: string };

const falha = (erro: string): Resultado => ({ ok: false, erro });

const comEvento = (sol: Solicitacao, ator: Ator, agora: string, acao: string, detalhe?: string, mudancas: Partial<Solicitacao> = {}): Resultado => ({
  ok: true,
  solicitacao: {
    ...sol,
    ...mudancas,
    eventos: [...sol.eventos, { data: agora, usuario: ator.nome, acao, ...(detalhe ? { detalhe } : {}) }],
    atualizadoEm: agora,
  },
});

const ehData = (valor: string | undefined) => /^\d{4}-\d{2}-\d{2}$/.test(valor || '');

/** Abre a requisição (Etapa 1). Sem item válido nada é criado. */
export const abrirSolicitacao = (
  dados: DadosAbertura,
  ator: Ator,
  existentes: readonly Solicitacao[],
  agora: string,
  id: string,
): Resultado => {
  if (!exerce(ator, 'solicitante')) return falha('Só quem está cadastrado como solicitante abre requisições.');
  if (!dados.frente.trim()) return falha('Informe a frente de trabalho ou o ramo.');
  if (dados.itens.length === 0) return falha('Inclua pelo menos um item.');
  for (const [indice, item] of dados.itens.entries()) {
    const problemas = problemasDoItem(item);
    if (problemas.length) return falha(`Item ${indice + 1}: ${problemas[0]}`);
  }
  const ano = Number(agora.slice(0, 4));
  const numero = proximoNumero('SOL', existentes.map(item => item.numero), ano);
  return {
    ok: true,
    solicitacao: {
      id,
      numero,
      abertaEm: agora,
      solicitante: dados.solicitante,
      frente: dados.frente.trim(),
      ...(dados.estacamento?.trim() ? { estacamento: dados.estacamento.trim() } : {}),
      itens: dados.itens.map((item, indice) => ({
        itemId: indice + 1,
        tipo: item.tipo as TipoItem,
        descricao: (item.descricao || '').trim(),
        quantidade: Number(String(item.quantidade).replace(',', '.')),
        unidade: item.unidade as Unidade,
        prazoDesejado: item.prazoDesejado as string,
        permiteParcial: item.permiteParcial as boolean,
      })),
      etapa: 'Pendente Suprimentos',
      statusAprovacao: 'Pendente',
      statusLogistico: 'Aguardando Envio',
      reagendamentos: [],
      eventos: [{ data: agora, usuario: ator.nome, acao: 'Abriu a solicitação' }],
      atualizadoEm: agora,
    },
  };
};

export const aplicarAcao = (
  sol: Solicitacao,
  acao: Acao,
  ator: Ator,
  agora: string,
  todas: readonly Solicitacao[] = [],
): Resultado => {
  const suprimentos = exerce(ator, 'suprimentos');
  switch (acao.tipo) {
    case 'assumir': {
      if (!suprimentos) return falha('Só Suprimentos assume uma solicitação.');
      if (sol.etapa !== 'Pendente Suprimentos') return falha('Esta solicitação já foi assumida.');
      return comEvento(sol, ator, agora, 'Assumiu para cotação', undefined, { etapa: 'Em Cotação', comprador: ator.nome, assumidaEm: agora });
    }
    case 'enviarParaAprovacao': {
      if (!suprimentos) return falha('Só Suprimentos monta o pedido de compra.');
      if (sol.etapa !== 'Em Cotação') return falha('O pedido só vai para aprovação durante a cotação.');
      const { pedido } = acao;
      if (pedido.fornecedor.trim().length < 3) return falha('Informe o fornecedor (razão social ou CNPJ).');
      if (!(pedido.valorTotal > 0)) return falha('Informe o valor total do pedido.');
      if (!ehData(pedido.janelaInicio) || !ehData(pedido.janelaFim)) return falha('Informe o início e o fim da janela de entrega.');
      if (pedido.janelaFim < pedido.janelaInicio) return falha('O fim da janela não pode ser antes do início.');
      const itens = sol.itens.map(item => {
        const pedida = pedido.quantidades?.[item.itemId];
        if (pedida === undefined || pedida === item.quantidade) return { ...item, quantidadePedido: item.quantidade };
        return { ...item, quantidadePedido: pedida };
      });
      for (const item of itens) {
        const pedida = item.quantidadePedido as number;
        if (!(pedida > 0)) return falha(`Item ${item.itemId}: a quantidade do pedido precisa ser maior que zero.`);
        if (pedida !== item.quantidade && !item.permiteParcial) return falha(`Item ${item.itemId}: não aceita entrega parcial, a quantidade não pode mudar.`);
        if (pedida > item.quantidade) return falha(`Item ${item.itemId}: o pedido não pode passar do que foi solicitado.`);
      }
      const numeroPedido = sol.numeroPedido || proximoNumero('PC', todas.map(item => item.numeroPedido), Number(agora.slice(0, 4)));
      return comEvento(sol, ator, agora, 'Enviou o pedido para aprovação', `${numeroPedido} · ${pedido.fornecedor.trim()} · ${formatarReais(pedido.valorTotal)}`, {
        etapa: 'Aguardando Aprovação',
        numeroPedido,
        fornecedor: pedido.fornecedor.trim(),
        valorTotal: pedido.valorTotal,
        ...(pedido.condicaoPagamento?.trim() ? { condicaoPagamento: pedido.condicaoPagamento.trim() } : {}),
        janelaInicio: pedido.janelaInicio,
        janelaFim: pedido.janelaFim,
        cotacoes: (pedido.cotacoes || []).filter(item => item.fornecedor.trim() && item.valor > 0),
        itens,
        enviadaAprovacaoEm: agora,
        statusAprovacao: 'Pendente',
      });
    }
    case 'aprovar': {
      if (!exerce(ator, 'aprovador')) return falha('Só o aprovador decide o pedido de compra.');
      if (sol.etapa !== 'Aguardando Aprovação') return falha('Não há pedido aguardando aprovação.');
      const parecer = acao.parecer?.trim();
      if (acao.condicional && !parecer) return falha('Escreva a condição da aprovação.');
      return comEvento(sol, ator, agora, acao.condicional ? 'Aprovou com condição' : 'Aprovou o pedido', parecer, {
        etapa: 'Aprovado', statusAprovacao: 'Aprovado', aprovador: ator.nome, decisaoEm: agora,
        parecer, aprovacaoCondicional: Boolean(acao.condicional),
      });
    }
    case 'rejeitar': {
      if (!exerce(ator, 'aprovador')) return falha('Só o aprovador decide o pedido de compra.');
      if (sol.etapa !== 'Aguardando Aprovação') return falha('Não há pedido aguardando aprovação.');
      if (acao.parecer.trim().length < 5) return falha('Escreva o motivo da rejeição para Suprimentos ajustar.');
      return comEvento(sol, ator, agora, 'Rejeitou o pedido', acao.parecer.trim(), {
        etapa: 'Em Cotação', statusAprovacao: 'Rejeitado', aprovador: ator.nome, decisaoEm: agora,
        parecer: acao.parecer.trim(), aprovacaoCondicional: false, rejeicoes: (sol.rejeicoes ?? 0) + 1,
      });
    }
    case 'despachar': {
      if (!suprimentos) return falha('Só Suprimentos marca o pedido como enviado.');
      if (sol.etapa !== 'Aprovado') return falha('Só pedido aprovado sai para entrega.');
      return comEvento(sol, ator, agora, 'Marcou como em trânsito', undefined, { etapa: 'Em Trânsito', statusLogistico: 'Em Trânsito' });
    }
    case 'receber': {
      if (!exerce(ator, 'recebedor')) return falha('Só o recebimento (fiscal ou almoxarife) confirma a chegada.');
      if (sol.etapa !== 'Aprovado' && sol.etapa !== 'Em Trânsito') return falha('Só pedido aprovado ou em trânsito pode ser recebido.');
      const { recebimento } = acao;
      if (!recebimento.local.trim()) return falha('Informe onde o material chegou.');
      if (!recebimento.notaFiscal.trim()) return falha('Informe o número da nota fiscal.');
      const itens = sol.itens.map(item => ({
        ...item,
        quantidadeRecebida: (item.quantidadeRecebida ?? 0) + Math.max(0, Number(recebimento.quantidades[item.itemId]) || 0),
      }));
      if (itens.every((item, indice) => item.quantidadeRecebida === (sol.itens[indice].quantidadeRecebida ?? 0))) {
        return falha('Informe a quantidade que chegou.');
      }
      const divergencias = itens
        .filter(item => item.quantidadeRecebida !== (item.quantidadePedido ?? item.quantidade))
        .map(item => `Item ${item.itemId}: recebido ${numeroBr(item.quantidadeRecebida)} de ${numeroBr(item.quantidadePedido ?? item.quantidade)} ${item.unidade}`);
      // Fica aberto só quando falta e o item aceita parcial; senão o
      // recebimento fecha e a diferença fica registrada como divergência.
      const aguardaSaldo = itens.some(item => item.permiteParcial && saldoDoItem(item) > 0);
      const nf = recebimento.notaFiscal.trim();
      return comEvento(sol, ator, agora, aguardaSaldo ? 'Recebeu entrega parcial' : recebimento.tipo, `${recebimento.local.trim()} · NF ${nf}${divergencias.length ? ` · ${divergencias.join('; ')}` : ''}`, {
        itens,
        localDestino: recebimento.local.trim(),
        notaFiscal: sol.notaFiscal && sol.notaFiscal !== nf ? `${sol.notaFiscal}, ${nf}` : nf,
        chegadaEm: agora,
        statusLogistico: aguardaSaldo ? 'Em Trânsito' : recebimento.tipo,
        etapa: aguardaSaldo ? 'Em Trânsito' : 'Entregue',
        ...(divergencias.length ? { divergencia: divergencias.join('; ') } : { divergencia: undefined }),
      });
    }
    case 'reagendar': {
      if (!suprimentos) return falha(MENSAGEM_PRAZO_NEGADO);
      if (sol.etapa !== 'Aprovado' && sol.etapa !== 'Em Trânsito') return falha('Só entrega aprovada ou em trânsito é reagendada.');
      if (!ehData(acao.novaData)) return falha('Informe a nova data prometida.');
      if (acao.motivo.trim().length < 5) return falha('Escreva o motivo do atraso ou da nova data.');
      const anterior = sol.janelaFim || '';
      if (acao.novaData === anterior) return falha('A nova data é igual à data atual.');
      const registro: Reagendamento = { data: agora, usuario: ator.nome, anterior, nova: acao.novaData, motivo: acao.motivo.trim() };
      return comEvento(sol, ator, agora, 'Reagendou a entrega', `${anterior ? formatarDia(anterior) : 'sem data'} → ${formatarDia(acao.novaData)} · ${registro.motivo}`, {
        janelaFim: acao.novaData,
        janelaInicio: sol.janelaInicio && sol.janelaInicio > acao.novaData ? acao.novaData : sol.janelaInicio,
        reagendamentos: [...sol.reagendamentos, registro],
      });
    }
    case 'cancelar': {
      const dono = exerce(ator, 'solicitante') && ator.nome === sol.solicitante;
      if (!suprimentos && !dono) return falha('Só quem abriu ou Suprimentos cancela a solicitação.');
      if (sol.etapa !== 'Pendente Suprimentos' && sol.etapa !== 'Em Cotação') return falha('Depois de ir para aprovação a solicitação não é cancelada por aqui.');
      if (acao.motivo.trim().length < 5) return falha('Escreva o motivo do cancelamento.');
      return comEvento(sol, ator, agora, 'Cancelou', acao.motivo.trim(), { etapa: 'Cancelado', canceladaMotivo: acao.motivo.trim() });
    }
    default:
      return falha('Ação desconhecida.');
  }
};

/** Quais ações aparecem para esta pessoa nesta etapa (a tela só mostra estas). */
export const acoesDisponiveis = (sol: Solicitacao, ator: Ator): Acao['tipo'][] => {
  const acoes: Acao['tipo'][] = [];
  const { etapa } = sol;
  if (exerce(ator, 'suprimentos')) {
    if (etapa === 'Pendente Suprimentos') acoes.push('assumir');
    if (etapa === 'Em Cotação') acoes.push('enviarParaAprovacao');
    if (etapa === 'Aprovado') acoes.push('despachar');
    if (etapa === 'Aprovado' || etapa === 'Em Trânsito') acoes.push('reagendar');
  }
  if (exerce(ator, 'aprovador') && etapa === 'Aguardando Aprovação') acoes.push('aprovar', 'rejeitar');
  if (exerce(ator, 'recebedor') && (etapa === 'Aprovado' || etapa === 'Em Trânsito')) acoes.push('receber');
  if ((etapa === 'Pendente Suprimentos' || etapa === 'Em Cotação')
    && (exerce(ator, 'suprimentos') || (exerce(ator, 'solicitante') && ator.nome === sol.solicitante))) acoes.push('cancelar');
  return acoes;
};

// ---------------------------------------------------------------------------
// Formatos

export const numeroBr = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
export const formatarReais = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const formatarDia = (iso?: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');

/** A solicitação no esquema JSON do pedido (cabeçalho, itens, suprimentos...). */
export const paraEsquemaJson = (sol: Solicitacao, hoje: string) => {
  const situacao = situacaoDe(sol, hoje);
  const statusItem = situacao === 'Aguardando Aprovação' ? `Aguardando Aprovação ${sol.aprovador || 'Bruno'}` : situacao;
  const pedida = sol.itens.reduce((soma, item) => soma + (item.quantidadePedido ?? item.quantidade), 0);
  const recebida = sol.itens.reduce((soma, item) => soma + (item.quantidadeRecebida ?? 0), 0);
  return {
    cabecalho: {
      id_solicitacao: sol.numero,
      data_hora_abertura: sol.abertaEm.slice(0, 19),
      solicitante: sol.solicitante,
      frente_trabalho_ramo: sol.frente,
      estacamento_aplicacao: sol.estacamento ?? '',
    },
    itens_solicitados: sol.itens.map(item => ({
      item_id: item.itemId,
      tipo: item.tipo,
      descricao_detalhada: item.descricao,
      quantidade_solicitada: item.quantidade,
      unidade_medida: item.unidade,
      prazo_entrega_desejado: item.prazoDesejado,
      permite_entrega_parcial: item.permiteParcial,
      status_item: statusItem,
    })),
    processamento_suprimentos: {
      comprador_responsavel: sol.comprador ?? '',
      id_pedido_compra: sol.numeroPedido ?? '',
      fornecedor_cotado: sol.fornecedor ?? '',
      valor_total_pedido_brl: sol.valorTotal ?? 0,
      janela_entrega_prometida: { data_inicio: sol.janelaInicio ?? '', data_fim: sol.janelaFim ?? '' },
      quantidade_atendida_parcial: recebida,
      saldo_remanescente_pendente: Math.max(0, pedida - recebida),
    },
    aprovação_gerencial: {
      aprovador: sol.aprovador ?? '',
      status_aprovação: sol.statusAprovacao,
      data_hora_decisao: sol.decisaoEm?.slice(0, 19) ?? '',
      observacoes_gerencia: sol.parecer ?? '',
    },
    rastreamento_logistico: {
      status_logistico_atual: estaEmAtraso(sol, hoje) ? 'Em Atraso' : sol.statusLogistico,
      local_destino_final: sol.localDestino ?? '',
      data_efetiva_chegada: sol.chegadaEm?.slice(0, 19) ?? '',
      historico_reagendamentos: sol.reagendamentos.map(item => ({
        data_alteracao: item.data.slice(0, 19),
        usuario_alteracao: item.usuario,
        data_prometida_anterior: item.anterior,
        nova_data_prometida: item.nova,
        motivo_atraso_justificativa: item.motivo,
      })),
    },
  };
};
