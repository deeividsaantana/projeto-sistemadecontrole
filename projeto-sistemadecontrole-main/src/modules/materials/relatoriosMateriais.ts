/**
 * Relatórios de Materiais: indicadores do período comparados com o período
 * anterior do mesmo tamanho, e cinco tabelas (por material, fornecedor, ramo,
 * mês a mês e dia a dia). Tonelada, m³ e o resto nunca se somam entre si.
 */
import type { EtapaServico, MovimentoMaterial, TipoMovimentoMaterial } from '../../types';
import { normalizeComparable } from '../../utils/canonicalIdentity';
import { indiceDeLocais, localDoMovimento } from './locaisSge';
import { chaveUnidade, mesDe, ramoDoLocal } from './previstoMateriais';

export interface FiltroRelatorio {
  de: string;
  ate: string;
  /** "" = todos os tipos. */
  tipo: TipoMovimentoMaterial | '';
  materialId: string;
  fornecedor: string;
  ramo: string;
}

export const SEM_FORNECEDOR = 'Sem fornecedor';
export const SEM_RAMO = 'Fora dos ramos';

const diaMs = 86_400_000;
const paraData = (dia: string) => new Date(`${dia}T12:00:00Z`);
const paraDia = (data: Date) => data.toISOString().slice(0, 10);

/** Quantos dias o período tem, contando o primeiro e o último. */
export const diasDoPeriodo = (de: string, ate: string) => Math.max(1, Math.round((paraData(ate).getTime() - paraData(de).getTime()) / diaMs) + 1);

/** O período do mesmo tamanho logo antes: 1 a 30/09 compara com 2 a 31/08. */
export const periodoAnterior = (de: string, ate: string) => {
  const dias = diasDoPeriodo(de, ate);
  const fim = new Date(paraData(de).getTime() - diaMs);
  return { de: paraDia(new Date(fim.getTime() - (dias - 1) * diaMs)), ate: paraDia(fim) };
};

const custoDe = (item: MovimentoMaterial) => Math.abs(Number(item.valorTotal) || 0) || Math.abs(Number(item.valorUnitario) || 0) * Math.abs(Number(item.quantidade) || 0);

/** Ramo do destino de cada lançamento, lembrado por texto para não refazer a busca 11 mil vezes. */
export const ramoDoMovimento = (etapas: readonly EtapaServico[]) => {
  const porId = new Map(etapas.map(etapa => [etapa.id, etapa]));
  const indice = indiceDeLocais(etapas);
  const memoria = new Map<string, string>();
  return (item: MovimentoMaterial) => {
    const chave = `${item.etapaServicoId || ''}\u0000${item.destino || ''}`;
    let ramo = memoria.get(chave);
    if (ramo === undefined) {
      ramo = ramoDoLocal(localDoMovimento(item, porId, indice)) || SEM_RAMO;
      memoria.set(chave, ramo);
    }
    return ramo;
  };
};

/** Lançamentos do filtro, sem os desfeitos, do mais novo para o mais antigo. */
export const filtrarRelatorio = (
  movimentos: readonly MovimentoMaterial[],
  filtro: FiltroRelatorio,
  ramoDe: (item: MovimentoMaterial) => string,
) => {
  const fornecedor = normalizeComparable(filtro.fornecedor);
  return movimentos
    .filter(item => !item.canceladoEm
      && item.data >= filtro.de && item.data <= filtro.ate
      && (!filtro.tipo || item.tipo === filtro.tipo)
      && (!filtro.materialId || item.materialId === filtro.materialId)
      && (!fornecedor || normalizeComparable(item.fornecedorNome || SEM_FORNECEDOR) === fornecedor)
      && (!filtro.ramo || ramoDe(item) === filtro.ramo))
    .sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm));
};

export interface Soma {
  lancamentos: number;
  toneladas: number;
  metrosCubicos: number;
  /** Quantidade das outras unidades, por unidade (viagem, un, kg...). */
  outras: Record<string, number>;
  valor: number;
}

export const somaVazia = (): Soma => ({ lancamentos: 0, toneladas: 0, metrosCubicos: 0, outras: {}, valor: 0 });

export const somar = (soma: Soma, item: MovimentoMaterial) => {
  const quantidade = Math.abs(Number(item.quantidade) || 0);
  const unidade = chaveUnidade(item.unidade);
  soma.lancamentos += 1;
  if (unidade === 't') soma.toneladas += quantidade;
  else if (unidade === 'm3') soma.metrosCubicos += quantidade;
  else if (unidade) soma.outras[item.unidade.trim()] = (soma.outras[item.unidade.trim()] || 0) + quantidade;
  soma.valor += custoDe(item);
  return soma;
};

export interface Indicador {
  chave: 'lancamentos' | 'toneladas' | 'metrosCubicos' | 'valor' | 'fornecedores' | 'porDia';
  valor: number;
  anterior: number;
  /** Variação em % contra o período anterior; null quando antes era zero. */
  variacao: number | null;
}

const variacao = (agora: number, antes: number) => (antes > 0 ? Math.round(((agora - antes) / antes) * 100) : null);

