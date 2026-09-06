import type { ContextoPendencias } from './pendencias';
import { painelOcorrencias } from './ocorrencias';
import { aderenciaDosPlanos } from './planejamento';
import { resumoFvs } from './fvs';

export type TendenciaIndicador = 'alta' | 'baixa' | 'estavel';

export interface Indicador {
  id: string;
  grupo: string;
  titulo: string;
  valor: number;
  unidade: string;
  /** Quando existe base de comparação, a variação contra o período anterior. */
  variacao?: number;
  tendencia?: TendenciaIndicador;
  /** Quanto maior melhor? Define a cor sem inverter a leitura do número. */
  maiorMelhor: boolean;
  detalhe?: string;
}

export type ContextoIndicadores = ContextoPendencias & {
  /** Período anterior de mesmo tamanho, para a variação. */
  inicioAnterior?: string;
  fimAnterior?: string;
};

const percentual = (parte: number, total: number) => total > 0 ? Number(((parte / total) * 100).toFixed(1)) : 0;
const noPeriodo = (data: string | undefined, inicio: string, fim: string) =>
  Boolean(data) && data! >= inicio && data! <= fim;

const variacaoEntre = (atual: number, anterior: number) => {
  if (anterior === 0) return undefined;
  return Number((((atual - anterior) / anterior) * 100).toFixed(1));
};

const tendenciaDe = (variacao?: number): TendenciaIndicador | undefined => {
  if (variacao === undefined) return undefined;
  if (variacao > 1) return 'alta';
  if (variacao < -1) return 'baixa';
  return 'estavel';
};

/**
 * Indicadores consolidados do período. Todo número sai dos registros já
 * existentes — nenhum indicador tem valor próprio guardado, então não existe
 * indicador desatualizado em relação à operação.
 */
