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
  const jaGuardadas = [...local, ...arquivados.flatMap(periodo => periodo.dados?.presencasLink || [])];
  const conhecidas = new Set(jaGuardadas.map(presenceBusinessKey));
  // O mesmo id é o mesmo apontamento, mesmo que a equipe ou a pessoa tenha
  // mudado depois. Trazer de novo criaria um id repetido, que a sincronização
  // junta num só, e a cópia voltaria a "faltar" na entrada seguinte.
  const ids = new Set(jaGuardadas.map(item => item.id).filter(Boolean));
  const faltantes = new Map<string, PresencaApontamento>();
  fila.forEach(item => {
    const chave = presenceBusinessKey(item);
    if (!conhecidas.has(chave) && !(item.id && ids.has(item.id))) faltantes.set(chave, item);
  });
  return Array.from(faltantes.values());
};

/** "Equipe X em 20/09 (18)": diz ao usuário o que voltou, não só quantos. */
export const resumoRecuperadas = (registros: PresencaApontamento[]): string => {
  const contagem = new Map<string, number>();
  registros.forEach(item => {
    const dia = String(item.data || '').split('-').reverse().join('/');
    const chave = `${item.grupoNome || 'Equipe sem nome'} em ${dia}`;
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  });
  const partes = Array.from(contagem, ([chave, total]) => `${chave} (${total})`);
  return partes.length > 3 ? `${partes.slice(0, 3).join(', ')} e mais ${partes.length - 3}` : partes.join(', ');
};

/**
 * Presença que só existe aqui e ainda não subiu (id fora da base da última
 * sincronização) não pode sumir quando a nuvem chega. Antes a decisão era pelo
 * total de registros: bastava a nuvem ter mais registros no geral para as
 * presenças novas de hoje serem trocadas pelas da nuvem.
 */
export const juntarPresencaBaixada = (
  nuvem: PresencaApontamento[],
  local: PresencaApontamento[],
  idsDaBase: string[] = [],
): PresencaApontamento[] => {
  const base = new Set(idsDaBase);
  const idsDaNuvem = new Set(nuvem.map(item => item.id));
  const chavesDaNuvem = new Set(nuvem.map(presenceBusinessKey));
  const novasAqui = local.filter(item => !base.has(item.id)
    && !idsDaNuvem.has(item.id)
    && !chavesDaNuvem.has(presenceBusinessKey(item)));
  return novasAqui.length === 0 ? nuvem : [...nuvem, ...novasAqui];
};
