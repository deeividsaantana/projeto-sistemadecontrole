import type { Organization } from '../../app/organizations/types';

/**
 * Mock centralizado — único lugar que sabe quais organizações existem.
 * Trocar por uma chamada real ao Supabase (organizations + organization_members)
 * não muda quem chama isso, só o corpo destas duas funções.
 */
const MOCK_ORGANIZATIONS: Organization[] = [
  { id: 'org-renea', name: 'RENEA Infraestrutura', slug: 'renea', plan: 'Profissional', status: 'active', userRole: 'admin', worksitesCount: 3 },
  { id: 'org-demo', name: 'Empresa Demo', slug: 'demo', plan: 'Teste', status: 'trial', userRole: 'owner', worksitesCount: 1 },
];

export const getUserOrganizations = async (_userId: string): Promise<Organization[]> => MOCK_ORGANIZATIONS;

export const getOrganizationById = async (id: string): Promise<Organization | null> =>
  MOCK_ORGANIZATIONS.find(item => item.id === id) ?? null;
