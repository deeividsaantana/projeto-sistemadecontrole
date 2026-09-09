/**
 * Custos do período. Combustível e manutenção não são digitados aqui: o
 * consolidado lê o custo total do abastecimento e o custo final da ordem de
 * serviço. O lançamento manual existe só para o que não nasce em outro módulo
 * (locação, terceiros, mão de obra), e custo estimado de OS aberta aparece como
 * previsto — nunca somado ao realizado.
 */
import { useMemo, useState } from 'react';
import { BarChart3, Coins, Plus, Search, Truck } from 'lucide-react';
import type {
  Abastecimento,
  CategoriaCusto,
  Empresa,
  Equipamento,
  FrenteServico,
  LancamentoCusto,
  ObraLocal,
  OrdemServico,
} from '../types';
import {
  consolidarCustos,
  custoPrevistoManutencao,
  custosDeOutrosModulos,
  custosPor,
  totalCustos,
  validarLancamentoCusto,
} from '../utils/custos';
import { normalizeComparable } from '../utils/canonicalIdentity';
import { usePaginacao } from '../shared/hooks/usePaginacao';
import { formatarData, moeda } from '../utils/formato';
import {
  Badge,
  EmptyState,
  Modal,
  PageHeader,
  Pagination,
  PeriodFilter,
  SearchInput,
  StatCard,
  TableBody,
  TableHead,
  TableShell,
  buildPeriod,
  isoDay,
  type PeriodValue,
} from '../shared/ui';

interface CustosTabProps {
  lancamentos: LancamentoCusto[];
  abastecimentos: Abastecimento[];
  ordensServico: OrdemServico[];
  obras: ObraLocal[];
  frentes: FrenteServico[];
  equipamentos: Equipamento[];
  empresas: Empresa[];
  responsavel: string;
  podeEditar: boolean;
  onSave: (lancamento: LancamentoCusto, isNew: boolean) => void;
}

const CATEGORIAS_MANUAIS: CategoriaCusto[] = ['Locação', 'Serviço de terceiro', 'Mão de obra', 'Material', 'Outro'];


