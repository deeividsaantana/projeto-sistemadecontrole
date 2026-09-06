/**
 * Apontamentos: horas de trabalho por colaborador, serviço e frente. É a base
 * dos indicadores de produtividade.
 */
import { useMemo, useState } from 'react';
import { ClipboardList, Plus, Search } from 'lucide-react';
import type { ApontamentoOperacional, EtapaServico, Funcionario, GrupoEquipe } from '../types';
import { horasNoDia, horasPor, validarApontamento } from '../utils/apontamentos';
import { normalizeComparable } from '../utils/canonicalIdentity';
import { formatarData } from '../utils/formato';
import {
  Card,
  ConfirmDialog,
  EmptyState,
  Modal,
  PageHeader,
  PeriodFilter,
  TableBody,
  TableHead,
  TableShell,
  buildPeriod,
  isoDay,
  type PeriodValue,
} from '../shared/ui';

interface ApontamentosTabProps {
  apontamentos: ApontamentoOperacional[];
  funcionarios: Funcionario[];
  gruposEquipe: GrupoEquipe[];
  etapas: EtapaServico[];
  responsavel: string;
  podeEditar: boolean;
  onSave: (apontamento: ApontamentoOperacional, isNew: boolean) => void;
  onDelete: (id: string) => void;
}

