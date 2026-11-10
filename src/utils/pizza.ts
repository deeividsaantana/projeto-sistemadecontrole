/** Gráfico de rosca: fatias, cores e porcentagens inteiras (usado nos relatórios da Presença). */
export const CORES_PIZZA = ['#1baf7a', '#eb6834', '#2a78d6', '#eda100', '#e87ba4'] as const;
export const COR_OUTROS = '#718087';
export const FATIAS_COM_COR = CORES_PIZZA.length;

export interface Fatia {
  chave: string;
  nome: string;
  valor: number;
  /** Inteiro; as fatias mostradas somam 100. */
  percentual: number;
  cor: string;
  /** Quantos lançamentos estão nesta fatia. */
  lancamentos: number;
}

export interface Pizza {
  total: number;
  /** Até 5 com cor e, se sobrar, uma "Outros" cinza. */
  fatias: Fatia[];
  /** Todas as partes, da maior para a menor, para a lista completa. */
  todas: Fatia[];
  /** Lançamentos que não entraram (sem fornecedor, sem ramo, outra unidade...). */
  deFora: number;
}

interface Parte { chave: string; nome: string; valor: number; lancamentos: number }

/**
 * Porcentagens inteiras que somam 100, pelo maior resto: 33,3 + 33,3 + 33,3
 * vira 34 + 33 + 33, e ninguém vê uma pizza que soma 99%.
 */
export const porcentagensInteiras = (valores: readonly number[]): number[] => {
  const total = valores.reduce((soma, valor) => soma + valor, 0);
  if (total <= 0) return valores.map(() => 0);
  const exatos = valores.map(valor => (valor / total) * 100);
  const inteiros = exatos.map(Math.floor);
  let falta = 100 - inteiros.reduce((soma, valor) => soma + valor, 0);
  const porResto = exatos.map((valor, indice) => ({ indice, resto: valor - Math.floor(valor) })).sort((a, b) => b.resto - a.resto || a.indice - b.indice);
  for (const { indice } of porResto) {
    if (falta <= 0) break;
    inteiros[indice] += 1;
    falta -= 1;
  }
  return inteiros;
};

/**
 * A cor segue a parte, não a posição: quem tem cor na ordem geral (todos os
 * meses) fica com ela quando o mês muda; quem não tem pega a primeira livre.
 */
export const coresFixas = (chaves: readonly string[], ordemGeral: readonly string[]): Map<string, string> => {
  const cores = new Map<string, string>();
  const usadas = new Set<string>();
  ordemGeral.slice(0, FATIAS_COM_COR).forEach((chave, indice) => {
    if (chaves.includes(chave)) {
      cores.set(chave, CORES_PIZZA[indice]);
      usadas.add(CORES_PIZZA[indice]);
    }
  });
  const livres = CORES_PIZZA.filter(cor => !usadas.has(cor));
  chaves.filter(chave => !cores.has(chave)).forEach(chave => cores.set(chave, livres.shift() ?? COR_OUTROS));
  return cores;
};

const ordenar = (partes: Iterable<Parte>) => [...partes]
  .filter(parte => parte.valor > 0)
  .sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, 'pt-BR'));

/** Junta as partes numa pizza: as 5 maiores com cor e o resto em "Outros". */
export const montarPizza = (partes: Iterable<Parte>, deFora = 0, ordemGeral: readonly string[] = []): Pizza => {
  const lista = ordenar(partes);
  const total = lista.reduce((soma, parte) => soma + parte.valor, 0);
  const comCor = lista.slice(0, FATIAS_COM_COR);
  // Sobrando uma só, ela aparece com o próprio nome: "Outros (1)" esconde à toa.
  const resto = lista.slice(comCor.length);
  const cores = coresFixas(comCor.map(parte => parte.chave), ordemGeral.length ? ordemGeral : lista.map(parte => parte.chave));
  const visiveis: Parte[] = resto.length === 1 ? [...comCor, resto[0]] : resto.length
    ? [...comCor, { chave: '__outros', nome: `Outros (${resto.length})`, valor: resto.reduce((soma, parte) => soma + parte.valor, 0), lancamentos: resto.reduce((soma, parte) => soma + parte.lancamentos, 0) }]
    : comCor;
  const percentuais = porcentagensInteiras(visiveis.map(parte => parte.valor));
  const percentuaisTodas = porcentagensInteiras(lista.map(parte => parte.valor));
  return {
    total,
    deFora,
    fatias: visiveis.map((parte, indice) => ({ ...parte, percentual: percentuais[indice], cor: cores.get(parte.chave) ?? COR_OUTROS })),
    todas: lista.map((parte, indice) => ({ ...parte, percentual: percentuaisTodas[indice], cor: cores.get(parte.chave) ?? COR_OUTROS })),
  };
};

