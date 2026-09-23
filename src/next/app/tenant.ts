/**
 * Contexto multi-tenant do novo frontend: organização e obra ativas, e papel
 * do usuário. Mockado nesta fase (uma organização, algumas obras fixas),
 * mas com a mesma assinatura que vai receber dados reais do Supabase depois
 * — nenhuma tela chama isso diretamente, sempre via useActiveTenant().
 *
 * RENEA é uma organização/tenant (a empresa cliente), não o produto — o
 * produto é PRODUCT_NAME (./constants/brand.ts). Outra organização cliente
 * do SaaS vira só outra linha aqui, nunca outro fork do código.
 */
export type UserRole = 'owner' | 'admin' | 'gerente' | 'engenheiro' | 'encarregado' | 'apontador' | 'visualizador';

export interface Worksite {
  id: string;
  name: string;
}

export interface TenantContextValue {
  organizationId: string;
  organizationName: string;
  worksites: Worksite[];
  activeWorksiteId: string;
  userRole: UserRole;
  userName: string;
}

export const MOCK_TENANT: TenantContextValue = {
  organizationId: 'renea',
  organizationName: 'RENEA Infraestrutura',
  worksites: [
    { id: 'obra-alto-tiete', name: 'Complexo do Alto Tietê' },
    { id: 'obra-serra', name: 'Rodovia da Serra' },
  ],
  activeWorksiteId: 'obra-alto-tiete',
  userRole: 'admin',
  userName: 'Deivid Santana',
};
