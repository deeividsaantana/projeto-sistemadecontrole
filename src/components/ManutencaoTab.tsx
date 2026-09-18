/**
 * Manutenção: abertura, acompanhamento e liberação das ordens de serviço.
 * As horas paradas saem da própria ordem — abertura até liberação.
 */
import { useMemo, useState } from 'react';
import { Clock3, Gauge, Plus, Search, TriangleAlert, Wrench } from 'lucide-react';
import type { Equipamento, OrdemServico } from '../types';
import {
  FLUXO_MANUTENCAO,
  calcularHorasParadas,
  isOrdemEncerrada,
  proximoNumeroOrdemServico,
  proximoStatusManutencao,
} from '../utils/manutencao';
import { normalizeComparable } from '../utils/canonicalIdentity';
import { Badge, ConfirmDialog, EmptyState, Modal, PageHeader, TableBody, TableHead, TableShell, statusTone } from '../shared/ui';

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
  const [editando, setEditando] = useState<OrdemServico | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [form, setForm] = useState(formularioVazio());
  const [erro, setErro] = useState('');
  const [exclusao, setExclusao] = useState<OrdemServico | null>(null);

  const prefixoDe = (equipamentoId: string) => equipamentos.find(item => item.id === equipamentoId)?.prefixo || 'Frota não localizada';

  const lista = useMemo(() => {
    const termo = normalizeComparable(busca).trim();
    return ordensServico
      .filter(ordem => {
        if (filtroStatus === 'Todas') return true;
        if (filtroStatus === 'Em aberto') return !isOrdemEncerrada(ordem.status);
        return ordem.status === filtroStatus;
      })
      .filter(ordem => !termo || normalizeComparable(`${ordem.numero} ${prefixoDe(ordem.equipamentoId)} ${ordem.descricao} ${ordem.motivo || ''} ${ordem.responsavel} ${ordem.oficina || ''}`).includes(termo))
      .sort((a, b) => `${b.dataAbertura}${b.numero}`.localeCompare(`${a.dataAbertura}${a.numero}`));
  }, [ordensServico, filtroStatus, busca, equipamentos]);

  const resumo = useMemo(() => {
    const abertas = ordensServico.filter(ordem => !isOrdemEncerrada(ordem.status));
    const horasAbertas = abertas.reduce((total, ordem) => total + (calcularHorasParadas(ordem) || 0), 0);
    return {
      abertas: abertas.length,
      aguardandoPeca: ordensServico.filter(ordem => ordem.status === 'Aguardando Peça').length,
      concluidas: ordensServico.filter(ordem => ordem.status === 'Concluída').length,
      horasAbertas: Math.round(horasAbertas),
      criticas: abertas.filter(ordem => ['Alta', 'Urgente'].includes(ordem.prioridade)).length,
    };
  }, [ordensServico]);

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
    <div id="manutencao-tab" className="min-h-full w-full bg-white px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Manutenção"
        description="Ordens de serviço da frota, do chamado até a liberação."
        actions={podeEditar ? (
          <button
            type="button"
            onClick={abrirNova}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-800"
          >
            <Plus className="h-4 w-4" /> Abrir OS
          </button>
        ) : undefined}
      />

      {/* KPIs Compactos */}
      <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { icon: Wrench, label: 'OS em aberto', valor: resumo.abertas },
          { icon: TriangleAlert, label: 'Alta ou urgente', valor: resumo.criticas },
          { icon: Clock3, label: 'Aguardando peça', valor: resumo.aguardandoPeca },
          { icon: Gauge, label: 'Concluídas', valor: resumo.concluidas },
        ].map(item => (
          <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <item.icon className="size-5 text-slate-400 shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{item.label}</p>
                <strong className="mt-1.5 block text-2xl font-black tabular-nums text-slate-900">{item.valor}</strong>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* Horas Paradas em Aberto */}
      {resumo.horasAbertas > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <Clock3 className="size-5 text-amber-600 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Horas paradas</p>
            <strong className="block text-lg font-black text-amber-900">{resumo.horasAbertas.toLocaleString('pt-BR')} h</strong>
          </div>
        </div>
      )}

      {/* Filtros e Busca */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
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
      </div>

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
                return (
                  <tr key={ordem.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                    <td className="p-3 text-xs font-mono font-bold text-slate-900">{ordem.numero}</td>
                    <td className="p-3">
                      <strong className="text-sm text-slate-800">{prefixoDe(ordem.equipamentoId)}</strong>
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
