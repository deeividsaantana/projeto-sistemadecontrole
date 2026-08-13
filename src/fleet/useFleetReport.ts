import { useMemo, useState } from 'react';
import type { FleetDataContext, FleetReportFilters } from './domain';
import { createEmptyFleetFilters } from './domain';
import { createFleetReportViewModel } from './reportService';
import { getOperationalToday } from './time';

export interface UseFleetReportResult {
  filters: FleetReportFilters;
  setFilters: React.Dispatch<React.SetStateAction<FleetReportFilters>>;
  updateFilter: <K extends keyof FleetReportFilters>(
    key: K,
    value: FleetReportFilters[K],
  ) => void;
  clearFilters: () => void;
  activeFilterCount: number;
  viewModel: ReturnType<typeof createFleetReportViewModel>;
}

const countActiveFilters = (filters: FleetReportFilters): number => [
  filters.companyId !== 'Todos',
  filters.status !== 'Todos',
  Boolean(filters.prefix),
  Boolean(filters.driver),
  Boolean(filters.search),
].filter(Boolean).length;

export const useFleetReport = (
  context: FleetDataContext,
  initialDate = getOperationalToday(),
): UseFleetReportResult => {
  const [filters, setFilters] = useState<FleetReportFilters>(
    () => createEmptyFleetFilters(initialDate),
  );
  const viewModel = useMemo(
    () => createFleetReportViewModel(context, filters),
    [context, filters],
  );
  const updateFilter = <K extends keyof FleetReportFilters>(
    key: K,
    value: FleetReportFilters[K],
  ) => setFilters(current => ({ ...current, [key]: value }));
  const clearFilters = () => setFilters(current => ({
    ...createEmptyFleetFilters(current.date),
  }));
  return {
    filters,
    setFilters,
    updateFilter,
    clearFilters,
    activeFilterCount: countActiveFilters(filters),
    viewModel,
  };
};
