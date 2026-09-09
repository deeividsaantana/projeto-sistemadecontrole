import { useMemo, useState, type ReactNode } from 'react';
import {
  Activity, ArrowRight, CalendarDays, CheckCircle2,
  Clock3, Fuel, Plus, Truck, Wrench, type LucideIcon,
} from 'lucide-react';
import type {
  Abastecimento, Comboio, ControleEquipamentoDiario, ControleEstacas, Empresa,
  Equipamento, FichaVerificacaoServico, FrenteServico, Funcionario, GrupoEquipe,
  HistoryLog, Inspecao, LancamentoCusto, ListaPresenca, Lubrificacao, Material,
  Medicao, MovimentoMaterial, NaoConformidade, ObraLocal, OrcamentoItem,
  OrdemServico, PlanejamentoItem, PresencaApontamento, ProdutoLubrificacao,
  RegistroProducao, TicketJazida, TipoCombustivel,
} from '../types';
import siteAerial from '../assets/renea-editorial/rodovia-duplicada-1600.webp';

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

type FleetFilter = 'Todos' | 'Em operação' | 'Em manutenção' | 'A confirmar';

const PROJECT_NAME = 'Rodoanel Mário Covas · Alça Trecho Leste';
const MAINTENANCE_STATUSES = new Set(['Em manutenção', 'Aguardando manutenção', 'Indisponível', 'Parado']);
const CONFIRM_STATUSES = new Set(['A confirmar', 'Aguardando motorista', 'Não classificado']);

const formatDate = (value: string) => {
  if (!value) return 'Sem data';
  const [year, month, day] = value.split('-');
  return [day, month, year].filter(Boolean).join('/');
};
const shortDate = (value: string) => {
  const [, month, day] = value.split('-');
  return [day, month].filter(Boolean).join('/');
};
const recordKey = (item: ControleEquipamentoDiario) => item.equipamentoId || item.prefixo || item.id;
const normalizeFleetStatus = (status: string): Exclude<FleetFilter, 'Todos'> | 'À disposição' => {
  if (status === 'Em operação') return 'Em operação';
  if (MAINTENANCE_STATUSES.has(status)) return 'Em manutenção';
  if (CONFIRM_STATUSES.has(status)) return 'A confirmar';
  return 'À disposição';
};
const uniqueLatestRecords = (records: ControleEquipamentoDiario[]) => {
  const byEquipment = new Map<string, ControleEquipamentoDiario>();
  records.forEach(item => {
    const key = recordKey(item);
    const current = byEquipment.get(key);
    if (!current || String(item.atualizadoEm || item.criadoEm) >= String(current.atualizadoEm || current.criadoEm)) {
      byEquipment.set(key, item);
    }
  });
  return Array.from(byEquipment.values());
};

function ActionLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#176b4d] transition hover:text-[#0b4935] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f26a2e]/40">
      {children}<ArrowRight className="size-3.5" aria-hidden="true" />
    </button>
  );
}

function Metric({ icon: Icon, label, value, detail, tone, active, onClick }: {
  icon: LucideIcon; label: string; value: string; detail: string;
  tone: 'graphite' | 'green' | 'orange' | 'amber'; active?: boolean; onClick: () => void;
}) {
  const tones = {
    graphite: 'border-[#213038] text-[#213038]',
    green: 'border-[#24965f] text-[#176b4d]',
    orange: 'border-[#f26a2e] text-[#c94f1c]',
    amber: 'border-[#e4a227] text-[#a76b08]',
  };
  return (
    <button type="button" onClick={onClick}
      className={'dashboard-metric group min-w-0 border-l bg-transparent px-5 py-5 text-left transition-colors duration-200 hover:bg-white/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#f26a2e]/60 ' + tones[tone] + (active ? ' is-active' : '')}>
      <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#47555c]">
        <Icon className="size-4 text-current" strokeWidth={1.8} aria-hidden="true" />{label}
      </span>
      <strong className="mt-3 block text-[clamp(2.6rem,4.5vw,5.2rem)] font-black leading-[0.82] tracking-[-0.07em] tabular-nums text-[#101c18]">{value}</strong>
      <span className="mt-2 block text-[11px] leading-snug text-[#718087]">{detail}</span>
    </button>
  );
}

