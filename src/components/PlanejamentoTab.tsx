/**
 * Planejamento: meta de produção por período, frente e equipe. O realizado nunca
 * é digitado — vem dos lançamentos de produção que atendem ao plano.
 */
import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, CalendarRange, Clock3, Plus, Search } from 'lucide-react';
import type { FrenteServico, GrupoEquipe, ObraLocal, PlanejamentoItem, RegistroProducao, ServicoObra, SituacaoPlano } from '../types';
import { aderenciaDosPlanos, planosNoPeriodo, validarPlano } from '../utils/planejamento';
import { normalizeComparable } from '../utils/canonicalIdentity';
import { formatarData, numero } from '../utils/formato';
import {
  StatCard,
  Badge,
  EmptyState,
  Modal,
  PageHeader,
  TableBody,
  TableHead,
  TableShell,
  isoDay,
} from '../shared/ui';

interface PlanejamentoTabProps {
  planos: PlanejamentoItem[];
  servicos: ServicoObra[];
  producao: RegistroProducao[];
  obras: ObraLocal[];
  frentes: FrenteServico[];
  gruposEquipe: GrupoEquipe[];
  responsavel: string;
  podeEditar: boolean;
  onSave: (plano: PlanejamentoItem, isNew: boolean) => void;
}

const SITUACOES: SituacaoPlano[] = ['Planejado', 'Em execução', 'Concluído', 'Cancelado'];

const somarDias = (base: string, dias: number) => {
  const data = new Date(`${base}T00:00:00`);
  data.setDate(data.getDate() + dias);
  return isoDay(data);
};

const tomDaSituacao = (situacao: SituacaoPlano) => {
  if (situacao === 'Concluído') return 'success' as const;
  if (situacao === 'Em execução') return 'info' as const;
  if (situacao === 'Cancelado') return 'neutral' as const;
  return 'warning' as const;
};

