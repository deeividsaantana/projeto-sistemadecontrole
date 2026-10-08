import type { Organization, UserRole } from '../../app/organizations/types';
import { getSupabaseClient } from '../../../supabase/client';

const normalizeRole = (role: string): UserRole => {
  if (role === 'admin') return 'admin';
  if (role === 'editor') return 'engenheiro';
  return 'visualizador';
};

export const getUserOrganizations = async (_userId: string): Promise<Organization[]> => {
  const client = getSupabaseClient();
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) return [];

  const { data: memberships, error: membershipError } = await client
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', authData.user.id);
  if (membershipError) throw membershipError;

  const ids = (memberships || []).map(row => row.organization_id).filter(Boolean);
  if (ids.length === 0) return [];
  const { data: organizations, error: organizationError } = await client
    .from('organizations')
    .select('id, name')
    .in('id', ids);
  if (organizationError) throw organizationError;

  return (organizations || []).map(organization => ({
    id: organization.id,
    name: organization.name,
    slug: organization.id,
    plan: 'Profissional',
    status: 'active',
    userRole: normalizeRole(memberships.find(row => row.organization_id === organization.id)?.role || 'viewer'),
    worksitesCount: 0,
  }));
};

export const getOrganizationById = async (id: string): Promise<Organization | null> => {
  const organizations = await getUserOrganizations(id);
  return organizations.find(item => item.id === id) ?? null;
};
