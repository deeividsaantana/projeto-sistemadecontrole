import type { Worksite } from '../../app/organizations/types';

const MOCK_WORKSITES: Worksite[] = [
  { id: 'obra-alto-tiete', organizationId: 'org-renea', name: 'Complexo do Alto Tietê' },
  { id: 'obra-serra', organizationId: 'org-renea', name: 'Rodovia da Serra' },
  { id: 'obra-duplicada', organizationId: 'org-renea', name: 'Duplicação BR-101' },
  { id: 'obra-demo', organizationId: 'org-demo', name: 'Obra Demonstração' },
];

export const getByOrganizationId = async (organizationId: string): Promise<Worksite[]> =>
  MOCK_WORKSITES.filter(item => item.organizationId === organizationId);
