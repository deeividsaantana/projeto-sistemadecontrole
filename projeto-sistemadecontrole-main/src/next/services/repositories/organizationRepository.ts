import type { Organization } from '../../app/organizations/types';
import { cloudProvider, isSupabaseCloudEnabled } from '../../../platform/cloudProvider';
import { getSupabaseClient } from '../../../supabase/client';

/**
 * Mock centralizado — único lugar que sabe quais organizações existem.
 * Trocar por uma chamada real ao Supabase (organizations + organization_members)
 * não muda quem chama isso, só o corpo destas duas funções.
 */
const MOCK_ORGANIZATIONS: Organization[] = [
  { id: 'org-renea', name: 'RENEA Infraestrutura', slug: 'renea', plan: 'Profissional', status: 'active', userRole: 'admin', worksitesCount: 3 },
  { id: 'org-demo', name: 'Empresa Demo', slug: 'demo', plan: 'Teste', status: 'trial', userRole: 'owner', worksitesCount: 1 },
];

export interface SupabaseOrganizationRow {
  id: string;
  name: string;
}

export interface SupabaseOrganizationMembershipRow {
  organization_id: string;
  role: string;
}

export interface SupabaseProjectOrganizationRow {
  organization_id: string;
}

const normalizeRole = (role: string): Organization['userRole'] => {
  if (role === 'admin') return 'admin';
  if (role === 'editor') return 'engenheiro';
  return 'visualizador';
};

export const normalizeSupabaseOrganizations = (
  organizations: readonly SupabaseOrganizationRow[],
  memberships: readonly SupabaseOrganizationMembershipRow[],
  projects: readonly SupabaseProjectOrganizationRow[],
): Organization[] => {
  const membershipByOrganization = new Map(
    memberships.map(membership => [membership.organization_id, membership]),
  );
  const projectCountByOrganization = new Map<string, number>();
  for (const project of projects) {
    projectCountByOrganization.set(
      project.organization_id,
      (projectCountByOrganization.get(project.organization_id) || 0) + 1,
    );
  }

  return organizations.flatMap(organization => {
    const membership = membershipByOrganization.get(organization.id);
    if (!membership) return [];
    return [{
      id: organization.id,
      name: organization.name,
      slug: organization.id,
      plan: 'Profissional',
      status: 'active',
      userRole: normalizeRole(membership.role),
      worksitesCount: projectCountByOrganization.get(organization.id) || 0,
    }];
  });
};

const loadSupabaseOrganizations = async (): Promise<Organization[]> => {
  const client = getSupabaseClient();
  const { data: userResult, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userResult.user) return [];

  const { data: memberships, error: membershipsError } = await client
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', userResult.user.id);
  if (membershipsError) throw membershipsError;

  const organizationIds = ((memberships || []) as SupabaseOrganizationMembershipRow[])
    .map(membership => membership.organization_id)
    .filter(Boolean);
  if (organizationIds.length === 0) return [];

  const [{ data: organizations, error: organizationsError }, { data: projects, error: projectsError }] = await Promise.all([
    client.from('organizations').select('id, name').in('id', organizationIds),
    client.from('projects').select('organization_id').in('organization_id', organizationIds),
  ]);
  if (organizationsError) throw organizationsError;
  if (projectsError) throw projectsError;

  return normalizeSupabaseOrganizations(
    (organizations || []) as SupabaseOrganizationRow[],
    (memberships || []) as SupabaseOrganizationMembershipRow[],
    (projects || []) as SupabaseProjectOrganizationRow[],
  );
};

export const getUserOrganizations = async (_userId: string): Promise<Organization[]> => {
  if (!isSupabaseCloudEnabled) return MOCK_ORGANIZATIONS;
  try {
    return await loadSupabaseOrganizations();
  } catch (error) {
    if (cloudProvider === 'supabase') throw error;
    console.warn('Organizações Supabase indisponíveis; usando catálogo local de homologação.', error);
    return MOCK_ORGANIZATIONS;
  }
};

export const getOrganizationById = async (id: string): Promise<Organization | null> =>
  (await getUserOrganizations('')).find(item => item.id === id) ?? null;
