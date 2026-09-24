import { useMemo, Suspense } from 'react';
import { calculateLevel2 } from '../../utils/dashboardMetrics';
import { DataTable, type DataTableColumn } from '../../shared/ui';
import type { ObraLocal, Equipamento, RegistroProducao } from '../../types';
import type { DashboardLevel2Obra } from '../../types/dashboard';

interface Level2Props {
  obras: ObraLocal[];
  equipamentos: Equipamento[];
  producao: RegistroProducao[];
  periodo: { inicio: string; fim: string };
}

export default function Level2_Operational(props: Level2Props) {
  const level2 = useMemo(
    () => calculateLevel2(props.obras, props.equipamentos, props.producao, props.periodo),
    [props.obras, props.equipamentos, props.producao, props.periodo]
  );

  const obraColumns: readonly DataTableColumn<DashboardLevel2Obra>[] = useMemo(
    () => [
      {
        id: 'nome',
        label: 'Obra',
        cell: (row) => <span className="font-medium text-14px">{row.nome}</span>,
        sortValue: (row) => row.nome,
      },
      {
        id: 'status',
        label: 'Status',
        cell: (row) => (
          <span
            className={`inline-flex rounded-full px-2 py-1 text-11px font-semibold ${
              row.status === 'Ativa'
                ? 'bg-green-100 text-green-800'
                : row.status === 'Pausada'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
            }`}
          >
            {row.status}
          </span>
        ),
      },
      {
        id: 'producaoHoje',
        label: 'Produção Hoje',
        cell: (row) => <span className="text-14px">{row.producaoHoje.toFixed(1)} m³</span>,
        sortValue: (row) => row.producaoHoje,
      },
      {
        id: 'progresso',
        label: 'Progresso',
        cell: (row) => (
          <div className="flex items-center gap-2">
            <div className="h-2 w-32 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-green-500" style={{ width: row.progresso + '%' }} />
            </div>
            <span className="text-11px text-[#8a969b]">{Math.round(row.progresso)}%</span>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <Suspense fallback={<div className="h-32 bg-gray-100 rounded-lg animate-pulse" />}>
      <div className="rounded-lg border border-[#dce3df] bg-white overflow-hidden">
        <DataTable
          rows={level2.obras}
          columns={obraColumns}
          getRowId={(row) => row.id}
          caption="Obras em operação"
        />
      </div>
    </Suspense>
  );
}
