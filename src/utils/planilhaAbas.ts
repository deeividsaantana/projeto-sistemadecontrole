/**
 * Escolha de aba na importação de cadastros.
 *
 * Planilhas operacionais trazem abas de resumo, detalhe e apoio, muitas vezes
 * ocultas. Ler todas misturava essas linhas com o cadastro (num teste, 1.228
 * linhas de combustível virariam equipamentos). Por isso só abas visíveis
 * entram, e quando sobra mais de uma a pessoa escolhe qual importar.
 */
export interface AbaPlanilha {
  nome: string;
  linhas: Record<string, string>[];
}

export type EstadoAba = 'visible' | 'hidden' | 'veryHidden' | string | undefined;

export const abaVisivel = (estado: EstadoAba): boolean => !estado || estado === 'visible';

const normalizar = (valor: string) => valor
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

// Singular e plural divergem no fim ("combustível" x "combustíveis").
const prefixoComum = (a: string, b: string) => {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return i;
};

/**
 * Aba sugerida para o tipo de cadastro aberto: a primeira cujo nome lembra o
 * tipo (ex.: "EQUIPAMENTOS" para Equipamentos); sem nenhuma parecida, a
 * primeira aba que tem linhas.
 */
export const abaSugerida = (abas: readonly AbaPlanilha[], termos: readonly string[]): string | null => {
  const chaves = termos.map(normalizar).filter(chave => chave.length >= 4);
  const parecida = abas.find(aba => aba.linhas.length > 0 && chaves.some(chave => {
    const nome = normalizar(aba.nome);
    return nome.includes(chave) || chave.includes(nome) || prefixoComum(nome, chave) >= Math.min(6, nome.length, chave.length);
  }));
  return parecida?.nome ?? abas.find(aba => aba.linhas.length > 0)?.nome ?? null;
};
