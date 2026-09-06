import type { Treinamento } from '../types';
import { DIAS_ALERTA_VENCIMENTO, exigeAtencao, situacaoVencimento, type SituacaoVencimento } from './vencimento';

export { DIAS_ALERTA_VENCIMENTO };

export type SituacaoTreinamento = SituacaoVencimento;

/** Situação do treinamento na data de referência. */
export const situacaoTreinamento = (
  treinamento: Pick<Treinamento, 'dataVencimento'>,
  hoje: string,
  diasAlerta: number = DIAS_ALERTA_VENCIMENTO,
): SituacaoTreinamento => situacaoVencimento(treinamento.dataVencimento, hoje, diasAlerta);

/** Treinamentos que exigem ação: já vencidos ou vencendo dentro do prazo. */
export const treinamentosParaAlertar = (
  treinamentos: Treinamento[],
  hoje: string,
  diasAlerta: number = DIAS_ALERTA_VENCIMENTO,
) => treinamentos
  .map(item => ({ treinamento: item, situacao: situacaoTreinamento(item, hoje, diasAlerta) }))
  .filter(item => exigeAtencao(item.situacao))
  .sort((a, b) => (a.treinamento.dataVencimento || '').localeCompare(b.treinamento.dataVencimento || ''));
