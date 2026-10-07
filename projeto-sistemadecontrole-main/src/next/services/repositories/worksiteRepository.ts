import type { Worksite } from '../../app/organizations/types';
import { cloudProvider, isSupabaseCloudEnabled } from '../../../platform/cloudProvider';
import { getSupabaseClient } from '../../../supabase/client';

const MOCK_WORKSITES: Worksite[] = [
  { id: 'obra-alto-tiete', organizationId: 'org-renea', name: 'Complexo do Alto Tietê' },
  { id: 'obra-serra', organizationId: 'org-renea', name: 'Rodovia da Serra' },
  { id: 'obra-duplicada', organizationId: 'org-renea', name: 'Duplicação BR-101' },
  { id: 'obra-demo', organizationId: 'org-demo', name: 'Obra Demonstração' },
];

export interface SupabaseProjectRow {
  id: string;
  organization_id: string;
  name: string;
}

export const normalizeSupabaseWorksites = (
  projects: readonly SupabaseProjectRow[],
  organizationId: string,
): Worksite[] => projects
  .filter(project => project.organization_id === organizationId && project.id && project.name)
  .map(project => ({
    id: project.id,
    organizationId: project.organization_id,
    name: project.name,
  }));

const loadSupabaseWorksites = async (organizationId: string): Promise<Worksite[]> => {
  const { data, error } = await getSupabaseClient()
    .from('projects')
    .select('id, organization_id, name')
    .eq('organization_id', organizationId)
    .order('name');
  if (error) throw error;
  return normalizeSupabaseWorksites((data || []) as SupabaseProjectRow[], organizationId);
};

export const getByOrganizationId = async (organizationId: string): Promise<Worksite[]> => {
  if (!isSupabaseCloudEnabled) return MOCK_WORKSITES.filter(item => item.organizationId === organizationId);
  try {
    return await loadSupabaseWorksites(organizationId);
  } catch (error) {
    if (cloudProvider === 'supabase') throw error;
    console.warn('Obras Supabase indisponíveis; usando catálogo local de homologação.', error);
    return MOCK_WORKSITES.filter(item => item.organizationId === organizationId);
  }
};
