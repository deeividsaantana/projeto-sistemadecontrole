import type { Material, MovimentoMaterial } from '../types';

/**
 * Quanto cada movimento soma no saldo. Entrada soma, saída subtrai, ajuste
 * respeita o sinal informado e transferência é neutra: muda de lugar, não muda
 * a quantidade que a obra tem.
 */
export const efeitoNoSaldo = (movimento: Pick<MovimentoMaterial, 'tipo' | 'quantidade'> & { canceladoEm?: string }): number => {
  if (movimento.canceladoEm) return 0;
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

/** Um único percurso dos movimentos alimenta todos os saldos, inclusive listas extensas. */
export const posicaoEstoque = (materiais: Material[], movimentos: MovimentoMaterial[], ate?: string): PosicaoEstoque[] => {
  const totals = new Map<string, { saldo: number; entradas: number; saidas: number; ultimoMovimento?: string }>();
  for (const item of movimentos) {
    if (ate && item.data > ate) continue;
    if (item.canceladoEm) continue;
    const current = totals.get(item.materialId) ?? { saldo: 0, entradas: 0, saidas: 0 };
    current.saldo += efeitoNoSaldo(item);
    if (item.tipo === 'Entrada') current.entradas += Math.abs(Number(item.quantidade) || 0);
    if (item.tipo === 'Saída') current.saidas += Math.abs(Number(item.quantidade) || 0);
    if (!current.ultimoMovimento || item.data > current.ultimoMovimento) current.ultimoMovimento = item.data;
    totals.set(item.materialId, current);
  }
  return materiais.map(material => {
    const total = totals.get(material.id);
    const saldo = Number((total?.saldo ?? 0).toFixed(3));
    const minimo = Number(material.estoqueMinimo || 0);
    return {
      material,
      saldo,
      entradas: Number((total?.entradas ?? 0).toFixed(3)),
      saidas: Number((total?.saidas ?? 0).toFixed(3)),
      abaixoDoMinimo: minimo > 0 && saldo < minimo,
      ultimoMovimento: total?.ultimoMovimento,
    };
  }).sort((a, b) => String(a.material.descricao || '').localeCompare(String(b.material.descricao || ''), 'pt-BR'));
};

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
