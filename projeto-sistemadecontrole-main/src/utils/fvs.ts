import type { FichaVerificacaoServico, ItemFvs, ModeloFvs, SituacaoFvs } from '../types';

/** Modelo de partida. A qualidade ajusta os itens pela tela, sem deploy. */
export const MODELO_FVS_PADRAO: ModeloFvs = {
  id: 'modelo-fvs-padrao',
  nome: 'Verificação de serviço',
  itens: [
    { id: 'projeto', descricao: 'Serviço executado conforme projeto', obrigatorio: true },
    { id: 'material', descricao: 'Material aprovado e dentro da especificação', obrigatorio: true },
    { id: 'geometria', descricao: 'Geometria, cota e alinhamento conferidos', obrigatorio: true },
    { id: 'acabamento', descricao: 'Acabamento sem falhas aparentes', obrigatorio: false },
    { id: 'limpeza', descricao: 'Local limpo e desimpedido', obrigatorio: false },
    { id: 'seguranca', descricao: 'Condições de segurança atendidas', obrigatorio: true },
    { id: 'registro', descricao: 'Registro fotográfico anexado', obrigatorio: false },
  ],
  ativo: true,
  criadoEm: '',
  atualizadoEm: '',
};

export const itensNaoConformes = (itens: ItemFvs[]) => itens.filter(item => item.resposta === 'Não conforme');

export const pendenciasObrigatorias = (itens: ItemFvs[]) =>
  itensNaoConformes(itens).filter(item => item.obrigatorio);

export const itensSemResposta = (itens: ItemFvs[]) =>
  itens.filter(item => !item.resposta);

/** Resumo usado na lista e no cabeçalho da ficha. */
export const resumoFvs = (itens: ItemFvs[]) => ({
  total: itens.length,
  conformes: itens.filter(item => item.resposta === 'Conforme').length,
  naoConformes: itensNaoConformes(itens).length,
  naoAplicaveis: itens.filter(item => item.resposta === 'Não aplicável').length,
  obrigatoriosPendentes: pendenciasObrigatorias(itens).length,
});

/**
 * Uma ficha com item obrigatório não conforme não pode ser aprovada. A liberação
 * com pendência existe, mas exige justificativa escrita — a decisão fica
 * registrada em vez de virar uma aprovação silenciosa.
 */
export const validarFvs = (
  ficha: Pick<FichaVerificacaoServico, 'local' | 'itens' | 'situacao' | 'observacao'>,
): string | null => {
  if (!ficha.local.trim()) return 'Informe o local verificado.';
  if (ficha.itens.length === 0) return 'A ficha precisa ter itens de verificação.';
  if (ficha.situacao === 'Em preenchimento') return null;
  if (itensSemResposta(ficha.itens).length > 0) return 'Responda todos os itens antes de encerrar a ficha.';
  const obrigatorias = pendenciasObrigatorias(ficha.itens);
  if (ficha.situacao === 'Aprovada' && obrigatorias.length > 0) {
    return `Não é possível aprovar: ${obrigatorias.length} item(ns) obrigatório(s) não conforme(s).`;
  }
  if (ficha.situacao === 'Liberada com pendência' && !ficha.observacao?.trim()) {
    return 'Descreva a justificativa da liberação com pendência.';
  }
  if (ficha.situacao === 'Reprovada' && itensNaoConformes(ficha.itens).length === 0) {
    return 'Uma ficha sem item não conforme não deve ser reprovada.';
  }
  return null;
};

/** Situação sugerida pelas respostas, sem decidir pela qualidade. */
export const situacaoSugerida = (itens: ItemFvs[]): SituacaoFvs => {
  if (itensSemResposta(itens).length > 0) return 'Em preenchimento';
  if (pendenciasObrigatorias(itens).length > 0) return 'Reprovada';
  if (itensNaoConformes(itens).length > 0) return 'Liberada com pendência';
  return 'Aprovada';
};

/** Numeração sequencial por ano, no mesmo padrão das ordens de serviço. */
export const proximoNumeroFvs = (fichas: FichaVerificacaoServico[], ano = new Date().getFullYear()) => {
  const prefixo = `FVS-${ano}-`;
  const ultimo = fichas
    .filter(ficha => ficha.numero?.startsWith(prefixo))
    .map(ficha => Number(ficha.numero.slice(prefixo.length)) || 0)
    .reduce((maior, valor) => Math.max(maior, valor), 0);
  return `${prefixo}${String(ultimo + 1).padStart(4, '0')}`;
};
