import type { Material, MovimentoMaterial } from '../types';
import { normalizeComparable } from '../utils/canonicalIdentity';
import type { ImportPreview } from './types';
import { stableId } from './stableId';

type Receipt = { data: string | null; material: string | null; especificacao?: string | null; codigo?: string | null; quantidadeNota?: number | null; quantidadeRecebida: number | null; unidade: string | null; notaFiscal: string | null; localAplicacao?: string | null };
type Movement = { material: string; data: string | null; tipoMovimento?: string | null; origem?: string | null; destino: string | null; quantidade: number | null; unidade: string | null };

export const buildMaterialImportApplication = (preview: ImportPreview<unknown>, currentMaterials: readonly Material[], currentMovements: readonly MovimentoMaterial[], responsible: string) => {
  const materials: Material[] = [], movements: MovimentoMaterial[] = [];
  const skipped = { duplicate: 0, review: 0, other: 0 };
  const knownIds = new Set(currentMovements.map(item => item.id));
  preview.rows.forEach(item => {
    if (item.disposition !== 'new') {
      if (item.disposition === 'duplicate-in-file' || item.disposition === 'unchanged') skipped.duplicate++;
      else if (item.disposition === 'review') skipped.review++;
      else skipped.other++;
      return;
    }
    const value = item.row.value as Receipt | Movement;
    const receipt = 'quantidadeRecebida' in value;
    const description = receipt ? [value.material, value.especificacao].filter(Boolean).join(' · ') : value.material;
    const quantity = receipt ? value.quantidadeRecebida : value.quantidade;
    if (!description || !value.data || quantity === null || !value.unidade || !item.row.operationalKey) { skipped.review++; return; }
    const key = normalizeComparable(description);
    let material = [...currentMaterials, ...materials].find(entry => normalizeComparable(entry.descricao) === key);
    if (!material) {
      material = { id: stableId('mat-import', key), codigo: receipt ? value.codigo || '' : '', descricao: description, categoria: item.row.lineage.sourceSheet, unidade: value.unidade, ativo: true, criadoEm: preview.generatedAt, atualizadoEm: preview.generatedAt };
      materials.push(material);
    }
    const id = stableId('mov-import', `${preview.sourceHash}-${item.row.lineage.sourceSheet}-${item.row.lineage.sourceRow}`);
    if (knownIds.has(id)) return;
    knownIds.add(id);
    movements.push({ id, data: value.data, tipo: receipt ? 'Entrada' : (value.tipoMovimento === 'saida' ? 'Saída' : value.tipoMovimento === 'transferencia' ? 'Transferência' : 'Entrada'), materialId: material.id, materialDescricao: material.descricao, quantidade: quantity, unidade: value.unidade, quantidadeNota: receipt ? value.quantidadeNota ?? undefined : undefined, notaFiscal: receipt ? value.notaFiscal || undefined : undefined, destino: receipt ? value.localAplicacao || undefined : value.destino || undefined, origem: receipt ? undefined : value.origem || undefined, responsavel: responsible, criadoEm: preview.generatedAt, observacao: `Importado de ${preview.sourceFile} · ${item.row.lineage.sourceSheet} · linha ${item.row.lineage.sourceRow}` });
  });
  return { materials, movements, skipped };
};
