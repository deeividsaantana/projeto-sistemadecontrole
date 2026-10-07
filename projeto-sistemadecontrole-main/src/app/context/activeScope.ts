import { parsePrivatePath } from '../routing/privateRoutes';

/** Identity asserted by an authenticated membership source, never inferred from URL or labels. */
export interface OrganizationMembership {
  organizationId: string;
  role: string;
  projectIds: readonly string[];
}

export interface ActiveScope {
  organizationId: string;
  projectId: string;
  role: string;
}

export const resolveActiveScope = (
  organizationId: string,
  projectId: string,
  memberships: readonly OrganizationMembership[],
): ActiveScope | null => {
  const membership = memberships.find(item => item.organizationId === organizationId && item.projectIds.includes(projectId));
  if (!membership || !membership.role) return null;
  return { organizationId, projectId, role: membership.role };
};

export const resolveScopeForPath = (
  pathname: string,
  memberships: readonly OrganizationMembership[],
): ActiveScope | null => {
  const route = parsePrivatePath(pathname);
  return route ? resolveActiveScope(route.organizationId, route.projectId, memberships) : null;
};
