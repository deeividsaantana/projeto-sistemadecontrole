import { Truck, Wrench, Users, Package, ClipboardList, UserCheck } from 'lucide-react';
import { PageHeader } from '../../../components/ui/PageHeader';
import { MetricCard } from '../../../components/ui/MetricCard';
import { Card, CardHeader, CardBody } from '../../../components/ui/Card';
import { LoadingState, ErrorState } from '../../../components/ui/States';
import { MOCK_TENANT } from '../../../app/tenant';
import { useDashboardSummary } from '../hooks/useDashboardSummary';

export const DashboardPage = () => {
  const { data, isLoading, isError, refetch } = useDashboardSummary();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Olá, ${MOCK_TENANT.userName.split(' ')[0]}`}
        description={`${MOCK_TENANT.worksites.find(w => w.id === MOCK_TENANT.activeWorksiteId)?.name} · hoje`}
      />

      {isLoading && <LoadingState label="Carregando indicadores…" />}
      {isError && <ErrorState description="Não foi possível ler os indicadores locais." onRetry={() => refetch()} />}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard label="Equipamentos ativos" value={String(data.equipamentosAtivos)} icon={Truck} tone="brand" />
            <MetricCard label="Em manutenção" value={String(data.equipamentosEmManutencao)} icon={Wrench} />
            <MetricCard label="Colaboradores ativos" value={String(data.colaboradoresAtivos)} icon={Users} />
            <MetricCard label="Pendências" value={String(data.pendencias)} icon={ClipboardList} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Presença de hoje" description="Apontado nas listas de presença de hoje" />
              <CardBody className="flex items-center gap-6">
                <span className="grid size-12 place-items-center rounded-full bg-[var(--color-brand-50)] text-[var(--color-brand-600)]">
                  <UserCheck className="size-5" />
                </span>
                <div>
                  <p className="text-2xl font-black text-[var(--color-ink-primary)]">
                    {data.presencaHoje.presentes}
                    <span className="text-sm font-semibold text-[var(--color-ink-muted)]"> / {data.presencaHoje.total || '—'}</span>
                  </p>
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    {data.presencaHoje.total > 0 ? `${data.presencaHoje.ausentes} ausentes hoje` : 'Nenhuma lista de presença lançada hoje ainda'}
                  </p>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Materiais de hoje" description="Movimentações lançadas hoje" />
              <CardBody className="flex items-center gap-6">
                <span className="grid size-12 place-items-center rounded-full bg-[var(--color-brand-50)] text-[var(--color-brand-600)]">
                  <Package className="size-5" />
                </span>
                <div className="flex gap-6">
                  <div>
                    <p className="text-xl font-black text-[var(--color-ink-primary)]">{data.materiaisHoje.recebido}</p>
                    <p className="text-xs text-[var(--color-ink-muted)]">Recebido</p>
                  </div>
                  <div>
                    <p className="text-xl font-black text-[var(--color-ink-primary)]">{data.materiaisHoje.utilizado}</p>
                    <p className="text-xs text-[var(--color-ink-muted)]">Utilizado</p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
