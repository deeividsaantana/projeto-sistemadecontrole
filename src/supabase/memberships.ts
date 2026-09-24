import type { OrganizationMembership } from '../app/context/activeScope';
import { getSupabaseClient } from './client';

export interface MembershipRow {
  organization_id: string;
  role: string;
}

export interface ProjectRow {
  id: string;
  organization_id: string;
}

export const normalizeMembershipRows = (
  memberships: readonly MembershipRow[],
  projects: readonly ProjectRow[],
): OrganizationMembership[] => memberships
  .filter(row => Boolean(row.organization_id && row.role))
  .map(row => ({
    organizationId: row.organization_id,
    role: row.role,
    projectIds: projects
      .filter(project => project.organization_id === row.organization_id && project.id)
      .map(project => project.id),
  }));

export const loadSupabaseMemberships = async (): Promise<OrganizationMembership[]> => {
  const client = getSupabaseClient();
  const { data: userResult, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  if (!userResult.user) return [];

  const [{ data: memberships, error: membershipsError }, { data: projects, error: projectsError }] = await Promise.all([
    client
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', userResult.user.id),
    client
      .from('projects')
      .select('id, organization_id'),
  ]);
  if (membershipsError) throw membershipsError;
  if (projectsError) throw projectsError;

  return normalizeMembershipRows(
    (memberships || []) as MembershipRow[],
    (projects || []) as ProjectRow[],
  );
};