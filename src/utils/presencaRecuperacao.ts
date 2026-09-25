import type { PeriodoArquivado, PresencaApontamento } from '../types';

/** Uma pessoa, numa equipe, num dia: é essa a identidade de um apontamento. */
export const presenceBusinessKey = (item: Pick<PresencaApontamento, 'grupoId' | 'data' | 'funcionarioId'>) => (
  `${item.grupoId}|${item.data}|${item.funcionarioId}`
);

/**
 * A recuperação lê de novo a fila do link público, que guarda o envio
 * original da equipe. Ela roda sozinha a cada entrada no sistema, então só
 * pode trazer o que falta: o que já está aqui pode ter sido corrigido no
 * painel ou lançado à mão, e o que foi arquivado saiu da lista de propósito.
 */
export const presencasFaltantes = (
  local: PresencaApontamento[],
  fila: PresencaApontamento[],
  arquivados: Pick<PeriodoArquivado, 'dados'>[] = [],
): PresencaApontamento[] => {
  const conhecidas = new Set(local.map(presenceBusinessKey));
  arquivados.forEach(periodo => (periodo.dados?.presencasLink || []).forEach(item => conhecidas.add(presenceBusinessKey(item))));
  const faltantes = new Map<string, PresencaApontamento>();
  fila.forEach(item => {
    const chave = presenceBusinessKey(item);
    if (!conhecidas.has(chave)) faltantes.set(chave, item);
  });
  return Array.from(faltantes.values());
};