function Panel({ title, action, children, className = '' }: {
  title: string; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={'min-w-0 border-t border-[#dce3df] bg-white ' + className}>
      <header className="flex min-h-14 items-center justify-between gap-3 px-4 sm:px-5">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-[#172329]">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export default function Dashboard({
  abastecimentos, historyLogs, ordensServico = [],
  controlesEquipamentos = [], planejamento = [], naoConformidades = [],
  materiais = [], movimentosMaterial = [], frentes = [], onNavigate,
}: DashboardProps) {
  const [periodDays, setPeriodDays] = useState<7 | 14 | 30>(7);
  const [fleetFilter, setFleetFilter] = useState<FleetFilter>('Todos');
  const [selectedDate, setSelectedDate] = useState('');

  /**
   * Janela de calendário, não "os últimos N dias que têm lançamento". Com a
   * segunda leitura, 7d, 14d e 30d desenhavam exatamente o mesmo gráfico
   * sempre que a obra tinha menos dias lançados do que o período pedido — o
   * botão mudava de cor e a visualização não mudava. Dia sem lançamento entra
   * na régua do tempo com `semDados`, para o eixo esticar de verdade sem que
   * o painel invente 0% de disponibilidade onde ninguém apontou nada.
   */
  const fleetSeries = useMemo(() => {
    const comLancamento = Array.from(new Set(controlesEquipamentos.map(item => item.data).filter(Boolean))).sort();
    const fim = comLancamento.at(-1) || new Date().toISOString().slice(0, 10);
    const base = new Date(`${fim}T12:00:00`);
    const dates = Array.from({ length: periodDays }, (_, index) => {
      const dia = new Date(base);
      dia.setDate(dia.getDate() - (periodDays - 1 - index));
      return dia.toISOString().slice(0, 10);
    });
    return dates.map(date => {
      const records = uniqueLatestRecords(controlesEquipamentos.filter(item => item.data === date));
      const operating = records.filter(item => normalizeFleetStatus(item.status) === 'Em operação').length;
      const maintenance = records.filter(item => normalizeFleetStatus(item.status) === 'Em manutenção').length;
      const confirm = records.filter(item => normalizeFleetStatus(item.status) === 'A confirmar').length;
      const available = records.length - operating - maintenance - confirm;
      const availability = records.length ? ((operating + available) / records.length) * 100 : 0;
      return { date, records, operating, maintenance, confirm, available, availability, semDados: records.length === 0 };
    });
  }, [controlesEquipamentos, periodDays]);

  const latest = [...fleetSeries].reverse().find(item => !item.semDados) || fleetSeries.at(-1) || {
    date: '', records: [] as ControleEquipamentoDiario[], operating: 0,
    maintenance: 0, confirm: 0, available: 0, availability: 0,
  };
  const activePoint = fleetSeries.find(item => item.date === selectedDate) || latest;
  const activePointIndex = Math.max(0, fleetSeries.findIndex(item => item.date === activePoint.date));
  const chartWidth = 620;
  const chartHeight = 210;
  const chartPadding = 18;
  const xAt = (index: number) => fleetSeries.length <= 1
    ? chartWidth / 2
    : chartPadding + index * ((chartWidth - chartPadding * 2) / (fleetSeries.length - 1));
  const yAt = (value: number) => chartHeight - chartPadding - (Math.max(0, Math.min(100, value)) / 100) * (chartHeight - chartPadding * 2);
  const pontosMedidos = fleetSeries
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !item.semDados);
  const linePoints = pontosMedidos.map(({ item, index }) => String(xAt(index)) + ',' + String(yAt(item.availability))).join(' ');
  /** Com 30 dias na régua, um rótulo por ponto vira borrão: mostra de N em N. */
  const passoRotulo = Math.max(1, Math.ceil(fleetSeries.length / 8));

  const filteredLatest = useMemo(() => latest.records
    .filter(item => fleetFilter === 'Todos' || normalizeFleetStatus(item.status) === fleetFilter)
    .sort((a, b) => a.prefixo.localeCompare(b.prefixo, 'pt-BR'))
    .slice(0, 7), [latest.records, fleetFilter]);

  const openOrders = ordensServico.filter(item => !['Concluída', 'Cancelada'].includes(item.status));
  const overduePlans = planejamento.filter(item => item.ativo && item.dataFim < new Date().toISOString().slice(0, 10) && item.situacao !== 'Concluído');
  const openQuality = naoConformidades.filter(item => item.ativo && !['Encerrada', 'Cancelada'].includes(item.situacao));
  const fuelToday = abastecimentos.filter(item => item.data === latest.date && item.status !== 'Cancelado')
    .reduce((sum, item) => sum + Number(item.quantidadeLitros || 0), 0);
  const stock = useMemo(() => {
    const balances = new Map<string, number>();
    movimentosMaterial.forEach(item => {
      const current = balances.get(item.materialId) || 0;
      const quantity = Math.abs(Number(item.quantidade || 0));
      balances.set(item.materialId, current + (item.tipo === 'Entrada' ? quantity : item.tipo === 'Saída' ? -quantity : Number(item.quantidade || 0)));
    });
    return balances;
  }, [movimentosMaterial]);
  const criticalMaterials = materiais.filter(item => item.ativo && Number(item.estoqueMinimo || 0) > (stock.get(item.id) || 0));

  const activity = historyLogs.slice(0, 6);
  const latestActivityTime = activity[0]?.timestamp || (latest.date ? formatDate(latest.date) : 'Sem sincronização');
  const activeFronts = frentes.filter(item => item.ativo && item.situacao !== 'Concluída').slice(0, 3);

  const chooseFilter = (filter: FleetFilter) => {
    setFleetFilter(filter);
  };

  return (
    <main id="dashboard-tab" className="erp-dashboard min-h-full bg-[#eef0ec] pb-14 text-[#172329]">
      <header className="dashboard-hero border-b border-[#cbd4cf] bg-[#f7f8f5]">
        <div className="dashboard-hero__visual" aria-hidden="true">
          <img src={siteAerial} alt="" />
          <span>Pessoas<br />e engenharia<br />em movimento</span>
        </div>
        <div className="dashboard-hero__content px-4 py-7 sm:px-7 lg:px-8 lg:py-10">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#52615b]">Operação em tempo real</p>
            <h1 className="mt-3 text-[clamp(3rem,5vw,5.15rem)] font-black leading-[0.86] tracking-[-0.075em] text-[#07110e] lg:whitespace-nowrap">Visão operacional</h1>
            <p className="mt-4 text-[clamp(1rem,2vw,1.6rem)] font-bold tracking-[-0.025em] text-[#16372e]">{PROJECT_NAME}</p>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#66736e]">Frota, pendências e movimentações recentes reunidas em uma leitura diária.</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-3 pb-8 sm:px-6 lg:px-8">
        <section className="dashboard-metrics grid border-b border-[#cdd6d1] bg-[#f7f8f4]" aria-label="Indicadores da frota">
          <Metric icon={Activity} label="Frota ativa" value={String(latest.operating)} detail={(latest.records.length ? (latest.operating / latest.records.length) * 100 : 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '% dos informados'} tone="green" active={fleetFilter === 'Em operação'} onClick={() => chooseFilter('Em operação')} />
          <Metric icon={Wrench} label="Em manutenção" value={String(latest.maintenance)} detail={openOrders.length + ' ordens de serviço abertas'} tone="orange" active={fleetFilter === 'Em manutenção'} onClick={() => chooseFilter('Em manutenção')} />
          <Metric icon={Clock3} label="A confirmar" value={String(latest.confirm)} detail="aguardando definição operacional" tone="amber" active={fleetFilter === 'A confirmar'} onClick={() => chooseFilter('A confirmar')} />
          <Metric icon={Truck} label="Disponibilidade" value={latest.availability.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%'} detail={latest.date ? 'posição de ' + formatDate(latest.date) : 'sem lançamento no período'} tone="green" active={fleetFilter === 'Todos'} onClick={() => chooseFilter('Todos')} />
          <div className="dashboard-metric-cta grid place-items-center px-5 py-6">
            <button type="button" onClick={() => onNavigate('controle-equipamentos')}
              className="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-[2px] bg-[#083c2f] px-5 text-sm font-black text-[#ffffff] transition hover:bg-[#07513c] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f26a2e]/50">
              <Plus className="size-5" aria-hidden="true" />Novo lançamento
            </button>
          </div>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.72fr)_minmax(21rem,.78fr)]">
          <Panel title="Disponibilidade da frota" action={<div className="flex items-center gap-3"><span className="text-[10px] font-bold uppercase tracking-[.13em] text-[#748187]">Últimos {periodDays} dias</span><div className="inline-flex border border-[#d7dfda] bg-white" aria-label="Período do painel">{([7, 14, 30] as const).map(days => <button key={days} type="button" onClick={() => setPeriodDays(days)} aria-pressed={periodDays === days} className={'min-h-8 px-2 text-[10px] font-bold ' + (periodDays === days ? 'bg-[#123d31] text-[#ffffff]' : 'text-[#617078] hover:bg-[#f0f3f0]')}>{days}d</button>)}</div></div>}>
            <div className="px-4 pb-5 sm:px-5">
              <div className="flex items-end gap-3">
                <strong className="text-4xl font-semibold tracking-[-0.05em] tabular-nums">{activePoint.availability.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</strong>
                <span className="pb-1 text-xs text-[#758188]">{activePoint.operating} operando de {activePoint.records.length}</span>
              </div>
              {pontosMedidos.length ? (
                <div className="relative mt-5 overflow-hidden border-y border-[#e4e9e6] py-4">
                  <svg viewBox={'0 0 ' + chartWidth + ' ' + chartHeight} className="h-56 w-full" role="img" aria-label="Evolução da disponibilidade da frota">
                    {[25, 50, 75, 100].map(value => (
                      <g key={value}>
                        <line x1="0" x2={chartWidth} y1={yAt(value)} y2={yAt(value)} stroke="#e4e9e6" strokeWidth="1" />
                        <text x="2" y={yAt(value) - 5} fill="#8a969b" fontSize="9">{value}%</text>
                      </g>
                    ))}
                    <polyline key={`${periodDays}-${linePoints}`} className="dashboard-trend-line" points={linePoints} fill="none" stroke="#238657" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" pathLength="1" />
                    {fleetSeries.map((item, index) => (
                      <g key={item.date} className="dashboard-trend-point" style={{ animationDelay: `${260 + index * 65}ms` }}>
                        {item.semDados ? (
                          /* Marca de "não teve lançamento" fica abaixo da linha
                             de base: um ponto em cima dela seria lido como 0%. */
                          <line x1={xAt(index)} x2={xAt(index)} y1={yAt(0) + 3} y2={yAt(0) + 8} stroke="#c7d2cc" strokeWidth="2" strokeLinecap="round" />
                        ) : (
                          <circle cx={xAt(index)} cy={yAt(item.availability)} r={index === activePointIndex ? 6 : 4} fill="#fff" stroke={index === activePointIndex ? '#ed5d24' : '#238657'} strokeWidth="3" />
                        )}
                        {index % passoRotulo === 0 || index === fleetSeries.length - 1 ? (
                          <text x={xAt(index)} y={chartHeight - 2} textAnchor="middle" fill="#78858b" fontSize="9">{shortDate(item.date)}</text>
                        ) : null}
                        <circle cx={xAt(index)} cy={item.semDados ? yAt(0) : yAt(item.availability)} r="15" fill="transparent" className={item.semDados ? '' : 'cursor-pointer'}
                          onClick={() => { if (!item.semDados) setSelectedDate(item.date); }}>
                          <title>{item.semDados
                            ? formatDate(item.date) + ': sem lançamento de frota'
                            : formatDate(item.date) + ': ' + item.availability.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%'}</title>
                        </circle>
                      </g>
                    ))}
                  </svg>
                  <div className="absolute right-3 top-3 border border-[#d7dfda] bg-white px-3 py-2 text-xs shadow-[0_8px_24px_-18px_rgba(19,52,41,.55)]">
                    <strong className="block tabular-nums text-[#172329]">{activePoint.availability.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</strong>
                    <span className="text-[#758188]">{formatDate(activePoint.date)}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-5 flex h-56 items-center justify-center border-y border-[#e4e9e6] text-sm text-[#7a878c]">Sem lançamento de frota nos últimos {periodDays} dias</div>
              )}
            </div>
          </Panel>

          <Panel title="Ocorrências agora" action={<span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.12em] text-[#008b62]"><i className="size-2 rounded-full bg-[#00a875]" />Ao vivo</span>}>
            <div className="divide-y divide-[#edf0ee]">
              {activity.length ? activity.map(log => (
                <button key={log.id} type="button" onClick={() => onNavigate('auditoria')}
                  className="flex w-full gap-3 px-4 py-3 text-left transition hover:bg-[#f7f9f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#f26a2e]/30 sm:px-5">
                  <span className={'mt-1.5 size-2 shrink-0 ' + (log.acao === 'Excluiu' ? 'bg-[#d94f3d]' : log.acao === 'Editou' ? 'bg-[#e4a227]' : 'bg-[#238657]')} />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-xs font-semibold text-[#27353b]">{log.tela}</strong>
                    <span className="mt-1 block line-clamp-2 text-[11px] leading-snug text-[#718087]">{log.descricao}</span>
                  </span>
                  <time className="shrink-0 text-[10px] tabular-nums text-[#8a969b]">{log.timestamp.split(' ')[1]?.slice(0, 5) || '—'}</time>
                </button>
              )) : (
                <div className="grid min-h-64 place-content-center px-5 text-center text-sm text-[#7a878c]">Nenhuma atividade registrada</div>
              )}
            </div>
          </Panel>
        </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(20rem,.82fr)]">
          <Panel title="Itens críticos" className="border-t-[3px] border-t-[#ed5d24]" action={<ActionLink onClick={() => onNavigate('timeline')}>Ver todos</ActionLink>}>
            <div className="divide-y divide-[#edf0ee]">
              {[
                { value: latest.maintenance, text: 'equipamento(s) em manutenção', detail: openOrders.length + ' OS abertas', target: 'manutencao', tone: 'bg-[#d94f3d]' },
                { value: latest.confirm, text: 'situação(ões) a confirmar', detail: 'fechamento operacional pendente', target: 'controle-equipamentos', tone: 'bg-[#e4a227]' },
                { value: overduePlans.length, text: 'atividade(s) fora do prazo', detail: 'planejamento requer revisão', target: 'planejamento', tone: 'bg-[#ed5d24]' },
                { value: openQuality.length + criticalMaterials.length, text: 'alerta(s) de qualidade ou estoque', detail: 'verificação recomendada', target: openQuality.length ? 'nao-conformidades' : 'materiais', tone: 'bg-[#839096]' },
              ].map(item => (
                <button key={item.text} type="button" onClick={() => onNavigate(item.target)}
                  className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-[#f7f9f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#f26a2e]/30 sm:px-5">
                  <span className={'mt-1.5 size-2 shrink-0 ' + item.tone} />
                  <span className="min-w-0 flex-1">
                    <strong className="block text-xs font-semibold text-[#27353b]">{item.value} {item.text}</strong>
                    <span className="mt-1 block text-[11px] text-[#718087]">{item.detail}</span>
                  </span>
                  <ArrowRight className="mt-1 size-3.5 shrink-0 text-[#9aa5a0]" />
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="Status das frentes" action={<ActionLink onClick={() => onNavigate('frentes')}>Ver frentes</ActionLink>}>
            <div className="divide-y divide-[#edf0ee]">
              {(activeFronts.length ? activeFronts : [{ id: 'empty', nome: 'Nenhuma frente ativa', servico: 'Cadastre as frentes de serviço', situacao: 'Planejada' as const }]).map((frente, index) => (
                <button key={frente.id} type="button" onClick={() => onNavigate('frentes')} className="group grid w-full grid-cols-[4.5rem_1fr_auto] items-center gap-3 px-4 py-3 text-left hover:bg-[#f7f9f7] sm:px-5">
                  <span className="h-11 overflow-hidden bg-[#dfe6e1]"><img src={siteAerial} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-110" style={{ objectPosition: `${35 + index * 22}% center` }} /></span>
                  <span className="min-w-0"><strong className="block truncate text-xs font-bold text-[#172329]">{frente.nome}</strong><small className="mt-1 block truncate text-[10px] text-[#718087]">{frente.servico || frente.situacao}</small></span>
                  <span className="text-[10px] font-black uppercase tracking-[.08em] text-[#087653]">{frente.situacao}</span>
                </button>
              ))}
            </div>
          </Panel>
        </section>

        <Panel title={'Equipamentos em destaque · ' + fleetFilter} className="mt-4" action={<ActionLink onClick={() => onNavigate('controle-equipamentos')}>Ver frota completa</ActionLink>}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-[#f2f4f1] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#738087]">
                <tr>
                  <th className="px-4 py-3 sm:px-5">Prefixo</th><th className="px-4 py-3">Equipamento</th>
                  <th className="px-4 py-3">Situação</th><th className="px-4 py-3">Motorista</th>
                  <th className="px-4 py-3">Saída</th><th className="px-4 py-3">Atualização</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6ebe8]">
                {filteredLatest.map(item => (
                  <tr key={item.id} onClick={() => onNavigate('controle-equipamentos')} className="cursor-pointer bg-white transition hover:bg-[#f7f9f7]">
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#172329] sm:px-5">{item.prefixo || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#5e6c72]">{item.tipoEquipamento || item.familia || 'Equipamento'}</td>
                    <td className="whitespace-nowrap px-4 py-3"><span className="inline-flex items-center gap-2"><i className={'size-2 ' + (normalizeFleetStatus(item.status) === 'Em operação' ? 'bg-[#238657]' : normalizeFleetStatus(item.status) === 'Em manutenção' ? 'bg-[#ed5d24]' : 'bg-[#e4a227]')} />{item.status}</span></td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#5e6c72]">{item.nomeMotorista || 'Não informado'}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-[#5e6c72]">{item.horaSaida || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#7b878c]">{formatDate(item.data)}</td>
                  </tr>
                ))}
                {!filteredLatest.length && (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-[#7a878c]">Nenhum equipamento encontrado neste filtro.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e4e9e6] px-4 py-3 text-[11px] text-[#718087] sm:px-5">
            <span>{filteredLatest.length} registro(s) exibido(s)</span>
            <span className="inline-flex items-center gap-2"><Fuel className="size-3.5 text-[#176b4d]" />{fuelToday.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L abastecidos na data</span>
          </footer>
        </Panel>

        {!controlesEquipamentos.length && (
          <section className="mt-4 flex flex-col items-center justify-center border border-dashed border-[#cbd5cf] bg-white px-6 py-12 text-center">
            <CalendarDays className="size-7 text-[#176b4d]" strokeWidth={1.6} />
            <h2 className="mt-3 text-base font-semibold">A visão operacional começa com o primeiro lançamento</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-[#718087]">Registre a situação da frota para liberar indicadores, evolução e pendências deste painel.</p>
            <button type="button" onClick={() => onNavigate('controle-equipamentos')} className="mt-5 inline-flex min-h-11 items-center gap-2 bg-[#183f32] px-4 text-sm font-semibold text-[#ffffff] hover:bg-[#0f3025]">
              <Plus className="size-4" />Criar lançamento
            </button>
          </section>
        )}

        {(latest.maintenance === 0 && latest.confirm === 0 && overduePlans.length === 0 && openQuality.length === 0) && controlesEquipamentos.length > 0 && (
          <div className="mt-4 flex items-center gap-3 border-l-2 border-[#238657] bg-white px-4 py-3 text-xs text-[#54636a]">
            <CheckCircle2 className="size-4 text-[#238657]" />Nenhuma pendência crítica identificada no retrato mais recente.
          </div>
        )}
      </div>
    </main>
  );
}
