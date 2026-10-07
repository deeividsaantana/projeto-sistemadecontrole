import type {
  Abastecimento,
  CategoriaCusto,
  LancamentoCusto,
  OrdemServico,
} from '../types';

export interface CustoConsolidado {
  id: string;
  data: string;
  categoria: CategoriaCusto;
  descricao: string;
  valor: number;
  obraId?: string;
  equipamentoId?: string;
  /** De onde o valor veio: registro de outro módulo ou lançamento manual. */
  origem: 'Abastecimento' | 'Ordem de serviço' | 'Lançamento';
}

const dinheiro = (valor: number) => Number(valor.toFixed(2));
const noPeriodo = (data: string | undefined, inicio: string, fim: string) =>
  Boolean(data) && data! >= inicio && data! <= fim;

/**
 * Custos que já existem em outros módulos. Combustível usa o custo total do
 * abastecimento e manutenção usa só o custo final — o estimado é previsão e não
 * entra como realizado, para o consolidado não contar dinheiro que não saiu.
 */
export const custosDeOutrosModulos = (
  abastecimentos: Abastecimento[],
  ordensServico: OrdemServico[],
  inicio: string,
  fim: string,
): CustoConsolidado[] => [
  ...abastecimentos
    .filter(item => noPeriodo(item.data, inicio, fim) && Number(item.custoTotal) > 0)
    .map(item => ({
      id: `abast-${item.id}`,
      data: item.data,
      categoria: 'Combustível' as const,
      descricao: `Abastecimento ${item.prefixoInformado || ''}`.trim(),
      valor: dinheiro(Number(item.custoTotal)),
      equipamentoId: item.equipamentoId,
      origem: 'Abastecimento' as const,
    })),
  ...ordensServico
    .filter(item => noPeriodo(item.dataConclusao || item.dataAbertura, inicio, fim) && Number(item.custoFinal) > 0)
    .map(item => ({
      id: `os-${item.id}`,
      data: item.dataConclusao || item.dataAbertura,
      categoria: 'Manutenção' as const,
      descricao: `OS ${item.numero} — ${item.motivo || item.tipo}`,
      valor: dinheiro(Number(item.custoFinal)),
      equipamentoId: item.equipamentoId,
      origem: 'Ordem de serviço' as const,
    })),
];

/** Junta o que veio dos módulos com os lançamentos manuais do período. */
export const consolidarCustos = (
  derivados: CustoConsolidado[],
  lancamentos: LancamentoCusto[],
  inicio: string,
  fim: string,
): CustoConsolidado[] => [
  ...derivados,
  ...lancamentos
    .filter(item => item.ativo !== false && noPeriodo(item.data, inicio, fim))
    .map(item => ({
      id: item.id,
      data: item.data,
      categoria: item.categoria,
      descricao: item.descricao,
      valor: dinheiro(Number(item.valor) || 0),
      obraId: item.obraId,
      equipamentoId: item.equipamentoId,
      origem: 'Lançamento' as const,
    })),
].sort((a, b) => b.data.localeCompare(a.data));

export const totalCustos = (custos: CustoConsolidado[]) =>
  dinheiro(custos.reduce((total, item) => total + (Number(item.valor) || 0), 0));

/** Agrupa por qualquer chave do custo, sem rateio automático nem estimativa. */
export const custosPor = (
  custos: CustoConsolidado[],
  chave: (custo: CustoConsolidado) => string | undefined,
) => {
  const mapa = new Map<string, number>();
  custos.forEach(item => {
    const grupo = chave(item) || 'Sem classificação';
    mapa.set(grupo, (mapa.get(grupo) || 0) + (Number(item.valor) || 0));
  });
  return [...mapa.entries()]
    .map(([grupo, valor]) => ({ grupo, valor: dinheiro(valor) }))
    .sort((a, b) => b.valor - a.valor);
};

/** Manutenção prevista mas ainda não realizada, para leitura de compromisso. */
export const custoPrevistoManutencao = (ordensServico: OrdemServico[]) =>
  dinheiro(ordensServico
    .filter(item => !['Concluída', 'Cancelada'].includes(item.status) && Number(item.custoEstimado) > 0)
    .reduce((total, item) => total + Number(item.custoEstimado), 0));

/** Lançamento manual só existe para o que não nasce em outro módulo. */
export const validarLancamentoCusto = (
  candidato: Pick<LancamentoCusto, 'data' | 'descricao' | 'valor' | 'categoria'>,
): string | null => {
  if (!candidato.data) return 'Informe a data do custo.';
  if (!candidato.descricao.trim()) return 'Descreva o custo.';
  if (!(Number(candidato.valor) > 0)) return 'Informe um valor maior que zero.';
  if (candidato.categoria === 'Combustível') return 'Combustível vem dos abastecimentos, não se lança aqui.';
  if (candidato.categoria === 'Manutenção') return 'Manutenção vem do custo final da ordem de serviço.';
  return null;
};
