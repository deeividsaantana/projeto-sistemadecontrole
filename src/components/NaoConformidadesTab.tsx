/**
 * Não conformidades com causa raiz, ação e verificação de eficácia. As origens
 * pendentes (FVS reprovada, inspeção grave em aberto) são derivadas na hora:
 * a pendência some sozinha quando a NC é criada, sem fila para sincronizar.
 */
import { useMemo, useState } from 'react';
import { Activity, AlertOctagon, AlertTriangle, CheckCircle2, Plus, Search } from 'lucide-react';
import type {
  FichaVerificacaoServico,
  FrenteServico,
  Inspecao,
  NaoConformidade,
  ObraLocal,
  OrigemNaoConformidade,
  SituacaoNaoConformidade,
} from '../types';
import {
  estaAtrasada,
  origensSemTratativa,
  painelNaoConformidades,
  proximoNumeroNc,
  validarNaoConformidade,
} from '../utils/naoConformidades';
import { normalizeComparable } from '../utils/canonicalIdentity';
import { usePaginacao } from '../shared/hooks/usePaginacao';
import { formatarData } from '../utils/formato';
import {
  Badge,
  EmptyState,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  StatCard,
  TableBody,
  TableHead,
  TableShell,
  isoDay,
} from '../shared/ui';

interface NaoConformidadesTabProps {
  registros: NaoConformidade[];
  fichasFvs: FichaVerificacaoServico[];
  inspecoes: Inspecao[];
  obras: ObraLocal[];
  frentes: FrenteServico[];
  responsavel: string;
  podeEditar: boolean;
  onSave: (registro: NaoConformidade, isNew: boolean) => void;
}

const ORIGENS: OrigemNaoConformidade[] = ['FVS', 'Inspeção', 'Checklist', 'Cliente', 'Interna'];
const SITUACOES: SituacaoNaoConformidade[] = ['Aberta', 'Em tratamento', 'Verificação', 'Encerrada', 'Cancelada'];


const tomDaSituacao = (situacao: SituacaoNaoConformidade) => {
  if (situacao === 'Encerrada') return 'success' as const;
  if (situacao === 'Cancelada') return 'neutral' as const;
  if (situacao === 'Aberta') return 'danger' as const;
  return 'warning' as const;
};

