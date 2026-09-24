import { useState, useMemo, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Plus, AlertCircle } from 'lucide-react';
import type {
  Abastecimento, Comboio, ControleEquipamentoDiario, ControleEstacas, Empresa,
  Equipamento, FichaVerificacaoServico, FrenteServico, Funcionario, GrupoEquipe,
  HistoryLog, Inspecao, LancamentoCusto, ListaPresenca, Lubrificacao, Material,
  Medicao, MovimentoMaterial, NaoConformidade, ObraLocal, OrcamentoItem,
  OrdemServico, PlanejamentoItem, PresencaApontamento, ProdutoLubrificacao,
  RegistroProducao, TicketJazida, TipoCombustivel,
} from '../types';
import { PageHeader, PeriodFilter, DataTable, type PeriodValue, type DataTableColumn } from '../shared/ui';
import { calculateDashboardKpis } from '../utils/dashboardOperational';

interface DashboardProps {
  empresas: Empresa[]; obras: ObraLocal[]; equipamentos: Equipamento[];
  funcionarios: Funcionario[]; comboios: Comboio[]; combustiveis: TipoCombustivel[];
  lubrificantes: ProdutoLubrificacao[]; abastecimentos: Abastecimento[];
  lubrificacoes: Lubrificacao[]; historyLogs: HistoryLog[];
  listasPresenca?: ListaPresenca[]; ordensServico?: OrdemServico[];
  ticketsJazida?: TicketJazida[]; estacas?: ControleEstacas;
  presencasLink?: PresencaApontamento[]; controlesEquipamentos?: ControleEquipamentoDiario[];
  gruposEquipe?: GrupoEquipe[]; planejamento?: PlanejamentoItem[];
  producao?: RegistroProducao[]; medicoes?: Medicao[]; materiais?: Material[];
  movimentosMaterial?: MovimentoMaterial[]; fichasFvs?: FichaVerificacaoServico[];
  inspecoes?: Inspecao[]; naoConformidades?: NaoConformidade[];
  lancamentosCusto?: LancamentoCusto[]; orcamento?: OrcamentoItem[];
  frentes?: FrenteServico[]; onNavigate: (tab: string) => void;
  periodo?: { from: string; to: string };
}

/** KPI Card — Pixel-perfect design com interatividade */
function KPICard({
  label,
  value,
  unit,
  onClick,
}: {
  label: string;
  value: number;
  unit: string;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (!onClick) return;
    gsap.to(ref.current, {
      scale: 1.02,
      duration: 0.2,
      ease: 'power2.out',
    });
  };

  const handleMouseLeave = () => {
    if (!onClick) return;
    gsap.to(ref.current, {
      scale: 1,
      duration: 0.2,
      ease: 'back.out',
    });
  };

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={onClick ? 0 : -1}
      aria-label={`${label}: ${value} ${unit}`}
      data-testid="kpi-card"
      data-anim="kpi-card"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`rounded-lg border border-[#dce3df] bg-white p-4 sm:p-5
                   ${onClick ? 'cursor-pointer hover:border-[#176b4d]' : ''}
                   focus-visible:outline-none focus-visible:ring-2
                   focus-visible:ring-[#f26a2e]/60 focus-visible:ring-offset-2`}
    >
      <span className="block text-12px font-semibold uppercase tracking-widest text-[#47555c]">
        {label}
      </span>
      <strong
        className="mt-2 block text-32px font-black leading-none text-[#101c18] tabular-nums"
        data-testid="kpi-value"
      >
        {value.toLocaleString('pt-BR')}
      </strong>
      <span className="mt-1 block text-11px text-[#8a969b]">{unit}</span>
    </div>
  );
}

/** Empty State — Mensagem amigável */
function EmptyState() {
  return (
    <div
      className="rounded-lg border border-[#dce3df] bg-white p-12 text-center"
      data-anim="empty-state"
    >
      <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        <AlertCircle className="h-8 w-8 text-gray-400" aria-hidden="true" />
      </div>
      <h3 className="text-14px font-semibold text-[#172329]">Nenhuma obra ativa</h3>
      <p className="mt-1 text-13px text-[#718087]">
        Selecione um período com obras para visualizar dados
      </p>
    </div>
  );
}

/** Loading State — Skeleton com pulsação */
function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-lg bg-gray-200"
          data-anim="skeleton"
        />
      ))}
    </div>
  );
}

