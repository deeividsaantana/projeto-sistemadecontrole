import type { Worksite } from '../../app/organizations/types';
import { getSupabaseClient } from '../../../supabase/client';

export const getByOrganizationId = async (organizationId: string): Promise<Worksite[]> => {
  const { data, error } = await getSupabaseClient()
    .from('projects')
    .select('id, organization_id, name')
    .eq('organization_id', organizationId)
    .order('name');
  if (error) throw error;
  return (data || []).map(project => ({
    id: project.id,
    organizationId: project.organization_id,
    name: project.name,
  }));
};
