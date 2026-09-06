/** Painel executivo do ERP RENEA: ambiente operacional, com dados reais. */
import { useMemo, useRef, useState, type ReactNode } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Activity, AlertTriangle, ChevronRight, Clock3, Droplets, Gauge, ListChecks, PieChart, Truck, UserCheck, UserX, Wrench } from 'lucide-react';
import type { Abastecimento, Comboio, ControleEquipamentoDiario, ControleEstacas, Empresa, Equipamento, Funcionario, GrupoEquipe, HistoryLog, ListaPresenca, Lubrificacao, ObraLocal, OrdemServico, PresencaApontamento, ProdutoLubrificacao, TicketJazida, TipoCombustivel } from '../types';
import { splitOperationalFuelRecords } from '../utils/fuelAnalyticsSafety';
import { listarPendencias } from '../utils/pendencias';
import { CompactMetric, DataTable, KpiCard, PageHeader, PeriodFilter, StatusBadge, buildPeriod, type PeriodValue } from '../shared/ui';

interface DashboardProps {
  empresas: Empresa[]; obras: ObraLocal[]; equipamentos: Equipamento[]; funcionarios: Funcionario[]; comboios: Comboio[]; combustiveis: TipoCombustivel[]; lubrificantes: ProdutoLubrificacao[]; abastecimentos: Abastecimento[]; lubrificacoes: Lubrificacao[]; historyLogs: HistoryLog[]; listasPresenca?: ListaPresenca[]; ordensServico?: OrdemServico[]; ticketsJazida?: TicketJazida[]; estacas?: ControleEstacas; presencasLink?: PresencaApontamento[]; controlesEquipamentos?: ControleEquipamentoDiario[]; gruposEquipe?: GrupoEquipe[]; onNavigate: (tab: string) => void;
}

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const ACAO_TONE: Record<HistoryLog['acao'], string> = {
  Criou: 'bg-emerald-50 text-emerald-700',
  Editou: 'bg-sky-50 text-sky-700',
  Sincronizou: 'bg-sky-50 text-sky-700',
  Excluiu: 'bg-rose-50 text-rose-700',
  Inativou: 'bg-amber-50 text-amber-700',
  Desmobilizou: 'bg-amber-50 text-amber-700',
};

const OPERATING_STATUS = ['Em operação'];
const MAINTENANCE_STATUS = ['Em manutenção', 'Aguardando manutenção'];
const WAITING_STATUS = ['A confirmar', 'Aguardando motorista', 'Aguardando equipamento'];

const DONUT_RADIUS = 40;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

const SectionTitle = ({ icon: Icon, tone, children }: { icon: typeof Activity; tone: string; children: ReactNode }) => (
  <div className="flex items-center gap-2.5">
    <span className={`grid size-7 shrink-0 place-items-center rounded-lg text-white shadow-md ${tone}`}><Icon size={14} strokeWidth={2.5} /></span>
    <p className="text-sm font-bold text-slate-800">{children}</p>
  </div>
);

const inRange = (date: string | undefined, from: string, to: string) => Boolean(date) && date! >= from && date! <= to;

