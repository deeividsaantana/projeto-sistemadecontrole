/**
 * Regras puras do lançamento rápido de materiais: achar o material pelo que a
 * pessoa digitou ou colou, ler número e data no jeito brasileiro e transformar
 * um pedaço copiado do Excel em linhas da grade de viagens.
 */
import type { Material, MovimentoMaterial, TipoMovimentoMaterial } from '../../types';
import { normalizeComparable } from '../../utils/canonicalIdentity';
import { validarMovimento } from '../../utils/estoque';

export interface OpcaoNomeada {
  id: string;
  nome: string;
  /** Código, sigla ou outro texto que também serve para achar a opção. */
  apelido?: string;
}

const palavras = (texto: string) => normalizeComparable(texto).split(/\s+/).filter(Boolean);

/**
 * Opções que batem com o texto: cada palavra digitada precisa aparecer no nome
 * ou no apelido, em qualquer ordem. "brita 1" acha "BRITA 01 - PEDREIRA".
 * O nome igual vem primeiro, depois o que começa com o texto.
 */
export const filtrarOpcoes = <T extends OpcaoNomeada>(opcoes: readonly T[], texto: string, limite = 8): T[] => {
  const busca = palavras(texto);
  if (!busca.length) return opcoes.slice(0, limite);
  const alvo = normalizeComparable(texto);
  const pontuadas: Array<{ opcao: T; nota: number }> = [];
  for (const opcao of opcoes) {
    const nome = normalizeComparable(opcao.nome);
    const apelido = normalizeComparable(opcao.apelido);
    const tudo = `${nome} ${apelido}`;
    if (!busca.every(palavra => tudo.includes(palavra))) continue;
    const nota = nome === alvo || apelido === alvo ? 0 : nome.startsWith(alvo) || apelido.startsWith(alvo) ? 1 : 2;
    pontuadas.push({ opcao, nota });
  }
  return pontuadas
    .sort((a, b) => a.nota - b.nota || a.opcao.nome.localeCompare(b.opcao.nome, 'pt-BR'))
    .slice(0, limite)
    .map(item => item.opcao);
};

/** Só devolve quando não há dúvida: nome ou apelido igual, ou uma única opção que bate. */
export const acharOpcao = <T extends OpcaoNomeada>(opcoes: readonly T[], texto: string): T | undefined => {
  const alvo = normalizeComparable(texto);
  if (!alvo) return undefined;
  const exata = opcoes.find(opcao => normalizeComparable(opcao.nome) === alvo || (opcao.apelido && normalizeComparable(opcao.apelido) === alvo));
  if (exata) return exata;
  const parecidas = filtrarOpcoes(opcoes, texto, 2);
  return parecidas.length === 1 ? parecidas[0] : undefined;
};

/** "1.234,5", "1234.5", "12,5 m³" viram número. Texto sem número vira null, nunca zero. */
export const lerNumeroBR = (texto: string): number | null => {
  const limpo = String(texto ?? '').replace(/[^\d,.-]/g, '');
  if (!/\d/.test(limpo)) return null;
  const temVirgula = limpo.includes(',');
  const normal = temVirgula ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  const valor = Number(normal);
  return Number.isFinite(valor) ? valor : null;
};

/** "26/09/2026", "26/09/26" e "2026-09-26" viram "2026-09-26". O resto vira null. */
export const lerDataBR = (texto: string): string | null => {
  const valor = String(texto ?? '').trim();
  const iso = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = valor.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!br) return null;
  const ano = br[3].length === 2 ? `20${br[3]}` : br[3];
  const mes = Number(br[2]);
  const dia = Number(br[1]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
};

const TIPOS_POR_TEXTO: Record<string, TipoMovimentoMaterial> = {
  entrada: 'Entrada', e: 'Entrada', recebimento: 'Entrada',
  saida: 'Saída', s: 'Saída', uso: 'Saída', consumo: 'Saída',
  transferencia: 'Transferência', t: 'Transferência', transporte: 'Transferência',
  ajuste: 'Ajuste', a: 'Ajuste',
};

export const lerTipo = (texto: string): TipoMovimentoMaterial | null => TIPOS_POR_TEXTO[normalizeComparable(texto)] ?? null;