export default function PlanejamentoTab({
  planos,
  servicos,
  producao,
  obras,
  frentes,
  gruposEquipe,
  responsavel,
  podeEditar,
  onSave,
}: PlanejamentoTabProps) {
  const hoje = isoDay(new Date());
  const [inicio, setInicio] = useState(somarDias(hoje, -7));
  const [fim, setFim] = useState(somarDias(hoje, 21));
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState(false);
  const [editado, setEditado] = useState<PlanejamentoItem | null>(null);
  const [form, setForm] = useState({
    dataInicio: hoje,
    dataFim: somarDias(hoje, 6),
    servicoId: '',
    quantidadePlanejada: 0,
    obraId: '',
    frente: '',
    grupoId: '',
    situacao: 'Planejado' as SituacaoPlano,
    observacao: '',
  });

  const servicosAtivos = useMemo(() => servicos.filter(item => item.ativo !== false), [servicos]);
  const doPeriodo = useMemo(() => planosNoPeriodo(planos, inicio, fim), [planos, inicio, fim]);
  const linhas = useMemo(() => aderenciaDosPlanos(doPeriodo, producao, hoje), [doPeriodo, producao, hoje]);

  const termo = normalizeComparable(busca).trim();
  const filtradas = linhas.filter(item => !termo
    || normalizeComparable(`${item.plano.servicoDescricao} ${item.plano.frente || ''} ${item.plano.equipeNome || ''} ${item.plano.situacao}`).includes(termo));

  const atrasados = linhas.filter(item => item.atrasado);
  const totalPlanejado = linhas.reduce((total, item) => total + item.planejado, 0);
  const totalRealizado = linhas.reduce((total, item) => total + item.realizado, 0);
  const aderenciaGeral = totalPlanejado > 0 ? Number(((totalRealizado / totalPlanejado) * 100).toFixed(1)) : 0;

  const abrir = (plano?: PlanejamentoItem) => {
    setEditado(plano || null);
    setForm(plano
      ? {
        dataInicio: plano.dataInicio,
        dataFim: plano.dataFim,
        servicoId: plano.servicoId,
        quantidadePlanejada: plano.quantidadePlanejada,
        obraId: plano.obraId || '',
        frente: plano.frente || '',
        grupoId: plano.grupoId || '',
        situacao: plano.situacao,
        observacao: plano.observacao || '',
      }
      : {
        dataInicio: hoje,
        dataFim: somarDias(hoje, 6),
        servicoId: '',
        quantidadePlanejada: 0,
        obraId: '',
        frente: '',
        grupoId: '',
        situacao: 'Planejado',
        observacao: '',
      });
    setErro('');
    setAberto(true);
  };

  const salvar = () => {
    const problema = validarPlano({
      dataInicio: form.dataInicio,
      dataFim: form.dataFim,
      servicoId: form.servicoId,
      quantidadePlanejada: Number(form.quantidadePlanejada),
    });
    const servico = servicos.find(item => item.id === form.servicoId);
    if (problema || !servico) {
      setErro(problema || 'Selecione o serviço.');
      return;
    }
    const equipe = gruposEquipe.find(item => item.id === form.grupoId);
    const agora = new Date().toISOString();
    onSave({
      id: editado?.id || `plan-${Date.now()}`,
      dataInicio: form.dataInicio,
      dataFim: form.dataFim,
      servicoId: servico.id,
      servicoDescricao: servico.descricao,
      unidade: servico.unidade,
      quantidadePlanejada: Number(form.quantidadePlanejada),
      obraId: form.obraId || servico.obraId || undefined,
      frente: form.frente.trim() || undefined,
      grupoId: equipe?.id,
      equipeNome: equipe?.nome,
      responsavel: editado?.responsavel || responsavel,
      situacao: form.situacao,
      observacao: form.observacao.trim() || undefined,
      ativo: editado?.ativo ?? true,
      criadoEm: editado?.criadoEm || agora,
      atualizadoEm: agora,
    }, !editado);
    setErro('');
    setAberto(false);
  };

  return (
    <div id="planejamento-tab" className="renea-page min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        eyebrow="Planejamento"
        photo="rodovia-serra"
        title="Planejamento"
        description="Metas por período, frente e equipe. O realizado vem da produção lançada."
        actions={podeEditar ? (
          <button type="button" onClick={() => abrir()} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-800">
            <Plus className="h-4 w-4" /> Novo plano
          </button>
        ) : undefined}
      />

      {atrasados.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="flex items-center gap-2 text-xs font-bold text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            {atrasados.length} plano(s) com prazo vencido e meta não atingida
          </p>
          <p className="mt-1 text-[11px] text-amber-800">
            {atrasados.slice(0, 5).map(item => `${item.plano.servicoDescricao} (faltam ${numero(item.saldo)} ${item.plano.unidade})`).join(' · ')}
          </p>
        </div>
      )}

      <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: 'Planos no período', valor: linhas.length, tone: 'info' as const, icone: Clock3 },
          { label: 'Planejado', valor: numero(totalPlanejado), tone: 'neutral' as const, icone: CalendarRange },
          { label: 'Realizado', valor: numero(totalRealizado), tone: 'success' as const, icone: CalendarRange },
        ].map(item => (
          <StatCard key={item.label} label={item.label} value={item.valor} tone={item.tone} icon={item.icone} />
        ))}
      </section>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-bold text-slate-600">
          De
          <input type="date" value={inicio} onChange={event => setInicio(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
        </label>
        <label className="text-xs font-bold text-slate-600">
          Até
          <input type="date" value={fim} onChange={event => setFim(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
        </label>
        <label className="relative text-xs font-bold text-slate-600 sm:col-span-2">
          Buscar
          <Search className="pointer-events-none absolute left-3 top-[2.1rem] h-4 w-4 text-slate-400" />
          <input
            value={busca}
            onChange={event => setBusca(event.target.value)}
            placeholder="Serviço, frente, equipe ou situação"
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500"
          />
        </label>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {filtradas.length === 0 ? (
          <EmptyState icon={CalendarRange} title="Nenhum plano no período" description="Crie metas por serviço e período para acompanhar a aderência." />
        ) : (
          <TableShell minWidth={1040}>
            <TableHead>
              <tr>
                <th className="p-3">Período</th>
                <th className="p-3">Serviço</th>
                <th className="p-3">Frente / Equipe</th>
                <th className="p-3">Planejado</th>
                <th className="p-3">Realizado</th>
                <th className="p-3">Aderência</th>
                <th className="p-3">Situação</th>
                {podeEditar && <th className="p-3 text-right">Ações</th>}
              </tr>
            </TableHead>
            <TableBody>
              {filtradas.map(item => (
                <tr key={item.plano.id} className={`transition-colors hover:bg-slate-50 ${item.atrasado ? 'bg-amber-50/50' : ''}`}>
                  <td className="p-3 text-slate-600">{formatarData(item.plano.dataInicio)} → {formatarData(item.plano.dataFim)}</td>
                  <td className="p-3 font-bold text-slate-800">{item.plano.servicoDescricao}</td>
                  <td className="p-3 text-slate-600">{[item.plano.frente, item.plano.equipeNome].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="p-3 font-mono text-slate-600">{numero(item.planejado)} {item.plano.unidade}</td>
                  <td className="p-3 font-mono font-bold text-slate-900">{numero(item.realizado)}</td>
                  <td className="p-3">
                    <div className="flex min-w-28 items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                        <div className={`h-1.5 rounded-full ${item.atrasado ? 'bg-amber-500' : 'bg-emerald-600'}`} style={{ width: `${Math.min(100, item.aderencia)}%` }} />
                      </div>
                      <span className="font-mono text-[11px] font-bold text-slate-700">{item.aderencia}%</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge tone={tomDaSituacao(item.plano.situacao)}>{item.plano.situacao}</Badge>
                  </td>
                  {podeEditar && (
                    <td className="p-3 text-right">
                      <button type="button" onClick={() => abrir(item.plano)} className="min-h-9 rounded-lg border border-slate-200 px-2.5 text-[11px] font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700">Editar</button>
                    </td>
                  )}
                </tr>
              ))}
            </TableBody>
          </TableShell>
        )}
      </div>

      <Modal
        open={aberto}
        title={editado ? `Editar plano de ${editado.servicoDescricao}` : 'Novo plano'}
        onSubmit={salvar}
        size="md"
        onClose={() => setAberto(false)}
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setAberto(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={salvar} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">Salvar plano</button>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">
            Início
            <input type="date" value={form.dataInicio} onChange={event => setForm({ ...form, dataInicio: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Fim
            <input type="date" value={form.dataFim} onChange={event => setForm({ ...form, dataFim: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Serviço
            <select value={form.servicoId} onChange={event => setForm({ ...form, servicoId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              <option value="">Selecione</option>
              {servicosAtivos.map(item => <option key={item.id} value={item.id}>{item.descricao} ({item.unidade})</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Quantidade planejada
            <input type="number" min={0} step="0.001" value={form.quantidadePlanejada} onChange={event => setForm({ ...form, quantidadePlanejada: Number(event.target.value) })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Situação
            <select value={form.situacao} onChange={event => setForm({ ...form, situacao: event.target.value as SituacaoPlano })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              {SITUACOES.map(situacao => <option key={situacao} value={situacao}>{situacao}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Equipe
            <select value={form.grupoId} onChange={event => setForm({ ...form, grupoId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              <option value="">Qualquer equipe</option>
              {gruposEquipe.filter(item => item.status !== 'inativo').map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Frente
            <input list="planejamento-frentes" value={form.frente} onChange={event => setForm({ ...form, frente: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
            <datalist id="planejamento-frentes">
              {frentes.map(frente => <option key={frente.id} value={frente.nome} />)}
            </datalist>
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Obra
            <select value={form.obraId} onChange={event => setForm({ ...form, obraId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              <option value="">Herdar do serviço</option>
              {obras.map(obra => <option key={obra.id} value={obra.id}>{obra.nome}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Observação
            <textarea value={form.observacao} onChange={event => setForm({ ...form, observacao: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <p className="sm:col-span-2 text-[11px] text-slate-500">
            O realizado não é digitado: soma a produção lançada do mesmo serviço no período, filtrada por frente e equipe quando informadas.
          </p>
          {erro && <p className="sm:col-span-2 text-xs font-bold text-rose-700">{erro}</p>}
        </div>
      </Modal>
    </div>
  );
}
