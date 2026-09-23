import type { EtapaServico, Material, MovimentoMaterial } from '../types';

/**
 * Utilização de material por ramo/trecho: recebido (Entrada), utilizado
 * (Saída) e o saldo/percentual derivados — nunca guardados, sempre somados
 * dos movimentos, no mesmo espírito de src/utils/estoque.ts. Movimentos sem
 * ramoId não entram aqui (não têm um ramo pra agrupar); aparecem normalmente
 * nas outras visões de Materiais.
 */
export interface UtilizacaoPorRamoRow {
  materialId: string;
  materialDescricao: string;
  unidade: string;
  ramoId: string;
  ramoNome: string;
  recebido: number;
  utilizado: number;
  saldo: number;
  /** null quando nada foi recebido ainda — percentual não faz sentido sobre zero. */
  percentualUtilizacao: number | null;
}

const asNumber = (value: number | undefined): number => (Number.isFinite(value) ? Number(value) : 0);

export function buildUtilizacaoPorRamo(
  materiais: Material[],
  movimentos: MovimentoMaterial[],
  ramos: EtapaServico[],
): UtilizacaoPorRamoRow[] {
  const materialById = new Map(materiais.map(item => [item.id, item]));
  const ramoById = new Map(ramos.map(item => [item.id, item]));
  const rows = new Map<string, UtilizacaoPorRamoRow>();

  for (const movimento of movimentos) {
    if (!movimento.ramoId) continue;
    if (movimento.tipo !== 'Entrada' && movimento.tipo !== 'Saída') continue;

    const key = `${movimento.materialId}|${movimento.ramoId}`;
    const existing = rows.get(key);
    const material = materialById.get(movimento.materialId);
    const ramo = ramoById.get(movimento.ramoId);
    const row = existing ?? {
      materialId: movimento.materialId,
      materialDescricao: material?.descricao || movimento.materialDescricao,
      unidade: material?.unidade || movimento.unidade,
      ramoId: movimento.ramoId,
      ramoNome: ramo?.nome || 'Ramo removido',
      recebido: 0,
      utilizado: 0,
      saldo: 0,
      percentualUtilizacao: null,
    };

    const quantidade = Math.abs(asNumber(movimento.quantidade));
    if (movimento.tipo === 'Entrada') row.recebido += quantidade;
    else row.utilizado += quantidade;

    rows.set(key, row);
  }

  return [...rows.values()]
    .map(row => ({
      ...row,
      saldo: row.recebido - row.utilizado,
      percentualUtilizacao: row.recebido > 0 ? (row.utilizado / row.recebido) * 100 : null,
    }))
    .sort((a, b) => a.materialDescricao.localeCompare(b.materialDescricao, 'pt-BR') || a.ramoNome.localeCompare(b.ramoNome, 'pt-BR'));
}
