import type { ControleEquipamentoDiario } from '../types';
import {
  lerRelacaoEquipamentos,
  reconcileOperationalFleetDay,
  type OperationalFleetDayReconciliation,
  type OperationalFleetReferenceItem,
} from './operationalFleetReference';
import {
  lerRelacaoOperadores,
  reconcileOperationalDriversDay,
  type OperationalDriverDayReconciliation,
  type OperationalDriverReferenceItem,
} from './operationalDriverReference';

/** As duas relações da conferência do dia, prontas para os relatórios. */
export interface ConferenciaDoDia {
  equipamentos: OperationalFleetDayReconciliation;
  operadores: OperationalDriverDayReconciliation;
}

export const montarConferenciaDoDia = (
  records: readonly ControleEquipamentoDiario[],
  date: string,
  relacaoEquipamentos: readonly OperationalFleetReferenceItem[] = lerRelacaoEquipamentos(),
  relacaoOperadores: readonly OperationalDriverReferenceItem[] = lerRelacaoOperadores(),
): ConferenciaDoDia => ({
  equipamentos: reconcileOperationalFleetDay(records, date, relacaoEquipamentos),
  operadores: reconcileOperationalDriversDay(records, date, relacaoOperadores),
});

/** Linhas do quadro "Conferência da relação" (PDF e Excel). */
export const linhasDaConferencia = (conferencia: ConferenciaDoDia): Array<[string, number, number, number, string]> => [
  [
    'Equipamentos',
    conferencia.equipamentos.total,
    conferencia.equipamentos.informed,
    conferencia.equipamentos.missing,
    conferencia.equipamentos.missingItems.map(item => item.prefix).join(', ') || 'Todos lançados',
  ],
  [
    'Operadores',
    conferencia.operadores.total,
    conferencia.operadores.informed,
    conferencia.operadores.missing,
    conferencia.operadores.missingItems.map(item => item.nome).join(', ') || 'Todos lançados',
  ],
];

/**
 * Avisos que pedem correção no lançamento, em frases curtas. Equipamento fora
 * da relação não entra: escavadeiras, rolos e pás ficam fora dela de propósito.
 */
export const avisosDaConferencia = (conferencia: ConferenciaDoDia): string[] => [
  ...(conferencia.equipamentos.duplicatePrefixes.length
    ? [`Equipamento lançado mais de uma vez: ${conferencia.equipamentos.duplicatePrefixes.join(', ')}.`] : []),
  ...(conferencia.operadores.duplicateDrivers.length
    ? [`Operador em mais de um caminhão: ${conferencia.operadores.duplicateDrivers.join(', ')}.`] : []),
  ...(conferencia.operadores.unexpectedDrivers.length
    ? [`Operadores de basculante fora da relação: ${conferencia.operadores.unexpectedDrivers.join(', ')}.`] : []),
];
