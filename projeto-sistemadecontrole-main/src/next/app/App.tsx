import { AppShell } from '../layouts/AppShell';
import { useRoute } from './useRoute';
import { resolveRoute } from './routes';
import { useActiveOrganization } from './organizations/OrganizationContext';
import { SelectOrganizationPage } from '../modules/organization-select/pages/SelectOrganizationPage';
import { LoadingState } from '../components/ui/States';

// Regra principal do SaaS: nenhuma tela operacional roda sem empresa ativa.
// Sem organização selecionada, a única coisa alcançável é a seleção —
// mesmo digitando outro caminho na URL.
export const NextApp = () => {
  const { path, navigate } = useRoute();
  const { isLoading, activeOrganization } = useActiveOrganization();

  if (isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[var(--color-surface-canvas)]">
        <LoadingState label="Carregando…" />
      </div>
    );
  }

  if (!activeOrganization) {
    return <SelectOrganizationPage />;
  }

  return (
    <AppShell currentPath={path} onNavigate={navigate}>
      {resolveRoute(path)}
    </AppShell>
  );
};
