/**
 * Números dos gráficos de pizza de Materiais. Cada pizza divide um todo
 * (o que chegou no mês, por exemplo) e diz a porcentagem de cada parte.
 * Unidades nunca se misturam: ou se conta lançamento, ou se soma uma unidade
 * só (toneladas, m³...), e o que veio em outra unidade fica de fora e é dito.
 */
import type { EtapaServico, MovimentoMaterial, TipoMovimentoMaterial } from '../../types';
import { normalizeComparable } from '../../utils/canonicalIdentity';
import { indiceDeLocais, localDoMovimento } from './locaisSge';
import { chaveUnidade, mesDe, ramoDoLocal } from './previstoMateriais';

/**
 * Cores das fatias, na ordem fixa. Conferidas no validador de paleta (faixa de
 * claridade, saturação e separação para daltonismo). "Outros" é sempre cinza.
 */
export const CORES_PIZZA = ['#1baf7a', '#eb6834', '#2a78d6', '#eda100', '#e87ba4'] as const;
export const COR_OUTROS = '#718087';
export const FATIAS_COM_COR = CORES_PIZZA.length;

/** "lancamentos" conta linhas; qualquer outro valor é a chave da unidade somada. */
export type Medida = string;
export const CONTAR_LANCAMENTOS: Medida = 'lancamentos';

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

export interface FiltroGraficos {
  tipo: TipoMovimentoMaterial;
  /** "AAAA-MM" ou "" para todos os meses. */
  mes: string;
  medida: Medida;
}

/** Lançamentos que valem para o gráfico: do tipo e do mês, sem os desfeitos. */
export const movimentosDoFiltro = (movimentos: readonly MovimentoMaterial[], { tipo, mes }: Pick<FiltroGraficos, 'tipo' | 'mes'>) =>
  movimentos.filter(item => !item.canceladoEm && item.tipo === tipo && (!mes || mesDe(item.data) === mes));

export interface OpcaoMedida { medida: Medida; nome: string; sigla: string; lancamentos: number }

const NOME_UNIDADE: Record<string, [nome: string, sigla: string]> = {
  t: ['Toneladas', 't'],
  m3: ['Metros cúbicos', 'm³'],
  viagem: ['Viagens', 'viagens'],
  viagens: ['Viagens', 'viagens'],
  un: ['Unidades', 'un'],
  kg: ['Quilos', 'kg'],
  l: ['Litros', 'L'],
  m: ['Metros', 'm'],
};

/** Unidades que aparecem nos lançamentos, da mais usada para a menos, depois "contar lançamentos". */
export const medidasDisponiveis = (movimentos: readonly MovimentoMaterial[]): OpcaoMedida[] => {
  const porUnidade = new Map<string, OpcaoMedida>();
  for (const item of movimentos) {
    const medida = chaveUnidade(item.unidade);
    if (!medida) continue;
    const [nome, sigla] = NOME_UNIDADE[medida] ?? [item.unidade.trim(), item.unidade.trim()];
    const atual = porUnidade.get(medida) ?? { medida, nome, sigla, lancamentos: 0 };
    atual.lancamentos += 1;
    porUnidade.set(medida, atual);
  }
  const unidades = [...porUnidade.values()].sort((a, b) => b.lancamentos - a.lancamentos || a.nome.localeCompare(b.nome, 'pt-BR'));
  return [...unidades, { medida: CONTAR_LANCAMENTOS, nome: 'Número de lançamentos', sigla: '', lancamentos: movimentos.length }];
};

/** Quanto o lançamento vale na medida escolhida, ou null se é de outra unidade. */
const valorNaMedida = (item: MovimentoMaterial, medida: Medida) => {
  if (medida === CONTAR_LANCAMENTOS) return 1;
  return chaveUnidade(item.unidade) === medida ? Math.abs(Number(item.quantidade) || 0) : null;
};

type Classificar = (item: MovimentoMaterial) => { chave: string; nome: string } | undefined;

