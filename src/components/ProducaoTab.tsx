/**
 * Produção: serviços contratados e o que foi executado por dia. O acumulado e o
 * avanço saem da soma dos lançamentos — nada de contador guardado. Sem
 * quantidade prevista no contrato o sistema não exibe percentual inventado.
 */
import { useMemo, useState } from 'react';
import { BarChart3, ClipboardList, Plus, Search, TrendingUp } from 'lucide-react';
import type { FrenteServico, GrupoEquipe, ObraLocal, RegistroProducao, ServicoObra, SituacaoServico } from '../types';
import { avancoDosServicos, producaoPorDia, validarProducao } from '../utils/producao';
import { normalizeComparable } from '../utils/canonicalIdentity';
import {
  Badge,
  EmptyState,
  Modal,
  PageHeader,
  TableBody,
  TableHead,
  TableShell,
  isoDay,
} from '../shared/ui';

interface ProducaoTabProps {
  servicos: ServicoObra[];
  registros: RegistroProducao[];
  obras: ObraLocal[];
  frentes: FrenteServico[];
  gruposEquipe: GrupoEquipe[];
  responsavel: string;
  podeEditar: boolean;
  onSaveServico: (servico: ServicoObra, isNew: boolean) => void;
  onSaveRegistro: (registro: RegistroProducao, isNew: boolean) => void;
}

const UNIDADES = ['m³', 'm²', 'm', 'km', 't', 'kg', 'un', 'h', 'vb'];
const SITUACOES: SituacaoServico[] = ['Ativo', 'Suspenso', 'Concluído'];

const formatarData = (valor: string) => valor.split('-').reverse().join('/');
const numero = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 3 });

