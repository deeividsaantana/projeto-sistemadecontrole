import { useState, useMemo } from 'react';
import { Plus } from 'lucide-react';
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

/** KPI card component for displaying individual metrics */
function KPICard({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div
      className="rounded-lg border border-[#dce3df] bg-white p-4 sm:p-5"
      data-testid="kpi-card"
    >
      <span className="block text-sm font-semibold text-[#718087]">{label}</span>
      <strong className="mt-2 block text-3xl font-bold text-[#101c18] tabular-nums" data-testid="kpi-value">
        {value}
      </strong>
      <span className="text-xs text-[#8a969b]">{unit}</span>
    </div>
  );
}

export default function Dashboard(props: DashboardProps) {
  // Period state with default to current month
  const [periodo, setPeriodo] = useState<PeriodValue>({
    preset: 'mes',
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  });

  // Calculate KPIs using the utility function from Task 1
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

  // Filter obras ativas for table (using 'Ativa' status from ObraLocal)
  const obrasAtivas = useMemo(
    () => (props.obras || []).filter(o => o.status === 'Ativa'),
    [props.obras],
  );

  // DataTable columns for obras
  const obraColumns: readonly DataTableColumn<ObraLocal>[] = [
    {
      id: 'nome',
      label: 'Obra',
      cell: (row) => <span className="truncate font-medium">{row.nome}</span>,
      sortValue: (row) => row.nome,
    },
    {
      id: 'responsavel',
      label: 'Responsável',
      cell: (row) => <span className="truncate">{row.responsavel || '—'}</span>,
      sortValue: (row) => row.responsavel,
    },
    {
      id: 'endereco',
      label: 'Endereço',
      cell: (row) => <span className="truncate text-sm text-[#718087]">{row.endereco || '—'}</span>,
      sortValue: (row) => row.endereco,
    },
    {
      id: 'status',
      label: 'Status',
      cell: (row) => (
        <span className="inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800">
          {row.status}
        </span>
      ),
    },
  ];

  return (
    <div id="dashboard-tab" className="flex flex-col gap-6 p-4 sm:p-6">
      {/* PageHeader with primary action */}
      <PageHeader
        eyebrow="Painel de Controle"
        title="Dashboard"
        description={`Período: ${periodo.from} a ${periodo.to}`}
        actions={
          <button
            type="button"
            onClick={() => props.onNavigate('Lançamentos')}
            data-testid="dashboard-launch-button"
            className="inline-flex items-center gap-2 rounded-lg bg-[#176b4d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0b4935] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f26a2e]/60"
          >
            <Plus className="size-4" />
            Lançar Produção
          </button>
        }
      />

      {/* Period Filter */}
      <div data-testid="period-filter">
        <PeriodFilter value={periodo} onChange={setPeriodo} />
      </div>

      {/* KPIs Grid - responsive: 1 col mobile, 2 col tablet, 3 col desktop */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KPICard label="Obras Abertas" value={kpis.obrasAbertas} unit="unid" />
        <KPICard label="Equipamentos Ativos" value={kpis.equipamentosAtivos} unit="unid" />
        <KPICard label="Equipamentos Parados" value={kpis.equipamentosParados} unit="unid" />
        <KPICard label="Produção do Período" value={Math.round(kpis.producaoMes)} unit="m³" />
        <KPICard label="Eficiência Média" value={kpis.eficienciaMedia} unit="m³/eq" />
      </div>

      {/* Obras Ativas Table */}
      <DataTable
        caption="Obras ativas"
        rows={obrasAtivas}
        columns={obraColumns}
        getRowId={(row) => row.id}
        emptyMessage="Nenhuma obra ativa no período"
      />
    </div>
  );
}