/** Soma os lançamentos por parte; os sem parte ou de outra unidade vão para "de fora". */
const dividir = (movimentos: readonly MovimentoMaterial[], medida: Medida, classificar: Classificar) => {
  const partes = new Map<string, Parte>();
  let deFora = 0;
  for (const item of movimentos) {
    const valor = valorNaMedida(item, medida);
    const parte = valor === null ? undefined : classificar(item);
    if (!parte || valor === null) {
      deFora += 1;
      continue;
    }
    const atual = partes.get(parte.chave) ?? { ...parte, valor: 0, lancamentos: 0 };
    atual.valor += valor;
    atual.lancamentos += 1;
    partes.set(parte.chave, atual);
  }
  return { partes: partes.values(), deFora };
};

const porTexto = (texto: string | undefined) => {
  const nome = (texto || '').trim();
  return nome ? { chave: normalizeComparable(nome), nome } : undefined;
};

export const classificarPorMaterial: Classificar = item => porTexto(item.materialDescricao) && { chave: item.materialId || normalizeComparable(item.materialDescricao), nome: item.materialDescricao.trim() };
export const classificarPorFornecedor: Classificar = item => porTexto(item.fornecedorNome);

/** Ramo do local de destino, pelo cadastro de Ramos e locais. */
export const classificadorDeRamo = (etapas: readonly EtapaServico[]): Classificar => {
  const porId = new Map(etapas.map(etapa => [etapa.id, etapa]));
  const indice = indiceDeLocais(etapas);
  const memoria = new Map<string, { chave: string; nome: string } | undefined>();
  return item => {
    const chave = `${item.etapaServicoId || ''}\u0000${item.destino || ''}`;
    if (!memoria.has(chave)) memoria.set(chave, porTexto(ramoDoLocal(localDoMovimento(item, porId, indice))));
    return memoria.get(chave);
  };
};

/** Pizza de uma divisão, com as cores presas à ordem de todos os meses. */
export const pizzaPor = (
  todos: readonly MovimentoMaterial[],
  filtro: FiltroGraficos,
  classificar: Classificar,
): Pizza => {
  const doFiltro = movimentosDoFiltro(todos, filtro);
  const geral = ordenar(dividir(movimentosDoFiltro(todos, { ...filtro, mes: '' }), filtro.medida, classificar).partes).map(parte => parte.chave);
  const { partes, deFora } = dividir(doFiltro, filtro.medida, classificar);
  return montarPizza(partes, deFora, geral);
};

/** Custo em reais por fornecedor: valor total, ou unitário vezes quantidade. */
export const pizzaDeCusto = (todos: readonly MovimentoMaterial[], filtro: Pick<FiltroGraficos, 'tipo' | 'mes'>): Pizza => {
  const custo = (item: MovimentoMaterial) => Math.abs(Number(item.valorTotal) || 0) || Math.abs(Number(item.valorUnitario) || 0) * Math.abs(Number(item.quantidade) || 0);
  const somar = (lista: readonly MovimentoMaterial[]) => {
    const partes = new Map<string, Parte>();
    let deFora = 0;
    for (const item of lista) {
      const parte = porTexto(item.fornecedorNome);
      const valor = custo(item);
      if (!parte || !valor) {
        deFora += 1;
        continue;
      }
      const atual = partes.get(parte.chave) ?? { ...parte, valor: 0, lancamentos: 0 };
      atual.valor += valor;
      atual.lancamentos += 1;
      partes.set(parte.chave, atual);
    }
    return { partes: partes.values(), deFora };
  };
  const geral = ordenar(somar(movimentosDoFiltro(todos, { ...filtro, mes: '' })).partes).map(parte => parte.chave);
  const { partes, deFora } = somar(movimentosDoFiltro(todos, filtro));
  return montarPizza(partes, deFora, geral);
};

/** Meses com lançamento, do mais novo para o mais antigo. */
export const mesesComLancamento = (movimentos: readonly MovimentoMaterial[]) =>
  [...new Set(movimentos.filter(item => !item.canceladoEm && item.data).map(item => mesDe(item.data)))].sort().reverse();
