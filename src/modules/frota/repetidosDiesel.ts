import type { Abastecimento } from '../../types';

/**
 * Trava de lançamento repetido no diesel: a mesma máquina, no mesmo dia, com
 * a mesma quantidade de litros é o mesmo abastecimento lançado duas vezes.
 * Dois abastecimentos da mesma máquina no dia com litros diferentes são
 * normais (dois turnos) e só viram aviso.
 */
type Lancamento = Pick<Abastecimento, 'id' | 'data' | 'equipamentoId' | 'prefixoInformado' | 'quantidadeLitros'>;

const TOLERANCIA_LITROS = 0.05;

export const chaveMaquina = (item: Pick<Abastecimento, 'equipamentoId' | 'prefixoInformado'>) => (
  item.equipamentoId
    ? `id:${item.equipamentoId}`
    : `p:${String(item.prefixoInformado ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s-]/g, '').toUpperCase()}`
);

const litros = (item: Pick<Abastecimento, 'quantidadeLitros'>) => Number(item.quantidadeLitros || 0);

const mesmaMaquinaNoDia = (a: Lancamento, b: Lancamento) => (
  Boolean(a.data) && a.data === b.data && chaveMaquina(a) === chaveMaquina(b) && chaveMaquina(a) !== 'p:'
);

export interface ConferenciaDoDia<T extends Lancamento> {
  /** Mesma máquina, mesmo dia e mesmos litros: trava o salvamento. */
  repetido?: T;
  /** Outros abastecimentos da mesma máquina no mesmo dia: só aviso. */
  doDia: T[];
}

/** O que já existe da mesma máquina no dia do candidato (fora ele mesmo). */
export const conferirNoDia = <T extends Lancamento>(lista: readonly T[], candidato: Lancamento): ConferenciaDoDia<T> => {
  const doDia = lista.filter(item => item.id !== candidato.id && mesmaMaquinaNoDia(item, candidato));
  const repetido = doDia.find(item => Math.abs(litros(item) - litros(candidato)) < TOLERANCIA_LITROS);
  return { repetido, doDia };
};

/** Ids de todos os lançamentos que têm um gêmeo (mesma máquina, dia e litros). */
export const idsRepetidos = (lista: readonly Lancamento[]): Set<string> => {
  const grupos = new Map<string, Lancamento[]>();
  lista.forEach(item => {
    if (!item.data || chaveMaquina(item) === 'p:') return;
    const chave = `${item.data}|${chaveMaquina(item)}|${Math.round(litros(item) * 10)}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), item]);
  });
  const ids = new Set<string>();
  grupos.forEach(grupo => { if (grupo.length > 1) grupo.forEach(item => ids.add(item.id)); });
  return ids;
};

/**
 * Leva os abastecimentos escolhidos para outra data, mantendo o resto igual.
 * A competência acompanha a data, como no lançamento.
 */
export const trocarData = <T extends Abastecimento>(itens: readonly T[], novaData: string, agora: string): T[] => (
  itens.map(item => ({ ...item, data: novaData, competencia: novaData.slice(0, 7), atualizadoEm: agora }))
);

/** Quantos dos movidos ficariam repetidos com o que já existe na nova data (ou entre si). */
export const repetidosAoTrocar = (todos: readonly Lancamento[], movidos: readonly Lancamento[], novaData: string): number => {
  const ids = new Set(movidos.map(item => item.id));
  const depois = [
    ...todos.filter(item => !ids.has(item.id)),
    ...movidos.map(item => ({ ...item, data: novaData })),
  ];
  const repetidos = idsRepetidos(depois);
  return movidos.filter(item => repetidos.has(item.id)).length;
};
