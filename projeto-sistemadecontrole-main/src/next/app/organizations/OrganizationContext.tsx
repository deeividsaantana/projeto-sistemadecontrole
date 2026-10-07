import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import type { Organization, UserRole, Worksite } from './types';
import { getUserOrganizations } from '../../services/repositories/organizationRepository';
import { getByOrganizationId } from '../../services/repositories/worksiteRepository';
import { auth } from '../../../firebase';

const STORAGE_KEY_ACTIVE_ORG = 'obrix_active_organization_id';
const ORGANIZATION_LOAD_TIMEOUT_MS = 12_000;

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
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const userId = currentUser?.uid || '';
  const userName = currentUser?.displayName || currentUser?.email || 'Usuário RENEA';

  useEffect(() => onAuthStateChanged(auth, setCurrentUser), []);

  // Carrega as organizações do usuário e tenta restaurar a última ativa —
  // só se o usuário ainda tiver acesso a ela. Empresa removida ou perdida
  // volta pra tela de seleção, nunca fica presa num contexto inválido.
  useEffect(() => {
    let ativo = true;
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('ORGANIZATIONS_LOAD_TIMEOUT')), ORGANIZATION_LOAD_TIMEOUT_MS);
    });
    void Promise.race([getUserOrganizations(userId), timeout])
      .then(lista => {
        if (!ativo) return;
        setOrganizations(lista);
        const salvo = window.localStorage.getItem(STORAGE_KEY_ACTIVE_ORG);
        const restaurada = salvo && lista.some(item => item.id === salvo) ? salvo : null;
        const automatica = !restaurada && lista.length === 1 ? lista[0].id : null;
        setActiveOrganizationId(restaurada || automatica);
      })
      .catch(error => {
        if (!ativo) return;
        console.error('Não foi possível carregar as organizações.', error);
        setOrganizations([]);
        setActiveOrganizationId(null);
      })
      .finally(() => {
        if (ativo) setIsLoading(false);
      });
    return () => { ativo = false; };
  }, [userId]);

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
    userName,
  };

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
};

export const useActiveOrganization = (): OrganizationContextValue => {
  const context = useContext(OrganizationContext);
  if (!context) throw new Error('useActiveOrganization precisa estar dentro de <OrganizationProvider>.');
  return context;
};
