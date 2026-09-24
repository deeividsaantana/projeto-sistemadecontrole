export type ImportMergeResult<T> = {
  next: T[];
  created: number;
  updated: number;
  unchanged: number;
  duplicated: number;
};

const comparableRecord = <T extends { id: string }>(item: T) => {
  const { id: _id, criadoEm: _created, atualizadoEm: _updated, ...value } = item as T & {
    criadoEm?: string;
    atualizadoEm?: string;
  };
  return JSON.stringify(value);
};

export const mergeImportedRecords = <T extends { id: string }>(
  current: T[],
  incoming: T[],
  getKey: (item: T) => string,
  mergeExisting?: (saved: T, imported: T) => T,
): ImportMergeResult<T> => {
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let duplicated = 0;
  const next = [...current];
  const processedKeys = new Set<string>();

  incoming.forEach(item => {
    const key = getKey(item);
    if (key && processedKeys.has(key)) {
      duplicated += 1;
      return;
    }
    if (key) processedKeys.add(key);
    const index = key ? next.findIndex(existing => getKey(existing) === key) : -1;
    if (index < 0) {
      next.push(item);
      created += 1;
      return;
    }
    const candidate = mergeExisting ? mergeExisting(next[index], item) : item;
    if (comparableRecord(next[index]) === comparableRecord(candidate)) {
      unchanged += 1;
      return;
    }
    next[index] = { ...candidate, id: next[index].id };
    updated += 1;
  });

  return { next, created, updated, unchanged, duplicated };
};
