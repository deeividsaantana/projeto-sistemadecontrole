import { useMemo, type ReactNode } from 'react';
import {
  AlertTriangle, ArrowRight, BarChart3, CalendarClock, CheckCircle2,
  ClipboardCheck, Clock3, FileSpreadsheet, HardHat, Package, TrendingUp,
  Users, WalletCards, type LucideIcon,
} from 'lucide-react';
import type {
  Abastecimento, Comboio, ControleEquipamentoDiario, ControleEstacas, Empresa,
  Equipamento, FichaVerificacaoServico, FrenteServico, Funcionario, GrupoEquipe,
  HistoryLog, Inspecao, LancamentoCusto, ListaPresenca, Lubrificacao, Material,
  Medicao, MovimentoMaterial, NaoConformidade, ObraLocal, OrcamentoItem,
  OrdemServico, PlanejamentoItem, PresencaApontamento, ProdutoLubrificacao,
  RegistroProducao, TicketJazida, TipoCombustivel,
} from '../types';

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
}

const PROJECT_NAME = 'Rodoanel Complexo do Alto Tietê · Alça';
const PROJECT_TABS = [
  { label: 'Geral', target: 'dashboard' },
  { label: 'Cronograma', target: 'cronograma' },
  { label: 'Diário de obra', target: 'diario-obra' },
  { label: 'Medições', target: 'medicoes' },
  { label: 'Financeiro', target: 'custos' },
  { label: 'Materiais', target: 'materiais' },
  { label: 'Qualidade', target: 'fvs' },
] as const;

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', notation: value >= 1_000_000 ? 'compact' : 'standard',
  maximumFractionDigits: value >= 1_000_000 ? 2 : 0,
}).format(value);
const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const statusTone: Record<string, string> = {
  Aprovada: 'bg-emerald-50 text-emerald-700',
  Concluído: 'bg-emerald-50 text-emerald-700',
  'Em execução': 'bg-sky-50 text-sky-700',
  'Em elaboração': 'bg-amber-50 text-amber-700',
  Enviada: 'bg-sky-50 text-sky-700',
  Rejeitada: 'bg-rose-50 text-rose-700',
};

function Metric({ icon: Icon, label, value, detail, tone = 'green' }: {
  icon: LucideIcon; label: string; value: string; detail: string;
  tone?: 'green' | 'blue' | 'amber' | 'red';
}) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-700', blue: 'bg-sky-50 text-sky-700',
    amber: 'bg-amber-50 text-amber-700', red: 'bg-rose-50 text-rose-700',
  };
  return <article className="min-w-0 border border-slate-200 bg-white p-3.5 sm:p-4">
    <div className="flex items-start gap-3">
      <span className={`hidden size-9 shrink-0 place-items-center rounded-md sm:grid ${tones[tone]}`}>
        <Icon className="size-4" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-slate-500">{label}</p>
        <strong className="mt-1 block text-lg font-bold leading-tight tabular-nums text-slate-900 sm:text-xl">{value}</strong>
        <p className="mt-1 text-[10px] leading-snug text-slate-500">{detail}</p>
      </div>
    </div>
  </article>;
}

