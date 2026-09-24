import { useMemo, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Plus } from 'lucide-react';
import { PageHeader, PeriodFilter, type PeriodValue } from '../../shared/ui';
import { calculateLevel1 } from '../../utils/dashboardMetrics';
import type { ObraLocal, Equipamento, RegistroProducao } from '../../types';

interface Level1Props {
  obras: ObraLocal[];
  equipamentos: Equipamento[];
  producao: RegistroProducao[];
  periodo: PeriodValue;
  onPeriodoChange: (value: PeriodValue) => void;
  onNavigate: (tab: string) => void;
}

function KPICard({
  label,
  value,
  unit,
  onHover,
}: {
  label: string;
  value: number;
  unit: string;
  onHover?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (!onHover) return;
    gsap.to(ref.current, {
      scale: 1.02,
      duration: 0.2,
      ease: 'power2.out',
    });
  };

  const handleMouseLeave = () => {
    gsap.to(ref.current, {
      scale: 1,
      duration: 0.2,
      ease: 'back.out',
    });
  };

  return (
    <div
      ref={ref}
      className="rounded-lg border border-[#dce3df] bg-white p-4 sm:p-5 hover:border-[#176b4d] transition-colors"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className="block text-12px font-semibold uppercase tracking-widest text-[#47555c]">
        {label}
      </span>
      <strong className="mt-2 block text-32px font-black leading-none text-[#101c18] tabular-nums">
        {value.toLocaleString('pt-BR')}
      </strong>
      <span className="mt-1 block text-11px text-[#8a969b]">{unit}</span>
    </div>
  );
}

export default function Level1_KPIs(props: Level1Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const kpiRefs = useRef<(HTMLDivElement | null)[]>([]);

  const kpis = useMemo(
    () =>
      calculateLevel1(props.obras, props.equipamentos, props.producao, {
        inicio: props.periodo.from,
        fim: props.periodo.to,
      }),
    [props.obras, props.equipamentos, props.producao, props.periodo]
  );

  // GSAP: Header fade-in
  useGSAP(
    () => {
      gsap.from(headerRef.current, {
        opacity: 0,
        y: -30,
        duration: 0.4,
        ease: 'power2.out',
      });
    },
    { scope: containerRef }
  );

  // GSAP: KPI cards stagger
  useGSAP(
    () => {
      gsap.from(kpiRefs.current.filter(Boolean), {
        opacity: 0,
        y: 20,
        duration: 0.5,
        stagger: 0.1,
        ease: 'back.out',
      });
    },
    { scope: containerRef, dependencies: [kpis] }
  );

  const kpiData = [
    { label: 'Obras Ativas', value: kpis.obrasAbertas, unit: 'unidades' },
    { label: 'Equipamentos Ativos', value: kpis.equipamentosAtivos, unit: 'unidades' },
    { label: 'Equipamentos Parados', value: kpis.equipamentosParados, unit: 'unidades' },
    { label: 'Produção do Período', value: Math.round(kpis.producaoMes), unit: 'm³' },
    { label: 'Eficiência Média', value: kpis.eficienciaMedia, unit: 'm³/eq' },
    { label: 'Taxa de Atividade', value: kpis.taxaAtividade, unit: '%' },
  ];

  return (
    <div ref={containerRef} className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* PageHeader */}
      <div ref={headerRef} data-anim="header">
        <PageHeader
          eyebrow="Painel de Controle"
          title="Dashboard"
          description={`Período: ${props.periodo.from.split('-').reverse().join('/')} a ${props.periodo.to
            .split('-')
            .reverse()
            .join('/')}`}
          actions={
            <button
              type="button"
              onClick={() => props.onNavigate('Lançamentos')}
              className="inline-flex items-center gap-2 rounded-lg bg-[#176b4d] px-4 py-2 text-14px font-semibold text-white hover:bg-[#0b4935] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f26a2e]/60 focus-visible:ring-offset-2"
              onMouseEnter={(e) => gsap.to(e.currentTarget, { scale: 0.95, duration: 0.2 })}
              onMouseLeave={(e) => gsap.to(e.currentTarget, { scale: 1, duration: 0.2, ease: 'back.out' })}
              aria-label="Lançar novo registro de produção"
            >
              <Plus className="size-4" aria-hidden="true" />
              Lançar Produção
            </button>
          }
        />
      </div>

      {/* Period Filter */}
      <PeriodFilter value={props.periodo} onChange={props.onPeriodoChange} />

      {/* KPIs Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-anim="kpi-bucket">
        {kpiData.map((kpi, i) => (
          <div
            key={i}
            ref={(el) => {
              kpiRefs.current[i] = el;
            }}
            data-anim="kpi-card"
          >
            <KPICard label={kpi.label} value={kpi.value} unit={kpi.unit} />
          </div>
        ))}
      </div>
    </div>
  );
}
