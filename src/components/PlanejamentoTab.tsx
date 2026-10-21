/**
 * Previsto x Executado: uma tela só para o avanço físico. Em cima, o avanço de
 * cada frente no dia escolhido (lança a produção e define o previsto ali
 * mesmo); embaixo, todos os previstos do período para editar. O executado
 * nunca é digitado no previsto — vem da produção lançada.
 */
import { useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { AlertTriangle, CalendarRange, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import type { FrenteServico, GrupoEquipe, ObraLocal, PlanejamentoItem, RegistroProducao, ServicoObra, SituacaoPlano } from '../types';
import { aderenciaDosPlanos, planosNoPeriodo, validarPlano } from '../utils/planejamento';
import { normalizeComparable } from '../utils/canonicalIdentity';
import { formatarData, numero } from '../utils/formato';
import {
  Badge,
  EmptyState,
  Modal,
  PageHeader,
  TabelaPadrao,
  isoDay,
  type ColunaTabela,
} from '../shared/ui';
import { FrentesDoDia } from './planejamento/FrentesDoDia';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO } from './cadastros/estilos';

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
  /** Só vem para quem pode lançar produção. */
  onSaveProducao?: (registro: RegistroProducao, isNew: boolean) => void;
}

const SITUACOES: SituacaoPlano[] = ['Planejado', 'Em execução', 'Concluído', 'Cancelado'];

const somarDias = (base: string, dias: number) => {
  const data = new Date(`${base}T00:00:00`);
  data.setDate(data.getDate() + dias);
  return isoDay(data);
};