function Surface({ title, action, children, className = '' }: {
  title: string; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return <section className={`border border-slate-200 bg-white ${className}`}>
    <header className="flex min-h-12 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
      <h2 className="text-sm font-bold text-slate-900">{title}</h2>{action}
    </header>
    {children}
  </section>;
}

export default function Dashboard({
  equipamentos, controlesEquipamentos = [], presencasLink = [], planejamento = [],
  producao = [], medicoes = [], materiais = [], movimentosMaterial = [],
  fichasFvs = [], inspecoes = [], naoConformidades = [], lancamentosCusto = [],
  orcamento = [], frentes = [], onNavigate,
}: DashboardProps) {
  const today = new Date().toISOString().slice(0, 10);
  const summary = useMemo(() => {
    const activePlans = planejamento.filter(item => item.ativo && item.situacao !== 'Cancelado');
    const planRatios = activePlans.map(plan => {
      const delivered = producao
        .filter(item => item.ativo && item.servicoId === plan.servicoId && item.data >= plan.dataInicio && item.data <= plan.dataFim)
        .reduce((sum, item) => sum + Number(item.quantidade || 0), 0);
      return plan.quantidadePlanejada > 0 ? clamp((delivered / plan.quantidadePlanejada) * 100) : 0;
    });
    const physical = planRatios.length
      ? Math.round(planRatios.reduce((sum, value) => sum + value, 0) / planRatios.length) : 0;
    const delayed = activePlans.filter(item => item.dataFim < today && item.situacao !== 'Concluído').length;
    const measured = medicoes.filter(item => item.ativo).reduce((sum, measurement) => sum + measurement.itens.reduce(
      (itemSum, item) => itemSum + Number(item.quantidade || 0) * Number(item.valorUnitario || 0), 0,
    ), 0);
    const budget = orcamento.filter(item => item.ativo).reduce((sum, item) => sum + Number(item.valorOrcado || 0), 0);
    const cost = lancamentosCusto.filter(item => item.ativo).reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const financial = budget > 0 ? clamp((cost / budget) * 100) : 0;
    const openQuality = naoConformidades.filter(item => item.ativo && !['Encerrada', 'Cancelada'].includes(item.situacao)).length;
    const stock = new Map<string, number>();
    movimentosMaterial.forEach(item => {
      const current = stock.get(item.materialId) || 0;
      const quantity = Math.abs(Number(item.quantidade || 0));
      const signal = item.tipo === 'Entrada' ? 1 : item.tipo === 'Saída' ? -1 : item.tipo === 'Ajuste' ? Math.sign(Number(item.quantidade || 0)) : 0;
      stock.set(item.materialId, current + quantity * signal);
    });
    const criticalMaterials = materiais.filter(item => item.ativo && Number(item.estoqueMinimo || 0) > (stock.get(item.id) || 0));
    const operationalDate = controlesEquipamentos.reduce((latest, item) => item.data > latest ? item.data : latest, '');
    const latestFleet = controlesEquipamentos.filter(item => item.data === operationalDate);
    const operating = new Set(latestFleet.filter(item => item.status === 'Em operação').map(item => item.equipamentoId || item.prefixo)).size;
    const fleetBase = new Set(latestFleet.map(item => item.equipamentoId || item.prefixo)).size || equipamentos.length;
    const fleetAvailability = fleetBase ? Math.round((operating / fleetBase) * 100) : 0;
    const presenceDate = presencasLink.reduce((latest, item) => item.data > latest ? item.data : latest, '');
    const latestPresence = presencasLink.filter(item => item.data === presenceDate);
    const people = latestPresence.filter(item => ['Presente', 'Atraso', 'Saída antecipada'].includes(item.status)).length;
    return { physical, delayed, measured, budget, cost, financial, openQuality, criticalMaterials, stock, fleetAvailability, people, planCount: activePlans.length };
  }, [planejamento, producao, medicoes, orcamento, lancamentosCusto, naoConformidades, movimentosMaterial, materiais, controlesEquipamentos, equipamentos, presencasLink, today]);

  const criticalFronts = useMemo(() => planejamento
    .filter(item => item.ativo && item.dataFim < today && item.situacao !== 'Concluído')
    .sort((a, b) => a.dataFim.localeCompare(b.dataFim)).slice(0, 4), [planejamento, today]);
  const approvals = useMemo(() => [
    ...medicoes.filter(item => item.ativo).map(item => ({
      id: `med-${item.id}`, title: `Medição ${item.numero}`,
      meta: `${item.periodoInicio.split('-').reverse().join('/')} a ${item.periodoFim.split('-').reverse().join('/')}`,
      status: item.situacao, target: 'medicoes',
    })),
    ...fichasFvs.filter(item => item.ativo).map(item => ({
      id: `fvs-${item.id}`, title: `FVS ${item.numero}`,
      meta: item.servicoDescricao || item.modeloNome, status: item.situacao, target: 'fvs',
    })),
  ].slice(0, 5), [medicoes, fichasFvs]);
  const materialRisks = summary.criticalMaterials.slice(0, 4).map(material => ({ ...material, balance: summary.stock.get(material.id) || 0 }));
  const progressSeries = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (6 - index) + 1, 0);
    const cutoff = date.toISOString().slice(0, 10);
    const eligible = planejamento.filter(item => item.ativo && item.situacao !== 'Cancelado' && item.dataInicio <= cutoff);
    const ratios = eligible.map(plan => {
      const duration = Math.max(1, new Date(`${plan.dataFim}T12:00:00`).getTime() - new Date(`${plan.dataInicio}T12:00:00`).getTime());
      const elapsed = new Date(`${cutoff}T12:00:00`).getTime() - new Date(`${plan.dataInicio}T12:00:00`).getTime();
      const planned = clamp((elapsed / duration) * 100);
      const delivered = producao.filter(item => item.ativo && item.servicoId === plan.servicoId && item.data >= plan.dataInicio && item.data <= cutoff)
        .reduce((sum, item) => sum + Number(item.quantidade || 0), 0);
      const actual = plan.quantidadePlanejada > 0 ? clamp((delivered / plan.quantidadePlanejada) * 100) : 0;
      return { planned, actual };
    });
    const average = (key: 'planned' | 'actual') => ratios.length
      ? ratios.reduce((sum, item) => sum + item[key], 0) / ratios.length : 0;
    return { label: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', ''), planned: average('planned'), actual: average('actual') };
  }), [planejamento, producao]);
  const plannedProgress = Math.round(progressSeries.at(-1)?.planned || 0);
  const chartActual = progressSeries.map(item => item.actual);
  const chartPlanned = progressSeries.map(item => item.planned);
  const points = (values: number[]) => values.map((value, index) => `${index * 16.66},${100 - clamp(value)}`).join(' ');

  return <div id="dashboard-tab" className="min-h-full bg-[#f7f9f8] pb-14">
    <div className="border-b border-slate-200 bg-white px-4 pt-5 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-3 pb-4 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase text-emerald-700">Visão consolidada</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Painel de Controle</h1>
          <p className="mt-1 truncate text-xs text-slate-500">{PROJECT_NAME}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500"><span className="size-2 rounded-full bg-emerald-500" />Dados operacionais atualizados</div>
      </div>
      <nav className="-mx-4 flex overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8" aria-label="Módulos da obra">
        {PROJECT_TABS.map(tab => <button key={tab.target} type="button" onClick={() => onNavigate(tab.target)} aria-current={tab.target === 'dashboard' ? 'page' : undefined}
          className={`h-11 shrink-0 border-b-2 px-3 text-xs font-semibold sm:px-4 ${tab.target === 'dashboard' ? 'border-emerald-700 text-emerald-800' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'}`}>
          {tab.label}
        </button>)}
      </nav>
    </div>

    <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6 lg:px-8">
      <section className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <Metric icon={TrendingUp} label="Avanço físico" value={`${summary.physical}%`} detail={summary.planCount ? `${plannedProgress}% previsto no período` : 'Sem planejamento lançado'} />
        <Metric icon={WalletCards} label="Custo realizado" value={formatCurrency(summary.cost)} detail={`${Math.round(summary.financial)}% do orçamento lançado`} tone="blue" />
        <Metric icon={CalendarClock} label="Prazo" value={summary.delayed ? `${summary.delayed} atrasos` : 'Em dia'} detail={`${planejamento.filter(item => item.ativo).length} atividades acompanhadas`} tone={summary.delayed ? 'amber' : 'green'} />
        <Metric icon={ClipboardCheck} label="Qualidade" value={`${summary.openQuality} abertas`} detail={`${inspecoes.filter(item => item.ativo).length} inspeções registradas`} tone={summary.openQuality ? 'red' : 'green'} />
      </section>

      <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(19rem,.7fr)]">
        <Surface title="Curva de avanço da obra" action={<button type="button" onClick={() => onNavigate('cronograma')} className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">Abrir cronograma <ArrowRight className="size-3.5" /></button>}>
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap gap-4 text-[10px] font-semibold text-slate-500">
              <span className="flex items-center gap-1.5"><i className="h-0.5 w-5 bg-emerald-700" />Realizado</span>
              <span className="flex items-center gap-1.5"><i className="h-0.5 w-5 border-t-2 border-dashed border-sky-500" />Planejado</span>
            </div>
            <div className="mt-4 h-48 w-full sm:h-56">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible" role="img" aria-label={`Avanço realizado ${summary.physical}% e planejado ${plannedProgress}%`}>
                {[20, 40, 60, 80].map(value => <line key={value} x1="0" x2="100" y1={100 - value} y2={100 - value} stroke="#e8eeeb" strokeWidth="0.5" />)}
                <polyline points={points(chartPlanned)} fill="none" stroke="#38a6db" strokeWidth="1.4" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
                <polyline points={points(chartActual)} fill="none" stroke="#087553" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                {chartActual.map((value, index) => <circle key={index} cx={index * 16.66} cy={100 - clamp(value)} r="1.2" fill="#087553" />)}
              </svg>
            </div>
            <div className="mt-2 grid grid-cols-7 text-center text-[9px] text-slate-400">{progressSeries.map(item => <span key={item.label}>{item.label}</span>)}</div>
          </div>
        </Surface>

        <Surface title="Operação hoje">
          <div className="divide-y divide-slate-100">
            {[
              { icon: Users, label: 'Efetivo presente', value: String(summary.people), target: 'presenca' },
              { icon: HardHat, label: 'Frentes em execução', value: String(frentes.filter(item => item.ativo && item.situacao === 'Em execução').length), target: 'frentes' },
              { icon: BarChart3, label: 'Disponibilidade da frota', value: `${summary.fleetAvailability}%`, target: 'controle-equipamentos' },
              { icon: FileSpreadsheet, label: 'Medido acumulado', value: formatCurrency(summary.measured), target: 'medicoes' },
            ].map(item => { const Icon = item.icon; return <button key={item.label} type="button" onClick={() => onNavigate(item.target)} className="flex min-h-14 w-full items-center gap-3 px-4 text-left hover:bg-slate-50 sm:px-5">
              <Icon className="size-4 text-emerald-700" strokeWidth={1.8} /><span className="flex-1 text-xs font-medium text-slate-600">{item.label}</span>
              <strong className="text-sm tabular-nums text-slate-900">{item.value}</strong><ArrowRight className="size-3.5 text-slate-300" />
            </button>; })}
          </div>
        </Surface>
      </section>

      <section className="mt-3 grid gap-3 xl:grid-cols-3">
        <Surface title="Frentes críticas" action={<button type="button" onClick={() => onNavigate('planejamento')} className="text-[11px] font-bold text-emerald-700">Ver planejamento</button>}>
          <div className="divide-y divide-slate-100">
            {criticalFronts.length ? criticalFronts.map(item => <button key={item.id} type="button" onClick={() => onNavigate('planejamento')} className="flex min-h-16 w-full items-center gap-3 px-4 text-left hover:bg-slate-50 sm:px-5">
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-amber-50 text-amber-700"><AlertTriangle className="size-4" /></span>
              <span className="min-w-0 flex-1"><strong className="block truncate text-xs text-slate-800">{item.frente || item.servicoDescricao}</strong><small className="mt-1 block truncate text-[10px] text-slate-500">Prazo {item.dataFim.split('-').reverse().join('/')} · {item.responsavel}</small></span>
              <Clock3 className="size-4 text-amber-600" />
            </button>) : <EmptyLine text="Nenhuma frente atrasada" icon={CheckCircle2} />}
          </div>
        </Surface>

        <Surface title="Aprovações pendentes" action={<button type="button" onClick={() => onNavigate('medicoes')} className="text-[11px] font-bold text-emerald-700">Ver todas</button>}>
          <div className="divide-y divide-slate-100">
            {approvals.length ? approvals.map(item => <button key={item.id} type="button" onClick={() => onNavigate(item.target)} className="flex min-h-16 w-full items-center gap-3 px-4 text-left hover:bg-slate-50 sm:px-5">
              <span className="min-w-0 flex-1"><strong className="block truncate text-xs text-slate-800">{item.title}</strong><small className="mt-1 block truncate text-[10px] text-slate-500">{item.meta}</small></span>
              <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${statusTone[item.status] || 'bg-slate-100 text-slate-600'}`}>{item.status}</span>
            </button>) : <EmptyLine text="Nenhuma aprovação pendente" icon={CheckCircle2} />}
          </div>
        </Surface>

        <Surface title="Risco de materiais" action={<button type="button" onClick={() => onNavigate('materiais')} className="text-[11px] font-bold text-emerald-700">Abrir estoque</button>}>
          <div className="divide-y divide-slate-100">
            {materialRisks.length ? materialRisks.map(item => <button key={item.id} type="button" onClick={() => onNavigate('materiais')} className="flex min-h-16 w-full items-center gap-3 px-4 text-left hover:bg-slate-50 sm:px-5">
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-rose-50 text-rose-700"><Package className="size-4" /></span>
              <span className="min-w-0 flex-1"><strong className="block truncate text-xs text-slate-800">{item.descricao}</strong><small className="mt-1 block text-[10px] text-slate-500">Saldo {item.balance.toLocaleString('pt-BR')} {item.unidade} · mínimo {Number(item.estoqueMinimo || 0).toLocaleString('pt-BR')}</small></span>
            </button>) : <EmptyLine text="Estoque sem itens críticos" icon={CheckCircle2} />}
          </div>
        </Surface>
      </section>
    </div>
  </div>;
}

function EmptyLine({ text, icon: Icon }: { text: string; icon: LucideIcon }) {
  return <div className="flex min-h-32 flex-col items-center justify-center gap-2 px-4 text-center text-slate-400">
    <Icon className="size-5 text-emerald-600" strokeWidth={1.7} /><p className="text-xs">{text}</p>
  </div>;
}