export default function Dashboard({
  obras,
  equipamentos,
  abastecimentos,
  historyLogs,
  listasPresenca = [],
  ordensServico = [],
  ticketsJazida = [],
  presencasLink = [],
  controlesEquipamentos = [],
  gruposEquipe = [],
  onNavigate,
}: DashboardProps) {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const donutGroupRef = useRef<SVGGElement>(null);
  const percentRef = useRef<HTMLElement>(null);
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [period, setPeriod] = useState<PeriodValue>(() => buildPeriod('hoje'));
  const now = new Date();
  const formattedToday = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }).format(now);
  const formattedWeekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(now);

  // Situação da frota vem do controle diário — a fonte que a operação preenche
  // todo dia. O cadastro só entra para saber quantos equipamentos existem.
  const fleet = useMemo(() => {
    const noPeriodo = controlesEquipamentos.filter(item => inRange(item.data, period.from, period.to));
    // Um equipamento pode ter vários lançamentos no período: vale o mais recente.
    const ultimoPorEquipamento = new Map<string, ControleEquipamentoDiario>();
    noPeriodo.forEach(item => {
      const chave = item.equipamentoId || item.prefixo;
      const atual = ultimoPorEquipamento.get(chave);
      if (!atual || `${item.data}${item.atualizadoEm}` >= `${atual.data}${atual.atualizadoEm}`) {
        ultimoPorEquipamento.set(chave, item);
      }
    });
    const registros = Array.from(ultimoPorEquipamento.values());
    const operando = registros.filter(item => OPERATING_STATUS.includes(item.status)).length;
    const manutencao = registros.filter(item => MAINTENANCE_STATUS.includes(item.status)).length;
    const aConfirmar = registros.filter(item => WAITING_STATUS.includes(item.status)).length;
    const disponivel = registros.filter(item => item.status === 'Disponível' || item.status === 'Reserva').length;
    const informados = registros.length;
    const disponibilidade = informados ? Math.round((operando / informados) * 100) : 0;
    return { operando, manutencao, aConfirmar, disponivel, informados, disponibilidade, registros };
  }, [controlesEquipamentos, period.from, period.to]);

  const pessoas = useMemo(() => {
    const noPeriodo = presencasLink.filter(item => inRange(item.data, period.from, period.to));
    // Atraso e saída antecipada são presença: a pessoa trabalhou no dia.
    const presentes = noPeriodo.filter(item => ['Presente', 'Atraso', 'Saída antecipada'].includes(item.status)).length;
    const ausentes = noPeriodo.filter(item => item.status === 'Ausente').length;
    const justificados = noPeriodo.filter(item => ['Falta justificada', 'Atestado', 'Férias', 'Afastado'].includes(item.status)).length;
    return { presentes, ausentes, justificados, total: noPeriodo.length };
  }, [presencasLink, period.from, period.to]);

  const movimento = useMemo(() => {
    const viagens = ticketsJazida.filter(item => inRange(item.data, period.from, period.to));
    const { operational } = splitOperationalFuelRecords(abastecimentos.filter(item => inRange(item.data, period.from, period.to)));
    const litros = operational.reduce((total, item) => total + (Number(item.quantidadeLitros) || 0), 0);
    return { viagens: viagens.length, viagensRascunho: viagens.filter(item => item.statusFluxo === 'Rascunho').length, abastecimentos: operational.length, litros };
  }, [ticketsJazida, abastecimentos, period.from, period.to]);

  // Pendências vêm da mesma função da tela de Pendências: existe uma regra só
  // para o que está em aberto, e o painel não pode divergir dela.
  const pendencias = useMemo(() => listarPendencias({
    hoje: new Date().toISOString().slice(0, 10),
    inicio: period.from,
    fim: period.to,
    equipamentos,
    controlesEquipamentos,
    gruposEquipe,
    presencasLink,
    listasPresenca,
    obras,
    ordensServico,
    ticketsJazida,
  }).slice(0, 6), [equipamentos, controlesEquipamentos, gruposEquipe, presencasLink, listasPresenca, obras, ordensServico, ticketsJazida, period.from, period.to]);

  const fleetSituation = [
    { label: 'Em operação', value: fleet.operando, color: '#087345' },
    { label: 'Em manutenção', value: fleet.manutencao, color: '#d97706' },
    { label: 'A confirmar', value: fleet.aConfirmar, color: '#0284c7' },
    { label: 'À disposição', value: fleet.disponivel, color: '#94a3b8' },
  ];
  const fleetTotal = fleetSituation.reduce((sum, item) => sum + item.value, 0);
  const donutSegments = useMemo(() => {
    let offset = 0;
    return fleetSituation.map(item => {
      const length = fleetTotal ? (item.value / fleetTotal) * DONUT_CIRCUMFERENCE : 0;
      const pct = fleetTotal ? Math.round((item.value / fleetTotal) * 100) : 0;
      const segment = { ...item, length, offset, pct };
      offset += length;
      return segment;
    });
  }, [fleetSituation, fleetTotal]);
  const visibleSegmentCount = donutSegments.filter(segment => segment.length > 0).length;
  const donutGap = visibleSegmentCount > 1 ? 1.5 : 0;
  const centerLabel = hoveredSegment !== null ? donutSegments[hoveredSegment] : null;

  // Atividade real (histórico de ações) da semana — nada fictício, é contagem de eventos já registrados.
  const weeklyActivity = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      return date;
    });
    const counts = days.map(date => {
      const key = date.toLocaleDateString('pt-BR');
      return historyLogs.filter(log => log.timestamp.startsWith(key)).length;
    });
    const max = Math.max(1, ...counts);
    return days.map((date, index) => ({ label: WEEKDAY_LABELS[date.getDay()], count: counts[index], pct: Math.round((counts[index] / max) * 100) }));
  }, [historyLogs]);

  const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useGSAP(() => {
    if (reduceMotion || !dashboardRef.current) return;
    gsap.fromTo(dashboardRef.current.querySelectorAll('[data-erp-enter]'), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.38, stagger: 0.045, ease: 'power2.out', clearProps: 'transform,opacity,visibility' });
  }, { scope: dashboardRef, dependencies: [fleet.operando, historyLogs.length] });
  useGSAP(() => {
    if (!barsRef.current) return;
    const bars = barsRef.current.querySelectorAll<HTMLElement>('[data-bar]');
    if (reduceMotion) {
      bars.forEach(bar => { bar.style.height = `${bar.dataset.pct}%`; });
      return;
    }
    gsap.fromTo(bars, { height: '4%' }, {
      height: (index, target) => `${target.dataset.pct}%`,
      duration: 0.65,
      ease: 'power3.out',
      stagger: 0.06,
      delay: 0.25,
    });
  }, { scope: barsRef, dependencies: [weeklyActivity] });
  useGSAP(() => {
    if (!donutGroupRef.current) return;
    if (reduceMotion) {
      gsap.set(donutGroupRef.current, { scale: 1, opacity: 1 });
    } else {
      gsap.fromTo(donutGroupRef.current, { scale: 0.4, opacity: 0, transformOrigin: '50% 50%' }, { scale: 1, opacity: 1, duration: 0.7, ease: 'back.out(1.6)', delay: 0.15 });
    }
    if (percentRef.current) {
      if (reduceMotion) {
        percentRef.current.textContent = `${fleet.disponibilidade}%`;
      } else {
        const counter = { current: 0 };
        gsap.to(counter, {
          current: fleet.disponibilidade, duration: 0.9, ease: 'power2.out', delay: 0.2,
          onUpdate: () => { if (percentRef.current) percentRef.current.textContent = `${Math.round(counter.current)}%`; },
        });
      }
    }
  }, { scope: dashboardRef, dependencies: [fleet.disponibilidade, donutSegments.length] });

  // Situação completa da frota para a barra segmentada: o cadastro entra só
  // para saber quantos existem e quantos estão inativos.
  const situacaoFrota = useMemo(() => {
    const inativos = equipamentos.filter(item => ['Desmobilizado', 'Parado'].includes(item.status)).length;
    const total = equipamentos.length;
    return [
      { label: 'Em operação', valor: fleet.operando, cor: '#087353' },
      { label: 'Em manutenção', valor: fleet.manutencao, cor: '#d97706' },
      { label: 'A confirmar', valor: fleet.aConfirmar, cor: '#0284c7' },
      { label: 'À disposição', valor: fleet.disponivel, cor: '#94a3b8' },
      { label: 'Inativo', valor: inativos, cor: '#cbd5e1' },
    ].map(item => ({ ...item, pct: total > 0 ? (item.valor / total) * 100 : 0, total }));
  }, [equipamentos, fleet.aConfirmar, fleet.disponivel, fleet.manutencao, fleet.operando]);

  const totalFrota = equipamentos.length;

  // Equipamentos que exigem atenção: derivado do controle diário, sem campo novo.
  const atencao = useMemo(() => fleet.registros
    .filter(item => MAINTENANCE_STATUS.includes(item.status) || WAITING_STATUS.includes(item.status))
    .map(item => ({
      id: item.id,
      prefixo: item.prefixo,
      situacao: item.status,
      problema: item.motivoManutencao || item.observacao || 'Sem atualização hoje',
      tempo: item.horaEntradaManutencao && item.horaLiberacao === ''
        ? `desde ${item.horaEntradaManutencao}`
        : item.horaSaida ? `saída ${item.horaSaida}` : '—',
    }))
    .slice(0, 6), [fleet.registros]);

  const latestLogs = historyLogs.slice(0, 6);
  const periodoLabel = period.from === period.to
    ? period.from.split('-').reverse().join('/')
    : `${period.from.split('-').reverse().join('/')} a ${period.to.split('-').reverse().join('/')}`;

  return <div ref={dashboardRef} id="dashboard-tab" className="erp-dashboard min-h-full w-full bg-[#f7f8f6] px-5 pb-12 pt-7 sm:px-7 lg:px-9 2xl:px-10">
    <div data-erp-enter>
      <PageHeader
        title="Painel de Controle"
        description="Visão operacional consolidada da frota, equipes e atividades."
        actions={<div className="text-right">
          <p className="text-[13px] font-semibold text-slate-700">
            <span className="capitalize">{formattedWeekday}</span>, {formattedToday}
          </p>
          <p className="text-[11px] text-slate-400">Período analisado: {periodoLabel}</p>
        </div>}
      />
    </div>

    <div data-erp-enter className="mt-4">
      <PeriodFilter value={period} onChange={setPeriod} />
    </div>

    <section data-erp-enter className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Em operação"
        valor={fleet.operando}
        contexto={`de ${totalFrota} equipamentos`}
        destaque={totalFrota ? `${((fleet.operando / totalFrota) * 100).toFixed(1).replace('.', ',')}%` : undefined}
        percentual={totalFrota ? (fleet.operando / totalFrota) * 100 : 0}
        icone={Truck}
        estado="operacao"
        onClick={() => onNavigate('controle-equipamentos')}
      />
      <KpiCard
        label="Em manutenção"
        valor={fleet.manutencao}
        contexto={`de ${totalFrota} equipamentos`}
        destaque={totalFrota ? `${((fleet.manutencao / totalFrota) * 100).toFixed(1).replace('.', ',')}%` : undefined}
        percentual={totalFrota ? (fleet.manutencao / totalFrota) * 100 : 0}
        icone={Wrench}
        estado="manutencao"
        onClick={() => onNavigate('manutencao')}
      />
      <KpiCard
        label="A confirmar"
        valor={fleet.aConfirmar}
        contexto={`de ${totalFrota} equipamentos`}
        destaque={totalFrota ? `${((fleet.aConfirmar / totalFrota) * 100).toFixed(1).replace('.', ',')}%` : undefined}
        percentual={totalFrota ? (fleet.aConfirmar / totalFrota) * 100 : 0}
        icone={Clock3}
        estado="confirmar"
        onClick={() => onNavigate('controle-equipamentos')}
      />
      <KpiCard
        label="Disponibilidade"
        valor={`${fleet.disponibilidade}%`}
        contexto={`${fleet.operando} de ${totalFrota} equipamentos`}
        percentual={fleet.disponibilidade}
        icone={Gauge}
        estado="operacao"
        onClick={() => onNavigate('controle-equipamentos')}
      />
    </section>

    <section data-erp-enter className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <CompactMetric
        label="Presentes"
        valor={pessoas.presentes}
        contexto={`de ${pessoas.total || 0} colaboradores`}
        variacao={pessoas.total ? `${Math.round((pessoas.presentes / pessoas.total) * 100)}%` : undefined}
        icone={UserCheck}
        estado="operacao"
        onClick={() => onNavigate('presenca')}
      />
      <CompactMetric
        label="Ausências"
        valor={pessoas.ausentes}
        contexto="colaboradores"
        variacao={pessoas.total ? `${Math.round((pessoas.ausentes / pessoas.total) * 100)}%` : undefined}
        icone={UserX}
        estado="erro"
        onClick={() => onNavigate('presenca')}
      />
      <CompactMetric
        label="Viagens"
        valor={movimento.viagens}
        contexto="registros"
        variacao={movimento.viagensRascunho ? `${movimento.viagensRascunho} rascunho` : undefined}
        icone={Truck}
        estado="confirmar"
        onClick={() => onNavigate('tickets-jazida')}
      />
      <CompactMetric
        label="Abastecimentos"
        valor={movimento.abastecimentos}
        contexto="registros"
        variacao={movimento.litros ? `${movimento.litros.toLocaleString('pt-BR')} L` : undefined}
        icone={Droplets}
        estado="neutro"
        onClick={() => onNavigate('lancamentos')}
      />
    </section>

    <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <article data-erp-enter className="rounded-xl border border-slate-200 bg-white p-5">
        <SectionTitle icon={PieChart} tone="bg-gradient-to-br from-emerald-500 to-emerald-700">Situação da Frota</SectionTitle>
        {totalFrota === 0 ? (
          <p className="mt-6 text-center text-[13px] text-slate-500">Nenhum equipamento cadastrado.</p>
        ) : (
          <>
            <div className="mt-5 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Distribuição da frota por situação">
              {situacaoFrota.filter(item => item.valor > 0).map(item => (
                <span key={item.label} style={{ width: `${item.pct}%`, backgroundColor: item.cor }} title={`${item.label}: ${item.valor}`} />
              ))}
            </div>
            <ul className="mt-4 divide-y divide-slate-100">
              {situacaoFrota.map(item => (
                <li key={item.label} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex min-w-0 items-center gap-2.5 text-[13px] text-slate-600">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.cor }} />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <strong className="shrink-0 text-[14px] font-bold tabular-nums text-slate-900">{item.valor}</strong>
                </li>
              ))}
              <li className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-[13px] font-semibold text-slate-700">Total</span>
                <strong className="text-[14px] font-bold tabular-nums text-slate-900">{totalFrota}</strong>
              </li>
            </ul>
          </>
        )}
      </article>

      <article data-erp-enter className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <SectionTitle icon={AlertTriangle} tone="bg-gradient-to-br from-amber-500 to-amber-600">Equipamentos que exigem atenção</SectionTitle>
          <button type="button" onClick={() => onNavigate('controle-equipamentos')} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#087353] hover:text-[#065f3c]">
            Ver todos <ChevronRight size={14} />
          </button>
        </header>
        {atencao.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-slate-500">Nenhum equipamento pedindo atenção no período.</p>
        ) : (
          <DataTable
            larguraMinima={520}
            itens={atencao}
            chaveDe={item => item.id}
            colunas={[
              { chave: 'prefixo', titulo: 'Prefixo', render: item => <span className="font-semibold text-slate-800">{item.prefixo}</span> },
              { chave: 'situacao', titulo: 'Situação', render: item => <StatusBadge>{item.situacao}</StatusBadge> },
              { chave: 'problema', titulo: 'Problema', render: item => <span className="line-clamp-1">{item.problema}</span> },
              { chave: 'tempo', titulo: 'Tempo', alinhamento: 'direita', ocultarNoCelular: true },
            ]}
          />
        )}
      </article>
    </section>

    <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <article data-erp-enter className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 px-5 py-4">
          <SectionTitle icon={AlertTriangle} tone="bg-gradient-to-br from-amber-500 to-amber-600">Pendências do período</SectionTitle>
        </header>
        {pendencias.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">Nenhuma pendência no período selecionado.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pendencias.map(item => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(item.tab)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-amber-50/50"
                >
                  <span className="min-w-0 text-sm text-slate-700">{item.titulo}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <strong className="tabular-nums text-base font-black text-amber-700">{item.quantidade}</strong>
                    <ChevronRight size={16} className="text-slate-300" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article data-erp-enter className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <SectionTitle icon={ListChecks} tone="bg-gradient-to-br from-slate-600 to-slate-800">Últimos Registros</SectionTitle>
          <button type="button" onClick={() => onNavigate('consulta-geral')} className="inline-flex items-center gap-1 text-sm font-semibold text-[#087345] transition-colors hover:text-[#065f3c]">Ver todos <ChevronRight size={16} /></button>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead><tr className="bg-slate-50/80"><th className="px-5 py-3 font-semibold text-slate-500">Horário</th><th className="px-4 py-3 font-semibold text-slate-500">Módulo</th><th className="px-4 py-3 font-semibold text-slate-500">Descrição</th><th className="px-5 py-3 font-semibold text-slate-500">Ação</th></tr></thead>
            <tbody>{latestLogs.length ? latestLogs.map(log => <tr key={log.id} className="border-t border-slate-100 transition-colors duration-150 hover:bg-emerald-50/40">
              <td className="px-5 py-3 font-mono text-slate-600">{log.timestamp.split(' ')[1] || log.timestamp}</td>
              <td className="px-4 py-3 font-medium text-slate-700">{log.tela}</td>
              <td className="px-4 py-3 text-slate-600">{log.descricao}</td>
              <td className="px-5 py-3"><span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold ${ACAO_TONE[log.acao]}`}>{log.acao}</span></td>
            </tr>) : <tr><td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-500">Nenhum registro encontrado.</td></tr>}</tbody>
          </table>
        </div>
      </article>
    </section>
  </div>;
}
