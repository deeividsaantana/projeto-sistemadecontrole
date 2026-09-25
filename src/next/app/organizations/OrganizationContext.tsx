import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import type { Organization, UserRole, Worksite } from './types';
import { getUserOrganizations } from '../../services/repositories/organizationRepository';
import { getByOrganizationId } from '../../services/repositories/worksiteRepository';

const STORAGE_KEY_ACTIVE_ORG = 'obrix_active_organization_id';
// Usuário mockado — troca pelo usuário autenticado real quando o login do
// Obrix existir; nenhuma tela chama isso, só este contexto.
const MOCK_USER_ID = 'user-deivid';
const MOCK_USER_NAME = 'Deivid Santana';

interface OrganizationContextValue {
  isLoading: boolean;
  organizations: Organization[];
  activeOrganization: Organization | null;
  activeOrganizationId: string | null;
  setActiveOrganization: (organizationId: string) => void;
  clearActiveOrganization: () => void;
  worksites: Worksite[];
  activeWorksite: Worksite | null;
  activeWorksiteId: string | null;
  setActiveWorksite: (worksiteId: string) => void;
  userRole: UserRole | null;
  userName: string;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

export const OrganizationProvider = ({ children }: PropsWithChildren) => {
  const [isLoading, setIsLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null);
  const [worksites, setWorksites] = useState<Worksite[]>([]);
  const [activeWorksiteId, setActiveWorksiteId] = useState<string | null>(null);

  // Carrega as organizações do usuário e tenta restaurar a última ativa —
  // só se o usuário ainda tiver acesso a ela. Empresa removida ou perdida
  // volta pra tela de seleção, nunca fica presa num contexto inválido.
  useEffect(() => {
    let ativo = true;
    getUserOrganizations(MOCK_USER_ID).then(lista => {
      if (!ativo) return;
      setOrganizations(lista);
      const salvo = window.localStorage.getItem(STORAGE_KEY_ACTIVE_ORG);
      const restaurada = salvo && lista.some(item => item.id === salvo) ? salvo : null;
      const automatica = !restaurada && lista.length === 1 ? lista[0].id : null;
      setActiveOrganizationId(restaurada || automatica);
      setIsLoading(false);
    });
    return () => { ativo = false; };
  }, []);

  // Obra ativa depende da empresa ativa — troca de empresa sempre limpa e
  // recarrega, nunca herda a obra de uma organização diferente.
  useEffect(() => {
    if (!activeOrganizationId) {
      setWorksites([]);
      setActiveWorksiteId(null);
      return;
    }
    let ativo = true;
    getByOrganizationId(activeOrganizationId).then(lista => {
      if (!ativo) return;
      setWorksites(lista);
      setActiveWorksiteId(lista[0]?.id ?? null);
    });
    return () => { ativo = false; };
  }, [activeOrganizationId]);

  const setActiveOrganization = useCallback((organizationId: string) => {
    window.localStorage.setItem(STORAGE_KEY_ACTIVE_ORG, organizationId);
    setActiveOrganizationId(organizationId);
  }, []);

  const clearActiveOrganization = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY_ACTIVE_ORG);
    setActiveOrganizationId(null);
  }, []);

  const activeOrganization = useMemo(
    () => organizations.find(item => item.id === activeOrganizationId) ?? null,
    [organizations, activeOrganizationId],
  );
  const activeWorksite = useMemo(
    () => worksites.find(item => item.id === activeWorksiteId) ?? null,
    [worksites, activeWorksiteId],
  );

  const value: OrganizationContextValue = {
    isLoading,
    organizations,
    activeOrganization,
    activeOrganizationId,
    setActiveOrganization,
    clearActiveOrganization,
    worksites,
    activeWorksite,
    activeWorksiteId,
    setActiveWorksite: setActiveWorksiteId,
    userRole: activeOrganization?.userRole ?? null,
    userName: MOCK_USER_NAME,
  };

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
};

export const useActiveOrganization = (): OrganizationContextValue => {
  const context = useContext(OrganizationContext);
  if (!context) throw new Error('useActiveOrganization precisa estar dentro de <OrganizationProvider>.');
  return context;
};
