/**
 * Ramo e canteiro não são campos próprios do apontamento de presença: chegam
 * dentro do nome da equipe ou da frente de serviço, em texto livre. Comparar
 * com `includes` cru faz "Ramo 100" casar também com "Ramo 1000" e "Ramo 200"
 * com "Ramo 2000" — o filtro somava gente de outra frente. Aqui o termo
 * precisa aparecer inteiro, com caractere não alfanumérico (ou o fim do texto)
 * dos dois lados, o que também preserva "SP-066" e "Padre Eustáquio".
 */
export const contemTermo = (texto: string, termo: string): boolean => {
  const alvo = String(texto || '').toLocaleLowerCase('pt-BR');
  const busca = String(termo || '').toLocaleLowerCase('pt-BR').trim();
  if (!busca || !alvo) return false;
  const limite = (char?: string) => char === undefined || !/[\p{L}\p{N}]/u.test(char);
  let de = alvo.indexOf(busca);
  while (de !== -1) {
    if (limite(alvo[de - 1]) && limite(alvo[de + busca.length])) return true;
    de = alvo.indexOf(busca, de + 1);
  }
  return false;
};

/** Ramos ativos da obra, na ordem em que a operação os enumera. */
export const RAMOS_ATIVOS = [
  'Ramo 100', 'Ramo 200', 'Ramo 300', 'Ramo 500', 'Ramo 600', 'Ramo 700',
  'Ramo 800', 'Ramo 900', 'Ramo 1000', 'Ramo 1100', 'Ramo 1200', 'Ramo 1300',
  'Ramo 1400', 'Ramo 2000',
] as const;

/** Canteiros e locais de apoio ativos da obra. */
export const CANTEIROS_ATIVOS = [
  'SP-066', 'IBAR', 'Padre Eustáquio', 'Marginal', 'Barraca do Coco', 'Fábrica',
] as const;
