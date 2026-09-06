/**
 * FVS — Ficha de Verificação de Serviço. Ficha com item obrigatório não conforme
 * não é aprovada; a liberação com pendência existe, mas exige justificativa
 * escrita, para a decisão ficar registrada em vez de virar aprovação silenciosa.
 */
import { useMemo, useState } from 'react';
import { AlertOctagon, CheckCircle2, ClipboardCheck, FileText, Plus, Search, Trash2 } from 'lucide-react';
import type {
  FichaVerificacaoServico,
  FrenteServico,
  ItemFvs,
  ModeloFvs,
  ObraLocal,
  RespostaFvs,
  ServicoObra,
  SituacaoFvs,
} from '../types';
import {
  MODELO_FVS_PADRAO,
  proximoNumeroFvs,
  resumoFvs,
  situacaoSugerida,
  validarFvs,
} from '../utils/fvs';
import { normalizeComparable } from '../utils/canonicalIdentity';
import { formatarData } from '../utils/formato';
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

interface FvsTabProps {
  fichas: FichaVerificacaoServico[];
  modelos: ModeloFvs[];
  servicos: ServicoObra[];
  obras: ObraLocal[];
  frentes: FrenteServico[];
  responsavel: string;
  podeEditar: boolean;
  podeAprovar: boolean;
  onSaveFicha: (ficha: FichaVerificacaoServico, isNew: boolean) => void;
  onSaveModelo: (modelo: ModeloFvs, isNew: boolean) => void;
}

const RESPOSTAS: RespostaFvs[] = ['Conforme', 'Não conforme', 'Não aplicável'];
const SITUACOES: SituacaoFvs[] = ['Em preenchimento', 'Aprovada', 'Liberada com pendência', 'Reprovada'];


const tomDaSituacao = (situacao: SituacaoFvs) => {
  if (situacao === 'Aprovada') return 'success' as const;
  if (situacao === 'Reprovada') return 'danger' as const;
  if (situacao === 'Liberada com pendência') return 'warning' as const;
  return 'neutral' as const;
};

