import type { Material, MovimentoMaterial } from '../types';

/**
 * Quanto cada movimento soma no saldo. Entrada soma, saída subtrai, ajuste
 * respeita o sinal informado e transferência é neutra: muda de lugar, não muda
 * a quantidade que a obra tem.
 */
export const efeitoNoSaldo = (movimento: Pick<MovimentoMaterial, 'tipo' | 'quantidade'>): number => {
  const quantidade = Number(movimento.quantidade) || 0;
  if (movimento.tipo === 'Entrada') return Math.abs(quantidade);
  if (movimento.tipo === 'Saída') return -Math.abs(quantidade);
  if (movimento.tipo === 'Ajuste') return quantidade;
  return 0;
};

/**
 * Saldo é sempre a soma dos movimentos, nunca um número guardado. Não existe
 * contador para corrigir, então também não existe recálculo que possa divergir.
 */
export const saldoDoMaterial = (movimentos: MovimentoMaterial[], materialId: string, ate?: string) =>
  Number(movimentos
    .filter(item => item.materialId === materialId && (!ate || item.data <= ate))
    .reduce((total, item) => total + efeitoNoSaldo(item), 0)
    .toFixed(3));

export interface PosicaoEstoque {
  material: Material;
  saldo: number;
  entradas: number;
  saidas: number;
  abaixoDoMinimo: boolean;
  ultimoMovimento?: string;
}

/** Posição de estoque de cada material, para a tela e para os alertas. */
export const posicaoEstoque = (materiais: Material[], movimentos: MovimentoMaterial[], ate?: string): PosicaoEstoque[] =>
  materiais.map(material => {
    const doMaterial = movimentos.filter(item => item.materialId === material.id && (!ate || item.data <= ate));
    const saldo = Number(doMaterial.reduce((total, item) => total + efeitoNoSaldo(item), 0).toFixed(3));
    const minimo = Number(material.estoqueMinimo || 0);
    return {
      material,
      saldo,
      entradas: Number(doMaterial.filter(item => item.tipo === 'Entrada').reduce((total, item) => total + Math.abs(Number(item.quantidade) || 0), 0).toFixed(3)),
      saidas: Number(doMaterial.filter(item => item.tipo === 'Saída').reduce((total, item) => total + Math.abs(Number(item.quantidade) || 0), 0).toFixed(3)),
      abaixoDoMinimo: minimo > 0 && saldo < minimo,
      ultimoMovimento: doMaterial.map(item => item.data).sort().at(-1),
    };
  }).sort((a, b) => a.material.descricao.localeCompare(b.material.descricao, 'pt-BR'));

/** Recusa a saída que deixaria o saldo negativo, sem travar entrada e ajuste. */
export const validarMovimento = (
  movimentos: MovimentoMaterial[],
  candidato: Pick<MovimentoMaterial, 'id' | 'tipo' | 'materialId' | 'quantidade'>,
): string | null => {
  if (!candidato.materialId) return 'Selecione o material.';
  if (!(Math.abs(Number(candidato.quantidade)) > 0)) return 'Informe a quantidade.';
  if (candidato.tipo !== 'Saída') return null;
  const outros = movimentos.filter(item => item.id !== candidato.id);
  const saldo = saldoDoMaterial(outros, candidato.materialId);
  if (Math.abs(Number(candidato.quantidade)) > saldo) {
    return `Saldo disponível é ${saldo.toLocaleString('pt-BR')}. A saída deixaria o estoque negativo.`;
  }
  return null;
};
