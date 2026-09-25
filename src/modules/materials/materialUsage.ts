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
  lastUseBy?: string;
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
    if (!movement.materialId || !movement.etapaServicoId || movement.canceladoEm) continue;
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
      if (!row.lastUseDate || movement.data >= row.lastUseDate) {
        row.lastUseDate = movement.data;
        row.lastUseBy = movement.apontadoPor || movement.responsavel || row.lastUseBy;
      }
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

export interface BranchUsageGroup {
  branchId: string;
  branchName: string;
  received: number;
  used: number;
  percent: number | null;
  /** Soma em unidades diferentes não tem significado: o percentual do ramo é a média ponderada só quando todas as linhas têm a mesma unidade. */
  mixedUnits: boolean;
  rows: MaterialBranchUsage[];
}

/** Um bloco por ramo, em ordem de número do ramo (Ramo 900 antes de Ramo 1300). */
export const groupUsageByBranch = (rows: readonly MaterialBranchUsage[]): BranchUsageGroup[] => {
  const groups = new Map<string, BranchUsageGroup>();
  for (const row of rows) {
    let group = groups.get(row.branchId);
    if (!group) {
      group = { branchId: row.branchId, branchName: row.branchName, received: 0, used: 0, percent: null, mixedUnits: false, rows: [] };
      groups.set(row.branchId, group);
    }
    group.rows.push(row);
  }
  return [...groups.values()].map(group => {
    const units = new Set(group.rows.map(row => row.unit.trim().toUpperCase()));
    const received = group.rows.reduce((sum, row) => sum + row.received, 0);
    const used = group.rows.reduce((sum, row) => sum + row.used, 0);
    const mixedUnits = units.size > 1;
    // Com unidades misturadas (metro de tubo e peça de madeira), o percentual
    // do ramo é a média dos percentuais de cada material, não a soma crua.
    const percents = group.rows.map(row => row.percent).filter((value): value is number => value !== null);
    const percent = mixedUnits
      ? (percents.length ? Number((percents.reduce((sum, value) => sum + value, 0) / percents.length).toFixed(1)) : null)
      : (received > 0 ? Number(((used / received) * 100).toFixed(1)) : null);
    return { ...group, received: rounded(received), used: rounded(used), percent, mixedUnits };
  }).sort((a, b) => a.branchName.localeCompare(b.branchName, 'pt-BR', { numeric: true }));
};
