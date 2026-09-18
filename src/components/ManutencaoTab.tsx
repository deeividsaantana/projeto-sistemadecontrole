/**
 * Manutenção: abertura, acompanhamento e liberação das ordens de serviço.
 * As horas paradas saem da própria ordem — abertura até liberação.
 */
import { useMemo, useState } from 'react';
import { Clock3, FileSpreadsheet, Gauge, Plus, Search, TriangleAlert, Wrench } from 'lucide-react';
import type { Equipamento, OrdemServico } from '../types';
import {
  FLUXO_MANUTENCAO,
  calcularHorasParadas,
  isOrdemEncerrada,
  proximoNumeroOrdemServico,
  proximoStatusManutencao,
} from '../utils/manutencao';
import { normalizeComparable } from '../utils/canonicalIdentity';
import {
  EQUIPMENT_FAMILIES,
  EQUIPMENT_FAMILY_LABELS,
  classifyEquipment,
  equipmentFamilyIcon,
  presentEquipment,
  type EquipmentFamily,
} from '../utils/equipmentPresentation';
import { downloadManutencaoWorkbook } from '../utils/manutencaoExport';
import {
  Badge,
  ConfirmDialog,
  EmptyState,
  Modal,
  PageHeader,
  PeriodFilter,
  TableBody,
  TableHead,
  TableShell,
  buildPeriod,
  statusTone,
  type PeriodValue,
} from '../shared/ui';

interface ManutencaoTabProps {
  ordensServico: OrdemServico[];
  equipamentos: Equipamento[];
  /** Quem está operando: entra como responsável e no log da alteração. */
  responsavel: string;
  podeEditar: boolean;
  onSave: (ordem: OrdemServico, isNew: boolean) => void;
  onDelete: (id: string) => void;
}

const TIPOS: OrdemServico['tipo'][] = ['Corretiva', 'Preventiva', 'Preditiva', 'Revisão'];
const PRIORIDADES: OrdemServico['prioridade'][] = ['Baixa', 'Média', 'Alta', 'Urgente'];
const STATUS_FILTRO = ['Todas', 'Em aberto', ...FLUXO_MANUTENCAO, 'Cancelada'] as const;

const prioridadeTone = (prioridade: OrdemServico['prioridade']) => {
  if (prioridade === 'Urgente') return 'danger' as const;
  if (prioridade === 'Alta') return 'warning' as const;
  if (prioridade === 'Média') return 'info' as const;
  return 'neutral' as const;
};

const formatarData = (valor?: string) => (valor ? valor.slice(0, 10).split('-').reverse().join('/') : '—');
const formatarHoras = (valor?: number) => (
  valor === undefined ? '—' : `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`
);

const formularioVazio = (equipamentoId = '') => ({
  equipamentoId,
  tipo: 'Corretiva' as OrdemServico['tipo'],
  prioridade: 'Média' as OrdemServico['prioridade'],
  motivo: '',
  descricao: '',
  dataAbertura: new Date().toISOString().slice(0, 10),
  horaAbertura: new Date().toTimeString().slice(0, 5),
  oficina: '',
  solucao: '',
  dataConclusao: '',
  horaConclusao: '',
  observacao: '',
});

