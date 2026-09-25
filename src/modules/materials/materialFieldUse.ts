import type { MovimentoMaterial } from '../../types';

/** Um item apontado: material e quantidade já na unidade do cadastro (metro, peça). */
export interface MaterialUseItem {
  materialId: string;
  materialDescricao: string;
  unidade: string;
  quantidade: number;
}

/** Envio do link do apontador, guardado na fila pública até o ERP incorporar. */
export interface MaterialUseSubmission {
  id: string;
  createdAtIso: string;
  payload: {
    data: string;
    etapaServicoId: string;
    etapaServicoNome: string;
    apontador: string;
    itens: MaterialUseItem[];
    observacao?: string;
    /** Caminhos no Storage das fotos tiradas no link. */
    fotos?: string[];
  };
}

export const materialUseMovementId = (submissionId: string, index: number) => `uso-link-${submissionId}-${index + 1}`;

/**
 * Cada item vira uma saída de consumo vinculada ao ramo. O ID nasce do envio,
 * então incorporar a mesma fila duas vezes (dois computadores abertos, queda
 * no meio) nunca soma o uso em dobro.
 */
export const movementsFromMaterialUse = (submission: MaterialUseSubmission): MovimentoMaterial[] =>
  submission.payload.itens
    .filter(item => item.materialId && Number(item.quantidade) > 0)
    .map((item, index) => ({
      id: materialUseMovementId(submission.id, index),
      data: submission.payload.data,
      tipo: 'Saída' as const,
      finalidade: 'Consumo' as const,
      materialId: item.materialId,
      materialDescricao: item.materialDescricao,
      quantidade: Number(item.quantidade),
      unidade: item.unidade,
      etapaServicoId: submission.payload.etapaServicoId,
      etapaServicoNome: submission.payload.etapaServicoNome,
      destino: submission.payload.etapaServicoNome,
      origemApontamentoId: submission.id,
      apontadoPor: submission.payload.apontador,
      responsavel: submission.payload.apontador || 'Link do apontador',
      observacao: submission.payload.observacao || undefined,
      fotos: submission.payload.fotos?.length ? [...submission.payload.fotos] : undefined,
      criadoEm: submission.createdAtIso || new Date().toISOString(),
    }));

/** Junta sem duplicar e sem mexer no que já existe (inclusive o que foi desfeito). */
export const mergeMaterialUseMovements = (current: readonly MovimentoMaterial[], incoming: readonly MovimentoMaterial[]) => {
  const known = new Set(current.map(item => item.id));
  const added = incoming.filter(item => {
    if (known.has(item.id)) return false;
    known.add(item.id);
    return true;
  });
  return { movements: added.length ? [...added, ...current] : [...current], added: added.length };
};

/** Desfaz um lançamento de uso mantendo o registro para a auditoria. */
export const cancelMaterialMovement = (movement: MovimentoMaterial, by: string, nowIso = new Date().toISOString()): MovimentoMaterial =>
  movement.canceladoEm ? movement : { ...movement, canceladoEm: nowIso, canceladoPor: by };

/**
 * Entradas antigas guardaram o ramo só como texto ("Ramo 1400"). Vincular é
 * decisão de quem confere; aqui só se agrupa o que falta vincular e se sugere o
 * ramo cujo nome é igual, sem acento nem caixa.
 */
export interface UnlinkedDestination {
  destino: string;
  movementIds: string[];
  suggestedBranchId?: string;
}

const comparable = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

export const unlinkedReceiptDestinations = (
  movements: readonly MovimentoMaterial[],
  branches: ReadonlyArray<{ id: string; nome: string }>,
): UnlinkedDestination[] => {
  const groups = new Map<string, UnlinkedDestination>();
  for (const movement of movements) {
    if (movement.tipo !== 'Entrada' || movement.etapaServicoId || movement.canceladoEm) continue;
    const destino = (movement.destino || '').trim();
    if (!destino) continue;
    const key = comparable(destino);
    let group = groups.get(key);
    if (!group) {
      group = { destino, movementIds: [], suggestedBranchId: branches.find(branch => comparable(branch.nome) === key)?.id };
      groups.set(key, group);
    }
    group.movementIds.push(movement.id);
  }
  return [...groups.values()].sort((a, b) => b.movementIds.length - a.movementIds.length || a.destino.localeCompare(b.destino, 'pt-BR'));
};

export const linkMovementsToBranch = (
  movements: readonly MovimentoMaterial[],
  ids: ReadonlySet<string>,
  branch: { id: string; nome: string },
): MovimentoMaterial[] => movements
  .filter(item => ids.has(item.id) && !item.etapaServicoId)
  .map(item => ({ ...item, etapaServicoId: branch.id, etapaServicoNome: branch.nome }));
