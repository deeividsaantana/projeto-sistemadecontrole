import type { MovimentoMaterial } from '../types';

/**
 * Recebimento de material: a nota diz que veio 2.000 estacas, chegaram 0. A
 * diferença é carga paga que não está na obra — e some do controle se ninguém
 * a coloca numa tela. A pendência é sempre calculada, nunca gravada: gravar o
 * saldo cria um número que envelhece sozinho e passa a mentir.
 */
export interface PendenciaRecebimento {
  movimentoId: string;
  data: string;
  material: string;
  unidade: string;
  solicitacaoCompra: string;
  notaFiscal: string;
  destino: string;
  quantidadeNota: number;
  quantidadeRecebida: number;
  faltante: number;
}

const numero = (valor: unknown): number => {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
};

/** Só entrada tem recebimento: saída, transferência e ajuste não têm nota a conferir. */
const ehRecebimento = (movimento: MovimentoMaterial) =>
  movimento?.tipo === 'Entrada' && numero(movimento.quantidadeNota) > 0;

export const faltanteDe = (movimento: MovimentoMaterial): number => {
  if (!ehRecebimento(movimento)) return 0;
  return Math.max(0, Number((numero(movimento.quantidadeNota) - numero(movimento.quantidade)).toFixed(4)));
};

export const recebimentoCompleto = (movimento: MovimentoMaterial): boolean =>
  ehRecebimento(movimento) && faltanteDe(movimento) === 0;

export const pendenciasDeRecebimento = (
  movimentos: MovimentoMaterial[],
): PendenciaRecebimento[] => (Array.isArray(movimentos) ? movimentos : [])
  .filter(movimento => Boolean(movimento) && faltanteDe(movimento) > 0)
  .map(movimento => ({
    movimentoId: movimento.id,
    data: movimento.data,
    material: movimento.materialDescricao,
    unidade: movimento.unidade,
    solicitacaoCompra: movimento.solicitacaoCompra || '',
    notaFiscal: movimento.notaFiscal || '',
    destino: movimento.destino || '',
    quantidadeNota: numero(movimento.quantidadeNota),
    quantidadeRecebida: numero(movimento.quantidade),
    faltante: faltanteDe(movimento),
  }))
  .sort((a, b) => b.faltante - a.faltante || a.data.localeCompare(b.data));

export interface ResumoRecebimento {
  entregas: number;
  entregasPendentes: number;
  totalFaltante: number;
  /** Quanto do que a nota prometeu já chegou, de 0 a 100. */
  percentualRecebido: number;
}

export const resumoDeRecebimento = (movimentos: MovimentoMaterial[]): ResumoRecebimento => {
  const entregas = (Array.isArray(movimentos) ? movimentos : []).filter(ehRecebimento);
  const prometido = entregas.reduce((soma, item) => soma + numero(item.quantidadeNota), 0);
  const recebido = entregas.reduce((soma, item) => soma + Math.min(numero(item.quantidade), numero(item.quantidadeNota)), 0);
  return {
    entregas: entregas.length,
    entregasPendentes: entregas.filter(item => faltanteDe(item) > 0).length,
    totalFaltante: Number(entregas.reduce((soma, item) => soma + faltanteDe(item), 0).toFixed(4)),
    percentualRecebido: prometido > 0 ? Math.round((recebido / prometido) * 100) : 100,
  };
};