export default function NaoConformidadesTab({
  registros,
  fichasFvs,
  inspecoes,
  obras,
  frentes,
  responsavel,
  podeEditar,
  onSave,
}: NaoConformidadesTabProps) {
  const hoje = isoDay(new Date());
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'abertas' | 'todas'>('abertas');
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState(false);
  const [editada, setEditada] = useState<NaoConformidade | null>(null);
  const [form, setForm] = useState({
    data: hoje,
    origem: 'Interna' as OrigemNaoConformidade,
    origemId: '',
    origemNumero: '',
    descricao: '',
    local: '',
    obraId: '',
    frente: '',
    causaRaiz: '',
    acaoCorretiva: '',
    responsavelAcao: '',
    prazo: '',
    situacao: 'Aberta' as SituacaoNaoConformidade,
    eficaz: '' as '' | 'sim' | 'nao',
  });

  const ativas = useMemo(() => registros.filter(item => item.ativo !== false), [registros]);
  const painel = useMemo(() => painelNaoConformidades(ativas, hoje), [ativas, hoje]);
  const pendentes = useMemo(() => origensSemTratativa(fichasFvs, inspecoes, registros), [fichasFvs, inspecoes, registros]);

  const termo = normalizeComparable(busca).trim();
  const listadas = useMemo(() => [...ativas]
    .filter(item => filtro === 'todas' || ['Aberta', 'Em tratamento', 'Verificação'].includes(item.situacao))
    .filter(item => !termo || normalizeComparable(`${item.numero} ${item.descricao} ${item.origem} ${item.local || ''} ${item.responsavelAcao || ''}`).includes(termo))
    .sort((a, b) => b.data.localeCompare(a.data) || b.numero.localeCompare(a.numero)), [ativas, filtro, termo]);

  const paginacao = usePaginacao(listadas);

  const abrir = (registro?: NaoConformidade, origem?: ReturnType<typeof origensSemTratativa>[number]) => {
    setEditada(registro || null);
    setForm(registro
      ? {
        data: registro.data,
        origem: registro.origem,
        origemId: registro.origemId || '',
        origemNumero: registro.origemNumero || '',
        descricao: registro.descricao,
        local: registro.local || '',
        obraId: registro.obraId || '',
        frente: registro.frente || '',
        causaRaiz: registro.causaRaiz || '',
        acaoCorretiva: registro.acaoCorretiva || '',
        responsavelAcao: registro.responsavelAcao || '',
        prazo: registro.prazo || '',
        situacao: registro.situacao,
        eficaz: registro.eficaz === undefined ? '' : registro.eficaz ? 'sim' : 'nao',
      }
      : {
        data: origem?.data || hoje,
        origem: origem?.origem || 'Interna',
        origemId: origem?.id || '',
        origemNumero: origem?.numero || '',
        descricao: origem?.descricao || '',
        local: '',
        obraId: origem?.obraId || '',
        frente: origem?.frente || '',
        causaRaiz: '',
        acaoCorretiva: '',
        responsavelAcao: '',
        prazo: '',
        situacao: 'Aberta',
        eficaz: '',
      });
    setErro('');
    setAberto(true);
  };

  const salvar = () => {
    const eficaz = form.eficaz === '' ? undefined : form.eficaz === 'sim';
    const problema = validarNaoConformidade({
      data: form.data,
      descricao: form.descricao,
      situacao: form.situacao,
      causaRaiz: form.causaRaiz,
      acaoCorretiva: form.acaoCorretiva,
      prazo: form.prazo || undefined,
      eficaz,
    });
    if (problema) {
      setErro(problema);
      return;
    }
    const agora = new Date().toISOString();
    onSave({
      id: editada?.id || `nc-${Date.now()}`,
      numero: editada?.numero || proximoNumeroNc(registros),
      data: form.data,
      origem: form.origem,
      origemId: form.origemId || undefined,
      origemNumero: form.origemNumero || undefined,
      descricao: form.descricao.trim(),
      local: form.local.trim() || undefined,
      obraId: form.obraId || undefined,
      frente: form.frente.trim() || undefined,
      causaRaiz: form.causaRaiz.trim() || undefined,
      acaoCorretiva: form.acaoCorretiva.trim() || undefined,
      responsavelAcao: form.responsavelAcao.trim() || undefined,
      prazo: form.prazo || undefined,
      situacao: form.situacao,
      eficaz,
      dataEncerramento: form.situacao === 'Encerrada' ? (editada?.dataEncerramento || hoje) : undefined,
      registradoPor: editada?.registradoPor || responsavel,
      ativo: editada?.ativo ?? true,
      criadoEm: editada?.criadoEm || agora,
      atualizadoEm: agora,
    }, !editada);
    setErro('');
    setAberto(false);
  };

  return (
    <div id="nao-conformidades-tab" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Não Conformidades"
        description="Causa raiz, ação corretiva e verificação de eficácia, ligadas à FVS e à inspeção de origem."
        actions={podeEditar ? (
          <button type="button" onClick={() => abrir()} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-800">
            <Plus className="h-4 w-4" /> Nova NC
          </button>
        ) : undefined}
      />

      {pendentes.length > 0 && (
        <section className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <h2 className="text-xs font-bold text-amber-900">
            {pendentes.length} origem(ns) sem tratativa: FVS reprovada ou inspeção grave em aberto
          </h2>
          <ul className="mt-2 space-y-1.5">
            {pendentes.slice(0, 5).map(item => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-amber-900">
                <span className="min-w-0 truncate"><strong>{item.numero}</strong> · {item.descricao}</span>
                {podeEditar && (
                  <button type="button" onClick={() => abrir(undefined, item)} className="min-h-9 shrink-0 rounded-lg border border-amber-300 bg-white px-2.5 text-[11px] font-bold text-amber-800 transition-colors hover:border-amber-500">
                    Abrir NC
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: 'Em aberto', valor: painel.abertas, tone: 'warning' as const, icone: AlertOctagon },
          { label: 'Atrasadas', valor: painel.atrasadas, tone: 'danger' as const, icone: AlertTriangle },
          { label: 'Encerradas', valor: painel.encerradas, tone: 'success' as const, icone: CheckCircle2 },
          { label: 'Ação ineficaz', valor: painel.ineficazes, tone: 'danger' as const, icone: AlertOctagon },
        ].map(item => (
          <StatCard key={item.label} label={item.label} value={item.valor} tone={item.tone} icon={item.icone} />
        ))}
      </section>

      <div className="mt-4 flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {([['abertas', 'Em aberto'], ['todas', 'Todas']] as const).map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFiltro(id)}
            aria-pressed={filtro === id}
            className={`min-h-10 flex-1 rounded-md text-xs font-bold transition-colors ${filtro === id ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <SearchInput
        className="mt-3"
        label="Buscar não conformidade"
        value={busca}
        onChange={setBusca}
        placeholder="Número, descrição, origem, local ou responsável"
      />

      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {listadas.length === 0 ? (
          <EmptyState icon={AlertOctagon} title="Nenhuma não conformidade" description="Registre o desvio, a causa raiz e a ação corretiva." />
        ) : (
          <TableShell minWidth={1080}>
            <TableHead>
              <tr>
                <th className="p-3">Número</th>
                <th className="p-3">Data</th>
                <th className="p-3">Origem</th>
                <th className="p-3">Descrição</th>
                <th className="p-3">Responsável</th>
                <th className="p-3">Prazo</th>
                <th className="p-3">Situação</th>
                {podeEditar && <th className="p-3 text-right">Ações</th>}
              </tr>
            </TableHead>
            <TableBody>
              {paginacao.visiveis.map(item => {
                const atrasada = estaAtrasada(item, hoje);
                return (
                  <tr key={item.id} className={`transition-colors hover:bg-slate-50 ${atrasada ? 'bg-rose-50/50' : ''}`}>
                    <td className="p-3 font-mono text-slate-600">{item.numero}</td>
                    <td className="p-3 text-slate-600">{formatarData(item.data)}</td>
                    <td className="p-3 text-slate-600">{item.origemNumero ? `${item.origem} ${item.origemNumero}` : item.origem}</td>
                    <td className="max-w-80 truncate p-3 font-bold text-slate-800" title={item.descricao}>{item.descricao}</td>
                    <td className="p-3 text-slate-600">{item.responsavelAcao || '—'}</td>
                    <td className={`p-3 ${atrasada ? 'font-bold text-rose-700' : 'text-slate-600'}`}>{item.prazo ? formatarData(item.prazo) : '—'}</td>
                    <td className="p-3"><Badge tone={tomDaSituacao(item.situacao)}>{item.situacao}</Badge></td>
                    {podeEditar && (
                      <td className="p-3 text-right">
                        <button type="button" onClick={() => abrir(item)} className="min-h-9 rounded-lg border border-slate-200 px-2.5 text-[11px] font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700">Abrir</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </TableBody>
          </TableShell>
        )}
      </div>

      {paginacao.totalPaginas > 1 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-slate-500">
            {paginacao.visiveis.length} de {paginacao.total} registro(s)
          </span>
          <Pagination page={paginacao.pagina} totalPages={paginacao.totalPaginas} onChange={paginacao.setPagina} />
        </div>
      )}

      <Modal
        open={aberto}
        title={editada ? `NC ${editada.numero}` : 'Nova não conformidade'}
        onSubmit={salvar}
        size="md"
        onClose={() => setAberto(false)}
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setAberto(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={salvar} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">Salvar NC</button>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">
            Data
            <input type="date" value={form.data} onChange={event => setForm({ ...form, data: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Origem
            <select value={form.origem} onChange={event => setForm({ ...form, origem: event.target.value as OrigemNaoConformidade })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              {ORIGENS.map(origem => <option key={origem} value={origem}>{origem}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Descrição
            <textarea value={form.descricao} onChange={event => setForm({ ...form, descricao: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Local
            <input value={form.local} onChange={event => setForm({ ...form, local: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Frente
            <input list="nc-frentes" value={form.frente} onChange={event => setForm({ ...form, frente: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
            <datalist id="nc-frentes">
              {frentes.map(frente => <option key={frente.id} value={frente.nome} />)}
            </datalist>
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Causa raiz
            <textarea value={form.causaRaiz} onChange={event => setForm({ ...form, causaRaiz: event.target.value })} rows={2} placeholder="Obrigatória para encerrar" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Ação corretiva
            <textarea value={form.acaoCorretiva} onChange={event => setForm({ ...form, acaoCorretiva: event.target.value })} rows={2} placeholder="Obrigatória para encerrar" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Responsável pela ação
            <input value={form.responsavelAcao} onChange={event => setForm({ ...form, responsavelAcao: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Prazo
            <input type="date" value={form.prazo} onChange={event => setForm({ ...form, prazo: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Situação
            <select value={form.situacao} onChange={event => setForm({ ...form, situacao: event.target.value as SituacaoNaoConformidade })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              {SITUACOES.map(situacao => <option key={situacao} value={situacao}>{situacao}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Ação foi eficaz?
            <select value={form.eficaz} onChange={event => setForm({ ...form, eficaz: event.target.value as '' | 'sim' | 'nao' })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              <option value="">Ainda não verificada</option>
              <option value="sim">Sim</option>
              <option value="nao">Não</option>
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Obra
            <select value={form.obraId} onChange={event => setForm({ ...form, obraId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              <option value="">Sem obra</option>
              {obras.map(obra => <option key={obra.id} value={obra.id}>{obra.nome}</option>)}
            </select>
          </label>
          {form.origemNumero && (
            <p className="sm:col-span-2 text-[11px] text-slate-500">Origem vinculada: {form.origem} {form.origemNumero}</p>
          )}
          {erro && <p className="sm:col-span-2 text-xs font-bold text-rose-700">{erro}</p>}
        </div>
      </Modal>
    </div>
  );
}
