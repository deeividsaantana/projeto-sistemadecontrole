import type { Material, MovimentoMaterial } from '../../types';

export interface MaterialBranchUsage {
  materialId: string;
  materialDescription: string;
  unit: string;
  branchId: string;
  branchName: string;
  received: number;
  used: number;
  remaining: number;
  percent: number | null;
  lastUseDate?: string;
}

const rounded = (value: number) => Number(value.toFixed(3));

/** Only explicitly linked receipts and approved consumption movements enter the calculation. */
export const materialUsageByBranch = (
  materials: readonly Material[],
  movements: readonly MovimentoMaterial[],
): MaterialBranchUsage[] => {
  const catalog = new Map(materials.map(item => [item.id, item]));
  const grouped = new Map<string, MaterialBranchUsage>();
  for (const movement of movements) {
    if (!movement.materialId || !movement.etapaServicoId) continue;
    if (movement.tipo !== 'Entrada' && !(movement.tipo === 'Saída' && movement.finalidade === 'Consumo')) continue;
    const key = `${movement.materialId}\u0000${movement.etapaServicoId}`;
    let row = grouped.get(key);
    if (!row) {
      const material = catalog.get(movement.materialId);
      row = {
        materialId: movement.materialId,
        materialDescription: material?.descricao || movement.materialDescricao,
        unit: material?.unidade || movement.unidade,
        branchId: movement.etapaServicoId,
        branchName: movement.etapaServicoNome || movement.etapaServicoId,
        received: 0,
        used: 0,
        remaining: 0,
        percent: null,
      };
      grouped.set(key, row);
    }
    const quantity = Math.abs(Number(movement.quantidade) || 0);
    if (movement.tipo === 'Entrada') row.received += quantity;
    else {
      row.used += quantity;
      if (!row.lastUseDate || movement.data > row.lastUseDate) row.lastUseDate = movement.data;
    }
  }
  return [...grouped.values()].map(row => ({
    ...row,
    received: rounded(row.received),
    used: rounded(row.used),
    remaining: rounded(row.received - row.used),
    percent: row.received > 0 ? Number(((row.used / row.received) * 100).toFixed(1)) : null,
  })).sort((a, b) => a.branchName.localeCompare(b.branchName, 'pt-BR') || a.materialDescription.localeCompare(b.materialDescription, 'pt-BR'));
};
