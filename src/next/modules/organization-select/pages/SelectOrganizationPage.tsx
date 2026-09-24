import { Building2, ChevronRight } from 'lucide-react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { LoadingState } from '../../../components/ui/States';
import { PRODUCT_NAME } from '../../../constants/brand';
import { useActiveOrganization } from '../../../app/organizations/OrganizationContext';
import type { Organization } from '../../../app/organizations/types';

const STATUS_LABEL: Record<Organization['status'], { label: string; tone: 'success' | 'warning' | 'critical' }> = {
  active: { label: 'Ativa', tone: 'success' },
  trial: { label: 'Teste', tone: 'warning' },
  suspended: { label: 'Suspensa', tone: 'critical' },
};

export const SelectOrganizationPage = () => {
  const { isLoading, organizations, setActiveOrganization } = useActiveOrganization();

  if (isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-[var(--color-surface-canvas)]">
        <LoadingState label="Carregando suas empresas…" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[var(--color-surface-canvas)] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-[var(--radius-md)] bg-[var(--color-brand-500)] text-sm font-black text-white">
            {PRODUCT_NAME.charAt(0)}
          </span>
          <span className="text-sm font-black tracking-tight text-[var(--color-ink-primary)]">{PRODUCT_NAME}</span>
        </div>

        <h1 className="text-2xl font-black tracking-tight text-[var(--color-ink-primary)]">Escolha uma empresa</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-secondary)]">Você tem acesso a {organizations.length} organizaç{organizations.length === 1 ? 'ão' : 'ões'}.</p>

        <div className="mt-6 flex flex-col gap-3">
          {organizations.map(organization => {
            const status = STATUS_LABEL[organization.status];
            return (
              <Card key={organization.id} className="p-0">
                <button
                  type="button"
                  onClick={() => setActiveOrganization(organization.id)}
                  className="flex w-full items-center gap-4 rounded-[var(--radius-lg)] p-4 text-left transition hover:bg-[var(--color-surface-sunken)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-300)]"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--color-brand-50)] text-[var(--color-brand-600)]">
                    <Building2 className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-[var(--color-ink-primary)]">{organization.name}</span>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </span>
                    <span className="mt-1 block text-xs text-[var(--color-ink-muted)]">
                      Plano {organization.plan} · {organization.worksitesCount} obra{organization.worksitesCount === 1 ? '' : 's'} · seu papel: {organization.userRole}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-sm font-bold text-[var(--color-brand-600)]">
                    Acessar
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </span>
                </button>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};
