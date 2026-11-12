import { useMemo, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Activity, ClipboardList, Truck, Users } from 'lucide-react';
import type {
  Abastecimento, Comboio, ControleEquipamentoDiario, ControleEstacas, Empresa,
  Equipamento, FichaVerificacaoServico, FrenteServico, Funcionario, GrupoEquipe,
  HistoryLog, Inspecao, LancamentoCusto, ListaPresenca, Lubrificacao,
  Medicao, NaoConformidade, ObraLocal, OrcamentoItem,
  OrdemServico, PlanejamentoItem, PresencaApontamento, ProdutoLubrificacao,
  RegistroProducao, TipoCombustivel, DiarioObra,
} from '../types';
import type { Solicitacao } from '../utils/solicitacoes';
import { PageHeader, buildPeriod } from '../shared/ui';
import { TelaCheia } from '../shared/ui/TelaCheia';
import { buildDashboardGeneralViewModel } from '../utils/dashboardGeneral';
import { AvailabilityTrend, FleetDonut } from './dashboard/OperationalVisuals';
import { TeamActivity } from './dashboard/TeamActivity';

interface DashboardProps {
  empresas: Empresa[]; obras: ObraLocal[]; equipamentos: Equipamento[];
  funcionarios: Funcionario[]; comboios: Comboio[]; combustiveis: TipoCombustivel[];
  lubrificantes: ProdutoLubrificacao[]; abastecimentos: Abastecimento[];
  lubrificacoes: Lubrificacao[]; historyLogs: HistoryLog[];
  listasPresenca?: ListaPresenca[]; ordensServico?: OrdemServico[];
  estacas?: ControleEstacas;
  presencasLink?: PresencaApontamento[]; controlesEquipamentos?: ControleEquipamentoDiario[];
  gruposEquipe?: GrupoEquipe[]; planejamento?: PlanejamentoItem[];
  producao?: RegistroProducao[]; medicoes?: Medicao[];
  fichasFvs?: FichaVerificacaoServico[];
  inspecoes?: Inspecao[]; naoConformidades?: NaoConformidade[];
  lancamentosCusto?: LancamentoCusto[]; orcamento?: OrcamentoItem[];
  frentes?: FrenteServico[]; onNavigate: (tab: string) => void;
  diariosObra?: DiarioObra[]; solicitacoes?: Solicitacao[];
}

function ExecutiveCard({ label, value, detail, tone, icon: Icon, onClick }: { label: string; value: string | number; detail: string; tone: 'green' | 'blue' | 'orange' | 'slate'; icon: typeof Activity; onClick?: () => void }) {
  // Produção não tem tela própria desde que o Meu dia saiu: o cartão só mostra o número.
  const Elemento = onClick ? 'button' : 'div';
  // Todos os indicadores usam o mesmo cartão branco (pedido de 11/11/2026:
  // "muita aba desigual"). A cor fica só no ícone, para diferenciar o assunto.
  const icone = { green: 'bg-emerald-50 text-emerald-800', blue: 'bg-blue-50 text-blue-800', orange: 'bg-orange-50 text-orange-800', slate: 'bg-slate-100 text-slate-600' };
  return <Elemento type={onClick ? 'button' : undefined} onClick={onClick} data-dashboard-reveal className="dashboard-kpi group flex min-w-0 flex-col justify-center rounded-xl border border-slate-200 bg-white p-4 text-left text-slate-950 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--renea-focus)">
    <div className="flex items-start justify-between gap-3"><span className="text-sm font-bold text-slate-600">{label}</span><span className={`rounded-lg p-1.5 ${icone[tone]}`}><Icon className="size-4" /></span></div>
    <strong className={`mt-2 block font-black leading-tight tabular-nums ${typeof value === 'number' || /\d/.test(value) ? 'text-3xl' : 'text-xl'}`}>{value}</strong><span className="mt-1 block text-xs font-semibold text-slate-600">{detail}</span>
  </Elemento>;
}

