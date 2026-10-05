import type { EtapaServico, Material, MovimentoMaterial } from '../../types';
import { chaveLocal, indiceDeLocais, ramoCitado, resolverLocal } from './locaisSge';
import { ramoDoLocal } from './previstoMateriais';

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
  /** Movimentos que entraram no ramo só pelo número escrito no local. */
  linkedByText: number;
}

export interface RamoDoMovimento {
  id: string;
  name: string;
  /** Não há local cadastrado com este nome: o id é só uma marca do ramo. */
  synthetic: boolean;
  /** Veio do texto do local, não de um vínculo gravado. */
  byText: boolean;
}

/**
 * Ramo em que o movimento conta. O vínculo gravado vence; a frente soma no
 * ramo a que pertence. Sem vínculo, vale o número do ramo escrito no local
 * ("ATERRO RAMO 1300" conta no Ramo 1300). "Ramo 600/700" fica de fora:
 * são dois ramos, quem escolhe é a pessoa.
 */
export const resolvedorDeRamo = (etapas: readonly EtapaServico[], movimentos: readonly MovimentoMaterial[] = []) => {
  const porId = new Map(etapas.map(item => [item.id, item]));
  const indice = indiceDeLocais(etapas);
  const ramos = new Map<string, EtapaServico>();
  etapas.forEach(etapa => {
    const ramo = ramoDoLocal(etapa);
    const chave = ramo ? chaveLocal(ramo) : '';
    if (ramo && chave === chaveLocal(etapa.nome) && (!ramos.has(chave) || etapa.tipoLocal === 'Ramo')) ramos.set(chave, etapa);
  });
  // Ramo sem local cadastrado, mas com vínculo gravado ("Ramo 1400" do link):
  // o id gravado vira o do ramo, para o texto somar no mesmo lugar.
  const gravados = new Map<string, { id: string; nome: string }>();
  movimentos.forEach(item => {
    if (!item.etapaServicoId || porId.has(item.etapaServicoId)) return;
    const ramo = ramoCitado(item.etapaServicoNome || '');
    if (ramo && chaveLocal(ramo) === chaveLocal(item.etapaServicoNome) && !gravados.has(chaveLocal(ramo))) gravados.set(chaveLocal(ramo), { id: item.etapaServicoId, nome: item.etapaServicoNome || ramo });
  });
  const doRamo = (ramo: string, byText: boolean): RamoDoMovimento => {
    const chave = chaveLocal(ramo);
    const etapa = ramos.get(chave);
    if (etapa) return { id: etapa.id, name: etapa.nome, synthetic: false, byText };
    const gravado = gravados.get(chave);
    return gravado ? { id: gravado.id, name: gravado.nome, synthetic: false, byText } : { id: `ramo:${chave}`, name: ramo, synthetic: true, byText };
  };
  return (movimento: Pick<MovimentoMaterial, 'etapaServicoId' | 'etapaServicoNome' | 'destino'>): RamoDoMovimento | undefined => {
    if (movimento.etapaServicoId) {
      const local = porId.get(movimento.etapaServicoId);
      const ramo = ramoDoLocal(local) ?? ramoCitado(local?.nome || movimento.etapaServicoNome || '');
      if (ramo) return doRamo(ramo, false);
      return { id: movimento.etapaServicoId, name: local?.nome || movimento.etapaServicoNome || movimento.etapaServicoId, synthetic: false, byText: false };
    }
    const ramo = ramoDoLocal(resolverLocal(movimento.destino, indice)) ?? ramoCitado(movimento.destino || '');
    return ramo ? doRamo(ramo, true) : undefined;
  };
};

const rounded = (value: number) => Number(value.toFixed(3));

/** Entradas e saídas de consumo, no ramo do vínculo ou do número escrito no local. */
export const materialUsageByBranch = (
  materials: readonly Material[],
  movements: readonly MovimentoMaterial[],
  etapas: readonly EtapaServico[] = [],
): MaterialBranchUsage[] => {
  const catalog = new Map(materials.map(item => [item.id, item]));
  const ramoDe = resolvedorDeRamo(etapas, movements);
  const grouped = new Map<string, MaterialBranchUsage>();
  for (const movement of movements) {
    if (!movement.materialId || movement.canceladoEm) continue;
    if (movement.tipo !== 'Entrada' && !(movement.tipo === 'Saída' && movement.finalidade === 'Consumo')) continue;
    const branch = ramoDe(movement);
    if (!branch) continue;
    const key = `${movement.materialId}\u0000${branch.id}`;
    let row = grouped.get(key);
    if (!row) {
      const material = catalog.get(movement.materialId);
      row = {
        materialId: movement.materialId,
        materialDescription: material?.descricao || movement.materialDescricao,
        unit: material?.unidade || movement.unidade,
        branchId: branch.id,
        branchName: branch.name,
        received: 0,
        used: 0,
        remaining: 0,
        percent: null,
        linkedByText: 0,
      };
      grouped.set(key, row);
    }
    if (branch.byText) row.linkedByText += 1;
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
  })).sort((a, b) => a.branchName.localeCompare(b.branchName, 'pt-BR', { numeric: true }) || a.materialDescription.localeCompare(b.materialDescription, 'pt-BR'));
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
    // Uso sem entrada no ramo não entra no percentual: não há de onde tirar.
    const usedWithReceipt = group.rows.reduce((sum, row) => sum + (row.received > 0 ? row.used : 0), 0);
    const mixedUnits = units.size > 1;
    // Com unidades misturadas (metro de tubo e peça de madeira), o percentual
    // do ramo é a média dos percentuais de cada material, não a soma crua.
    const percents = group.rows.map(row => row.percent).filter((value): value is number => value !== null);
    const percent = mixedUnits
      ? (percents.length ? Number((percents.reduce((sum, value) => sum + value, 0) / percents.length).toFixed(1)) : null)
      : (received > 0 ? Number(((usedWithReceipt / received) * 100).toFixed(1)) : null);
    return { ...group, received: rounded(received), used: rounded(used), percent, mixedUnits };
  }).sort((a, b) => a.branchName.localeCompare(b.branchName, 'pt-BR', { numeric: true }));
};
