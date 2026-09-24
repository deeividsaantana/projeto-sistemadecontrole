export type UserRole = 'owner' | 'admin' | 'gerente' | 'engenheiro' | 'encarregado' | 'apontador' | 'visualizador';

export type OrganizationStatus = 'active' | 'trial' | 'suspended';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: OrganizationStatus;
  /** Papel deste usuário NESTA organização — o mesmo usuário pode ter
   *  papéis diferentes em organizações diferentes. */
  userRole: UserRole;
  worksitesCount: number;
}

export interface Worksite {
  id: string;
  organizationId: string;
  name: string;
}
