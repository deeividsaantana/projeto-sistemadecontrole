import { useState, useRef, lazy, Suspense } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import type { PeriodValue } from '../../shared/ui';
import Level1_KPIs from './Level1_KPIs';
import Level2_Operational from './Level2_Operational';
import type {
  Empresa,
  ObraLocal,
  Equipamento,
  Funcionario,
  Comboio,
  TipoCombustivel,
  ProdutoLubrificacao,
  Abastecimento,
  Lubrificacao,
  HistoryLog,
  ListaPresenca,
  OrdemServico,
  RegistroProducao,
} from '../../types';

const Level3_Insights = lazy(() => import('./Level3_Insights'));

interface DashboardProps {
  empresas: Empresa[];
  obras: ObraLocal[];
  equipamentos: Equipamento[];
  funcionarios: Funcionario[];
  comboios: Comboio[];
  combustiveis: TipoCombustivel[];
  lubrificantes: ProdutoLubrificacao[];
  abastecimentos: Abastecimento[];
  lubrificacoes: Lubrificacao[];
  historyLogs: HistoryLog[];
  listasPresenca?: ListaPresenca[];
  ordensServico?: OrdemServico[];
  producao?: RegistroProducao[];
  periodo?: { from: string; to: string };
  onNavigate: (tab: string) => void;
}

export default function Dashboard(props: DashboardProps) {
  const [periodo, setPeriodo] = useState<PeriodValue>({
    preset: 'mes',
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const level2Ref = useRef<HTMLDivElement>(null);
  const level3Ref = useRef<HTMLDivElement>(null);

  // GSAP: Level2 appears after Level1
  useGSAP(
    () => {
      gsap.from(level2Ref.current, {
        opacity: 0,
        y: 30,
        duration: 0.5,
        delay: 0.6,
        ease: 'power2.out',
      });
    },
    { scope: containerRef }
  );

  // GSAP: Level3 appears last
  useGSAP(
    () => {
      gsap.from(level3Ref.current, {
        opacity: 0,
        y: 30,
        duration: 0.5,
        delay: 1.0,
        ease: 'power2.out',
      });
    },
    { scope: containerRef }
  );

  return (
    <div
      ref={containerRef}
      id="dashboard-tab"
      className="flex flex-col gap-8 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto"
    >
      {/* Nível 1: KPIs Estratégicos */}
      <Level1_KPIs
        obras={props.obras || []}
        equipamentos={props.equipamentos || []}
        producao={props.producao || []}
        periodo={periodo}
        onPeriodoChange={setPeriodo}
        onNavigate={props.onNavigate}
      />

      {/* Nível 2: Operacional Real-time */}
      <div ref={level2Ref} className="space-y-4">
        <h2 className="text-20px font-semibold text-[#101c18]">Operação em Tempo Real</h2>
        <Level2_Operational
          obras={props.obras || []}
          equipamentos={props.equipamentos || []}
          producao={props.producao || []}
          periodo={{ inicio: periodo.from, fim: periodo.to }}
        />
      </div>

      {/* Nível 3: Insights e Gráficos */}
      <div ref={level3Ref}>
        <Suspense fallback={<div className="h-64 bg-gray-100 rounded-lg animate-pulse" />}>
          <Level3_Insights
            producao={props.producao || []}
            periodo={{ inicio: periodo.from, fim: periodo.to }}
          />
        </Suspense>
      </div>
    </div>
  );
}