export default function ManutencaoTab({
  ordensServico,
  equipamentos,
  responsavel,
  podeEditar,
  onSave,
  onDelete,
}: ManutencaoTabProps) {
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<(typeof STATUS_FILTRO)[number]>('Em aberto');
  const [filtroFamilia, setFiltroFamilia] = useState<EquipmentFamily | 'todas'>('todas');
  const [filtroMotivo, setFiltroMotivo] = useState('todos');
  // Período amplo por padrão: a manutenção acompanha ordens que arrastam por
  // semanas, e abrir a tela já filtrando o mês esconderia OS ainda abertas.
  const [periodo, setPeriodo] = useState<PeriodValue>(() => buildPeriod('mes'));
  const [usarPeriodo, setUsarPeriodo] = useState(false);
  const [editando, setEditando] = useState<OrdemServico | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [form, setForm] = useState(formularioVazio());
  const [erro, setErro] = useState('');
  const [exclusao, setExclusao] = useState<OrdemServico | null>(null);
  const [exportando, setExportando] = useState(false);
  const [avisoExport, setAvisoExport] = useState('');

  const equipamentoPorId = useMemo(
    () => new Map(equipamentos.map(item => [item.id, item])),
    [equipamentos],
  );
  const prefixoDe = (equipamentoId: string) => equipamentoPorId.get(equipamentoId)?.prefixo || 'Frota não localizada';

  /** Motivos que realmente aparecem nas ordens — o filtro não inventa opção. */
  const motivosDisponiveis = useMemo(() => {
    const motivos = new Set<string>();
    ordensServico.forEach(ordem => {
      const motivo = (ordem.motivo || '').trim();
      if (motivo) motivos.add(motivo);
    });
    return Array.from(motivos).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [ordensServico]);

  const lista = useMemo(() => {
    const termo = normalizeComparable(busca).trim();
    return ordensServico
      .filter(ordem => {
        if (filtroStatus === 'Todas') return true;
        if (filtroStatus === 'Em aberto') return !isOrdemEncerrada(ordem.status);
        return ordem.status === filtroStatus;
      })
      .filter(ordem => (
        filtroFamilia === 'todas'
        || classifyEquipment(equipamentoPorId.get(ordem.equipamentoId)) === filtroFamilia
      ))
      .filter(ordem => filtroMotivo === 'todos' || (ordem.motivo || '').trim() === filtroMotivo)
      // O período olha a abertura: uma OS que começou dentro do recorte
      // pertence a ele mesmo que ainda não tenha liberação.
      .filter(ordem => !usarPeriodo || (
        ordem.dataAbertura >= periodo.from && ordem.dataAbertura <= periodo.to
      ))
      .filter(ordem => !termo || normalizeComparable(`${ordem.numero} ${prefixoDe(ordem.equipamentoId)} ${ordem.descricao} ${ordem.motivo || ''} ${ordem.responsavel} ${ordem.oficina || ''}`).includes(termo))
      .sort((a, b) => `${b.dataAbertura}${b.numero}`.localeCompare(`${a.dataAbertura}${a.numero}`));
  }, [ordensServico, filtroStatus, filtroFamilia, filtroMotivo, usarPeriodo, periodo.from, periodo.to, busca, equipamentoPorId]);

  // Os indicadores acompanham o recorte: com um filtro ativo, os números do
  // topo precisam falar do que está na tela, não do arquivo inteiro.
  const resumo = useMemo(() => {
    const abertas = lista.filter(ordem => !isOrdemEncerrada(ordem.status));
    const horasAbertas = abertas.reduce((total, ordem) => total + (calcularHorasParadas(ordem) || 0), 0);
    return {
      abertas: abertas.length,
      aguardandoPeca: lista.filter(ordem => ordem.status === 'Aguardando Peça').length,
      concluidas: lista.filter(ordem => ordem.status === 'Concluída').length,
      horasAbertas: Math.round(horasAbertas),
      criticas: abertas.filter(ordem => ['Alta', 'Urgente'].includes(ordem.prioridade)).length,
    };
  }, [lista]);

  /** Uma linha por equipamento parado: onde a frota está perdendo tempo. */
  const paradasPorEquipamento = useMemo(() => {
    const agrupado = new Map<string, {
      equipamentoId: string;
      prefixo: string;
      familia: EquipmentFamily;
      horas: number;
      ordens: number;
      abertas: number;
      motivoAtual: string;
      statusAtual: string;
      desde: string;
    }>();

    lista.forEach(ordem => {
      const equipamento = equipamentoPorId.get(ordem.equipamentoId);
      const chave = ordem.equipamentoId || ordem.numero;
      const horas = calcularHorasParadas(ordem) || 0;
      const aberta = !isOrdemEncerrada(ordem.status);
      const atual = agrupado.get(chave) || {
        equipamentoId: ordem.equipamentoId,
        prefixo: equipamento?.prefixo || 'Frota não localizada',
        familia: classifyEquipment(equipamento),
        horas: 0,
        ordens: 0,
        abertas: 0,
        motivoAtual: '',
        statusAtual: '',
        desde: '',
      };
      atual.horas += horas;
      atual.ordens += 1;
      if (aberta) {
        atual.abertas += 1;
        // A ordem aberta mais antiga é a que explica a parada em curso.
        if (!atual.desde || ordem.dataAbertura < atual.desde) {
          atual.desde = ordem.dataAbertura;
          atual.motivoAtual = (ordem.motivo || ordem.descricao || 'Sem motivo informado').trim();
          atual.statusAtual = ordem.status;
        }
      }
      agrupado.set(chave, atual);
    });

    return Array.from(agrupado.values()).sort((a, b) => b.horas - a.horas);
  }, [lista, equipamentoPorId]);

  /** Ranking dos motivos que mais param a frota no recorte atual. */
  const motivosRanking = useMemo(() => {
    const agrupado = new Map<string, { motivo: string; horas: number; ocorrencias: number }>();
    lista.forEach(ordem => {
      const motivo = (ordem.motivo || ordem.descricao || 'Sem motivo informado').trim();
      const atual = agrupado.get(motivo) || { motivo, horas: 0, ocorrencias: 0 };
      atual.horas += calcularHorasParadas(ordem) || 0;
      atual.ocorrencias += 1;
      agrupado.set(motivo, atual);
    });
    return Array.from(agrupado.values()).sort((a, b) => b.horas - a.horas).slice(0, 6);
  }, [lista]);

  const familiasComOrdens = useMemo(() => {
    const contagem = new Map<EquipmentFamily, number>();
    ordensServico.forEach(ordem => {
      const familia = classifyEquipment(equipamentoPorId.get(ordem.equipamentoId));
      contagem.set(familia, (contagem.get(familia) || 0) + 1);
    });
    return EQUIPMENT_FAMILIES.filter(familia => contagem.has(familia))
      .map(familia => ({ familia, total: contagem.get(familia) || 0 }));
  }, [ordensServico, equipamentoPorId]);

  const filtrosAtivos = useMemo(() => [
    `Situação: ${filtroStatus}`,
    filtroFamilia === 'todas' ? '' : `Família: ${EQUIPMENT_FAMILY_LABELS[filtroFamilia]}`,
    filtroMotivo === 'todos' ? '' : `Motivo: ${filtroMotivo}`,
    usarPeriodo ? `Período: ${formatarData(periodo.from)} a ${formatarData(periodo.to)}` : '',
    busca.trim() ? `Busca: ${busca.trim()}` : '',
  ].filter(Boolean), [filtroStatus, filtroFamilia, filtroMotivo, usarPeriodo, periodo.from, periodo.to, busca]);

  const exportarExcel = async () => {
    if (exportando) return;
    setExportando(true);
    setAvisoExport('');
    try {
      await downloadManutencaoWorkbook({
        ordens: lista,
        equipamentos,
        filtros: filtrosAtivos,
        periodo: usarPeriodo ? { from: periodo.from, to: periodo.to } : undefined,
      });
    } catch (error) {
      setAvisoExport(error instanceof Error ? error.message : 'Não foi possível gerar a planilha.');
    } finally {
      setExportando(false);
    }
  };

  const abrirNova = () => {
    setEditando(null);
    setForm(formularioVazio());
    setErro('');
    setFormAberto(true);
  };

  const abrirEdicao = (ordem: OrdemServico) => {
    setEditando(ordem);
    setForm({
      equipamentoId: ordem.equipamentoId,
      tipo: ordem.tipo,
      prioridade: ordem.prioridade,
      motivo: ordem.motivo || '',
      descricao: ordem.descricao || '',
      dataAbertura: ordem.dataAbertura || '',
      horaAbertura: ordem.horaAbertura || '',
      oficina: ordem.oficina || '',
      solucao: ordem.solucao || '',
      dataConclusao: ordem.dataConclusao || '',
      horaConclusao: ordem.horaConclusao || '',
      observacao: ordem.observacao || '',
    });
    setErro('');
    setFormAberto(true);
  };

  const salvar = () => {
    if (!form.equipamentoId) {
      setErro('Selecione o equipamento da ordem.');
      return;
    }
    if (!form.descricao.trim()) {
      setErro('Descreva o problema para a oficina saber o que atender.');
      return;
    }
    if (!form.dataAbertura) {
      setErro('Informe a data de abertura.');
      return;
    }
    const base: OrdemServico = {
      ...(editando || {
        id: `os-${Date.now()}`,
        numero: proximoNumeroOrdemServico(ordensServico),
        status: 'Aberta',
        responsavel,
        observacao: '',
      } as OrdemServico),
      equipamentoId: form.equipamentoId,
      tipo: form.tipo,
      prioridade: form.prioridade,
      motivo: form.motivo.trim(),
      descricao: form.descricao.trim(),
      dataAbertura: form.dataAbertura,
      horaAbertura: form.horaAbertura,
      oficina: form.oficina.trim(),
      solucao: form.solucao.trim(),
      dataConclusao: form.dataConclusao || undefined,
      horaConclusao: form.dataConclusao ? form.horaConclusao : undefined,
      observacao: form.observacao.trim(),
      responsavel: editando?.responsavel || responsavel,
    };
    // Horas paradas só congelam quando a ordem tem liberação; antes disso o
    // número é corrente e seria mentira gravar.
    const ordem: OrdemServico = {
      ...base,
      horasParadas: base.dataConclusao ? calcularHorasParadas(base) : undefined,
    };
    onSave(ordem, !editando);
    setFormAberto(false);
    setEditando(null);
  };

  const avancar = (ordem: OrdemServico) => {
    const proximo = proximoStatusManutencao(ordem.status);
    if (!proximo) return;
    const hoje = new Date();
    const concluindo = proximo === 'Concluída';
    const atualizada: OrdemServico = {
      ...ordem,
      status: proximo,
      dataConclusao: concluindo ? (ordem.dataConclusao || hoje.toISOString().slice(0, 10)) : ordem.dataConclusao,
      horaConclusao: concluindo ? (ordem.horaConclusao || hoje.toTimeString().slice(0, 5)) : ordem.horaConclusao,
    };
    onSave({ ...atualizada, horasParadas: atualizada.dataConclusao ? calcularHorasParadas(atualizada) : undefined }, false);
  };

  return (
    <div id="manutencao-tab" className="min-h-full w-full space-y-4 bg-white pb-12">
      <PageHeader
        title="Manutenção"
        description="Ordens de serviço da frota, do chamado até a liberação."
        actions={<>
          <button
            type="button"
            onClick={() => void exportarExcel()}
            disabled={exportando || lista.length === 0}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition-colors hover:border-emerald-500 hover:text-emerald-700 disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" /> {exportando ? 'Gerando...' : 'Exportar Excel'}
          </button>
          {podeEditar && (
            <button
              type="button"
              onClick={abrirNova}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-800"
            >
              <Plus className="h-4 w-4" /> Abrir OS
            </button>
          )}
        </>}
      />

      {/* KPIs do recorte atual */}
      <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        {[
          { icon: Wrench, label: 'OS em aberto', valor: String(resumo.abertas) },
          { icon: TriangleAlert, label: 'Alta ou urgente', valor: String(resumo.criticas) },
          { icon: Clock3, label: 'Aguardando peça', valor: String(resumo.aguardandoPeca) },
          { icon: Gauge, label: 'Concluídas', valor: String(resumo.concluidas) },
          { icon: Clock3, label: 'Horas paradas', valor: `${resumo.horasAbertas.toLocaleString('pt-BR')} h` },
        ].map(item => (
          <div key={item.label} className="renea-card rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <item.icon className="mt-0.5 size-5 shrink-0 text-slate-400" strokeWidth={1.5} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{item.label}</p>
                <strong className="mt-1.5 block text-2xl font-black tabular-nums text-slate-900">{item.valor}</strong>
              </div>
            </div>
          </div>
        ))}
      </section>

      {avisoExport && (
        <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">{avisoExport}</p>
      )}

      {/* Filtros */}
      <div className="mt-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Buscar ordem de serviço</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={busca}
              onChange={event => setBusca(event.target.value)}
              placeholder="Número, prefixo, problema, responsável..."
              className="min-h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-emerald-500"
            />
          </label>
          <select
            value={filtroStatus}
            onChange={event => setFiltroStatus(event.target.value as (typeof STATUS_FILTRO)[number])}
            aria-label="Filtrar por situação"
            className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500"
          >
            {STATUS_FILTRO.map(item => <option key={item}>{item}</option>)}
          </select>
          <select
            value={filtroMotivo}
            onChange={event => setFiltroMotivo(event.target.value)}
            aria-label="Filtrar por motivo"
            className="min-h-10 max-w-[16rem] rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-emerald-500"
          >
            <option value="todos">Todos os motivos</option>
            {motivosDisponiveis.map(motivo => <option key={motivo} value={motivo}>{motivo}</option>)}
          </select>
        </div>

        {/* Família do equipamento: a operação reconhece pelo desenho. */}
        {familiasComOrdens.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por tipo de equipamento">
            <button
              type="button"
              onClick={() => setFiltroFamilia('todas')}
              aria-pressed={filtroFamilia === 'todas'}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-colors ${filtroFamilia === 'todas' ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-400'}`}
            >
              Todos <span className="tabular-nums text-slate-400">{ordensServico.length}</span>
            </button>
            {familiasComOrdens.map(({ familia, total }) => {
              const Icon = equipmentFamilyIcon(familia);
              const ativo = filtroFamilia === familia;
              return (
                <button
                  key={familia}
                  type="button"
                  onClick={() => setFiltroFamilia(ativo ? 'todas' : familia)}
                  aria-pressed={ativo}
                  title={EQUIPMENT_FAMILY_LABELS[familia]}
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-colors ${ativo ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-400'}`}
                >
                  <Icon className="size-4" strokeWidth={1.7} aria-hidden="true" />
                  <span className="hidden sm:inline">{EQUIPMENT_FAMILY_LABELS[familia]}</span>
                  <span className="tabular-nums text-slate-400">{total}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600">
            <input
              type="checkbox"
              checked={usarPeriodo}
              onChange={event => setUsarPeriodo(event.target.checked)}
              className="size-4 accent-emerald-700"
            />
            Filtrar por período de abertura
          </label>
          {usarPeriodo && <PeriodFilter value={periodo} onChange={setPeriodo} />}
        </div>
      </div>

      {/* Cards: onde a frota está parada agora */}
      {paradasPorEquipamento.length > 0 && (
        <section className="mt-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-sm font-black text-slate-900">Equipamentos em manutenção</h2>
              <p className="text-xs text-slate-500">Horas acumuladas no recorte, com o motivo da parada em curso.</p>
            </div>
            <span className="shrink-0 text-xs font-bold tabular-nums text-slate-500">{paradasPorEquipamento.length} equipamento(s)</span>
          </div>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {paradasPorEquipamento.slice(0, 9).map(item => {
              const Icon = equipmentFamilyIcon(item.familia);
              return (
                <article key={item.equipamentoId || item.prefixo} className="renea-card rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-800" aria-hidden="true">
                      <Icon className="size-5" strokeWidth={1.7} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <strong className="truncate font-black text-slate-900">{item.prefixo}</strong>
                        <span className="shrink-0 font-mono text-sm font-black tabular-nums text-slate-900">{formatarHoras(item.horas)}</span>
                      </div>
                      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">{EQUIPMENT_FAMILY_LABELS[item.familia]}</p>
                      {item.abertas > 0 ? (
                        <>
                          <p className="mt-2 line-clamp-2 text-xs text-slate-600" title={item.motivoAtual}>{item.motivoAtual}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${statusTone(item.statusAtual)}`}>{item.statusAtual}</span>
                            <span className="text-[10px] text-slate-400">desde {formatarData(item.desde)}</span>
                          </div>
                        </>
                      ) : (
                        <p className="mt-2 text-xs text-slate-400">Sem ordem em aberto · {item.ordens} no período</p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Motivos que mais param a frota */}
      {motivosRanking.length > 1 && (
        <section className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <header className="border-b border-slate-200 px-4 py-3 sm:px-5">
            <h2 className="text-sm font-black text-slate-900">Motivos que mais param a frota</h2>
            <p className="text-xs text-slate-500">Horas somadas por motivo no recorte atual.</p>
          </header>
          <ul className="divide-y divide-slate-100">
            {motivosRanking.map(item => {
              const maior = motivosRanking[0]?.horas || 1;
              return (
                <li key={item.motivo} className="px-4 py-3 sm:px-5">
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate font-bold text-slate-700" title={item.motivo}>{item.motivo}</span>
                    <span className="shrink-0 font-mono font-black tabular-nums text-slate-900">{formatarHoras(item.horas)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.max(3, (item.horas / maior) * 100)}%` }} />
                  </div>
                  <span className="mt-1 block text-[10px] text-slate-400">{item.ocorrencias} ordem(ns)</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Tabela de Ordens */}
      <section className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 sm:px-5">
          <span className="text-xs font-bold text-slate-600">{lista.length} Ordem(ns) de Serviço</span>
        </div>
        {lista.length === 0 ? (
          <EmptyState icon={Wrench} title="Nenhuma ordem de serviço" description="Abra uma OS quando um equipamento precisar de atendimento." />
        ) : (
          <TableShell minWidth={980}>
            <TableHead>
              <tr>
                <th className="p-3">OS</th>
                <th className="p-3">Equipamento</th>
                <th className="p-3">Problema</th>
                <th className="p-3">Situação</th>
                <th className="p-3">Abertura</th>
                <th className="p-3">Horas paradas</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </TableHead>
            <TableBody>
              {lista.map(ordem => {
                const horas = calcularHorasParadas(ordem);
                const proximo = proximoStatusManutencao(ordem.status);
                const { Icon: EquipmentIcon, label: equipmentLabel } = presentEquipment(equipamentoPorId.get(ordem.equipamentoId));
                return (
                  <tr key={ordem.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                    <td className="p-3 text-xs font-mono font-bold text-slate-900">{ordem.numero}</td>
                    <td className="p-3">
                      <span className="flex items-center gap-2.5">
                        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-800" aria-hidden="true">
                          <EquipmentIcon className="size-4" strokeWidth={1.7} />
                        </span>
                        <span className="min-w-0">
                          <strong className="block truncate text-sm text-slate-800">{prefixoDe(ordem.equipamentoId)}</strong>
                          <small className="block text-[9px] uppercase tracking-wide text-slate-400">{equipmentLabel}</small>
                        </span>
                      </span>
                    </td>
                    <td className="max-w-[260px] p-3">
                      <span className="block truncate text-slate-700" title={ordem.descricao}>{ordem.descricao || ordem.motivo || '—'}</span>
                      <Badge tone={prioridadeTone(ordem.prioridade)} className="mt-1">{ordem.prioridade}</Badge>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${statusTone(ordem.status)}`}>{ordem.status}</span>
                    </td>
                    <td className="p-3 text-slate-600">{formatarData(ordem.dataAbertura)}{ordem.horaAbertura ? ` ${ordem.horaAbertura}` : ''}</td>
                    <td className="p-3 font-mono text-slate-700">
                      {horas === undefined ? '—' : `${horas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`}
                      {!isOrdemEncerrada(ordem.status) && horas !== undefined && <span className="ml-1 text-[10px] text-slate-400">em curso</span>}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {podeEditar && proximo && (
                          <button
                            type="button"
                            onClick={() => avancar(ordem)}
                            className="min-h-9 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 text-[11px] font-bold text-emerald-800 transition-colors hover:border-emerald-500"
                          >
                            {proximo}
                          </button>
                        )}
                        {podeEditar && (
                          <button
                            type="button"
                            onClick={() => abrirEdicao(ordem)}
                            className="min-h-9 rounded-lg border border-slate-200 px-2.5 text-[11px] font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700"
                          >
                            Editar
                          </button>
                        )}
                        {podeEditar && (
                          <button
                            type="button"
                            onClick={() => setExclusao(ordem)}
                            className="min-h-9 rounded-lg border border-slate-200 px-2.5 text-[11px] font-bold text-rose-600 transition-colors hover:border-rose-400"
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </TableBody>
          </TableShell>
        )}
      </section>

      <Modal
        open={formAberto}
        title={editando ? `Editar ${editando.numero}` : 'Abrir ordem de serviço'}
        description={editando ? undefined : 'A OS entra como Aberta e segue o fluxo até a liberação.'}
        size="lg"
        onClose={() => setFormAberto(false)}
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setFormAberto(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={salvar} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">Salvar ordem</button>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">
            Equipamento
            <select
              value={form.equipamentoId}
              onChange={event => setForm({ ...form, equipamentoId: event.target.value })}
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500"
            >
              <option value="">Selecione</option>
              {[...equipamentos]
                .sort((a, b) => a.prefixo.localeCompare(b.prefixo, 'pt-BR', { numeric: true }))
                .map(item => <option key={item.id} value={item.id}>{item.prefixo} · {item.nome}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Categoria
            <select value={form.tipo} onChange={event => setForm({ ...form, tipo: event.target.value as OrdemServico['tipo'] })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500">
              {TIPOS.map(item => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Prioridade
            <select value={form.prioridade} onChange={event => setForm({ ...form, prioridade: event.target.value as OrdemServico['prioridade'] })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500">
              {PRIORIDADES.map(item => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Oficina
            <input value={form.oficina} onChange={event => setForm({ ...form, oficina: event.target.value })} placeholder="Interna ou terceiro" className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Data de abertura
            <input type="date" value={form.dataAbertura} onChange={event => setForm({ ...form, dataAbertura: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Hora de abertura
            <input type="time" value={form.horaAbertura} onChange={event => setForm({ ...form, horaAbertura: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Problema
            <input value={form.motivo} onChange={event => setForm({ ...form, motivo: event.target.value })} placeholder="Quebra, preventiva, pneu, elétrica..." className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Descrição
            <textarea value={form.descricao} onChange={event => setForm({ ...form, descricao: event.target.value })} rows={3} placeholder="O que aconteceu e o que precisa ser atendido" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Solução
            <textarea value={form.solucao} onChange={event => setForm({ ...form, solucao: event.target.value })} rows={2} placeholder="O que foi feito para liberar o equipamento" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Data de liberação
            <input type="date" value={form.dataConclusao} onChange={event => setForm({ ...form, dataConclusao: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Hora de liberação
            <input type="time" value={form.horaConclusao} onChange={event => setForm({ ...form, horaConclusao: event.target.value })} disabled={!form.dataConclusao} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500 disabled:bg-slate-50" />
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Observação
            <textarea value={form.observacao} onChange={event => setForm({ ...form, observacao: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
        </div>
        {form.dataConclusao && (
          <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            Horas paradas calculadas: <strong>{calcularHorasParadas({ ...form })?.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) ?? '—'} h</strong>
          </p>
        )}
        {erro && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs font-bold text-rose-700">{erro}</p>}
      </Modal>

      <ConfirmDialog
        open={Boolean(exclusao)}
        title={`Excluir ${exclusao?.numero}?`}
        description="A ordem sai da lista de manutenção. O histórico do sistema continua registrando a exclusão."
        confirmLabel="Excluir ordem"
        onCancel={() => setExclusao(null)}
        onConfirm={() => {
          if (exclusao) onDelete(exclusao.id);
          setExclusao(null);
        }}
      />
    </div>
  );
}
