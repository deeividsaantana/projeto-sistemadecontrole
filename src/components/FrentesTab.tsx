/**
 * Frentes de serviço: o cadastro da frente e a página que reúne tudo que
 * aconteceu nela. A ligação com o histórico é pelo nome, o mesmo texto que
 * equipes e lançamentos já usam.
 */
import { useMemo, useState } from 'react';
import { ArrowLeft, Boxes, ClipboardList, Clock3, MapPin, Plus, Truck, Users } from 'lucide-react';
import type {
  ApontamentoOperacional,
  ControleEquipamentoDiario,
  FrenteServico,
  GrupoEquipe,
  MovimentoMaterial,
  ObraLocal,
  PresencaApontamento,
  SituacaoFrente,
  TicketJazida,
} from '../types';
import type { FleetPersistedRecord } from '../fleet/domain';
import { normalizeComparable } from '../utils/canonicalIdentity';
import { horasPor } from '../utils/apontamentos';
import { Badge, Card, EmptyState, Modal, PageHeader, StatCard, isoDay, statusTone } from '../shared/ui';

interface FrentesTabProps {
  frentes: FrenteServico[];
  obras: ObraLocal[];
  gruposEquipe: GrupoEquipe[];
  presencasLink: PresencaApontamento[];
  controlesEquipamentos: ControleEquipamentoDiario[];
  apontamentos: ApontamentoOperacional[];
  movimentosMaterial: MovimentoMaterial[];
  ticketsJazida: TicketJazida[];
  podeEditar: boolean;
  onSave: (frente: FrenteServico, isNew: boolean) => void;
}

const SITUACOES: SituacaoFrente[] = ['Planejada', 'Em execução', 'Paralisada', 'Concluída'];

const formatarData = (valor?: string) => (valor ? valor.slice(0, 10).split('-').reverse().join('/') : '—');
const situacaoTone = (situacao: SituacaoFrente) =>
  situacao === 'Em execução' ? 'success' : situacao === 'Paralisada' ? 'danger' : situacao === 'Concluída' ? 'neutral' : 'info';