/**
 * Os mais usados por último primeiro, sem repetir: é o que aparece antes de a
 * pessoa digitar qualquer coisa. Lançamento desfeito não conta.
 */
export const recentes = (
  movimentos: readonly MovimentoMaterial[],
  campo: (movimento: MovimentoMaterial) => string | undefined,
  limite = 5,
): string[] => {
  const ordenados = [...movimentos]
    .filter(item => !item.canceladoEm)
    .sort((a, b) => b.data.localeCompare(a.data) || String(b.criadoEm).localeCompare(String(a.criadoEm)));
  const vistos: string[] = [];
  for (const item of ordenados) {
    const valor = campo(item)?.trim();
    if (!valor || vistos.includes(valor)) continue;
    vistos.push(valor);
    if (vistos.length >= limite) break;
  }
  return vistos;
};

export const COLUNAS_VIAGEM = ['data', 'tipo', 'materialId', 'quantidade', 'fornecedorId', 'placa', 'ticket', 'destino', 'valorUnitario', 'valorTotal'] as const;
export type ColunaViagem = typeof COLUNAS_VIAGEM[number];

/** Uma linha da grade. Números ficam como a pessoa digitou ("12,5") e só viram número ao salvar. */
export interface LinhaViagem {
  data: string;
  tipo: TipoMovimentoMaterial;
  materialId: string;
  quantidade: string;
  fornecedorId: string;
  placa: string;
  ticket: string;
  destino: string;
  valorUnitario: string;
  valorTotal: string;
}

export const linhaViagemVazia = (data: string, base?: Partial<LinhaViagem>): LinhaViagem => ({
  data,
  tipo: 'Entrada',
  materialId: '',
  quantidade: '',
  fornecedorId: '',
  placa: '',
  ticket: '',
  destino: '',
  valorUnitario: '',
  valorTotal: '',
  ...base,
});

/** A linha seguinte já nasce com o que costuma se repetir de uma viagem para outra. */
export const proximaLinha = (anterior: LinhaViagem | undefined, hoje: string): LinhaViagem => linhaViagemVazia(anterior?.data || hoje, anterior
  ? { tipo: anterior.tipo, materialId: anterior.materialId, fornecedorId: anterior.fornecedorId, destino: anterior.destino, valorUnitario: anterior.valorUnitario }
  : undefined);

export const linhaViagemPreenchida = (linha: LinhaViagem) => Boolean(linha.materialId || linha.quantidade.trim() || linha.placa.trim() || linha.ticket.trim());

interface ContextoColagem {
  materiais: readonly OpcaoNomeada[];
  fornecedores: readonly OpcaoNomeada[];
}

export interface ResultadoColagem {
  linhas: Array<Partial<LinhaViagem>>;
  avisos: string[];
}

/** Um pedaço copiado do Excel tem tabulação entre colunas ou mais de uma linha. */
export const pareceTabela = (texto: string) => /\t/.test(texto) || /\r?\n\S/.test(texto.trim());

/**
 * Lê o que foi copiado do Excel a partir da coluna onde a pessoa colou. Cada
 * linha copiada vira uma viagem; material e fornecedor são achados pelo nome.
 * O que não dá para entender fica em branco e vira aviso, nunca um valor inventado.
 */