export const calcularIndicadores = (contexto: ContextoIndicadores): Indicador[] => {
  const {
    inicio, fim, hoje, inicioAnterior, fimAnterior,
    controlesEquipamentos = [], presencasLink = [], ordensServico = [], ocorrencias = [],
    producao = [], planejamento = [], fichasFvs = [], naoConformidades = [], inspecoes = [],
    ticketsJazida = [],
  } = contexto;

  const frota = controlesEquipamentos.filter(item => noPeriodo(item.data, inicio, fim));
  const operando = frota.filter(item => item.status === 'Em operação').length;
  const manutencao = frota.filter(item => ['Em manutenção', 'Aguardando manutenção'].includes(item.status)).length;

  const presencas = presencasLink.filter(item => noPeriodo(item.data, inicio, fim));
  const presentes = presencas.filter(item => ['Presente', 'Atraso', 'Saída antecipada'].includes(item.status)).length;
  const ausentes = presencas.filter(item => item.status === 'Ausente').length;

  const producaoPeriodo = producao.filter(item => item.ativo !== false && noPeriodo(item.data, inicio, fim));
  const totalProduzido = Number(producaoPeriodo.reduce((total, item) => total + (Number(item.quantidade) || 0), 0).toFixed(3));
  const producaoAnterior = inicioAnterior && fimAnterior
    ? Number(producao
      .filter(item => item.ativo !== false && noPeriodo(item.data, inicioAnterior, fimAnterior))
      .reduce((total, item) => total + (Number(item.quantidade) || 0), 0).toFixed(3))
    : 0;

  const planosPeriodo = planejamento.filter(item => item.ativo !== false && item.dataInicio <= fim && item.dataFim >= inicio);
  const aderencias = aderenciaDosPlanos(planosPeriodo, producao, hoje);
  const planejado = aderencias.reduce((total, item) => total + item.planejado, 0);
  const realizado = aderencias.reduce((total, item) => total + item.realizado, 0);

  const fichas = fichasFvs.filter(item => item.ativo !== false && noPeriodo(item.data, inicio, fim));
  const itensFvs = fichas.flatMap(ficha => ficha.itens);
  const resumo = resumoFvs(itensFvs);

  const painelOcorrenciasPeriodo = painelOcorrencias(ocorrencias, inicio, fim);
  const variacaoProducao = variacaoEntre(totalProduzido, producaoAnterior);

  const osPeriodo = ordensServico.filter(item => noPeriodo(item.dataAbertura, inicio, fim));
  const osConcluidas = osPeriodo.filter(item => item.status === 'Concluída').length;

  return [
    {
      id: 'disponibilidade-frota',
      grupo: 'Equipamentos',
      titulo: 'Disponibilidade da frota',
      valor: percentual(operando, frota.length),
      unidade: '%',
      maiorMelhor: true,
      detalhe: `${operando} em operação de ${frota.length} lançamentos`,
    },
    {
      id: 'frota-manutencao',
      grupo: 'Equipamentos',
      titulo: 'Frota em manutenção',
      valor: percentual(manutencao, frota.length),
      unidade: '%',
      maiorMelhor: false,
      detalhe: `${manutencao} lançamento(s) em manutenção`,
    },
    {
      id: 'os-concluidas',
      grupo: 'Equipamentos',
      titulo: 'Ordens concluídas no período',
      valor: percentual(osConcluidas, osPeriodo.length),
      unidade: '%',
      maiorMelhor: true,
      detalhe: `${osConcluidas} de ${osPeriodo.length} ordens abertas no período`,
    },
    {
      id: 'presenca',
      grupo: 'Pessoas',
      titulo: 'Presença efetiva',
      valor: percentual(presentes, presentes + ausentes),
      unidade: '%',
      maiorMelhor: true,
      detalhe: `${presentes} presente(s) e ${ausentes} ausente(s)`,
    },
    {
      id: 'producao-total',
      grupo: 'Produção',
      titulo: 'Produção lançada',
      valor: totalProduzido,
      unidade: 'un',
      variacao: variacaoProducao,
      tendencia: tendenciaDe(variacaoProducao),
      maiorMelhor: true,
      detalhe: `${producaoPeriodo.length} lançamento(s) no período`,
    },
    {
      id: 'aderencia-plano',
      grupo: 'Produção',
      titulo: 'Aderência ao planejado',
      valor: percentual(realizado, planejado),
      unidade: '%',
      maiorMelhor: true,
      detalhe: `${planosPeriodo.length} plano(s) no período`,
    },
    {
      id: 'conformidade-fvs',
      grupo: 'Qualidade',
      titulo: 'Conformidade nas FVS',
      valor: percentual(resumo.conformes, resumo.conformes + resumo.naoConformes),
      unidade: '%',
      maiorMelhor: true,
      detalhe: `${resumo.naoConformes} item(ns) não conforme(s) em ${fichas.length} ficha(s)`,
    },
    {
      id: 'nc-abertas',
      grupo: 'Qualidade',
      titulo: 'Não conformidades em aberto',
      valor: naoConformidades.filter(item => item.ativo !== false
        && ['Aberta', 'Em tratamento', 'Verificação'].includes(item.situacao)).length,
      unidade: '',
      maiorMelhor: false,
    },
    {
      id: 'inspecoes-abertas',
      grupo: 'Segurança',
      titulo: 'Inspeções em aberto',
      valor: inspecoes.filter(item => item.ativo !== false && ['Aberta', 'Em correção'].includes(item.situacao)).length,
      unidade: '',
      maiorMelhor: false,
    },
    {
      id: 'acidentes',
      grupo: 'Segurança',
      titulo: 'Acidentes no período',
      valor: painelOcorrenciasPeriodo.acidentes,
      unidade: '',
      maiorMelhor: false,
    },
    {
      id: 'horas-paradas',
      grupo: 'Operação',
      titulo: 'Horas paradas por ocorrência',
      valor: painelOcorrenciasPeriodo.horasParadas,
      unidade: 'h',
      maiorMelhor: false,
      detalhe: `${painelOcorrenciasPeriodo.total} ocorrência(s) no período`,
    },
    {
      id: 'viagens',
      grupo: 'Operação',
      titulo: 'Viagens de jazida',
      valor: ticketsJazida.filter(item => noPeriodo(item.data, inicio, fim)).length,
      unidade: '',
      maiorMelhor: true,
    },
  ];
};