const horasTexto = (valor: number) => `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;

export default function ApontamentosTab({
  apontamentos,
  funcionarios,
  gruposEquipe,
  etapas,
  responsavel,
  podeEditar,
  onSave,
  onDelete,
}: ApontamentosTabProps) {
  const hoje = isoDay(new Date());
  const [periodo, setPeriodo] = useState<PeriodValue>(() => buildPeriod('semana'));
  const [busca, setBusca] = useState('');
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<ApontamentoOperacional | null>(null);
  const [erro, setErro] = useState('');
  const [exclusao, setExclusao] = useState<ApontamentoOperacional | null>(null);
  const [form, setForm] = useState({ data: hoje, funcionarioId: '', etapaServicoId: '', atividade: '', horas: 8, observacao: '' });

  const equipePorFuncionario = useMemo(() => {
    const mapa = new Map<string, GrupoEquipe>();
    gruposEquipe.forEach(grupo => grupo.funcionarioIds.forEach(id => mapa.set(id, grupo)));
    return mapa;
  }, [gruposEquipe]);

  const noPeriodo = useMemo(
    () => apontamentos.filter(item => item.data >= periodo.from && item.data <= periodo.to),
    [apontamentos, periodo.from, periodo.to],
  );

  const lista = useMemo(() => {
    const termo = normalizeComparable(busca).trim();
    return noPeriodo
      .filter(item => !termo || normalizeComparable(`${item.funcionarioNome} ${item.atividade} ${item.servico || ''} ${item.frenteServico || ''} ${item.equipeNome || ''}`).includes(termo))
      .sort((a, b) => b.data.localeCompare(a.data) || a.funcionarioNome.localeCompare(b.funcionarioNome, 'pt-BR'));
  }, [noPeriodo, busca]);

  const totalHoras = noPeriodo.reduce((soma, item) => soma + (Number(item.horas) || 0), 0);
  const porServico = horasPor(noPeriodo, item => item.servico || 'Sem serviço');
  const porFrente = horasPor(noPeriodo, item => item.frenteServico || 'Sem frente');

  const abrirNovo = () => {
    setEditando(null);
    setForm({ data: hoje, funcionarioId: '', etapaServicoId: '', atividade: '', horas: 8, observacao: '' });
    setErro('');
    setFormAberto(true);
  };

  const abrirEdicao = (item: ApontamentoOperacional) => {
    setEditando(item);
    setForm({
      data: item.data,
      funcionarioId: item.funcionarioId,
      etapaServicoId: item.etapaServicoId || '',
      atividade: item.atividade,
      horas: item.horas,
      observacao: item.observacao || '',
    });
    setErro('');
    setFormAberto(true);
  };

  const salvar = () => {
    const funcionario = funcionarios.find(item => item.id === form.funcionarioId);
    const candidato = {
      id: editando?.id || `apt-${Date.now()}`,
      funcionarioId: form.funcionarioId,
      data: form.data,
      horas: Number(form.horas),
      atividade: form.atividade,
    };
    const problema = validarApontamento(apontamentos, candidato);
    if (problema || !funcionario) {
      setErro(problema || 'Selecione o colaborador.');
      return;
    }
    // Equipe, frente e serviço ficam gravados como estavam no dia: a equipe
    // muda de frente e o histórico de horas precisa continuar coerente.
    const equipe = equipePorFuncionario.get(funcionario.id);
    const etapa = etapas.find(item => item.id === form.etapaServicoId);
    onSave({
      id: candidato.id,
      data: form.data,
      funcionarioId: funcionario.id,
      funcionarioNome: funcionario.nome,
      equipeId: equipe?.id,
      equipeNome: equipe?.nome,
      frenteServico: equipe?.frenteServico,
      etapaServicoId: etapa?.id,
      servico: etapa?.nome,
      atividade: form.atividade.trim(),
      horas: Number(form.horas),
      observacao: form.observacao.trim() || undefined,
      responsavel: editando?.responsavel || responsavel,
      criadoEm: editando?.criadoEm || new Date().toISOString(),
    }, !editando);
    setFormAberto(false);
    setEditando(null);
  };

  const horasDoDiaSelecionado = form.funcionarioId
    ? horasNoDia(apontamentos, form.funcionarioId, form.data, editando?.id)
    : 0;

  return (
    <div id="apontamentos-tab" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Apontamentos"
        description="Horas por colaborador, serviço e frente — a base da produtividade."
        actions={podeEditar ? (
          <button type="button" onClick={abrirNovo} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-800">
            <Plus className="h-4 w-4" /> Novo apontamento
          </button>
        ) : undefined}
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <PeriodFilter value={periodo} onChange={setPeriodo} />
        <span className="text-xs font-medium text-slate-500">{formatarData(periodo.from)} a {formatarData(periodo.to)}</span>
      </div>

      <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: 'Horas apontadas', valor: horasTexto(totalHoras) },
          { label: 'Lançamentos', valor: String(noPeriodo.length) },
          { label: 'Colaboradores', valor: String(new Set(noPeriodo.map(item => item.funcionarioId)).size) },
          { label: 'Serviços', valor: String(porServico.length) },
        ].map(item => (
          <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-500">{item.label}</p>
            <strong className="mt-1.5 block text-2xl font-black tabular-nums text-slate-900">{item.valor}</strong>
          </div>
        ))}
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {[{ titulo: 'Horas por serviço', dados: porServico }, { titulo: 'Horas por frente', dados: porFrente }].map(bloco => (
          <Card key={bloco.titulo} className="min-w-0" title={bloco.titulo} flush>
            {bloco.dados.length === 0 ? (
              <EmptyState icon={ClipboardList} title="Sem apontamentos no período" compact />
            ) : (
              <ul className="divide-y divide-slate-100">
                {bloco.dados.slice(0, 8).map(item => (
                  <li key={item.chave} className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
                    <span className="min-w-0 truncate font-bold text-slate-700">{item.chave}</span>
                    <span className="shrink-0 text-right">
                      <strong className="block font-mono text-slate-900">{horasTexto(item.horas)}</strong>
                      <span className="text-[10px] text-slate-400">{item.lancamentos} lançamento(s)</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>

      <label className="relative mt-4 block">
        <span className="sr-only">Buscar apontamento</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={busca}
          onChange={event => setBusca(event.target.value)}
          placeholder="Colaborador, atividade, serviço, frente ou equipe"
          className="min-h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-emerald-500"
        />
      </label>

      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {lista.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Nenhum apontamento no período" description="Lance as horas trabalhadas para alimentar a produtividade." />
        ) : (
          <TableShell minWidth={900}>
            <TableHead>
              <tr>
                <th className="p-3">Data</th>
                <th className="p-3">Colaborador</th>
                <th className="p-3">Equipe / Frente</th>
                <th className="p-3">Serviço</th>
                <th className="p-3">Atividade</th>
                <th className="p-3">Horas</th>
                {podeEditar && <th className="p-3 text-right">Ações</th>}
              </tr>
            </TableHead>
            <TableBody>
              {lista.map(item => (
                <tr key={item.id} className="transition-colors hover:bg-slate-50">
                  <td className="p-3 text-slate-600">{formatarData(item.data)}</td>
                  <td className="p-3 font-bold text-slate-800">{item.funcionarioNome}</td>
                  <td className="p-3 text-slate-600">{[item.equipeNome, item.frenteServico].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="p-3 text-slate-600">{item.servico || '—'}</td>
                  <td className="max-w-[240px] p-3"><span className="block truncate text-slate-700" title={item.atividade}>{item.atividade}</span></td>
                  <td className="p-3 font-mono font-bold text-slate-900">{horasTexto(item.horas)}</td>
                  {podeEditar && (
                    <td className="p-3">
                      <div className="flex justify-end gap-1.5">
                        <button type="button" onClick={() => abrirEdicao(item)} className="min-h-9 rounded-lg border border-slate-200 px-2.5 text-[11px] font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700">Editar</button>
                        <button type="button" onClick={() => setExclusao(item)} className="min-h-9 rounded-lg border border-slate-200 px-2.5 text-[11px] font-bold text-rose-600 transition-colors hover:border-rose-400">Excluir</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </TableBody>
          </TableShell>
        )}
      </div>

      <Modal
        open={formAberto}
        title={editando ? 'Editar apontamento' : 'Novo apontamento'}
        size="md"
        onClose={() => setFormAberto(false)}
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setFormAberto(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={salvar} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">Salvar</button>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">
            Data
            <input type="date" value={form.data} onChange={event => setForm({ ...form, data: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Horas
            <input type="number" min="0.5" max="24" step="0.5" value={form.horas} onChange={event => setForm({ ...form, horas: Number(event.target.value) })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Colaborador
            <select value={form.funcionarioId} onChange={event => setForm({ ...form, funcionarioId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500">
              <option value="">Selecione</option>
              {[...funcionarios]
                .filter(item => item.ativo !== false)
                .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
                .map(item => <option key={item.id} value={item.id}>{item.nome}{item.matricula ? ` · ${item.matricula}` : ''}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Serviço
            <select value={form.etapaServicoId} onChange={event => setForm({ ...form, etapaServicoId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500">
              <option value="">Sem serviço vinculado</option>
              {etapas.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Atividade
            <input value={form.atividade} onChange={event => setForm({ ...form, atividade: event.target.value })} placeholder="O que foi feito" className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Observação
            <textarea value={form.observacao} onChange={event => setForm({ ...form, observacao: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500" />
          </label>
        </div>
        {form.funcionarioId && (
          <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            Já apontado neste dia: <strong>{horasTexto(horasDoDiaSelecionado)}</strong> · com este lançamento: <strong>{horasTexto(horasDoDiaSelecionado + Number(form.horas || 0))}</strong>
          </p>
        )}
        {erro && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs font-bold text-rose-700">{erro}</p>}
      </Modal>

      <ConfirmDialog
        open={Boolean(exclusao)}
        title="Excluir apontamento?"
        description={`${exclusao?.funcionarioNome} · ${exclusao ? formatarData(exclusao.data) : ''} · ${exclusao ? horasTexto(exclusao.horas) : ''}. As horas saem da produtividade.`}
        confirmLabel="Excluir"
        onCancel={() => setExclusao(null)}
        onConfirm={() => {
          if (exclusao) onDelete(exclusao.id);
          setExclusao(null);
        }}
      />
    </div>
  );
}