export const lerColagem = (texto: string, colunaInicial: ColunaViagem, contexto: ContextoColagem): ResultadoColagem => {
  const inicio = COLUNAS_VIAGEM.indexOf(colunaInicial);
  const linhasTexto = texto.replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n');
  const linhas: Array<Partial<LinhaViagem>> = [];
  const avisos: string[] = [];

  linhasTexto.forEach((linhaTexto, indice) => {
    const celulas = linhaTexto.split('\t');
    const linha: Partial<LinhaViagem> = {};
    celulas.forEach((bruto, deslocamento) => {
      const coluna = COLUNAS_VIAGEM[inicio + deslocamento];
      const valor = bruto.trim();
      if (!coluna || !valor) return;
      const numeroLinha = indice + 1;
      switch (coluna) {
        case 'data': {
          const data = lerDataBR(valor);
          if (data) linha.data = data; else avisos.push(`Linha ${numeroLinha}: data "${valor}" não foi entendida.`);
          break;
        }
        case 'tipo': {
          const tipo = lerTipo(valor);
          if (tipo) linha.tipo = tipo; else avisos.push(`Linha ${numeroLinha}: tipo "${valor}" não foi entendido.`);
          break;
        }
        case 'materialId': {
          const material = acharOpcao(contexto.materiais, valor);
          if (material) linha.materialId = material.id; else avisos.push(`Linha ${numeroLinha}: material "${valor}" não está no cadastro.`);
          break;
        }
        case 'fornecedorId': {
          const fornecedor = acharOpcao(contexto.fornecedores, valor);
          if (fornecedor) linha.fornecedorId = fornecedor.id; else avisos.push(`Linha ${numeroLinha}: fornecedor "${valor}" não está no cadastro.`);
          break;
        }
        case 'quantidade':
        case 'valorUnitario':
        case 'valorTotal': {
          const numero = lerNumeroBR(valor);
          if (numero !== null) linha[coluna] = String(numero).replace('.', ','); else avisos.push(`Linha ${numeroLinha}: "${valor}" não é um número.`);
          break;
        }
        case 'placa':
          linha.placa = valor.toUpperCase();
          break;
        default:
          linha[coluna] = valor;
      }
    });
    linhas.push(linha);
  });

  return { linhas, avisos };
};

interface ContextoViagens {
  hoje: string;
  responsavel: string;
  agora: string;
  materiais: readonly Material[];
  empresas: ReadonlyArray<{ id: string; nome: string }>;
  movimentos: readonly MovimentoMaterial[];
}

/**
 * Transforma as linhas preenchidas da grade em movimentos. Para na primeira
 * linha com problema e diz qual é, sem gravar nada pela metade.
 */
export const montarViagens = (linhas: readonly LinhaViagem[], contexto: ContextoViagens): { movimentos: MovimentoMaterial[]; erro?: string; linhaComErro?: number } => {
  const novos: MovimentoMaterial[] = [];
  const carimbo = Date.parse(contexto.agora) || Date.now();
  for (const [indice, linha] of linhas.entries()) {
    if (!linhaViagemPreenchida(linha)) continue;
    const numeroLinha = indice + 1;
    const material = contexto.materiais.find(item => item.id === linha.materialId);
    if (!material) return { movimentos: [], erro: `Linha ${numeroLinha}: escolha o material.`, linhaComErro: indice };
    const quantidade = lerNumeroBR(linha.quantidade) ?? 0;
    const id = `mov-lote-${carimbo}-${indice}`;
    const problema = validarMovimento([...contexto.movimentos, ...novos], { id, tipo: linha.tipo, materialId: material.id, quantidade });
    if (problema) return { movimentos: [], erro: `Linha ${numeroLinha}: ${problema}`, linhaComErro: indice };
    const fornecedor = contexto.empresas.find(item => item.id === linha.fornecedorId);
    const valorUnitario = lerNumeroBR(linha.valorUnitario) ?? 0;
    const valorTotal = (lerNumeroBR(linha.valorTotal) ?? 0) || (valorUnitario ? Number((valorUnitario * Math.abs(quantidade)).toFixed(2)) : 0);
    novos.push({
      id,
      data: linha.data || contexto.hoje,
      tipo: linha.tipo,
      materialId: material.id,
      materialDescricao: material.descricao,
      quantidade,
      unidade: material.unidade,
      fornecedorId: fornecedor?.id,
      fornecedorNome: fornecedor?.nome,
      placa: linha.placa.trim().toUpperCase() || undefined,
      ticket: linha.ticket.trim() || undefined,
      destino: linha.destino.trim() || undefined,
      valorUnitario: valorUnitario > 0 ? valorUnitario : undefined,
      valorTotal: valorTotal > 0 ? valorTotal : undefined,
      responsavel: contexto.responsavel,
      criadoEm: contexto.agora,
    });
  }
  if (!novos.length) return { movimentos: [], erro: 'Preencha ao menos uma viagem para salvar.' };
  return { movimentos: novos };
};
