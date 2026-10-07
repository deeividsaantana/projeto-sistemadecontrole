import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { resolveActiveScope, type ActiveScope, type OrganizationMembership } from './activeScope';

interface ActiveScopeProviderProps extends PropsWithChildren {
  organizationId: string | null;
  projectId: string | null;
  memberships: readonly OrganizationMembership[];
}

const ActiveScopeContext = createContext<ActiveScope | null>(null);

/**
 * Keeps URL selection separate from authorization. The provider only exposes
 * a scope when an authenticated membership explicitly grants that project.
 */
export function ActiveScopeProvider({ organizationId, projectId, memberships, children }: ActiveScopeProviderProps) {
  const scope = useMemo(
    () => organizationId && projectId
      ? resolveActiveScope(organizationId, projectId, memberships)
      : null,
    [organizationId, projectId, memberships],
  );

  return <ActiveScopeContext.Provider value={scope}>{children}</ActiveScopeContext.Provider>;
}

export function useActiveScope(): ActiveScope {
  const scope = useContext(ActiveScopeContext);
  if (!scope) throw new Error('Nenhum escopo autorizado está ativo.');
  return scope;
}

export function useOptionalActiveScope(): ActiveScope | null {
  return useContext(ActiveScopeContext);
}