type LinhaPrevisto = ReturnType<typeof aderenciaDosPlanos>[number];

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
  onSaveProducao,
}: PlanejamentoTabProps) {
  const hoje = isoDay(new Date());
  const [dia, setDia] = useState(hoje);
  const escopo = useRef<HTMLDivElement>(null);
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
  const passado = dia < hoje;

  useGSAP(() => {
    if (!escopo.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(escopo.current.querySelectorAll('[data-previsto-reveal]'), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.035, ease: 'power3.out', clearProps: 'transform,opacity' });
  }, { scope: escopo, dependencies: [dia] });

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

  const colunasPrevisto: ColunaTabela<LinhaPrevisto>[] = [
    { chave: 'servico', titulo: 'Serviço', larguraMinima: 200, valorOrdenacao: item => item.plano.servicoDescricao, render: item => <strong className="text-slate-900">{item.plano.servicoDescricao}</strong>, dica: item => item.plano.servicoDescricao },
    {
      chave: 'periodo',
      titulo: 'Período',
      valorOrdenacao: item => item.plano.dataInicio,
      render: item => <span className="whitespace-nowrap tabular-nums">{formatarData(item.plano.dataInicio)} → {formatarData(item.plano.dataFim)}</span>,
    },
    {
      chave: 'frente',
      titulo: 'Frente / Equipe',
      larguraMinima: 160,
      valorOrdenacao: item => [item.plano.frente, item.plano.equipeNome].filter(Boolean).join(' · '),
      render: item => [item.plano.frente, item.plano.equipeNome].filter(Boolean).join(' · ') || '—',
    },
    { chave: 'previsto', titulo: 'Previsto', alinhamento: 'direita', valorOrdenacao: item => item.planejado, render: item => <span className="whitespace-nowrap">{numero(item.planejado)} {item.plano.unidade}</span> },
    { chave: 'executado', titulo: 'Executado', alinhamento: 'direita', valorOrdenacao: item => item.realizado, render: item => <strong className="text-slate-900">{numero(item.realizado)}</strong> },
    {
      chave: 'avanco',
      titulo: 'Avanço',
      alinhamento: 'direita',
      valorOrdenacao: item => item.aderencia,
      render: item => (
        <span className="flex min-w-28 items-center justify-end gap-2">
          <span className="h-1.5 flex-1 rounded-full bg-slate-100" aria-hidden="true">
            <span className={`block h-1.5 rounded-full ${item.atrasado ? 'bg-amber-500' : 'bg-emerald-600'}`} style={{ width: `${Math.min(100, item.aderencia)}%` }} />
          </span>
          <span className="font-bold text-slate-700">{item.aderencia}%</span>
        </span>
      ),
    },
    { chave: 'situacao', titulo: 'Situação', valorOrdenacao: item => item.plano.situacao, render: item => <Badge tone={tomDaSituacao(item.plano.situacao)}>{item.plano.situacao}</Badge> },
  ];

  return (
    <div ref={escopo} id="planejamento-tab" className="erp-module space-y-4">
      <div data-previsto-reveal>
        <PageHeader
          eyebrow="Obra"
          title="Previsto x Executado"
          description="Avanço de cada frente: quanto foi feito, quanto estava previsto e quanto falta."
          actions={(
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Escolher o dia">
              <button type="button" className={`${BOTAO_SECUNDARIO} px-3`} onClick={() => setDia(atual => somarDias(atual, -1))} aria-label="Dia anterior">
                <ChevronLeft className="size-5" aria-hidden="true" />
              </button>
              <label>
                <span className="sr-only">Dia</span>
                <input type="date" className={`${CAMPO} w-40`} value={dia} max={hoje} onChange={event => { if (event.target.value) setDia(event.target.value > hoje ? hoje : event.target.value); }} />
              </label>
              <button type="button" className={`${BOTAO_SECUNDARIO} px-3`} onClick={() => setDia(atual => (atual < hoje ? somarDias(atual, 1) : atual))} disabled={!passado} aria-label="Próximo dia">
                <ChevronRight className="size-5" aria-hidden="true" />
              </button>
              {passado && <button type="button" className={BOTAO_SECUNDARIO} onClick={() => setDia(hoje)}>Hoje</button>}
              {podeEditar && (
                <button type="button" onClick={() => abrir()} className={BOTAO_PRIMARIO}>
                  <Plus className="size-4" aria-hidden="true" /> Novo previsto
                </button>
              )}
            </div>
          )}
        />
      </div>

      <FrentesDoDia
        dia={dia}
        responsavel={responsavel.trim() || 'Sem nome'}
        frentes={frentes}
        servicos={servicos}
        registros={producao}
        planos={planos}
        onSaveProducao={onSaveProducao}
        onSavePlano={podeEditar ? onSave : undefined}
      />

      <section data-previsto-reveal aria-labelledby="previstos-titulo" className="space-y-3">
        <h2 id="previstos-titulo" className="px-1 text-base font-bold text-slate-900">Previstos do período</h2>

        {atrasados.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="flex items-center gap-2 text-xs font-bold text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              {atrasados.length} previsto(s) com prazo vencido e meta não atingida
            </p>
            <p className="mt-1 text-xs text-amber-800">
              {atrasados.slice(0, 5).map(item => `${item.plano.servicoDescricao} (faltam ${numero(item.saldo)} ${item.plano.unidade})`).join(' · ')}
            </p>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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

        <TabelaPadrao
          titulo="Previsto e executado de cada serviço"
          linhas={filtradas}
          colunas={colunasPrevisto}
          idDaLinha={item => item.plano.id}
          nomeDoItem={{ um: 'previsto', varios: 'previstos' }}
          classeLinha={item => (item.atrasado ? 'bg-amber-50/60' : undefined)}
          onAbrirLinha={podeEditar ? item => abrir(item.plano) : undefined}
          acoes={podeEditar ? item => (
            <button type="button" onClick={() => abrir(item.plano)} aria-label={`Editar previsto de ${item.plano.servicoDescricao}`} className="min-h-11 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] font-bold text-slate-700 transition-colors hover:border-emerald-500 hover:text-emerald-800 md:min-h-8">Editar</button>
          ) : undefined}
          vazio={<EmptyState icon={CalendarRange} title="Nenhum previsto no período" description="Use Novo previsto ou Definir previsto no cartão da frente." />}
        />
      </section>

      <Modal
        open={aberto}
        title={editado ? `Editar previsto de ${editado.servicoDescricao}` : 'Novo previsto'}
        onSubmit={salvar}
        size="md"
        onClose={() => setAberto(false)}
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setAberto(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={salvar} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">Salvar previsto</button>
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
            Quantidade prevista
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
          <p className="sm:col-span-2 text-xs text-slate-500">
            O executado não é digitado: soma a produção lançada do mesmo serviço no período, filtrada por frente e equipe quando informadas.
          </p>
          {erro && <p className="sm:col-span-2 text-xs font-bold text-rose-700">{erro}</p>}
        </div>
      </Modal>
    </div>
  );
}
