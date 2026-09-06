import type { Treinamento } from '../types';

export const DIAS_ALERTA_VENCIMENTO = 30;

export type SituacaoTreinamento = 'Válido' | 'Vence em breve' | 'Vencido' | 'Sem vencimento';

/** Situação do treinamento na data de referência. */
export const situacaoTreinamento = (
  treinamento: Pick<Treinamento, 'dataVencimento'>,
  hoje: string,
  diasAlerta: number = DIAS_ALERTA_VENCIMENTO,
): SituacaoTreinamento => {
  const vencimento = treinamento.dataVencimento?.slice(0, 10);
  if (!vencimento) return 'Sem vencimento';
  if (vencimento < hoje) return 'Vencido';
  const limite = new Date(`${hoje}T00:00:00`);
  limite.setDate(limite.getDate() + diasAlerta);
  return vencimento <= limite.toISOString().slice(0, 10) ? 'Vence em breve' : 'Válido';
};

/** Treinamentos que exigem ação: já vencidos ou vencendo dentro do prazo. */
export const treinamentosParaAlertar = (
  treinamentos: Treinamento[],
  hoje: string,
  diasAlerta: number = DIAS_ALERTA_VENCIMENTO,
) => treinamentos
  .map(item => ({ treinamento: item, situacao: situacaoTreinamento(item, hoje, diasAlerta) }))
  .filter(item => item.situacao === 'Vencido' || item.situacao === 'Vence em breve')
  .sort((a, b) => (a.treinamento.dataVencimento || '').localeCompare(b.treinamento.dataVencimento || ''));
