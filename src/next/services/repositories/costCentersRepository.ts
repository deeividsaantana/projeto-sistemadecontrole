import { cloudProvider, isSupabaseCloudEnabled } from '../../../platform/cloudProvider';
import { getSupabaseClient } from '../../../supabase/client';

export interface CostCenter {
  id: string;
  projectId: string;
  name: string;
  code?: string;
}

export interface SupabaseCostCenterRow {
  id: string;
  project_id: string;
  name: string;
  code: string | null;
}

export const normalizeSupabaseCostCenters = (
  rows: readonly SupabaseCostCenterRow[],
  projectId: string,
): CostCenter[] => rows
  .filter(row => row.project_id === projectId && row.id && row.name)
  .map(row => ({
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    code: row.code || undefined,
  }));

const loadSupabaseCostCenters = async (projectId: string): Promise<CostCenter[]> => {
  const { data, error } = await getSupabaseClient()
    .from('cost_centers')
    .select('id, project_id, name, code')
    .eq('project_id', projectId)
    .order('name');
  if (error) throw error;
  return normalizeSupabaseCostCenters((data || []) as SupabaseCostCenterRow[], projectId);
};

export const getCostCentersByProject = async (projectId: string): Promise<CostCenter[]> => {
  if (!isSupabaseCloudEnabled) return [];
  try {
    return await loadSupabaseCostCenters(projectId);
  } catch (error) {
    if (cloudProvider === 'supabase') throw error;
    console.warn('Centros de custo Supabase indisponíveis; nenhum catálogo local foi aplicado.', error);
    return [];
  }
};
