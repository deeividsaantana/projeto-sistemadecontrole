export const findDuplicateGroups = <T,>(
  items: readonly T[],
  operationalKey: (item: T) => string | undefined,
): ReadonlyMap<string, T[]> => {
  const groups = new Map<string, T[]>();
  items.forEach(item => {
    const key = operationalKey(item);
    if (!key) return;
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  });
  return groups;
};

export const countDuplicates = <T,>(
  items: readonly T[],
  operationalKey: (item: T) => string | undefined,
): number => {
  let total = 0;
  findDuplicateGroups(items, operationalKey).forEach(group => {
    if (group.length > 1) total += group.length;
  });
  return total;
};

export const isDuplicateOfExisting = <T,>(
  candidate: T,
  existing: readonly T[],
  operationalKey: (item: T) => string | undefined,
): boolean => {
  const key = operationalKey(candidate);
  if (!key) return false;
  return existing.some(item => operationalKey(item) === key);
};