export default function FvsTab({
  fichas,
  modelos,
  servicos,
  obras,
  frentes,
  responsavel,
  podeEditar,
  podeAprovar,
  onSaveFicha,
  onSaveModelo,
}: FvsTabProps) {
  const hoje = isoDay(new Date());
  const [aba, setAba] = useState<'fichas' | 'modelos'>('fichas');
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');
  const [fichaAberta, setFichaAberta] = useState(false);
  const [modeloAberto, setModeloAberto] = useState(false);
  const [editada, setEditada] = useState<FichaVerificacaoServico | null>(null);
  const [modeloEditado, setModeloEditado] = useState<ModeloFvs | null>(null);
  const [form, setForm] = useState({
    data: hoje,
    modeloId: '',
    servicoId: '',
    obraId: '',
    frente: '',
    local: '',
    situacao: 'Em preenchimento' as SituacaoFvs,
    observacao: '',
  });
  const [itens, setItens] = useState<ItemFvs[]>([]);
  const [formModelo, setFormModelo] = useState({ nome: '', servicoId: '', itens: [] as ModeloFvs['itens'] });

  const modelosDisponiveis = useMemo(() => {
    const ativos = modelos.filter(item => item.ativo !== false);
    return ativos.length > 0 ? ativos : [MODELO_FVS_PADRAO];
  }, [modelos]);
  const fichasAtivas = useMemo(() => fichas.filter(item => item.ativo !== false), [fichas]);

  const termo = normalizeComparable(busca).trim();
  const filtradas = useMemo(() => [...fichasAtivas]
    .filter(item => !termo || normalizeComparable(`${item.numero} ${item.local} ${item.modeloNome} ${item.servicoDescricao || ''} ${item.frente || ''} ${item.situacao}`).includes(termo))
    .sort((a, b) => b.data.localeCompare(a.data) || b.numero.localeCompare(a.numero)), [fichasAtivas, termo]);

  const aprovadas = fichasAtivas.filter(item => item.situacao === 'Aprovada').length;
  const reprovadas = fichasAtivas.filter(item => item.situacao === 'Reprovada').length;
  const comPendencia = fichasAtivas.filter(item => item.situacao === 'Liberada com pendência').length;

  const abrirFicha = (ficha?: FichaVerificacaoServico) => {
    const modelo = modelosDisponiveis.find(item => item.id === ficha?.modeloId) || modelosDisponiveis[0];
    setEditada(ficha || null);
    setForm(ficha
      ? {
        data: ficha.data,
        modeloId: ficha.modeloId,
        servicoId: ficha.servicoId || '',
        obraId: ficha.obraId || '',
        frente: ficha.frente || '',
        local: ficha.local,
        situacao: ficha.situacao,
        observacao: ficha.observacao || '',
      }
      : { data: hoje, modeloId: modelo.id, servicoId: modelo.servicoId || '', obraId: '', frente: '', local: '', situacao: 'Em preenchimento', observacao: '' });
    setItens(ficha
      ? ficha.itens
      : modelo.itens.map(item => ({ itemId: item.id, descricao: item.descricao, obrigatorio: item.obrigatorio, resposta: '' as RespostaFvs })));
    setErro('');
    setFichaAberta(true);
  };

  const trocarModelo = (modeloId: string) => {
    const modelo = modelosDisponiveis.find(item => item.id === modeloId);
    setForm({ ...form, modeloId, servicoId: modelo?.servicoId || form.servicoId });
    if (modelo) {
      setItens(modelo.itens.map(item => ({ itemId: item.id, descricao: item.descricao, obrigatorio: item.obrigatorio, resposta: '' as RespostaFvs })));
    }
  };

  const responder = (itemId: string, resposta: RespostaFvs) => {
    setItens(itens.map(item => item.itemId === itemId ? { ...item, resposta } : item));
  };

  const salvarFicha = () => {
    const modelo = modelosDisponiveis.find(item => item.id === form.modeloId);
    const problema = validarFvs({ local: form.local, itens, situacao: form.situacao, observacao: form.observacao });
    if (problema || !modelo) {
      setErro(problema || 'Selecione o modelo da ficha.');
      return;
    }
    if (form.situacao !== 'Em preenchimento' && !podeAprovar) {
      setErro('Seu perfil não pode encerrar a ficha. Salve em preenchimento.');
      return;
    }
    const servico = servicos.find(item => item.id === form.servicoId);
    const agora = new Date().toISOString();
    const encerrada = form.situacao !== 'Em preenchimento';
    onSaveFicha({
      id: editada?.id || `fvs-${Date.now()}`,
      numero: editada?.numero || proximoNumeroFvs(fichas),
      data: form.data,
      modeloId: modelo.id,
      modeloNome: modelo.nome,
      servicoId: servico?.id,
      servicoDescricao: servico?.descricao,
      obraId: form.obraId || undefined,
      frente: form.frente.trim() || undefined,
      local: form.local.trim(),
      itens,
      situacao: form.situacao,
      responsavel: editada?.responsavel || responsavel,
      aprovadoPor: encerrada ? responsavel : editada?.aprovadoPor,
      aprovadoEm: encerrada ? agora : editada?.aprovadoEm,
      observacao: form.observacao.trim() || undefined,
      ativo: editada?.ativo ?? true,
      criadoEm: editada?.criadoEm || agora,
      atualizadoEm: agora,
    }, !editada);
    setErro('');
    setFichaAberta(false);
  };

  const abrirModelo = (modelo?: ModeloFvs) => {
    setModeloEditado(modelo || null);
    setFormModelo(modelo
      ? { nome: modelo.nome, servicoId: modelo.servicoId || '', itens: modelo.itens.map(item => ({ ...item })) }
      : { nome: '', servicoId: '', itens: MODELO_FVS_PADRAO.itens.map(item => ({ ...item })) });
    setErro('');
    setModeloAberto(true);
  };

  const salvarModelo = () => {
    if (!formModelo.nome.trim() || formModelo.itens.length === 0) {
      setErro('Informe o nome e ao menos um item de verificação.');
      return;
    }
    const agora = new Date().toISOString();
    onSaveModelo({
      id: modeloEditado?.id || `modelo-fvs-${Date.now()}`,
      nome: formModelo.nome.trim(),
      servicoId: formModelo.servicoId || undefined,
      itens: formModelo.itens.filter(item => item.descricao.trim()),
      ativo: modeloEditado?.ativo ?? true,
      criadoEm: modeloEditado?.criadoEm || agora,
      atualizadoEm: agora,
    }, !modeloEditado);
    setErro('');
    setModeloAberto(false);
  };

  const resumo = resumoFvs(itens);
  const sugerida = situacaoSugerida(itens);

  return (
    <div id="fvs-tab" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="FVS"
        description="Ficha de Verificação de Serviço. Item obrigatório não conforme não é aprovado."
        actions={podeEditar ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => abrirModelo()} className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700">Novo modelo</button>
            <button type="button" onClick={() => abrirFicha()} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-800">
              <Plus className="h-4 w-4" /> Nova ficha
            </button>
          </div>
        ) : undefined}
      />

      <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: 'Fichas', valor: fichasAtivas.length, tone: 'neutral' as const, icone: FileText },
          { label: 'Aprovadas', valor: aprovadas, tone: 'success' as const, icone: CheckCircle2 },
          { label: 'Com pendência', valor: comPendencia, tone: 'warning' as const, icone: AlertOctagon },
          { label: 'Reprovadas', valor: reprovadas, tone: 'danger' as const, icone: AlertOctagon },
        ].map(item => (
          <StatCard key={item.label} label={item.label} value={item.valor} tone={item.tone} icon={item.icone} />
        ))}
      </section>

      <div className="mt-4 flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {([['fichas', 'Fichas'], ['modelos', 'Modelos']] as const).map(([id, rotulo]) => (
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

      {aba === 'fichas' && (
        <label className="relative mt-3 block">
          <span className="sr-only">Buscar ficha</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={event => setBusca(event.target.value)}
            placeholder="Número, local, serviço, frente ou situação"
            className="min-h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-emerald-500"
          />
        </label>
      )}

      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {aba === 'modelos' ? (
          <TableShell minWidth={720}>
            <TableHead>
              <tr>
                <th className="p-3">Modelo</th>
                <th className="p-3">Serviço</th>
                <th className="p-3">Itens</th>
                <th className="p-3">Obrigatórios</th>
                {podeEditar && <th className="p-3 text-right">Ações</th>}
              </tr>
            </TableHead>
            <TableBody>
              {modelosDisponiveis.map(modelo => (
                <tr key={modelo.id} className="transition-colors hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-800">{modelo.nome}</td>
                  <td className="p-3 text-slate-600">{servicos.find(item => item.id === modelo.servicoId)?.descricao || 'Todos'}</td>
                  <td className="p-3 text-slate-600">{modelo.itens.length}</td>
                  <td className="p-3 text-slate-600">{modelo.itens.filter(item => item.obrigatorio).length}</td>
                  {podeEditar && (
                    <td className="p-3 text-right">
                      <button type="button" onClick={() => abrirModelo(modelo)} className="min-h-9 rounded-lg border border-slate-200 px-2.5 text-[11px] font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700">Editar</button>
                    </td>
                  )}
                </tr>
              ))}
            </TableBody>
          </TableShell>
        ) : filtradas.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="Nenhuma ficha registrada" description="Abra a ficha do serviço executado para verificar a qualidade." />
        ) : (
          <TableShell minWidth={1040}>
            <TableHead>
              <tr>
                <th className="p-3">Número</th>
                <th className="p-3">Data</th>
                <th className="p-3">Local</th>
                <th className="p-3">Serviço</th>
                <th className="p-3">Não conformes</th>
                <th className="p-3">Situação</th>
                <th className="p-3">Responsável</th>
                {podeEditar && <th className="p-3 text-right">Ações</th>}
              </tr>
            </TableHead>
            <TableBody>
              {filtradas.map(ficha => {
                const linha = resumoFvs(ficha.itens);
                return (
                  <tr key={ficha.id} className="transition-colors hover:bg-slate-50">
                    <td className="p-3 font-mono text-slate-600">{ficha.numero}</td>
                    <td className="p-3 text-slate-600">{formatarData(ficha.data)}</td>
                    <td className="p-3 font-bold text-slate-800">{ficha.local}</td>
                    <td className="p-3 text-slate-600">{ficha.servicoDescricao || '—'}</td>
                    <td className={`p-3 font-mono ${linha.naoConformes > 0 ? 'font-bold text-rose-700' : 'text-slate-600'}`}>
                      {linha.naoConformes}/{linha.total}
                    </td>
                    <td className="p-3"><Badge tone={tomDaSituacao(ficha.situacao)}>{ficha.situacao}</Badge></td>
                    <td className="p-3 text-slate-600">{ficha.responsavel}</td>
                    {podeEditar && (
                      <td className="p-3 text-right">
                        <button type="button" onClick={() => abrirFicha(ficha)} className="min-h-9 rounded-lg border border-slate-200 px-2.5 text-[11px] font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700">Abrir</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </TableBody>
          </TableShell>
        )}
      </div>

      <Modal
        open={fichaAberta}
        title={editada ? `Ficha ${editada.numero}` : 'Nova ficha de verificação'}
        onSubmit={salvarFicha}
        size="lg"
        onClose={() => setFichaAberta(false)}
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setFichaAberta(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={salvarFicha} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">Salvar ficha</button>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">
            Data
            <input type="date" value={form.data} onChange={event => setForm({ ...form, data: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Modelo
            <select value={form.modeloId} onChange={event => trocarModelo(event.target.value)} disabled={Boolean(editada)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500 disabled:bg-slate-50">
              {modelosDisponiveis.map(modelo => <option key={modelo.id} value={modelo.id}>{modelo.nome}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Local verificado
            <input value={form.local} onChange={event => setForm({ ...form, local: event.target.value })} placeholder="Estaca, trecho, elemento" className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Serviço
            <select value={form.servicoId} onChange={event => setForm({ ...form, servicoId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              <option value="">Sem serviço</option>
              {servicos.filter(item => item.ativo !== false).map(item => <option key={item.id} value={item.id}>{item.descricao}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Frente
            <input list="fvs-frentes" value={form.frente} onChange={event => setForm({ ...form, frente: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
            <datalist id="fvs-frentes">
              {frentes.map(frente => <option key={frente.id} value={frente.nome} />)}
            </datalist>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Obra
            <select value={form.obraId} onChange={event => setForm({ ...form, obraId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              <option value="">Sem obra</option>
              {obras.map(obra => <option key={obra.id} value={obra.id}>{obra.nome}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Situação
            <select value={form.situacao} onChange={event => setForm({ ...form, situacao: event.target.value as SituacaoFvs })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              {SITUACOES.map(situacao => <option key={situacao} value={situacao}>{situacao}</option>)}
            </select>
          </label>
        </div>

        <p className="mt-3 text-[11px] text-slate-500">
          {resumo.conformes} conforme(s) · {resumo.naoConformes} não conforme(s) · situação sugerida pelas respostas: <strong>{sugerida}</strong>
        </p>

        <ul className="mt-2 space-y-2">
          {itens.map(item => (
            <li key={item.itemId} className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-bold text-slate-800">
                {item.descricao}
                {item.obrigatorio && <span className="ml-2 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">obrigatório</span>}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {RESPOSTAS.map(resposta => (
                  <button
                    key={resposta}
                    type="button"
                    onClick={() => responder(item.itemId, resposta)}
                    aria-pressed={item.resposta === resposta}
                    className={`min-h-9 rounded-lg border px-3 text-[11px] font-bold transition-colors ${item.resposta === resposta
                      ? resposta === 'Não conforme' ? 'border-rose-500 bg-rose-600 text-white' : 'border-emerald-600 bg-emerald-700 text-white'
                      : 'border-slate-200 text-slate-600 hover:border-emerald-400'}`}
                  >
                    {resposta}
                  </button>
                ))}
              </div>
              {item.resposta === 'Não conforme' && (
                <input
                  value={item.observacao || ''}
                  onChange={event => setItens(itens.map(atual => atual.itemId === item.itemId ? { ...atual, observacao: event.target.value } : atual))}
                  placeholder="O que está não conforme e o que precisa ser feito"
                  className="mt-2 min-h-10 w-full rounded-lg border border-rose-200 px-3 text-sm text-slate-800 outline-none focus:border-rose-500"
                />
              )}
            </li>
          ))}
        </ul>

        <label className="mt-3 block text-xs font-bold text-slate-600">
          Observação / justificativa
          <textarea value={form.observacao} onChange={event => setForm({ ...form, observacao: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
        </label>
        {erro && <p className="mt-2 text-xs font-bold text-rose-700">{erro}</p>}
      </Modal>

      <Modal
        open={modeloAberto}
        title={modeloEditado ? `Editar ${modeloEditado.nome}` : 'Novo modelo de FVS'}
        onSubmit={salvarModelo}
        size="md"
        onClose={() => setModeloAberto(false)}
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setModeloAberto(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={salvarModelo} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">Salvar modelo</button>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">
            Nome
            <input value={formModelo.nome} onChange={event => setFormModelo({ ...formModelo, nome: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Serviço
            <select value={formModelo.servicoId} onChange={event => setFormModelo({ ...formModelo, servicoId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              <option value="">Todos os serviços</option>
              {servicos.filter(item => item.ativo !== false).map(item => <option key={item.id} value={item.id}>{item.descricao}</option>)}
            </select>
          </label>
        </div>
        <ul className="mt-3 space-y-2">
          {formModelo.itens.map((item, indice) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2">
              <input
                value={item.descricao}
                onChange={event => setFormModelo({
                  ...formModelo,
                  itens: formModelo.itens.map((atual, posicao) => posicao === indice ? { ...atual, descricao: event.target.value } : atual),
                })}
                className="min-h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500"
              />
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                <input
                  type="checkbox"
                  checked={item.obrigatorio}
                  onChange={event => setFormModelo({
                    ...formModelo,
                    itens: formModelo.itens.map((atual, posicao) => posicao === indice ? { ...atual, obrigatorio: event.target.checked } : atual),
                  })}
                />
                obrigatório
              </label>
              <button
                type="button"
                aria-label={`Remover ${item.descricao}`}
                onClick={() => setFormModelo({ ...formModelo, itens: formModelo.itens.filter((_, posicao) => posicao !== indice) })}
                className="min-h-9 rounded-lg border border-slate-200 px-2 text-slate-500 transition-colors hover:border-rose-400 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setFormModelo({ ...formModelo, itens: [...formModelo.itens, { id: `item-${Date.now()}`, descricao: '', obrigatorio: false }] })}
          className="mt-2 min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700"
        >
          Adicionar item
        </button>
        {erro && <p className="mt-2 text-xs font-bold text-rose-700">{erro}</p>}
      </Modal>
    </div>
  );
}