export default function ProducaoTab({
  servicos,
  registros,
  obras,
  frentes,
  gruposEquipe,
  responsavel,
  podeEditar,
  onSaveServico,
  onSaveRegistro,
}: ProducaoTabProps) {
  const hoje = isoDay(new Date());
  const [aba, setAba] = useState<'avanco' | 'lancamentos' | 'servicos'>('avanco');
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');
  const [servicoAberto, setServicoAberto] = useState(false);
  const [lancamentoAberto, setLancamentoAberto] = useState(false);
  const [servicoEditado, setServicoEditado] = useState<ServicoObra | null>(null);
  const [registroEditado, setRegistroEditado] = useState<RegistroProducao | null>(null);
  const [cadastro, setCadastro] = useState({ codigo: '', descricao: '', unidade: 'm³', obraId: '', quantidadePrevista: 0, situacao: 'Ativo' as SituacaoServico, observacao: '' });
  const [lancamento, setLancamento] = useState({ data: hoje, servicoId: '', quantidade: 0, obraId: '', frente: '', grupoId: '', observacao: '' });

  const servicosAtivos = useMemo(() => servicos.filter(item => item.ativo !== false), [servicos]);
  const registrosAtivos = useMemo(() => registros.filter(item => item.ativo !== false), [registros]);
  const avancos = useMemo(() => avancoDosServicos(servicosAtivos, registrosAtivos), [servicosAtivos, registrosAtivos]);
  const ultimosDias = useMemo(() => producaoPorDia(registrosAtivos).slice(-14), [registrosAtivos]);

  const termo = normalizeComparable(busca).trim();
  const avancosFiltrados = avancos.filter(item => !termo
    || normalizeComparable(`${item.servico.codigo || ''} ${item.servico.descricao} ${item.servico.unidade}`).includes(termo));
  const registrosFiltrados = useMemo(() => [...registrosAtivos]
    .filter(item => !termo || normalizeComparable(`${item.servicoDescricao} ${item.frente || ''} ${item.equipeNome || ''} ${item.responsavel}`).includes(termo))
    .sort((a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm)), [registrosAtivos, termo]);

  const totalExecutadoHoje = registrosAtivos.filter(item => item.data === hoje).length;
  const concluidos = avancos.filter(item => item.percentual !== undefined && item.percentual >= 100).length;
  const picoDia = ultimosDias.reduce((maior, item) => Math.max(maior, item.quantidade), 0);

  const abrirServico = (servico?: ServicoObra) => {
    setServicoEditado(servico || null);
    setCadastro(servico
      ? {
        codigo: servico.codigo || '',
        descricao: servico.descricao,
        unidade: servico.unidade,
        obraId: servico.obraId || '',
        quantidadePrevista: servico.quantidadePrevista || 0,
        situacao: servico.situacao,
        observacao: servico.observacao || '',
      }
      : { codigo: '', descricao: '', unidade: 'm³', obraId: '', quantidadePrevista: 0, situacao: 'Ativo', observacao: '' });
    setErro('');
    setServicoAberto(true);
  };

  const salvarServico = () => {
    if (!cadastro.descricao.trim()) {
      setErro('Informe a descrição do serviço.');
      return;
    }
    const agora = new Date().toISOString();
    onSaveServico({
      id: servicoEditado?.id || `svc-${Date.now()}`,
      codigo: cadastro.codigo.trim() || undefined,
      descricao: cadastro.descricao.trim(),
      unidade: cadastro.unidade,
      obraId: cadastro.obraId || undefined,
      quantidadePrevista: Number(cadastro.quantidadePrevista) > 0 ? Number(cadastro.quantidadePrevista) : undefined,
      situacao: cadastro.situacao,
      observacao: cadastro.observacao.trim() || undefined,
      ativo: servicoEditado?.ativo ?? true,
      criadoEm: servicoEditado?.criadoEm || agora,
      atualizadoEm: agora,
    }, !servicoEditado);
    setServicoAberto(false);
  };

  const abrirLancamento = (registro?: RegistroProducao) => {
    setRegistroEditado(registro || null);
    setLancamento(registro
      ? {
        data: registro.data,
        servicoId: registro.servicoId,
        quantidade: registro.quantidade,
        obraId: registro.obraId || '',
        frente: registro.frente || '',
        grupoId: registro.grupoId || '',
        observacao: registro.observacao || '',
      }
      : { data: hoje, servicoId: '', quantidade: 0, obraId: '', frente: '', grupoId: '', observacao: '' });
    setErro('');
    setLancamentoAberto(true);
  };

  const salvarLancamento = () => {
    const problema = validarProducao({ data: lancamento.data, servicoId: lancamento.servicoId, quantidade: Number(lancamento.quantidade) });
    const servico = servicos.find(item => item.id === lancamento.servicoId);
    if (problema || !servico) {
      setErro(problema || 'Selecione o serviço.');
      return;
    }
    const equipe = gruposEquipe.find(item => item.id === lancamento.grupoId);
    const agora = new Date().toISOString();
    onSaveRegistro({
      id: registroEditado?.id || `prod-${Date.now()}`,
      data: lancamento.data,
      servicoId: servico.id,
      servicoDescricao: servico.descricao,
      unidade: servico.unidade,
      quantidade: Number(lancamento.quantidade),
      obraId: lancamento.obraId || servico.obraId || undefined,
      frente: lancamento.frente.trim() || equipe?.frenteServico || undefined,
      grupoId: equipe?.id,
      equipeNome: equipe?.nome,
      responsavel: registroEditado?.responsavel || responsavel,
      observacao: lancamento.observacao.trim() || undefined,
      ativo: registroEditado?.ativo ?? true,
      criadoEm: registroEditado?.criadoEm || agora,
      atualizadoEm: agora,
    }, !registroEditado);
    setErro('');
    setLancamentoAberto(false);
  };

  const servicoDoForm = servicos.find(item => item.id === lancamento.servicoId);
  const avancoDoForm = avancos.find(item => item.servico.id === lancamento.servicoId);

  return (
    <div id="producao-tab" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Produção"
        description="Serviços contratados e produção executada. O avanço vem da soma dos lançamentos."
        actions={podeEditar ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => abrirServico()} className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700">Novo serviço</button>
            <button type="button" onClick={() => abrirLancamento()} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-800">
              <Plus className="h-4 w-4" /> Lançar produção
            </button>
          </div>
        ) : undefined}
      />

      <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: 'Serviços ativos', valor: String(servicosAtivos.length) },
          { label: 'Lançamentos', valor: String(registrosAtivos.length) },
          { label: 'Lançados hoje', valor: String(totalExecutadoHoje) },
          { label: 'Serviços em 100%', valor: String(concluidos) },
        ].map(item => (
          <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-500">{item.label}</p>
            <strong className="mt-1.5 block text-2xl font-black tabular-nums text-slate-900">{item.valor}</strong>
          </div>
        ))}
      </section>

      {ultimosDias.length > 0 && (
        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            <TrendingUp className="h-4 w-4 text-emerald-600" /> Produção dos últimos dias
          </h2>
          <div className="mt-3 flex items-end gap-1.5 overflow-x-auto">
            {ultimosDias.map(item => (
              <div key={item.data} className="flex min-w-0 flex-1 shrink-0 basis-8 flex-col items-center gap-1">
                <span className="text-[10px] font-bold tabular-nums text-slate-500">{numero(item.quantidade)}</span>
                <div
                  className="w-full rounded-t bg-emerald-600/80"
                  style={{ height: `${picoDia > 0 ? Math.max(6, (item.quantidade / picoDia) * 72) : 6}px` }}
                />
                <span className="text-[9px] text-slate-400">{item.data.slice(8)}/{item.data.slice(5, 7)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-4 flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {([['avanco', 'Avanço'], ['lancamentos', 'Lançamentos'], ['servicos', 'Serviços']] as const).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            aria-pressed={aba === id}
            className={`min-h-10 flex-1 rounded-md text-xs font-bold transition-colors ${aba === id ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <label className="relative mt-3 block">
        <span className="sr-only">Buscar serviço ou lançamento</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={busca}
          onChange={event => setBusca(event.target.value)}
          placeholder="Serviço, frente, equipe ou responsável"
          className="min-h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-emerald-500"
        />
      </label>

      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {aba === 'lancamentos' ? (
          registrosFiltrados.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Nenhuma produção lançada" description="Registre o que foi executado em cada dia." />
          ) : (
            <TableShell minWidth={900}>
              <TableHead>
                <tr>
                  <th className="p-3">Data</th>
                  <th className="p-3">Serviço</th>
                  <th className="p-3">Quantidade</th>
                  <th className="p-3">Frente</th>
                  <th className="p-3">Equipe</th>
                  <th className="p-3">Responsável</th>
                  {podeEditar && <th className="p-3 text-right">Ações</th>}
                </tr>
              </TableHead>
              <TableBody>
                {registrosFiltrados.map(item => (
                  <tr key={item.id} className="transition-colors hover:bg-slate-50">
                    <td className="p-3 text-slate-600">{formatarData(item.data)}</td>
                    <td className="p-3 font-bold text-slate-800">{item.servicoDescricao}</td>
                    <td className="p-3 font-mono text-slate-900">{numero(item.quantidade)} {item.unidade}</td>
                    <td className="p-3 text-slate-600">{item.frente || '—'}</td>
                    <td className="p-3 text-slate-600">{item.equipeNome || '—'}</td>
                    <td className="p-3 text-slate-600">{item.responsavel}</td>
                    {podeEditar && (
                      <td className="p-3 text-right">
                        <button type="button" onClick={() => abrirLancamento(item)} className="min-h-9 rounded-lg border border-slate-200 px-2.5 text-[11px] font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700">Editar</button>
                      </td>
                    )}
                  </tr>
                ))}
              </TableBody>
            </TableShell>
          )
        ) : avancosFiltrados.length === 0 ? (
          <EmptyState icon={BarChart3} title="Nenhum serviço cadastrado" description="Cadastre os serviços contratados da obra." />
        ) : (
          <TableShell minWidth={aba === 'avanco' ? 900 : 860}>
            <TableHead>
              <tr>
                <th className="p-3">Código</th>
                <th className="p-3">Serviço</th>
                <th className="p-3">Unidade</th>
                {aba === 'avanco' ? (
                  <>
                    <th className="p-3">Previsto</th>
                    <th className="p-3">Executado</th>
                    <th className="p-3">Saldo</th>
                    <th className="p-3">Avanço</th>
                  </>
                ) : (
                  <>
                    <th className="p-3">Obra</th>
                    <th className="p-3">Previsto</th>
                    <th className="p-3">Situação</th>
                    {podeEditar && <th className="p-3 text-right">Ações</th>}
                  </>
                )}
              </tr>
            </TableHead>
            <TableBody>
              {avancosFiltrados.map(item => (
                <tr key={item.servico.id} className="transition-colors hover:bg-slate-50">
                  <td className="p-3 font-mono text-slate-600">{item.servico.codigo || '—'}</td>
                  <td className="p-3 font-bold text-slate-800">{item.servico.descricao}</td>
                  <td className="p-3 text-slate-600">{item.servico.unidade}</td>
                  {aba === 'avanco' ? (
                    <>
                      <td className="p-3 font-mono text-slate-600">{item.previsto > 0 ? numero(item.previsto) : '—'}</td>
                      <td className="p-3 font-mono font-bold text-slate-900">{numero(item.acumulado)}</td>
                      <td className="p-3 font-mono text-slate-600">{item.saldo === undefined ? '—' : numero(item.saldo)}</td>
                      <td className="p-3">
                        {item.percentual === undefined ? (
                          <span className="text-[11px] text-slate-400">sem previsto</span>
                        ) : (
                          <div className="flex min-w-28 items-center gap-2">
                            <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                              <div className="h-1.5 rounded-full bg-emerald-600" style={{ width: `${Math.min(100, item.percentual)}%` }} />
                            </div>
                            <span className="font-mono text-[11px] font-bold text-slate-700">{item.percentual}%</span>
                          </div>
                        )}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-3 text-slate-600">{obras.find(obra => obra.id === item.servico.obraId)?.nome || '—'}</td>
                      <td className="p-3 font-mono text-slate-600">{item.previsto > 0 ? numero(item.previsto) : '—'}</td>
                      <td className="p-3">
                        <Badge tone={item.servico.situacao === 'Ativo' ? 'success' : item.servico.situacao === 'Suspenso' ? 'warning' : 'neutral'}>
                          {item.servico.situacao}
                        </Badge>
                      </td>
                      {podeEditar && (
                        <td className="p-3 text-right">
                          <button type="button" onClick={() => abrirServico(item.servico)} className="min-h-9 rounded-lg border border-slate-200 px-2.5 text-[11px] font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700">Editar</button>
                        </td>
                      )}
                    </>
                  )}
                </tr>
              ))}
            </TableBody>
          </TableShell>
        )}
      </div>

      <Modal
        open={servicoAberto}
        title={servicoEditado ? `Editar ${servicoEditado.descricao}` : 'Novo serviço'}
        size="md"
        onClose={() => setServicoAberto(false)}
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setServicoAberto(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={salvarServico} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">Salvar serviço</button>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">
            Código
            <input value={cadastro.codigo} onChange={event => setCadastro({ ...cadastro, codigo: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Unidade
            <select value={cadastro.unidade} onChange={event => setCadastro({ ...cadastro, unidade: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              {UNIDADES.map(unidade => <option key={unidade} value={unidade}>{unidade}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Descrição
            <input value={cadastro.descricao} onChange={event => setCadastro({ ...cadastro, descricao: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Obra
            <select value={cadastro.obraId} onChange={event => setCadastro({ ...cadastro, obraId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              <option value="">Sem obra</option>
              {obras.map(obra => <option key={obra.id} value={obra.id}>{obra.nome}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Quantidade prevista
            <input type="number" min={0} step="0.001" value={cadastro.quantidadePrevista} onChange={event => setCadastro({ ...cadastro, quantidadePrevista: Number(event.target.value) })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Situação
            <select value={cadastro.situacao} onChange={event => setCadastro({ ...cadastro, situacao: event.target.value as SituacaoServico })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              {SITUACOES.map(situacao => <option key={situacao} value={situacao}>{situacao}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Observação
            <textarea value={cadastro.observacao} onChange={event => setCadastro({ ...cadastro, observacao: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          {erro && <p className="sm:col-span-2 text-xs font-bold text-rose-700">{erro}</p>}
        </div>
      </Modal>

      <Modal
        open={lancamentoAberto}
        title={registroEditado ? 'Editar produção' : 'Lançar produção'}
        size="md"
        onClose={() => setLancamentoAberto(false)}
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setLancamentoAberto(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={salvarLancamento} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">Salvar produção</button>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">
            Data
            <input type="date" value={lancamento.data} onChange={event => setLancamento({ ...lancamento, data: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Serviço
            <select value={lancamento.servicoId} onChange={event => setLancamento({ ...lancamento, servicoId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              <option value="">Selecione</option>
              {servicosAtivos.filter(item => item.situacao !== 'Concluído' || item.id === lancamento.servicoId)
                .map(item => <option key={item.id} value={item.id}>{item.descricao} ({item.unidade})</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Quantidade {servicoDoForm ? `(${servicoDoForm.unidade})` : ''}
            <input type="number" min={0} step="0.001" value={lancamento.quantidade} onChange={event => setLancamento({ ...lancamento, quantidade: Number(event.target.value) })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Equipe
            <select value={lancamento.grupoId} onChange={event => setLancamento({ ...lancamento, grupoId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              <option value="">Sem equipe</option>
              {gruposEquipe.filter(item => item.status !== 'inativo').map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Frente
            <input list="producao-frentes" value={lancamento.frente} onChange={event => setLancamento({ ...lancamento, frente: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
            <datalist id="producao-frentes">
              {frentes.map(frente => <option key={frente.id} value={frente.nome} />)}
            </datalist>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Obra
            <select value={lancamento.obraId} onChange={event => setLancamento({ ...lancamento, obraId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              <option value="">Herdar do serviço</option>
              {obras.map(obra => <option key={obra.id} value={obra.id}>{obra.nome}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Observação
            <textarea value={lancamento.observacao} onChange={event => setLancamento({ ...lancamento, observacao: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          {avancoDoForm && avancoDoForm.saldo !== undefined && (
            <p className="sm:col-span-2 text-[11px] text-slate-500">
              Executado até agora: {numero(avancoDoForm.acumulado)} {avancoDoForm.servico.unidade} · saldo previsto {numero(avancoDoForm.saldo)}
            </p>
          )}
          {erro && <p className="sm:col-span-2 text-xs font-bold text-rose-700">{erro}</p>}
        </div>
      </Modal>
    </div>
  );
}
