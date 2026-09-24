import type { Material, MovimentoMaterial } from '../../types';

/** Pure collection updates; persistence and audit stay in the cloud adapter. */
export const saveMaterial = (current: readonly Material[], item: Material, isNew: boolean): Material[] =>
  isNew ? [item, ...current] : current.map(existing => existing.id === item.id ? item : existing);

export const appendMovement = (current: readonly MovimentoMaterial[], item: MovimentoMaterial): MovimentoMaterial[] =>
  [item, ...current];

export const applyMaterialImport = (
  currentMaterials: readonly Material[],
  currentMovements: readonly MovimentoMaterial[],
  newMaterials: readonly Material[],
  newMovements: readonly MovimentoMaterial[],
) => {
  const materialIds = new Set(currentMaterials.map(item => item.id));
  const movementIds = new Set(currentMovements.map(item => item.id));
  const addedMaterials = newMaterials.filter(item => {
    if (materialIds.has(item.id)) return false;
    materialIds.add(item.id);
    return true;
  });
  const addedMovements = newMovements.filter(item => {
    if (movementIds.has(item.id)) return false;
    movementIds.add(item.id);
    return true;
  });
  return {
    materials: [...addedMaterials, ...currentMaterials],
    movements: [...addedMovements, ...currentMovements],
    addedMaterials: addedMaterials.length,
    addedMovements: addedMovements.length,
  };
};