export const indicadores = (doPeriodo: readonly MovimentoMaterial[], doAnterior: readonly MovimentoMaterial[], dias: number): Indicador[] => {
  const agora = doPeriodo.reduce(somar, somaVazia());
  const antes = doAnterior.reduce(somar, somaVazia());
  const fornecedores = (lista: readonly MovimentoMaterial[]) => new Set(lista.map(item => normalizeComparable(item.fornecedorNome)).filter(Boolean)).size;
  const valores: Array<[Indicador['chave'], number, number]> = [
    ['lancamentos', agora.lancamentos, antes.lancamentos],
    ['toneladas', agora.toneladas, antes.toneladas],
    ['metrosCubicos', agora.metrosCubicos, antes.metrosCubicos],
    ['valor', agora.valor, antes.valor],
    ['fornecedores', fornecedores(doPeriodo), fornecedores(doAnterior)],
    ['porDia', agora.lancamentos / dias, antes.lancamentos / dias],
  ];
  return valores.map(([chave, valor, anterior]) => ({ chave, valor, anterior, variacao: variacao(valor, anterior) }));
};

export interface LinhaRelatorio extends Soma {
  chave: string;
  nome: string;
  /** Texto de apoio: unidade do material, último recebimento... */
  detalhe?: string;
  ultima?: string;
}

const agrupar = (lista: readonly MovimentoMaterial[], chaveDe: (item: MovimentoMaterial) => { chave: string; nome: string; detalhe?: string }) => {
  const linhas = new Map<string, LinhaRelatorio>();
  for (const item of lista) {
    const { chave, nome, detalhe } = chaveDe(item);
    const linha = linhas.get(chave) ?? { chave, nome, detalhe, ...somaVazia() };
    somar(linha, item);
    if (!linha.ultima || item.data > linha.ultima) linha.ultima = item.data;
    linhas.set(chave, linha);
  }
  return [...linhas.values()];
};

// Maior primeiro pelo que pesa mais: valor, depois toneladas, m³ e lançamentos.
const porTamanho = (a: LinhaRelatorio, b: LinhaRelatorio) => b.valor - a.valor || b.toneladas - a.toneladas || b.metrosCubicos - a.metrosCubicos || b.lancamentos - a.lancamentos || a.nome.localeCompare(b.nome, 'pt-BR');

export const porMaterial = (lista: readonly MovimentoMaterial[]) => agrupar(lista, item => ({
  chave: `${item.materialId || normalizeComparable(item.materialDescricao)}\u0000${chaveUnidade(item.unidade)}`,
  nome: item.materialDescricao.trim() || 'Sem material',
  detalhe: item.unidade.trim(),
})).sort(porTamanho);

export const porFornecedor = (lista: readonly MovimentoMaterial[]) => agrupar(lista, item => {
  const nome = item.fornecedorNome?.trim() || SEM_FORNECEDOR;
  return { chave: normalizeComparable(nome), nome };
}).sort(porTamanho);

export const porRamo = (lista: readonly MovimentoMaterial[], ramoDe: (item: MovimentoMaterial) => string) => agrupar(lista, item => {
  const nome = ramoDe(item);
  return { chave: nome, nome };
}).sort((a, b) => (a.nome === SEM_RAMO ? 1 : 0) - (b.nome === SEM_RAMO ? 1 : 0) || porTamanho(a, b));

export const porDia = (lista: readonly MovimentoMaterial[]) => agrupar(lista, item => ({ chave: item.data, nome: item.data }))
  .sort((a, b) => b.nome.localeCompare(a.nome));

export interface MatrizMeses {
  meses: string[];
  linhas: Array<{ chave: string; nome: string; unidade: string; porMes: Record<string, number>; total: number }>;
}

/** Material por mês na unidade dele: cada linha é um material numa unidade. */
export const mesAMes = (lista: readonly MovimentoMaterial[]): MatrizMeses => {
  const meses = new Set<string>();
  const linhas = new Map<string, MatrizMeses['linhas'][number]>();
  for (const item of lista) {
    const mes = mesDe(item.data);
    meses.add(mes);
    const chave = `${item.materialId || normalizeComparable(item.materialDescricao)}\u0000${chaveUnidade(item.unidade)}`;
    const linha = linhas.get(chave) ?? { chave, nome: item.materialDescricao.trim(), unidade: item.unidade.trim(), porMes: {}, total: 0 };
    const quantidade = Math.abs(Number(item.quantidade) || 0);
    linha.porMes[mes] = (linha.porMes[mes] || 0) + quantidade;
    linha.total += quantidade;
    linhas.set(chave, linha);
  }
  return {
    meses: [...meses].sort(),
    linhas: [...linhas.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.unidade.localeCompare(b.unidade, 'pt-BR')),
  };
};

/** Tabela pronta para o Excel (separador ; e vírgula decimal). */
export const paraCsv = (linhas: ReadonlyArray<ReadonlyArray<string | number>>) => `﻿${linhas
  .map(linha => linha.map(celula => {
    const texto = typeof celula === 'number' ? String(Math.round(celula * 1000) / 1000).replace('.', ',') : celula;
    return `"${texto.replace(/"/g, '""')}"`;
  }).join(';'))
  .join('\n')}`;
