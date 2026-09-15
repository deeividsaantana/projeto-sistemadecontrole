import type { Funcionario, ListaPresenca, PresencaApontamento } from '../types';

const PRESENCE_CONFIRMED = new Set(['Presente', 'Atraso', 'Saída antecipada']);

export type DashboardPresenceMetrics = {
  officialActive: number;
  confirmed: number;
  absent: number;
  pending: number;
  percentage: number | undefined;
};

/**
 * A fonte do previsto e sempre o cadastro oficial de RH. Os apontamentos so
 * descrevem a situacao daquele efetivo na data, inclusive se a pessoa ainda
 * nao estiver vinculada a um link publico de equipe.
 */
export const dashboardPresenceMetrics = (
  funcionarios: Funcionario[],
  apontamentos: PresencaApontamento[],
  listasLegadas: ListaPresenca[],
  referenceDate: string,
): DashboardPresenceMetrics => {
  const officialActive = funcionarios.filter(item => item.ativo && !['INATIVO', 'DESMOBILIZADO'].includes(item.status || 'ATIVO')).length;
  const publicToday = apontamentos.filter(item => !item.inativoEm && item.data === referenceDate);

  const confirmed = publicToday.length
    ? new Set(publicToday.filter(item => PRESENCE_CONFIRMED.has(item.status)).map(item => item.funcionarioId)).size
    : new Set(listasLegadas
      .filter(item => item.data === referenceDate)
      .flatMap(item => item.funcionarios.filter(person => person.presente).map(person => person.funcionarioId))).size;
  const absent = publicToday.length
    ? new Set(publicToday.filter(item => item.status === 'Ausente').map(item => item.funcionarioId)).size
    : 0;
  const pending = Math.max(0, officialActive - confirmed - absent);

  return {
    officialActive,
    confirmed,
    absent,
    pending,
    percentage: officialActive ? Math.min(100, (confirmed / officialActive) * 100) : undefined,
  };
};
