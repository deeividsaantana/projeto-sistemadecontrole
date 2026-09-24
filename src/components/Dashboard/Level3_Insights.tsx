import { useMemo, Suspense } from 'react';
import { calculateLevel3 } from '../../utils/dashboardMetrics';
import type { RegistroProducao } from '../../types';

interface Level3Props {
  producao: RegistroProducao[];
  periodo: { inicio: string; fim: string };
}

export default function Level3_Insights(props: Level3Props) {
  const level3 = useMemo(
    () => calculateLevel3(props.producao, props.periodo),
    [props.producao, props.periodo]
  );

  return (
    <Suspense fallback={<div className="h-64 bg-gray-100 rounded-lg animate-pulse" />}>
      <div className="space-y-6">
        <h3 className="text-20px font-semibold text-[#101c18]">Tendências e Insights</h3>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-[#dce3df] bg-white p-6">
            <h4 className="mb-4 text-14px font-semibold text-[#172329]">Produção por Dia</h4>
            <div className="h-48 bg-gray-50 rounded flex items-center justify-center text-[#718087]">
              Gráfico: {level3.graficos.producaoTrend.data.length} dias
            </div>
          </div>

          <div className="rounded-lg border border-[#dce3df] bg-white p-6">
            <h4 className="mb-4 text-14px font-semibold text-[#172329]">Eficiência Média</h4>
            <div className="h-48 bg-gray-50 rounded flex items-center justify-center text-[#718087]">
              Gráfico: Trending
            </div>
          </div>
        </div>
      </div>
    </Suspense>
  );
}
