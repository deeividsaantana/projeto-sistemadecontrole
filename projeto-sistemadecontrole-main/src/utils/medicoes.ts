import type { ItemMedicao, Medicao, RegistroProducao, ServicoObra } from '../types';

const arredondar = (valor: number) => Number(valor.toFixed(3));

export const MEDICAO_CONTA_NO_ACUMULADO: Medicao['situacao'][] = ['Enviada', 'Aprovada'];

/**
 * Sugestão de itens a partir da produção lançada no período. É sugestão: quem
 * mede confirma ou ajusta a quantidade, porque medir é ato registrado e pode
 * divergir do apontamento de campo.
 */
export const itensSugeridos = (
  servicos: ServicoObra[],
  producao: RegistroProducao[],
  inicio: string,
  fim: string,
): ItemMedicao[] => {
  const noPeriodo = producao.filter(item => item.ativo !== false && item.data >= inicio && item.data <= fim);
  return servicos
    .filter(servico => servico.ativo !== false)
    .map(servico => ({
      servicoId: servico.id,
      servicoDescricao: servico.descricao,
      unidade: servico.unidade,
      quantidade: arredondar(noPeriodo
        .filter(item => item.servicoId === servico.id)
        .reduce((total, item) => total + (Number(item.quantidade) || 0), 0)),
    }))
    .filter(item => item.quantidade > 0);
};

/** Total do boletim. Só soma item com preço informado — não arbitra valor. */
export const totalMedicao = (itens: ItemMedicao[]) =>
  Number(itens
    .reduce((total, item) => total + (Number(item.quantidade) || 0) * (Number(item.valorUnitario) || 0), 0)
    .toFixed(2));

/** Quanto de um serviço já foi medido em boletins enviados ou aprovados. */
export const acumuladoMedido = (medicoes: Medicao[], servicoId: string, exceto?: string) =>
  arredondar(medicoes
    .filter(medicao => medicao.ativo !== false && medicao.id !== exceto
      && MEDICAO_CONTA_NO_ACUMULADO.includes(medicao.situacao))
    .flatMap(medicao => medicao.itens)
    .filter(item => item.servicoId === servicoId)
    .reduce((total, item) => total + (Number(item.quantidade) || 0), 0));

export interface ExcedenteMedicao {
  servicoId: string;
  servicoDescricao: string;
  previsto: number;
  acumulado: number;
  excedente: number;
}

/**
 * Serviços cuja soma medida passa a quantidade prevista em contrato. É aviso,
 * não bloqueio: medir acima do previsto é decisão contratual de quem mede, e o
 * sistema não tem evidência para decidir por ele.
 */
export const excedentesDoContrato = (
  medicao: Pick<Medicao, 'id' | 'itens'>,
  medicoes: Medicao[],
  servicos: ServicoObra[],
): ExcedenteMedicao[] =>
  medicao.itens.flatMap(item => {
    const servico = servicos.find(atual => atual.id === item.servicoId);
    const previsto = Number(servico?.quantidadePrevista) || 0;
    if (!servico || previsto <= 0) return [];
    const acumulado = arredondar(acumuladoMedido(medicoes, item.servicoId, medicao.id) + (Number(item.quantidade) || 0));
    if (acumulado <= previsto) return [];
    return [{
      servicoId: servico.id,
      servicoDescricao: servico.descricao,
      previsto,
      acumulado,
      excedente: arredondar(acumulado - previsto),
    }];
  });

/** Consistência do boletim; o valor do contrato continua sendo decisão humana. */
export const validarMedicao = (
  candidata: Pick<Medicao, 'periodoInicio' | 'periodoFim' | 'itens' | 'situacao'>,
): string | null => {
  if (!candidata.periodoInicio || !candidata.periodoFim) return 'Informe o período medido.';
  if (candidata.periodoFim < candidata.periodoInicio) return 'A data final não pode ser anterior à inicial.';
  if (candidata.itens.some(item => Number(item.quantidade) < 0)) return 'Quantidade medida não pode ser negativa.';
  if (candidata.situacao !== 'Em elaboração' && candidata.itens.filter(item => Number(item.quantidade) > 0).length === 0) {
    return 'Inclua ao menos um item com quantidade antes de enviar a medição.';
  }
  return null;
};

export const proximoNumeroMedicao = (medicoes: Medicao[], ano = new Date().getFullYear()) => {
  const prefixo = `MED-${ano}-`;
  const ultimo = medicoes
    .filter(item => item.numero?.startsWith(prefixo))
    .map(item => Number(item.numero.slice(prefixo.length)) || 0)
    .reduce((maior, valor) => Math.max(maior, valor), 0);
  return `${prefixo}${String(ultimo + 1).padStart(3, '0')}`;
};
