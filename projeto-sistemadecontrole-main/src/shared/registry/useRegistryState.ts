import { useMemo, useState } from 'react';
import type { RegistryConfig } from './registryTypes';
import { countDuplicates } from './duplicateDetection';

export const computeRegistryView = <T extends { id: string }>(
  items: readonly T[],
  config: RegistryConfig<T>,
  search: string,
  selectFilters: Readonly<Record<string, string>>,
  page: number,
  pageSize: number,
) => {
  const scoped = config.subFilter ? items.filter(config.subFilter) : [...items];

  const term = search.trim().toLowerCase();
  const filtered = scoped.filter(item => {
    for (const fieldKey of Object.keys(selectFilters)) {
      const value = selectFilters[fieldKey];
      if (!value || value === 'todos') continue;
      if (String((item as Record<string, unknown>)[fieldKey] ?? '') !== value) return false;
    }
    if (!term) return true;
    return config.fields.some(field =>
      field.searchable && String((item as Record<string, unknown>)[field.key] ?? '').toLowerCase().includes(term));
  });

  const duplicateCount = countDuplicates(scoped, config.operationalKey);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  return { scoped, filtered, paged, totalPages, duplicateCount };
};

const PAGE_SIZE = 50;

export const useRegistryState = <T extends { id: string }>(items: readonly T[], config: RegistryConfig<T>) => {
  const [search, setSearch] = useState('');
  const [selectFilters, setSelectFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);

  const view = useMemo(
    () => computeRegistryView(items, config, search, selectFilters, page, PAGE_SIZE),
    [items, config, search, selectFilters, page],
  );

  return { ...view, search, setSearch, selectFilters, setSelectFilters, page, setPage };
};