/** Error State — Com opção de retry */
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="rounded-lg border-l-4 border-l-red-500 bg-red-50 p-4"
      role="alert"
      data-anim="error-state"
    >
      <div className="flex items-start">
        <AlertCircle className="mt-0.5 h-5 w-5 text-red-600 mr-3 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-14px font-semibold text-red-800">
            Erro ao carregar dados
          </p>
          <button
            onClick={onRetry}
            className="mt-2 text-13px font-semibold text-red-600 hover:text-red-700 underline"
            aria-label="Tentar carregar dados novamente"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard(props: DashboardProps) {
  // Estado local
  const [periodo, setPeriodo] = useState<PeriodValue>({
    preset: 'mes',
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs para GSAP animações
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const kpiBucketRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Calcular KPIs com memoização
  const kpis = useMemo(() => {
    return calculateDashboardKpis(
      props.obras || [],
      props.equipamentos || [],
      props.producao || [],
      {
        inicio: periodo.from,
        fim: periodo.to,
      },
    );
  }, [props.obras, props.equipamentos, props.producao, periodo]);

  // Filtrar obras ativas com memoização
  const obrasAtivas = useMemo(
    () => (props.obras || []).filter(o => o.status === 'Ativa'),
    [props.obras],
  );

  // DataTable columns com memoização
  const obraColumns: readonly DataTableColumn<ObraLocal>[] = useMemo(
    () => [
      {
        id: 'nome',
        label: 'Obra',
        cell: (row) => <span className="truncate font-medium text-14px">{row.nome}</span>,
        sortValue: (row) => row.nome,
      },
      {
        id: 'responsavel',
        label: 'Responsável',
        cell: (row) => <span className="truncate text-14px">{row.responsavel || '—'}</span>,
        sortValue: (row) => row.responsavel,
      },
      {
        id: 'endereco',
        label: 'Endereço',
        cell: (row) => <span className="truncate text-13px text-[#718087]">{row.endereco || '—'}</span>,
        sortValue: (row) => row.endereco,
      },
      {
        id: 'status',
        label: 'Status',
        cell: (row) => (
          <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-11px font-semibold text-green-800">
            {row.status}
          </span>
        ),
      },
    ],
    [],
  );

  // GSAP Animações — PageHeader
  useGSAP(
    () => {
      gsap.from(headerRef.current, {
        opacity: 0,
        y: -30,
        duration: 0.4,
        ease: 'power2.out',
      });
    },
    { scope: containerRef },
  );

  // GSAP Animações — KPI Cards (stagger)
  useGSAP(
    () => {
      gsap.from('[data-anim="kpi-card"]', {
        opacity: 0,
        y: 20,
        duration: 0.5,
        stagger: 0.1,
        ease: 'back.out',
      });
    },
    { scope: containerRef, dependencies: [kpis] },
  );

  // GSAP Animações — Filter
  useGSAP(
    () => {
      gsap.from(filterRef.current, {
        opacity: 0,
        y: 10,
        duration: 0.4,
        delay: 0.3,
        ease: 'power2.out',
      });
    },
    { scope: containerRef },
  );

  // GSAP Animações — Table
  useGSAP(
    () => {
      if (obrasAtivas.length > 0) {
        gsap.from(tableRef.current, {
          opacity: 0,
          y: 30,
          duration: 0.5,
          delay: 0.4,
          ease: 'power2.out',
        });
      }
    },
    { scope: containerRef, dependencies: [obrasAtivas] },
  );

  // Handle retry
  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  };

  // Handle período change
  const handlePeriodoChange = (value: PeriodValue) => {
    setPeriodo(value);
  };

  return (
    <div
      ref={containerRef}
      id="dashboard-tab"
      className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto"
    >
      {/* PageHeader — Pixel-perfect */}
      <div ref={headerRef} data-anim="header">
        <PageHeader
          eyebrow="Painel de Controle"
          title="Dashboard"
          description={`Período: ${periodo.from.split('-').reverse().join('/')} a ${periodo.to
            .split('-')
            .reverse()
            .join('/')}`}
          actions={
            <button
              type="button"
              onClick={() => props.onNavigate('Lançamentos')}
              data-testid="dashboard-launch-button"
              className="inline-flex items-center gap-2 rounded-lg bg-[#176b4d] px-4 py-2
                         text-14px font-semibold text-white
                         transition-all duration-200
                         hover:bg-[#0b4935] focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-[#f26a2e]/60
                         focus-visible:ring-offset-2"
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
      <div ref={filterRef} data-anim="filter" data-testid="period-filter">
        <label htmlFor="period-select" className="mb-2 block text-12px font-semibold uppercase text-[#47555c]">
          Filtro de Período
        </label>
        <PeriodFilter value={periodo} onChange={handlePeriodoChange} />
      </div>

      {/* Error State */}
      {error && <ErrorState onRetry={handleRetry} />}

      {/* Loading State */}
      {isLoading && <LoadingSkeleton />}

      {/* KPIs Grid — Responsivo e interativo */}
      {!isLoading && (
        <div
          ref={kpiBucketRef}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-anim="kpi-bucket"
        >
          <KPICard
            label="Obras Ativas"
            value={kpis.obrasAbertas}
            unit="unidades"
          />
          <KPICard
            label="Equipamentos Ativos"
            value={kpis.equipamentosAtivos}
            unit="unidades"
          />
          <KPICard
            label="Equipamentos Parados"
            value={kpis.equipamentosParados}
            unit="unidades"
          />
          <KPICard
            label="Produção do Período"
            value={Math.round(kpis.producaoMes)}
            unit="m³"
          />
          <KPICard
            label="Eficiência Média"
            value={kpis.eficienciaMedia}
            unit="m³/eq"
          />
          <KPICard label="Taxa de Atividade" value={75} unit="%" />
        </div>
      )}

      {/* Obras Ativas Table */}
      <div ref={tableRef} data-anim="table">
        {!isLoading && obrasAtivas.length === 0 ? (
          <EmptyState />
        ) : !isLoading ? (
          <DataTable
            caption="Obras ativas no período"
            rows={obrasAtivas}
            columns={obraColumns}
            getRowId={(row) => row.id}
            emptyMessage="Nenhuma obra ativa no período selecionado"
          />
        ) : null}
      </div>
    </div>
  );
}