export default function FrentesTab({
  frentes,
  obras,
  gruposEquipe,
  presencasLink,
  controlesEquipamentos,
  apontamentos,
  movimentosMaterial,
  ticketsJazida,
  podeEditar,
  onSave,
}: FrentesTabProps) {
  const hoje = isoDay(new Date());
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState<FrenteServico | null>(null);
  const [erro, setErro] = useState('');
  const [form, setForm] = useState({
    nome: '', obraId: '', ramoLocal: '', servico: '', responsavel: '',
    dataInicio: '', dataTerminoPrevisto: '', situacao: 'Em execução' as SituacaoFrente, observacao: '',
  });

  const ordenadas = useMemo(
    () => frentes.filter(item => item.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })),
    [frentes],
  );

  const abrirForm = (frente?: FrenteServico) => {
    setEditando(frente || null);
    setForm(frente
      ? {
        nome: frente.nome, obraId: frente.obraId || '', ramoLocal: frente.ramoLocal || '',
        servico: frente.servico || '', responsavel: frente.responsavel || '',
        dataInicio: frente.dataInicio || '', dataTerminoPrevisto: frente.dataTerminoPrevisto || '',
        situacao: frente.situacao, observacao: frente.observacao || '',
      }
      : { nome: '', obraId: '', ramoLocal: '', servico: '', responsavel: '', dataInicio: '', dataTerminoPrevisto: '', situacao: 'Em execução', observacao: '' });
    setErro('');
    setFormAberto(true);
  };

  const salvar = () => {
    if (!form.nome.trim()) {
      setErro('Informe o nome da frente.');
      return;
    }
    const agora = new Date().toISOString();
    onSave({
      id: editando?.id || `frente-${Date.now()}`,
      nome: form.nome.trim(),
      obraId: form.obraId || undefined,
      ramoLocal: form.ramoLocal.trim() || undefined,
      servico: form.servico.trim() || undefined,
      responsavel: form.responsavel.trim() || undefined,
      dataInicio: form.dataInicio || undefined,
      dataTerminoPrevisto: form.dataTerminoPrevisto || undefined,
      situacao: form.situacao,
      observacao: form.observacao.trim() || undefined,
      ativo: editando?.ativo ?? true,
      criadoEm: editando?.criadoEm || agora,
      atualizadoEm: agora,
    }, !editando);
    setFormAberto(false);
    setEditando(null);
  };

  const selecionada = selecionadaId ? frentes.find(item => item.id === selecionadaId) : undefined;

  if (selecionada) {
    const alvo = normalizeComparable(selecionada.nome);
    const equipes = gruposEquipe.filter(item => normalizeComparable(item.frenteServico || '') === alvo);
    const idsEquipes = new Set(equipes.map(item => item.id));
    const presencasDoDia = presencasLink.filter(item => item.data === hoje
      && (idsEquipes.has(item.grupoId) || normalizeComparable(item.frenteServico || '') === alvo));
    const frotaDoDia = controlesEquipamentos.filter(item => item.data === hoje
      && normalizeComparable((item as FleetPersistedRecord).frenteServico || '') === alvo);
    const horasFrente = apontamentos.filter(item => normalizeComparable(item.frenteServico || '') === alvo);
    const materiais = movimentosMaterial.filter(item => normalizeComparable(item.destino || '') === alvo);
    const viagens = ticketsJazida.filter(item => normalizeComparable(String(item.destinoObra || '')) === alvo);
    const totalHoras = horasFrente.reduce((soma, item) => soma + (Number(item.horas) || 0), 0);

    return (
      <div id="frente-ficha" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
        <button
          type="button"
          onClick={() => setSelecionadaId(null)}
          className="mb-4 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para frentes
        </button>

        <PageHeader
          title={selecionada.nome}
          description={[selecionada.ramoLocal, selecionada.servico, obras.find(item => item.id === selecionada.obraId)?.nome].filter(Boolean).join(' · ')}
          actions={(
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={situacaoTone(selecionada.situacao)}>{selecionada.situacao}</Badge>
              {podeEditar && <button type="button" onClick={() => abrirForm(selecionada)} className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700">Editar</button>}
            </div>
          )}
        />

        <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: 'Equipes', valor: equipes.length, tone: 'neutral' as const, icone: Users },
          { label: 'Presentes hoje', valor: presencasDoDia.filter(item => ['Presente', 'Atraso', 'Saída antecipada'].includes(item.status)).length, tone: 'success' as const, icone: Users },
          { label: 'Frota hoje', valor: frotaDoDia.length, tone: 'neutral' as const, icone: Truck },
          { label: 'Horas apontadas', valor: `${totalHoras.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`, tone: 'info' as const, icone: Clock3 },
        ].map(item => (
          <StatCard key={item.label} label={item.label} value={item.valor} tone={item.tone} icon={item.icone} />
        ))}
      </section>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Card className="min-w-0" title="Planejamento">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              {[
                ['Responsável', selecionada.responsavel || '—'],
                ['Serviço', selecionada.servico || '—'],
                ['Ramo / local', selecionada.ramoLocal || '—'],
                ['Obra', obras.find(item => item.id === selecionada.obraId)?.nome || '—'],
                ['Início', formatarData(selecionada.dataInicio)],
                ['Término previsto', formatarData(selecionada.dataTerminoPrevisto)],
              ].map(([rotulo, valor]) => (
                <div key={rotulo} className="min-w-0">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{rotulo}</dt>
                  <dd className="mt-0.5 break-words font-medium text-slate-800">{valor}</dd>
                </div>
              ))}
            </dl>
            {selecionada.observacao && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">{selecionada.observacao}</p>}
          </Card>

          <Card className="min-w-0" title="Equipes e presença de hoje" flush>
            {equipes.length === 0 ? (
              <EmptyState icon={Users} title="Nenhuma equipe nesta frente" compact />
            ) : (
              <ul className="divide-y divide-slate-100">
                {equipes.map(equipe => {
                  const daEquipe = presencasDoDia.filter(item => item.grupoId === equipe.id);
                  return (
                    <li key={equipe.id} className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
                      <span className="min-w-0">
                        <strong className="block truncate text-slate-800">{equipe.nome}</strong>
                        <span className="block truncate text-[10px] text-slate-400">{equipe.responsavel || 'Sem encarregado'}</span>
                      </span>
                      {daEquipe.length === 0
                        ? <Badge tone="warning">Sem apontamento</Badge>
                        : <span className="shrink-0 font-mono text-slate-900">{daEquipe.filter(item => item.status === 'Presente').length}/{daEquipe.length}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="min-w-0" title="Frota de hoje" flush>
            {frotaDoDia.length === 0 ? (
              <EmptyState icon={Truck} title="Nenhum equipamento lançado nesta frente hoje" compact />
            ) : (
              <ul className="divide-y divide-slate-100">
                {frotaDoDia.map(item => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
                    <span className="min-w-0">
                      <strong className="block font-mono text-slate-900">{item.prefixo}</strong>
                      <span className="block truncate text-[10px] text-slate-400">{item.nomeMotorista || 'Sem motorista'}</span>
                    </span>
                    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusTone(item.status)}`}>{item.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            className="min-w-0"
            title="Horas e materiais"
            description={materiais.length ? `${materiais.length} movimento(s) de material para esta frente` : undefined}
            flush
          >
            {horasFrente.length === 0 && materiais.length === 0 && viagens.length === 0 ? (
              <EmptyState icon={ClipboardList} title="Sem apontamentos, materiais ou viagens" compact />
            ) : (
              <ul className="divide-y divide-slate-100">
                {horasPor(horasFrente, item => item.servico || item.atividade).slice(0, 5).map(item => (
                  <li key={`h-${item.chave}`} className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
                    <span className="min-w-0 truncate text-slate-700">{item.chave}</span>
                    <span className="shrink-0 font-mono font-bold text-slate-900">{item.horas.toLocaleString('pt-BR')} h</span>
                  </li>
                ))}
                {materiais.slice(0, 5).map(item => (
                  <li key={`m-${item.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
                    <span className="min-w-0 truncate text-slate-700"><Boxes className="mr-1 inline h-3 w-3 text-slate-400" />{item.materialDescricao}</span>
                    <span className="shrink-0 font-mono text-slate-900">{item.quantidade.toLocaleString('pt-BR')} {item.unidade}</span>
                  </li>
                ))}
                {viagens.length > 0 && (
                  <li className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
                    <span className="text-slate-700"><Truck className="mr-1 inline h-3 w-3 text-slate-400" />Viagens com destino nesta frente</span>
                    <span className="shrink-0 font-mono font-bold text-slate-900">{viagens.length}</span>
                  </li>
                )}
              </ul>
            )}
          </Card>
        </div>

        <FormFrente
          aberto={formAberto}
          editando={editando}
          form={form}
          setForm={setForm}
          obras={obras}
          erro={erro}
          onFechar={() => setFormAberto(false)}
          onSalvar={salvar}
        />
      </div>
    );
  }

  return (
    <div id="frentes-tab" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Frentes de Serviço"
        description="Onde a obra está trabalhando. Abra uma frente para ver tudo que passou por ela."
        actions={podeEditar ? (
          <button type="button" onClick={() => abrirForm()} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-800">
            <Plus className="h-4 w-4" /> Nova frente
          </button>
        ) : undefined}
      />

      {ordenadas.length === 0 ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white">
          <EmptyState icon={MapPin} title="Nenhuma frente cadastrada" description="Cadastre a frente com o mesmo nome que as equipes já usam, para o histórico se ligar sozinho." />
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ordenadas.map(frente => {
            const alvo = normalizeComparable(frente.nome);
            const equipes = gruposEquipe.filter(item => normalizeComparable(item.frenteServico || '') === alvo).length;
            return (
              <li key={frente.id}>
                <button
                  type="button"
                  onClick={() => setSelecionadaId(frente.id)}
                  className="group flex w-full flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <strong className="block truncate text-sm font-bold text-slate-900">{frente.nome}</strong>
                      <span className="block truncate text-xs text-slate-500">{frente.servico || frente.ramoLocal || 'Sem serviço informado'}</span>
                    </div>
                    <Badge tone={situacaoTone(frente.situacao)}>{frente.situacao}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{equipes} equipe(s)</span>
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{obras.find(item => item.id === frente.obraId)?.nome || 'Sem obra'}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <FormFrente
        aberto={formAberto}
        editando={editando}
        form={form}
        setForm={setForm}
        obras={obras}
        erro={erro}
        onFechar={() => setFormAberto(false)}
        onSalvar={salvar}
      />
    </div>
  );
}

interface FormFrenteProps {
  aberto: boolean;
  editando: FrenteServico | null;
  form: {
    nome: string; obraId: string; ramoLocal: string; servico: string; responsavel: string;
    dataInicio: string; dataTerminoPrevisto: string; situacao: SituacaoFrente; observacao: string;
  };
  setForm: (valor: FormFrenteProps['form']) => void;
  obras: ObraLocal[];
  erro: string;
  onFechar: () => void;
  onSalvar: () => void;
}

function FormFrente({ aberto, editando, form, setForm, obras, erro, onFechar, onSalvar }: FormFrenteProps) {
  return (
    <Modal
      open={aberto}
      title={editando ? `Editar ${editando.nome}` : 'Nova frente de serviço'}
      description={editando ? undefined : 'Use o mesmo nome que as equipes já usam para o histórico se ligar sozinho.'}
      size="md"
      onClose={onFechar}
      footer={(
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onFechar} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
          <button type="button" onClick={onSalvar} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">Salvar frente</button>
        </div>
      )}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-slate-600 sm:col-span-2">
          Nome da frente
          <input value={form.nome} onChange={event => setForm({ ...form, nome: event.target.value })} placeholder="Ex: Ramo 1400" className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
        </label>
        <label className="text-xs font-bold text-slate-600">
          Obra
          <select value={form.obraId} onChange={event => setForm({ ...form, obraId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500">
            <option value="">Sem obra vinculada</option>
            {obras.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-600">
          Situação
          <select value={form.situacao} onChange={event => setForm({ ...form, situacao: event.target.value as SituacaoFrente })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500">
            {SITUACOES.map(item => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-slate-600">
          Ramo / local
          <input value={form.ramoLocal} onChange={event => setForm({ ...form, ramoLocal: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
        </label>
        <label className="text-xs font-bold text-slate-600">
          Serviço
          <input value={form.servico} onChange={event => setForm({ ...form, servico: event.target.value })} placeholder="Ex: Terraplenagem" className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
        </label>
        <label className="text-xs font-bold text-slate-600">
          Responsável
          <input value={form.responsavel} onChange={event => setForm({ ...form, responsavel: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
        </label>
        <label className="text-xs font-bold text-slate-600">
          Início
          <input type="date" value={form.dataInicio} onChange={event => setForm({ ...form, dataInicio: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
        </label>
        <label className="text-xs font-bold text-slate-600 sm:col-span-2">
          Término previsto
          <input type="date" value={form.dataTerminoPrevisto} onChange={event => setForm({ ...form, dataTerminoPrevisto: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-emerald-500" />
        </label>
        <label className="text-xs font-bold text-slate-600 sm:col-span-2">
          Observações
          <textarea value={form.observacao} onChange={event => setForm({ ...form, observacao: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500" />
        </label>
      </div>
      {erro && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs font-bold text-rose-700">{erro}</p>}
    </Modal>
  );
}
