/**
 * Inspeções de campo: o que foi observado, prazo de correção e responsável. O
 * atraso não é um campo salvo — sai da comparação entre o prazo e o dia de hoje,
 * então nunca fica desatualizado.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, Plus, Search, ShieldAlert } from 'lucide-react';
import type {
  Equipamento,
  FrenteServico,
  GravidadeInspecao,
  Inspecao,
  ObraLocal,
  SituacaoInspecao,
  TipoInspecao,
} from '../types';
import { diasParaPrazo, estaAtrasada, painelInspecoes, proximoNumeroInspecao, validarInspecao } from '../utils/inspecoes';
import { normalizeComparable } from '../utils/canonicalIdentity';
import { usePaginacao } from '../shared/hooks/usePaginacao';
import {
  Badge,
  EmptyState,
  Modal,
  PageHeader,
  Pagination,
  TableBody,
  TableHead,
  TableShell,
  isoDay,
} from '../shared/ui';

interface InspecoesTabProps {
  inspecoes: Inspecao[];
  obras: ObraLocal[];
  frentes: FrenteServico[];
  equipamentos: Equipamento[];
  responsavel: string;
  podeEditar: boolean;
  onSave: (inspecao: Inspecao, isNew: boolean) => void;
}

const TIPOS: TipoInspecao[] = ['Segurança', 'Meio ambiente', 'Qualidade', 'Equipamento', 'Área de vivência'];
const GRAVIDADES: GravidadeInspecao[] = ['Baixa', 'Média', 'Alta'];
const SITUACOES: SituacaoInspecao[] = ['Aberta', 'Em correção', 'Corrigida', 'Cancelada'];

const formatarData = (valor: string) => valor.split('-').reverse().join('/');

const tomDaSituacao = (situacao: SituacaoInspecao) => {
  if (situacao === 'Corrigida') return 'success' as const;
  if (situacao === 'Em correção') return 'info' as const;
  if (situacao === 'Cancelada') return 'neutral' as const;
  return 'warning' as const;
};

export default function InspecoesTab({
  inspecoes,
  obras,
  frentes,
  equipamentos,
  responsavel,
  podeEditar,
  onSave,
}: InspecoesTabProps) {
  const hoje = isoDay(new Date());
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'abertas' | 'atrasadas' | 'todas'>('abertas');
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState(false);
  const [editada, setEditada] = useState<Inspecao | null>(null);
  const [form, setForm] = useState({
    data: hoje,
    tipo: 'Segurança' as TipoInspecao,
    gravidade: 'Média' as GravidadeInspecao,
    situacao: 'Aberta' as SituacaoInspecao,
    local: '',
    obraId: '',
    frente: '',
    equipamentoId: '',
    descricao: '',
    acaoCorretiva: '',
    prazo: '',
    responsavelAcao: '',
  });

  const ativas = useMemo(() => inspecoes.filter(item => item.ativo !== false), [inspecoes]);
  const painel = useMemo(() => painelInspecoes(ativas, hoje), [ativas, hoje]);

  const termo = normalizeComparable(busca).trim();
  const listadas = useMemo(() => [...ativas]
    .filter(item => filtro === 'todas'
      || (filtro === 'atrasadas' ? estaAtrasada(item, hoje) : ['Aberta', 'Em correção'].includes(item.situacao)))
    .filter(item => !termo || normalizeComparable(`${item.numero} ${item.local} ${item.descricao} ${item.tipo} ${item.frente || ''} ${item.responsavelAcao || ''}`).includes(termo))
    .sort((a, b) => b.data.localeCompare(a.data) || b.numero.localeCompare(a.numero)), [ativas, filtro, termo, hoje]);

  const paginacao = usePaginacao(listadas);

  const abrir = (inspecao?: Inspecao) => {
    setEditada(inspecao || null);
    setForm(inspecao
      ? {
        data: inspecao.data,
        tipo: inspecao.tipo,
        gravidade: inspecao.gravidade,
        situacao: inspecao.situacao,
        local: inspecao.local,
        obraId: inspecao.obraId || '',
        frente: inspecao.frente || '',
        equipamentoId: inspecao.equipamentoId || '',
        descricao: inspecao.descricao,
        acaoCorretiva: inspecao.acaoCorretiva || '',
        prazo: inspecao.prazo || '',
        responsavelAcao: inspecao.responsavelAcao || '',
      }
      : {
        data: hoje,
        tipo: 'Segurança',
        gravidade: 'Média',
        situacao: 'Aberta',
        local: '',
        obraId: '',
        frente: '',
        equipamentoId: '',
        descricao: '',
        acaoCorretiva: '',
        prazo: '',
        responsavelAcao: '',
      });
    setErro('');
    setAberto(true);
  };

  const salvar = () => {
    const problema = validarInspecao({
      data: form.data,
      local: form.local,
      descricao: form.descricao,
      situacao: form.situacao,
      acaoCorretiva: form.acaoCorretiva,
      prazo: form.prazo || undefined,
    });
    if (problema) {
      setErro(problema);
      return;
    }
    const agora = new Date().toISOString();
    onSave({
      id: editada?.id || `insp-${Date.now()}`,
      numero: editada?.numero || proximoNumeroInspecao(inspecoes),
      data: form.data,
      tipo: form.tipo,
      gravidade: form.gravidade,
      situacao: form.situacao,
      local: form.local.trim(),
      obraId: form.obraId || undefined,
      frente: form.frente.trim() || undefined,
      equipamentoId: form.equipamentoId || undefined,
      descricao: form.descricao.trim(),
      acaoCorretiva: form.acaoCorretiva.trim() || undefined,
      prazo: form.prazo || undefined,
      responsavelAcao: form.responsavelAcao.trim() || undefined,
      inspetor: editada?.inspetor || responsavel,
      dataCorrecao: form.situacao === 'Corrigida' ? (editada?.dataCorrecao || hoje) : undefined,
      fotos: editada?.fotos,
      ativo: editada?.ativo ?? true,
      criadoEm: editada?.criadoEm || agora,
      atualizadoEm: agora,
    }, !editada);
    setErro('');
    setAberto(false);
  };

  return (
    <div id="inspecoes-tab" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Inspeções"
        description="Segurança, meio ambiente e qualidade de campo, com prazo e responsável pela correção."
        actions={podeEditar ? (
          <button type="button" onClick={() => abrir()} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-800">
            <Plus className="h-4 w-4" /> Nova inspeção
          </button>
        ) : undefined}
      />

      {painel.atrasadas > 0 && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="flex items-center gap-2 text-xs font-bold text-rose-900">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            {painel.atrasadas} inspeção(ões) com prazo de correção vencido
          </p>
        </div>
      )}

      <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: 'Abertas', valor: String(painel.abertas) },
          { label: 'Atrasadas', valor: String(painel.atrasadas) },
          { label: 'Gravidade alta', valor: String(painel.porGravidade.Alta) },
          { label: 'Corrigidas', valor: String(painel.corrigidas) },
        ].map(item => (
          <div key={item.label} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-500">{item.label}</p>
            <strong className="mt-1.5 block text-2xl font-black tabular-nums text-slate-900">{item.valor}</strong>
          </div>
        ))}
      </section>

      <div className="mt-4 flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {([['abertas', 'Abertas'], ['atrasadas', 'Atrasadas'], ['todas', 'Todas']] as const).map(([id, rotulo]) => (
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

      <label className="relative mt-3 block">
        <span className="sr-only">Buscar inspeção</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={busca}
          onChange={event => setBusca(event.target.value)}
          placeholder="Número, local, descrição, frente ou responsável"
          className="min-h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-emerald-500"
        />
      </label>

      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {listadas.length === 0 ? (
          <EmptyState icon={ShieldAlert} title="Nenhuma inspeção" description="Registre o que foi observado em campo e o prazo de correção." />
        ) : (
          <TableShell minWidth={1100}>
            <TableHead>
              <tr>
                <th className="p-3">Número</th>
                <th className="p-3">Data</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Local</th>
                <th className="p-3">Observação</th>
                <th className="p-3">Prazo</th>
                <th className="p-3">Gravidade</th>
                <th className="p-3">Situação</th>
                {podeEditar && <th className="p-3 text-right">Ações</th>}
              </tr>
            </TableHead>
            <TableBody>
              {paginacao.visiveis.map(item => {
                const atrasada = estaAtrasada(item, hoje);
                const dias = diasParaPrazo(item, hoje);
                return (
                  <tr key={item.id} className={`transition-colors hover:bg-slate-50 ${atrasada ? 'bg-rose-50/50' : ''}`}>
                    <td className="p-3 font-mono text-slate-600">{item.numero}</td>
                    <td className="p-3 text-slate-600">{formatarData(item.data)}</td>
                    <td className="p-3 text-slate-600">{item.tipo}</td>
                    <td className="p-3 font-bold text-slate-800">{item.local}</td>
                    <td className="max-w-72 truncate p-3 text-slate-600" title={item.descricao}>{item.descricao}</td>
                    <td className={`p-3 ${atrasada ? 'font-bold text-rose-700' : 'text-slate-600'}`}>
                      {item.prazo ? `${formatarData(item.prazo)}${dias !== undefined && ['Aberta', 'Em correção'].includes(item.situacao) ? ` (${dias}d)` : ''}` : '—'}
                    </td>
                    <td className="p-3">
                      <Badge tone={item.gravidade === 'Alta' ? 'danger' : item.gravidade === 'Média' ? 'warning' : 'neutral'}>{item.gravidade}</Badge>
                    </td>
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
        title={editada ? `Inspeção ${editada.numero}` : 'Nova inspeção'}
        onSubmit={salvar}
        size="md"
        onClose={() => setAberto(false)}
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setAberto(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={salvar} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">Salvar inspeção</button>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">
            Data
            <input type="date" value={form.data} onChange={event => setForm({ ...form, data: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Tipo
            <select value={form.tipo} onChange={event => setForm({ ...form, tipo: event.target.value as TipoInspecao })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              {TIPOS.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Local
            <input value={form.local} onChange={event => setForm({ ...form, local: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            O que foi observado
            <textarea value={form.descricao} onChange={event => setForm({ ...form, descricao: event.target.value })} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Gravidade
            <select value={form.gravidade} onChange={event => setForm({ ...form, gravidade: event.target.value as GravidadeInspecao })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              {GRAVIDADES.map(gravidade => <option key={gravidade} value={gravidade}>{gravidade}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Situação
            <select value={form.situacao} onChange={event => setForm({ ...form, situacao: event.target.value as SituacaoInspecao })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              {SITUACOES.map(situacao => <option key={situacao} value={situacao}>{situacao}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Prazo de correção
            <input type="date" value={form.prazo} onChange={event => setForm({ ...form, prazo: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Responsável pela correção
            <input value={form.responsavelAcao} onChange={event => setForm({ ...form, responsavelAcao: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Frente
            <input list="inspecao-frentes" value={form.frente} onChange={event => setForm({ ...form, frente: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
            <datalist id="inspecao-frentes">
              {frentes.map(frente => <option key={frente.id} value={frente.nome} />)}
            </datalist>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Equipamento
            <select value={form.equipamentoId} onChange={event => setForm({ ...form, equipamentoId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              <option value="">Sem equipamento</option>
              {equipamentos.map(equipamento => <option key={equipamento.id} value={equipamento.id}>{equipamento.prefixo}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Obra
            <select value={form.obraId} onChange={event => setForm({ ...form, obraId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              <option value="">Sem obra</option>
              {obras.map(obra => <option key={obra.id} value={obra.id}>{obra.nome}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Ação corretiva
            <textarea value={form.acaoCorretiva} onChange={event => setForm({ ...form, acaoCorretiva: event.target.value })} rows={2} placeholder="Obrigatória para marcar como corrigida" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          {erro && <p className="sm:col-span-2 text-xs font-bold text-rose-700">{erro}</p>}
        </div>
      </Modal>
    </div>
  );
}
