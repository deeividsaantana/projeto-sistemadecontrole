/**
 * Medições: boletim por período. As quantidades vêm sugeridas da produção
 * lançada, mas medir é ato registrado — quem mede confirma ou ajusta. Medir
 * acima do previsto em contrato gera aviso, nunca bloqueio: o sistema não tem
 * evidência para decidir regra contratual no lugar de quem responde por ela.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, FileSpreadsheet, Plus, RefreshCw, Search } from 'lucide-react';
import type { ItemMedicao, Medicao, ObraLocal, RegistroProducao, ServicoObra, SituacaoMedicao } from '../types';
import {
  excedentesDoContrato,
  itensSugeridos,
  proximoNumeroMedicao,
  totalMedicao,
  validarMedicao,
} from '../utils/medicoes';
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

interface MedicoesTabProps {
  medicoes: Medicao[];
  servicos: ServicoObra[];
  producao: RegistroProducao[];
  obras: ObraLocal[];
  responsavel: string;
  podeEditar: boolean;
  podeAprovar: boolean;
  onSave: (medicao: Medicao, isNew: boolean) => void;
}

const SITUACOES: SituacaoMedicao[] = ['Em elaboração', 'Enviada', 'Aprovada', 'Rejeitada'];

const formatarData = (valor: string) => valor.split('-').reverse().join('/');
const numero = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const tomDaSituacao = (situacao: SituacaoMedicao) => {
  if (situacao === 'Aprovada') return 'success' as const;
  if (situacao === 'Rejeitada') return 'danger' as const;
  if (situacao === 'Enviada') return 'info' as const;
  return 'neutral' as const;
};

export default function MedicoesTab({
  medicoes,
  servicos,
  producao,
  obras,
  responsavel,
  podeEditar,
  podeAprovar,
  onSave,
}: MedicoesTabProps) {
  const hoje = isoDay(new Date());
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState(false);
  const [editada, setEditada] = useState<Medicao | null>(null);
  const [form, setForm] = useState({
    periodoInicio: `${hoje.slice(0, 8)}01`,
    periodoFim: hoje,
    obraId: '',
    situacao: 'Em elaboração' as SituacaoMedicao,
    observacao: '',
  });
  const [itens, setItens] = useState<ItemMedicao[]>([]);

  const ativas = useMemo(() => medicoes.filter(item => item.ativo !== false), [medicoes]);
  const termo = normalizeComparable(busca).trim();
  const listadas = useMemo(() => [...ativas]
    .filter(item => !termo || normalizeComparable(`${item.numero} ${item.situacao} ${item.responsavel}`).includes(termo))
    .sort((a, b) => b.periodoFim.localeCompare(a.periodoFim) || b.numero.localeCompare(a.numero)), [ativas, termo]);

  const aprovadas = ativas.filter(item => item.situacao === 'Aprovada');
  const emAberto = ativas.filter(item => ['Em elaboração', 'Enviada'].includes(item.situacao)).length;

  const excedentes = useMemo(
    () => excedentesDoContrato({ id: editada?.id || 'nova', itens }, medicoes, servicos),
    [editada, itens, medicoes, servicos],
  );

  const abrir = (medicao?: Medicao) => {
    setEditada(medicao || null);
    setForm(medicao
      ? {
        periodoInicio: medicao.periodoInicio,
        periodoFim: medicao.periodoFim,
        obraId: medicao.obraId || '',
        situacao: medicao.situacao,
        observacao: medicao.observacao || '',
      }
      : { periodoInicio: `${hoje.slice(0, 8)}01`, periodoFim: hoje, obraId: '', situacao: 'Em elaboração', observacao: '' });
    setItens(medicao ? medicao.itens.map(item => ({ ...item })) : []);
    setErro('');
    setAberto(true);
  };

  const carregarProducao = () => {
    const sugeridos = itensSugeridos(servicos, producao, form.periodoInicio, form.periodoFim);
    // Preserva preço e observação já digitados; a produção só atualiza a quantidade.
    setItens(sugeridos.map(sugerido => {
      const atual = itens.find(item => item.servicoId === sugerido.servicoId);
      return atual ? { ...atual, quantidade: sugerido.quantidade } : sugerido;
    }));
  };

  const salvar = () => {
    const problema = validarMedicao({
      periodoInicio: form.periodoInicio,
      periodoFim: form.periodoFim,
      itens,
      situacao: form.situacao,
    });
    if (problema) {
      setErro(problema);
      return;
    }
    if (['Aprovada', 'Rejeitada'].includes(form.situacao) && !podeAprovar) {
      setErro('Seu perfil não pode aprovar ou rejeitar medição.');
      return;
    }
    const agora = new Date().toISOString();
    const decidida = ['Aprovada', 'Rejeitada'].includes(form.situacao);
    onSave({
      id: editada?.id || `med-${Date.now()}`,
      numero: editada?.numero || proximoNumeroMedicao(medicoes),
      obraId: form.obraId || undefined,
      periodoInicio: form.periodoInicio,
      periodoFim: form.periodoFim,
      itens: itens.filter(item => Number(item.quantidade) > 0),
      situacao: form.situacao,
      responsavel: editada?.responsavel || responsavel,
      aprovadoPor: decidida ? responsavel : editada?.aprovadoPor,
      aprovadoEm: decidida ? agora : editada?.aprovadoEm,
      observacao: form.observacao.trim() || undefined,
      ativo: editada?.ativo ?? true,
      criadoEm: editada?.criadoEm || agora,
      atualizadoEm: agora,
    }, !editada);
    setErro('');
    setAberto(false);
  };

  const total = totalMedicao(itens);

  return (
    <div id="medicoes-tab" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Medições"
        description="Boletim por período com quantidades sugeridas pela produção e confirmadas por quem mede."
        actions={podeEditar ? (
          <button type="button" onClick={() => abrir()} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-800">
            <Plus className="h-4 w-4" /> Nova medição
          </button>
        ) : undefined}
      />

      <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: 'Medições', valor: String(ativas.length) },
          { label: 'Em aberto', valor: String(emAberto) },
          { label: 'Aprovadas', valor: String(aprovadas.length) },
          { label: 'Total aprovado', valor: moeda(aprovadas.reduce((soma, item) => soma + totalMedicao(item.itens), 0)) },
        ].map(item => (
          <div key={item.label} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-500">{item.label}</p>
            <strong className="mt-1.5 block truncate text-xl font-black tabular-nums text-slate-900">{item.valor}</strong>
          </div>
        ))}
      </section>

      <label className="relative mt-4 block">
        <span className="sr-only">Buscar medição</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={busca}
          onChange={event => setBusca(event.target.value)}
          placeholder="Número, situação ou responsável"
          className="min-h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-emerald-500"
        />
      </label>

      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {listadas.length === 0 ? (
          <EmptyState icon={FileSpreadsheet} title="Nenhuma medição" description="Monte o boletim do período a partir da produção lançada." />
        ) : (
          <TableShell minWidth={940}>
            <TableHead>
              <tr>
                <th className="p-3">Número</th>
                <th className="p-3">Período</th>
                <th className="p-3">Itens</th>
                <th className="p-3">Total</th>
                <th className="p-3">Situação</th>
                <th className="p-3">Responsável</th>
                {podeEditar && <th className="p-3 text-right">Ações</th>}
              </tr>
            </TableHead>
            <TableBody>
              {listadas.map(item => (
                <tr key={item.id} className="transition-colors hover:bg-slate-50">
                  <td className="p-3 font-mono text-slate-600">{item.numero}</td>
                  <td className="p-3 text-slate-600">{formatarData(item.periodoInicio)} → {formatarData(item.periodoFim)}</td>
                  <td className="p-3 text-slate-600">{item.itens.length}</td>
                  <td className="p-3 font-mono text-slate-900">{totalMedicao(item.itens) > 0 ? moeda(totalMedicao(item.itens)) : '—'}</td>
                  <td className="p-3"><Badge tone={tomDaSituacao(item.situacao)}>{item.situacao}</Badge></td>
                  <td className="p-3 text-slate-600">{item.responsavel}</td>
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

      <Modal
        open={aberto}
        title={editada ? `Medição ${editada.numero}` : 'Nova medição'}
        size="lg"
        onClose={() => setAberto(false)}
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setAberto(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={salvar} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">Salvar medição</button>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">
            Início do período
            <input type="date" value={form.periodoInicio} onChange={event => setForm({ ...form, periodoInicio: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Fim do período
            <input type="date" value={form.periodoFim} onChange={event => setForm({ ...form, periodoFim: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
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
            <select value={form.situacao} onChange={event => setForm({ ...form, situacao: event.target.value as SituacaoMedicao })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              {SITUACOES.map(situacao => <option key={situacao} value={situacao}>{situacao}</option>)}
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={carregarProducao}
          className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700"
        >
          <RefreshCw className="h-4 w-4" /> Carregar produção do período
        </button>

        {excedentes.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="flex items-center gap-2 text-[11px] font-bold text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              Acima do previsto em contrato (aviso, não bloqueio)
            </p>
            <ul className="mt-1 space-y-0.5 text-[11px] text-amber-800">
              {excedentes.map(item => (
                <li key={item.servicoId}>
                  {item.servicoDescricao}: {numero(item.acumulado)} medidos de {numero(item.previsto)} previstos (+{numero(item.excedente)})
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
          {itens.length === 0 ? (
            <p className="p-4 text-xs text-slate-500">Nenhum item. Use “Carregar produção do período” para trazer o que foi executado.</p>
          ) : (
            <TableShell minWidth={720}>
              <TableHead>
                <tr>
                  <th className="p-3">Serviço</th>
                  <th className="p-3">Unidade</th>
                  <th className="p-3">Quantidade medida</th>
                  <th className="p-3">Valor unitário</th>
                  <th className="p-3">Total</th>
                </tr>
              </TableHead>
              <TableBody>
                {itens.map((item, indice) => (
                  <tr key={item.servicoId}>
                    <td className="p-3 font-bold text-slate-800">{item.servicoDescricao}</td>
                    <td className="p-3 text-slate-600">{item.unidade}</td>
                    <td className="p-3">
                      <input
                        type="number"
                        min={0}
                        step="0.001"
                        value={item.quantidade}
                        onChange={event => setItens(itens.map((atual, posicao) => posicao === indice ? { ...atual, quantidade: Number(event.target.value) } : atual))}
                        className="min-h-10 w-28 rounded-lg border border-slate-200 px-2 text-sm text-slate-800 outline-none focus:border-emerald-500"
                      />
                    </td>
                    <td className="p-3">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.valorUnitario ?? ''}
                        onChange={event => setItens(itens.map((atual, posicao) => posicao === indice
                          ? { ...atual, valorUnitario: event.target.value === '' ? undefined : Number(event.target.value) }
                          : atual))}
                        placeholder="opcional"
                        className="min-h-10 w-28 rounded-lg border border-slate-200 px-2 text-sm text-slate-800 outline-none focus:border-emerald-500"
                      />
                    </td>
                    <td className="p-3 font-mono text-slate-900">
                      {item.valorUnitario ? moeda(Number(item.quantidade) * item.valorUnitario) : '—'}
                    </td>
                  </tr>
                ))}
              </TableBody>
            </TableShell>
          )}
        </div>

        <p className="mt-2 text-right text-xs font-bold text-slate-700">Total do boletim: {total > 0 ? moeda(total) : '—'}</p>

        <label className="mt-3 block text-xs font-bold text-slate-600">
          Observação
          <textarea value={form.observacao} onChange={event => setForm({ ...form, observacao: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
        </label>
        {erro && <p className="mt-2 text-xs font-bold text-rose-700">{erro}</p>}
      </Modal>
    </div>
  );
}
