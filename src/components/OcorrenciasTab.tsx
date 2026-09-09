/**
 * Ocorrências: o que saiu do previsto no dia, quanto parou e o que foi feito.
 * O impacto é sugerido pelas horas paradas, mas quem registra decide — e
 * acidente ou ocorrência resolvida exige providência escrita.
 */
import { useMemo, useState } from 'react';
import { Activity, AlertOctagon, AlertTriangle, Clock3, Megaphone, Plus, Search } from 'lucide-react';
import type {
  Equipamento,
  FrenteServico,
  Funcionario,
  ImpactoOcorrencia,
  ObraLocal,
  Ocorrencia,
  SituacaoOcorrencia,
  TipoOcorrencia,
} from '../types';
import {
  impactoSugerido,
  painelOcorrencias,
  proximoNumeroOcorrencia,
  validarOcorrencia,
} from '../utils/ocorrencias';
import { normalizeComparable } from '../utils/canonicalIdentity';
import { usePaginacao } from '../shared/hooks/usePaginacao';
import { formatarData } from '../utils/formato';
import {
  StatCard,
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

interface OcorrenciasTabProps {
  ocorrencias: Ocorrencia[];
  obras: ObraLocal[];
  frentes: FrenteServico[];
  equipamentos: Equipamento[];
  funcionarios: Funcionario[];
  responsavel: string;
  podeEditar: boolean;
  onSave: (ocorrencia: Ocorrencia, isNew: boolean) => void;
}

const TIPOS: TipoOcorrencia[] = ['Acidente', 'Incidente', 'Quebra de equipamento', 'Parada de produção', 'Clima', 'Falta de material', 'Visita', 'Reclamação', 'Outro'];
const IMPACTOS: ImpactoOcorrencia[] = ['Sem impacto', 'Baixo', 'Médio', 'Alto'];
const SITUACOES: SituacaoOcorrencia[] = ['Registrada', 'Em análise', 'Resolvida', 'Sem tratativa'];

const somarDias = (base: string, dias: number) => {
  const data = new Date(`${base}T00:00:00`);
  data.setDate(data.getDate() + dias);
  return isoDay(data);
};

const tomDoImpacto = (impacto: ImpactoOcorrencia) => {
  if (impacto === 'Alto') return 'danger' as const;
  if (impacto === 'Médio') return 'warning' as const;
  if (impacto === 'Baixo') return 'info' as const;
  return 'neutral' as const;
};

export default function OcorrenciasTab({
  ocorrencias,
  obras,
  frentes,
  equipamentos,
  funcionarios,
  responsavel,
  podeEditar,
  onSave,
}: OcorrenciasTabProps) {
  const hoje = isoDay(new Date());
  const [inicio, setInicio] = useState(somarDias(hoje, -30));
  const [fim, setFim] = useState(hoje);
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState(false);
  const [editada, setEditada] = useState<Ocorrencia | null>(null);
  const [form, setForm] = useState({
    data: hoje,
    hora: '',
    tipo: 'Quebra de equipamento' as TipoOcorrencia,
    impacto: 'Médio' as ImpactoOcorrencia,
    situacao: 'Registrada' as SituacaoOcorrencia,
    descricao: '',
    local: '',
    obraId: '',
    frente: '',
    equipamentoId: '',
    funcionarioId: '',
    horasParadas: 0,
    providencia: '',
  });

  const ativas = useMemo(() => ocorrencias.filter(item => item.ativo !== false), [ocorrencias]);
  const painel = useMemo(() => painelOcorrencias(ativas, inicio, fim), [ativas, inicio, fim]);

  const termo = normalizeComparable(busca).trim();
  const listadas = useMemo(() => ativas
    .filter(item => item.data >= inicio && item.data <= fim)
    .filter(item => !termo || normalizeComparable(`${item.numero} ${item.descricao} ${item.tipo} ${item.local || ''} ${item.frente || ''}`).includes(termo))
    .sort((a, b) => b.data.localeCompare(a.data) || (b.hora || '').localeCompare(a.hora || '')), [ativas, inicio, fim, termo]);

  const paginacao = usePaginacao(listadas);

  const abrir = (ocorrencia?: Ocorrencia) => {
    setEditada(ocorrencia || null);
    setForm(ocorrencia
      ? {
        data: ocorrencia.data,
        hora: ocorrencia.hora || '',
        tipo: ocorrencia.tipo,
        impacto: ocorrencia.impacto,
        situacao: ocorrencia.situacao,
        descricao: ocorrencia.descricao,
        local: ocorrencia.local || '',
        obraId: ocorrencia.obraId || '',
        frente: ocorrencia.frente || '',
        equipamentoId: ocorrencia.equipamentoId || '',
        funcionarioId: ocorrencia.funcionarioId || '',
        horasParadas: ocorrencia.horasParadas || 0,
        providencia: ocorrencia.providencia || '',
      }
      : {
        data: hoje,
        hora: '',
        tipo: 'Quebra de equipamento',
        impacto: 'Médio',
        situacao: 'Registrada',
        descricao: '',
        local: '',
        obraId: '',
        frente: '',
        equipamentoId: '',
        funcionarioId: '',
        horasParadas: 0,
        providencia: '',
      });
    setErro('');
    setAberto(true);
  };

  const salvar = () => {
    const problema = validarOcorrencia({
      data: form.data,
      descricao: form.descricao,
      tipo: form.tipo,
      situacao: form.situacao,
      providencia: form.providencia,
      horasParadas: Number(form.horasParadas),
    });
    if (problema) {
      setErro(problema);
      return;
    }
    const agora = new Date().toISOString();
    onSave({
      id: editada?.id || `oc-${Date.now()}`,
      numero: editada?.numero || proximoNumeroOcorrencia(ocorrencias),
      data: form.data,
      hora: form.hora || undefined,
      tipo: form.tipo,
      impacto: form.impacto,
      situacao: form.situacao,
      descricao: form.descricao.trim(),
      local: form.local.trim() || undefined,
      obraId: form.obraId || undefined,
      frente: form.frente.trim() || undefined,
      equipamentoId: form.equipamentoId || undefined,
      funcionarioId: form.funcionarioId || undefined,
      horasParadas: Number(form.horasParadas) || undefined,
      providencia: form.providencia.trim() || undefined,
      registradoPor: editada?.registradoPor || responsavel,
      fotos: editada?.fotos,
      ativo: editada?.ativo ?? true,
      criadoEm: editada?.criadoEm || agora,
      atualizadoEm: agora,
    }, !editada);
    setErro('');
    setAberto(false);
  };

  const sugestao = impactoSugerido(form.tipo, Number(form.horasParadas) || 0);

  return (
    <div id="ocorrencias-tab" className="renea-page min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        eyebrow="O que aconteceu em campo"
        photo="rodovia-duplicada"
        title="Ocorrências"
        description="O que saiu do previsto no dia, quanto parou e a providência tomada."
        actions={podeEditar ? (
          <button type="button" onClick={() => abrir()} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-800">
            <Plus className="h-4 w-4" /> Nova ocorrência
          </button>
        ) : undefined}
      />

      {painel.acidentes > 0 && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="flex items-center gap-2 text-xs font-bold text-rose-900">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            {painel.acidentes} acidente(s) registrado(s) no período
          </p>
        </div>
      )}

      <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: 'Ocorrências', valor: painel.total, tone: 'info' as const, icone: Megaphone },
          { label: 'Em aberto', valor: painel.emAberto, tone: 'warning' as const, icone: AlertOctagon },
          { label: 'Horas paradas', valor: painel.horasParadas, tone: 'info' as const, icone: Clock3 },
          { label: 'Acidentes', valor: painel.acidentes, tone: 'danger' as const, icone: AlertTriangle },
        ].map(item => (
          <StatCard key={item.label} label={item.label} value={item.valor} tone={item.tone} icon={item.icone} />
        ))}
      </section>

      {painel.porTipo.length > 0 && (
        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Por tipo no período</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {painel.porTipo.map(item => (
              <li key={item.tipo} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] text-slate-600">
                <strong className="text-slate-800">{item.tipo}</strong>: {item.quantidade}
                {item.horasParadas > 0 && ` · ${item.horasParadas}h paradas`}
              </li>
            ))}
          </ul>
        </section>
      )}

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
            placeholder="Número, descrição, tipo, local ou frente"
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500"
          />
        </label>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {listadas.length === 0 ? (
          <EmptyState icon={Megaphone} title="Nenhuma ocorrência no período" description="Registre paradas, quebras, clima, visitas e acidentes." />
        ) : (
          <TableShell minWidth={1100}>
            <TableHead>
              <tr>
                <th className="p-3">Número</th>
                <th className="p-3">Data</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Descrição</th>
                <th className="p-3">Horas paradas</th>
                <th className="p-3">Impacto</th>
                <th className="p-3">Situação</th>
                {podeEditar && <th className="p-3 text-right">Ações</th>}
              </tr>
            </TableHead>
            <TableBody>
              {paginacao.visiveis.map(item => (
                <tr key={item.id} className="transition-colors hover:bg-slate-50">
                  <td className="p-3 font-mono text-slate-600">{item.numero}</td>
                  <td className="p-3 text-slate-600">{formatarData(item.data)}{item.hora ? ` ${item.hora}` : ''}</td>
                  <td className="p-3 text-slate-600">{item.tipo}</td>
                  <td className="max-w-80 truncate p-3 font-bold text-slate-800" title={item.descricao}>{item.descricao}</td>
                  <td className="p-3 font-mono text-slate-600">{item.horasParadas ? `${item.horasParadas}h` : '—'}</td>
                  <td className="p-3"><Badge tone={tomDoImpacto(item.impacto)}>{item.impacto}</Badge></td>
                  <td className="p-3">
                    <Badge tone={item.situacao === 'Resolvida' ? 'success' : item.situacao === 'Sem tratativa' ? 'danger' : 'neutral'}>{item.situacao}</Badge>
                  </td>
                  {podeEditar && (
                    <td className="p-3 text-right">
                      <button type="button" onClick={() => abrir(item)} className="min-h-9 rounded-lg border border-slate-200 px-2.5 text-[11px] font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700">Abrir</button>
                    </td>
                  )}
                </tr>
              ))}
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
        title={editada ? `Ocorrência ${editada.numero}` : 'Nova ocorrência'}
        onSubmit={salvar}
        size="md"
        onClose={() => setAberto(false)}
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setAberto(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={salvar} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">Salvar ocorrência</button>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">
            Data
            <input type="date" value={form.data} onChange={event => setForm({ ...form, data: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Hora
            <input type="time" value={form.hora} onChange={event => setForm({ ...form, hora: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Tipo
            <select value={form.tipo} onChange={event => setForm({ ...form, tipo: event.target.value as TipoOcorrencia })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              {TIPOS.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Horas paradas
            <input type="number" min={0} max={24} step="0.5" value={form.horasParadas} onChange={event => setForm({ ...form, horasParadas: Number(event.target.value) })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Descrição
            <textarea value={form.descricao} onChange={event => setForm({ ...form, descricao: event.target.value })} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Impacto
            <select value={form.impacto} onChange={event => setForm({ ...form, impacto: event.target.value as ImpactoOcorrencia })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              {IMPACTOS.map(impacto => <option key={impacto} value={impacto}>{impacto}</option>)}
            </select>
            <span className="mt-1 block text-[10px] font-normal text-slate-500">Sugerido pelas horas paradas: {sugestao}</span>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Situação
            <select value={form.situacao} onChange={event => setForm({ ...form, situacao: event.target.value as SituacaoOcorrencia })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              {SITUACOES.map(situacao => <option key={situacao} value={situacao}>{situacao}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Local
            <input value={form.local} onChange={event => setForm({ ...form, local: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Frente
            <input list="ocorrencia-frentes" value={form.frente} onChange={event => setForm({ ...form, frente: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
            <datalist id="ocorrencia-frentes">
              {frentes.map(frente => <option key={frente.id} value={frente.nome} />)}
            </datalist>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Equipamento
            <select value={form.equipamentoId} onChange={event => setForm({ ...form, equipamentoId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              <option value="">Sem equipamento</option>
              {equipamentos.map(item => <option key={item.id} value={item.id}>{item.prefixo}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Colaborador
            <select value={form.funcionarioId} onChange={event => setForm({ ...form, funcionarioId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              <option value="">Sem colaborador</option>
              {funcionarios.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
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
            Providência tomada
            <textarea value={form.providencia} onChange={event => setForm({ ...form, providencia: event.target.value })} rows={2} placeholder="Obrigatória em acidente e ao marcar como resolvida" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          {erro && <p className="sm:col-span-2 text-xs font-bold text-rose-700">{erro}</p>}
        </div>
      </Modal>
    </div>
  );
}