export default function CustosTab({
  lancamentos,
  abastecimentos,
  ordensServico,
  obras,
  frentes,
  equipamentos,
  empresas,
  responsavel,
  podeEditar,
  onSave,
}: CustosTabProps) {
  const hoje = isoDay(new Date());
  const [period, setPeriod] = useState<PeriodValue>(() => buildPeriod('mes'));
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState(false);
  const [editado, setEditado] = useState<LancamentoCusto | null>(null);
  const [form, setForm] = useState({
    data: hoje,
    categoria: 'Locação' as CategoriaCusto,
    descricao: '',
    valor: 0,
    obraId: '',
    frente: '',
    equipamentoId: '',
    fornecedorId: '',
    documento: '',
    observacao: '',
  });

  const custos = useMemo(() => consolidarCustos(
    custosDeOutrosModulos(abastecimentos, ordensServico, period.from, period.to),
    lancamentos,
    period.from,
    period.to,
  ), [abastecimentos, ordensServico, lancamentos, period.from, period.to]);

  const previsto = useMemo(() => custoPrevistoManutencao(ordensServico), [ordensServico]);
  const porCategoria = useMemo(() => custosPor(custos, item => item.categoria), [custos]);
  const porEquipamento = useMemo(
    () => custosPor(custos, item => equipamentos.find(equipamento => equipamento.id === item.equipamentoId)?.prefixo).slice(0, 6),
    [custos, equipamentos],
  );

  const termo = normalizeComparable(busca).trim();
  const listados = custos.filter(item => !termo
    || normalizeComparable(`${item.descricao} ${item.categoria} ${item.origem}`).includes(termo));

  const paginacao = usePaginacao(listados);

  const abrir = (lancamento?: LancamentoCusto) => {
    setEditado(lancamento || null);
    setForm(lancamento
      ? {
        data: lancamento.data,
        categoria: lancamento.categoria,
        descricao: lancamento.descricao,
        valor: lancamento.valor,
        obraId: lancamento.obraId || '',
        frente: lancamento.frente || '',
        equipamentoId: lancamento.equipamentoId || '',
        fornecedorId: lancamento.fornecedorId || '',
        documento: lancamento.documento || '',
        observacao: lancamento.observacao || '',
      }
      : { data: hoje, categoria: 'Locação', descricao: '', valor: 0, obraId: '', frente: '', equipamentoId: '', fornecedorId: '', documento: '', observacao: '' });
    setErro('');
    setAberto(true);
  };

  const salvar = () => {
    const problema = validarLancamentoCusto({
      data: form.data,
      descricao: form.descricao,
      valor: Number(form.valor),
      categoria: form.categoria,
    });
    if (problema) {
      setErro(problema);
      return;
    }
    const agora = new Date().toISOString();
    onSave({
      id: editado?.id || `custo-${Date.now()}`,
      data: form.data,
      categoria: form.categoria,
      descricao: form.descricao.trim(),
      valor: Number(form.valor),
      obraId: form.obraId || undefined,
      frente: form.frente.trim() || undefined,
      equipamentoId: form.equipamentoId || undefined,
      fornecedorId: form.fornecedorId || undefined,
      documento: form.documento.trim() || undefined,
      responsavel: editado?.responsavel || responsavel,
      observacao: form.observacao.trim() || undefined,
      ativo: editado?.ativo ?? true,
      criadoEm: editado?.criadoEm || agora,
      atualizadoEm: agora,
    }, !editado);
    setErro('');
    setAberto(false);
  };

  return (
    <div id="custos-tab" className="renea-page min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        eyebrow="Custo da operação"
        photo="ponte-construcao"
        title="Custos"
        description="Consolidado do período: combustível e manutenção vêm dos registros; locação e terceiros são lançados aqui."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <PeriodFilter value={period} onChange={setPeriod} />
            {podeEditar && (
              <button type="button" onClick={() => abrir()} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-800">
                <Plus className="h-4 w-4" /> Novo lançamento
              </button>
            )}
          </div>
        )}
      />

      <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: 'Custo do período', valor: moeda(totalCustos(custos)), tone: 'info' as const, icone: Coins },
          { label: 'Lançamentos', valor: custos.length, tone: 'neutral' as const, icone: BarChart3 },
          { label: 'Manutenção prevista', valor: moeda(previsto), tone: 'warning' as const, icone: Truck },
        ].map(item => (
          <StatCard key={item.label} label={item.label} value={item.valor} tone={item.tone} icon={item.icone} />
        ))}
      </section>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Por categoria</h2>
          {porCategoria.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">Sem custos no período.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {porCategoria.map(item => (
                <li key={item.grupo} className="min-w-0">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate font-bold text-slate-700">{item.grupo}</span>
                    <span className="shrink-0 font-mono text-slate-900">{moeda(item.valor)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                    <div className="h-1.5 rounded-full bg-emerald-600" style={{ width: `${Math.min(100, (item.valor / (porCategoria[0]?.valor || 1)) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Por equipamento</h2>
          {porEquipamento.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">Sem custos vinculados a equipamento.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-xs">
              {porEquipamento.map(item => (
                <li key={item.grupo} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-slate-700">{item.grupo}</span>
                  <span className="shrink-0 font-mono text-slate-900">{moeda(item.valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <SearchInput
        className="mt-3"
        label="Buscar custo"
        value={busca}
        onChange={setBusca}
        placeholder="Descrição, categoria ou origem"
      />

      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {listados.length === 0 ? (
          <EmptyState icon={Coins} title="Sem custos no período" description="Combustível e manutenção aparecem quando o custo é informado no registro de origem." />
        ) : (
          <TableShell minWidth={920}>
            <TableHead>
              <tr>
                <th className="p-3">Data</th>
                <th className="p-3">Categoria</th>
                <th className="p-3">Descrição</th>
                <th className="p-3">Equipamento</th>
                <th className="p-3">Origem</th>
                <th className="p-3">Valor</th>
                {podeEditar && <th className="p-3 text-right">Ações</th>}
              </tr>
            </TableHead>
            <TableBody>
              {paginacao.visiveis.map(item => {
                const manual = item.origem === 'Lançamento';
                return (
                  <tr key={item.id} className="transition-colors hover:bg-slate-50">
                    <td className="p-3 text-slate-600">{formatarData(item.data)}</td>
                    <td className="p-3 text-slate-600">{item.categoria}</td>
                    <td className="max-w-80 truncate p-3 font-bold text-slate-800" title={item.descricao}>{item.descricao}</td>
                    <td className="p-3 text-slate-600">{equipamentos.find(equipamento => equipamento.id === item.equipamentoId)?.prefixo || '—'}</td>
                    <td className="p-3"><Badge tone={manual ? 'neutral' : 'info'}>{item.origem}</Badge></td>
                    <td className="p-3 font-mono font-bold text-slate-900">{moeda(item.valor)}</td>
                    {podeEditar && (
                      <td className="p-3 text-right">
                        {manual ? (
                          <button
                            type="button"
                            onClick={() => abrir(lancamentos.find(lancamento => lancamento.id === item.id))}
                            className="min-h-9 rounded-lg border border-slate-200 px-2.5 text-[11px] font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700"
                          >
                            Editar
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">na origem</span>
                        )}
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
        title={editado ? `Editar ${editado.descricao}` : 'Novo lançamento de custo'}
        onSubmit={salvar}
        size="md"
        onClose={() => setAberto(false)}
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setAberto(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={salvar} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">Salvar lançamento</button>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">
            Data
            <input type="date" value={form.data} onChange={event => setForm({ ...form, data: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Categoria
            <select value={form.categoria} onChange={event => setForm({ ...form, categoria: event.target.value as CategoriaCusto })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              {CATEGORIAS_MANUAIS.map(categoria => <option key={categoria} value={categoria}>{categoria}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Descrição
            <input value={form.descricao} onChange={event => setForm({ ...form, descricao: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Valor (R$)
            <input type="number" min={0} step="0.01" value={form.valor} onChange={event => setForm({ ...form, valor: Number(event.target.value) })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Documento
            <input value={form.documento} onChange={event => setForm({ ...form, documento: event.target.value })} placeholder="NF, contrato, recibo" className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Fornecedor
            <select value={form.fornecedorId} onChange={event => setForm({ ...form, fornecedorId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              <option value="">Sem fornecedor</option>
              {empresas.map(empresa => <option key={empresa.id} value={empresa.id}>{empresa.nome}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Equipamento
            <select value={form.equipamentoId} onChange={event => setForm({ ...form, equipamentoId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              <option value="">Sem equipamento</option>
              {equipamentos.map(equipamento => <option key={equipamento.id} value={equipamento.id}>{equipamento.prefixo}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Obra
            <select value={form.obraId} onChange={event => setForm({ ...form, obraId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              <option value="">Sem obra</option>
              {obras.map(obra => <option key={obra.id} value={obra.id}>{obra.nome}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Frente
            <input list="custo-frentes" value={form.frente} onChange={event => setForm({ ...form, frente: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
            <datalist id="custo-frentes">
              {frentes.map(frente => <option key={frente.id} value={frente.nome} />)}
            </datalist>
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Observação
            <textarea value={form.observacao} onChange={event => setForm({ ...form, observacao: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <p className="sm:col-span-2 text-[11px] text-slate-500">
            Combustível e manutenção não entram aqui: o consolidado lê o custo do abastecimento e o custo final da ordem de serviço.
          </p>
          {erro && <p className="sm:col-span-2 text-xs font-bold text-rose-700">{erro}</p>}
        </div>
      </Modal>
    </div>
  );
}
