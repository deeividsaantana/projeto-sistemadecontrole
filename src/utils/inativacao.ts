/**
 * Registro com valor histórico não se apaga: inativa-se. O dado continua no
 * arquivo, sai das telas e dos totais, e pode voltar. Isso também evita que a
 * exclusão feita num aparelho apague o registro dos outros na sincronização —
 * uma inativação é uma alteração, não um sumiço.
 */
export interface Inativavel {
  id: string;
  inativoEm?: string;
  inativoPor?: string;
}

export const estaAtivo = (registro: { inativoEm?: string } | null | undefined): boolean =>
  !registro?.inativoEm;

export const somenteAtivos = <T extends { inativoEm?: string }>(lista: T[] | null | undefined): T[] =>
  (Array.isArray(lista) ? lista : []).filter(estaAtivo);

export const contarInativos = (lista: Array<{ inativoEm?: string }> | null | undefined): number =>
  (Array.isArray(lista) ? lista : []).length - somenteAtivos(lista).length;

export const inativar = <T extends Inativavel>(
  lista: T[],
  ids: string[],
  por: string,
  agora: string = new Date().toISOString(),
): T[] => {
  const alvos = new Set(ids.filter(Boolean));
  if (alvos.size === 0) return lista;
  return lista.map(registro => (
    alvos.has(registro.id) && estaAtivo(registro)
      ? { ...registro, inativoEm: agora, inativoPor: por || 'Sistema' }
      : registro
  ));
};

export const reativar = <T extends Inativavel>(lista: T[], ids: string[]): T[] => {
  const alvos = new Set(ids.filter(Boolean));
  if (alvos.size === 0) return lista;
  return lista.map(registro => {
    if (!alvos.has(registro.id)) return registro;
    const { inativoEm: _em, inativoPor: _por, ...resto } = registro;
    return resto as T;
  });
};