export default function Dashboard(props: DashboardProps) {
  // Cada abertura começa no retrato operacional do dia atual.
  const periodo = useMemo(() => buildPeriod('hoje'), []);
  const dashboardRef = useRef<HTMLElement>(null);
  const view = useMemo(() => buildDashboardGeneralViewModel({ obraId: '', from: periodo.from, to: periodo.to }, props),
    [periodo.from, periodo.to, props.equipamentos, props.controlesEquipamentos, props.producao, props.abastecimentos, props.presencasLink, props.gruposEquipe, props.funcionarios, props.ordensServico]);
  const display = (value: number | null, unit = '') => value === null ? 'Sem registro' : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)}${unit ? ` ${unit}` : ''}`;
  const getTone = (value: string | number | null, defaultTone: 'green' | 'blue' | 'orange' | 'slate'): 'green' | 'blue' | 'orange' | 'slate' => {
    if (value === 'Sem posição' || value === 'Sem registro') return 'slate';
    return defaultTone;
  };

  useGSAP(() => {
    if (!dashboardRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(dashboardRef.current.querySelectorAll('[data-dashboard-reveal]'), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: .72, stagger: .065, ease: 'power3.out', clearProps: 'transform' });
  }, { scope: dashboardRef, dependencies: [periodo.from, periodo.to] });

  // O Painel sempre mostra o retrato operacional do dia atual. O conteúdo
  // segue rolando por dentro da TelaCheia, sem um filtro redundante no topo.
  return (
    <TelaCheia ref={dashboardRef} id="dashboard-tab" rotulo="Visão geral" longa rotuloDados="Indicadores da operação"
      cabecalho={<PageHeader tituloOculto title="Visão geral" />}
    >
      <div className="grid min-w-0 grid-flow-dense gap-4 xl:grid-cols-2" aria-label="Visualização da operação">
        <FleetDonut fleet={view.fleet} onNavigate={() => props.onNavigate('controle-equipamentos')} />
        <AvailabilityTrend measure={view.availability} onNavigate={() => props.onNavigate('controle-equipamentos')} />
      </div>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-6" aria-label="Indicadores principais">
        <ExecutiveCard label="Frota em operação" value={view.fleet.confirmed ? view.fleet.operating : 'Sem posição'} detail={`${view.fleet.confirmed} posições confirmadas`} tone={getTone(view.fleet.confirmed ? view.fleet.operating : 'Sem posição', 'green')} icon={Truck} onClick={() => props.onNavigate('controle-equipamentos')} />
        <ExecutiveCard label="Disponibilidade" value={view.fleet.availability === null ? 'Sem posição' : `${display(view.fleet.availability)}%`} detail="sobre posições confirmadas" tone={getTone(view.fleet.availability === null ? 'Sem posição' : `${display(view.fleet.availability)}%`, 'blue')} icon={Activity} onClick={() => props.onNavigate('controle-equipamentos')} />
        <ExecutiveCard label="Produção" value={display(view.production.value, view.production.unit)} detail="lançamentos em m³" tone={getTone(display(view.production.value, view.production.unit), 'slate')} icon={Activity} />
        <ExecutiveCard label="Presenças" value={display(view.presence.value)} detail="presenças registradas" tone={getTone(display(view.presence.value), 'slate')} icon={Users} onClick={() => props.onNavigate('presenca')} />
        <ExecutiveCard label="OS abertas" value={display(view.maintenance.value)} detail="pendências da frota" tone={getTone(display(view.maintenance.value), 'orange')} icon={ClipboardList} onClick={() => props.onNavigate('manutencao')} />
        <ExecutiveCard label="Combustível" value={display(view.fuel.value, view.fuel.unit)} detail="abastecimentos no período" tone="blue" icon={Activity} onClick={() => props.onNavigate('lancamentos')} />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Módulos operacionais">
        <ExecutiveCard label="Pluviômetro" value={props.diariosObra?.length ?? 0} detail="registros disponíveis" tone="blue" icon={Activity} onClick={() => props.onNavigate('pluviometro')} />
        <ExecutiveCard label="Estacas" value={props.estacas ? 'Ativo' : 'Sem dados'} detail="controle de cravações" tone="green" icon={Activity} onClick={() => props.onNavigate('estacas')} />
        <ExecutiveCard label="Solicitações" value={props.solicitacoes?.length ?? 0} detail="pedidos cadastrados" tone="orange" icon={ClipboardList} onClick={() => props.onNavigate('solicitacoes')} />
        <ExecutiveCard label="Cadastros" value={props.funcionarios.length + props.equipamentos.length} detail="pessoas e equipamentos" tone="slate" icon={Users} onClick={() => props.onNavigate('cadastros')} />
      </section>

      <TeamActivity view={view} onNavigate={props.onNavigate} />

    </TelaCheia>
  );
}
