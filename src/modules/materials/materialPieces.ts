import type { Material } from '../../types';

/**
 * Tubo chega na nota em metros e é assentado por peça. O cadastro guarda o
 * comprimento da peça; a tela conta peças e o banco continua na unidade da
 * nota, para o saldo bater com o documento fiscal.
 */
// O cadastro manual grava `comprimentoM`; a importação grava `comprimentoPecaM`.
export const pieceLength = (material?: Pick<Material, 'comprimentoPecaM' | 'comprimentoM'> | null): number | null => {
  const length = Number(material?.comprimentoPecaM || material?.comprimentoM);
  return Number.isFinite(length) && length > 0 ? length : null;
};

export const toPieces = (material: Pick<Material, 'comprimentoPecaM' | 'comprimentoM'> | null | undefined, quantity: number): number | null => {
  const length = pieceLength(material);
  return length ? Number((quantity / length).toFixed(2)) : null;
};

export const fromPieces = (material: Pick<Material, 'comprimentoPecaM' | 'comprimentoM'> | null | undefined, pieces: number): number => {
  const length = pieceLength(material);
  return length ? Number((pieces * length).toFixed(3)) : pieces;
};

const number = (value: number) => value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export const unitLabel = (unit: string) => {
  const key = unit.trim().toUpperCase();
  if (key === 'MT' || key === 'M') return 'm';
  if (key === 'PC' || key === 'PÇ') return 'pç';
  if (key === 'UN' || key === 'UND') return 'un';
  if (key === 'T' || key === 'TON') return 't';
  if (key === 'M3') return 'm³';
  return unit.trim();
};

/** "14 pç (21 m)" quando o material é contado por peça, "21 m" quando não. */
export const formatMaterialQuantity = (material: Pick<Material, 'comprimentoPecaM' | 'comprimentoM' | 'unidade'> | null | undefined, quantity: number, unit = material?.unidade || '') => {
  const pieces = toPieces(material, quantity);
  const base = `${number(quantity)} ${unitLabel(unit)}`.trim();
  return pieces === null ? base : `${number(pieces)} pç (${base})`;
};
