/**
 * Orçado x realizado por competência e categoria. O realizado nunca é digitado:
 * vem do mesmo consolidado da tela de Custos. Categoria gasta sem orçamento
 * aparece com orçado zero, porque gasto sem previsão é o que mais precisa ser
 * visto.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, Plus, Scale } from 'lucide-react';
import type { Abastecimento, CategoriaCusto, LancamentoCusto, ObraLocal, OrcamentoItem, OrdemServico } from '../types';
import { consolidarCustos, custosDeOutrosModulos } from '../utils/custos';
import { compararOrcamento, resumoOrcamento, validarOrcamento } from '../utils/orcamento';
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

interface OrcamentoTabProps {
  orcamentos: OrcamentoItem[];
  lancamentos: LancamentoCusto[];
  abastecimentos: Abastecimento[];
  ordensServico: OrdemServico[];
  obras: ObraLocal[];
  responsavel: string;
  podeEditar: boolean;
  onSave: (item: OrcamentoItem, isNew: boolean) => void;
}

const CATEGORIAS: CategoriaCusto[] = ['Combustível', 'Manutenção', 'Material', 'Locação', 'Serviço de terceiro', 'Mão de obra', 'Outro'];

const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const competenciaAtual = () => isoDay(new Date()).slice(0, 7);
const rotuloCompetencia = (competencia: string) => {
  const [ano, mes] = competencia.split('-');
  return `${mes}/${ano}`;
};

export default function OrcamentoTab({
  orcamentos,
  lancamentos,
  abastecimentos,
  ordensServico,
  obras,
  responsavel,
  podeEditar,
  onSave,
}: OrcamentoTabProps) {
  const [competencia, setCompetencia] = useState(competenciaAtual);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState(false);
  const [editado, setEditado] = useState<OrcamentoItem | null>(null);
  const [form, setForm] = useState({ competencia: competenciaAtual(), categoria: 'Locação' as CategoriaCusto, valorOrcado: 0, obraId: '', observacao: '' });

  // O mês inteiro da competência escolhida: o comparativo é sempre mensal.
  const custos = useMemo(() => {
    const inicio = `${competencia}-01`;
    const fim = `${competencia}-31`;
    return consolidarCustos(
      custosDeOutrosModulos(abastecimentos, ordensServico, inicio, fim),
      lancamentos,
      inicio,
      fim,
    );
  }, [abastecimentos, ordensServico, lancamentos, competencia]);

  const linhas = useMemo(() => compararOrcamento(orcamentos, custos, competencia), [orcamentos, custos, competencia]);
  const resumo = resumoOrcamento(linhas);

  const abrir = (item?: OrcamentoItem) => {
    setEditado(item || null);
    setForm(item
      ? {
        competencia: item.competencia,
        categoria: item.categoria,
        valorOrcado: item.valorOrcado,
        obraId: item.obraId || '',
        observacao: item.observacao || '',
      }
      : { competencia, categoria: 'Locação', valorOrcado: 0, obraId: '', observacao: '' });
    setErro('');
    setAberto(true);
  };

  const salvar = () => {
    const problema = validarOrcamento({ competencia: form.competencia, valorOrcado: Number(form.valorOrcado) });
    if (problema) {
      setErro(problema);
      return;
    }
    const agora = new Date().toISOString();
    onSave({
      id: editado?.id || `orc-${Date.now()}`,
      competencia: form.competencia,
      categoria: form.categoria,
      valorOrcado: Number(form.valorOrcado),
      obraId: form.obraId || undefined,
      observacao: form.observacao.trim() || undefined,
      responsavel: editado?.responsavel || responsavel,
      ativo: editado?.ativo ?? true,
      criadoEm: editado?.criadoEm || agora,
      atualizadoEm: agora,
    }, !editado);
    setErro('');
    setAberto(false);
  };

  return (
    <div id="orcamento-tab" className="min-h-full w-full bg-[#f7f8f6] px-4 pb-12 pt-6 sm:px-7 lg:px-9">
      <PageHeader
        title="Orçado x Realizado"
        description="Comparativo mensal por categoria. O realizado vem do consolidado de custos, não é digitado."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-bold text-slate-600">
              <span className="sr-only">Competência</span>
              <input
                type="month"
                value={competencia}
                onChange={event => setCompetencia(event.target.value)}
                className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500"
              />
            </label>
            {podeEditar && (
              <button type="button" onClick={() => abrir()} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-800">
                <Plus className="h-4 w-4" /> Novo orçamento
              </button>
            )}
          </div>
        )}
      />

      {(resumo.estouradas > 0 || resumo.semOrcamento > 0) && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="flex items-center gap-2 text-xs font-bold text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            {resumo.estouradas} categoria(s) acima do orçado e {resumo.semOrcamento} com gasto sem previsão
          </p>
        </div>
      )}

      <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: 'Orçado', valor: moeda(resumo.orcado) },
          { label: 'Realizado', valor: moeda(resumo.realizado) },
          { label: 'Saldo', valor: moeda(resumo.saldo) },
          { label: 'Consumo', valor: resumo.consumo === undefined ? '—' : `${resumo.consumo}%` },
        ].map(item => (
          <div key={item.label} className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-500">{item.label}</p>
            <strong className="mt-1.5 block truncate text-xl font-black tabular-nums text-slate-900">{item.valor}</strong>
          </div>
        ))}
      </section>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {linhas.length === 0 ? (
          <EmptyState icon={Scale} title="Sem orçamento nem custo na competência" description={`Nada registrado em ${rotuloCompetencia(competencia)}.`} />
        ) : (
          <TableShell minWidth={900}>
            <TableHead>
              <tr>
                <th className="p-3">Categoria</th>
                <th className="p-3">Orçado</th>
                <th className="p-3">Realizado</th>
                <th className="p-3">Saldo</th>
                <th className="p-3">Consumo</th>
                <th className="p-3">Situação</th>
                {podeEditar && <th className="p-3 text-right">Ações</th>}
              </tr>
            </TableHead>
            <TableBody>
              {linhas.map(linha => {
                const item = orcamentos.find(orcamento => orcamento.ativo !== false
                  && orcamento.competencia === linha.competencia && orcamento.categoria === linha.categoria);
                return (
                  <tr key={`${linha.competencia}-${linha.categoria}`} className={`transition-colors hover:bg-slate-50 ${linha.estourado ? 'bg-rose-50/50' : ''}`}>
                    <td className="p-3 font-bold text-slate-800">{linha.categoria}</td>
                    <td className="p-3 font-mono text-slate-600">{linha.orcado > 0 ? moeda(linha.orcado) : '—'}</td>
                    <td className="p-3 font-mono font-bold text-slate-900">{moeda(linha.realizado)}</td>
                    <td className={`p-3 font-mono ${linha.saldo < 0 ? 'font-bold text-rose-700' : 'text-slate-600'}`}>{moeda(linha.saldo)}</td>
                    <td className="p-3">
                      {linha.consumo === undefined ? (
                        <span className="text-[11px] text-slate-400">sem orçamento</span>
                      ) : (
                        <div className="flex min-w-28 items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                            <div className={`h-1.5 rounded-full ${linha.estourado ? 'bg-rose-600' : 'bg-emerald-600'}`} style={{ width: `${Math.min(100, linha.consumo)}%` }} />
                          </div>
                          <span className="font-mono text-[11px] font-bold text-slate-700">{linha.consumo}%</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <Badge tone={linha.estourado ? 'danger' : linha.orcado === 0 ? 'warning' : 'success'}>
                        {linha.estourado ? 'Acima do orçado' : linha.orcado === 0 ? 'Sem previsão' : 'Dentro do orçado'}
                      </Badge>
                    </td>
                    {podeEditar && (
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => item ? abrir(item) : (() => { setForm({ competencia, categoria: linha.categoria, valorOrcado: 0, obraId: '', observacao: '' }); setEditado(null); setErro(''); setAberto(true); })()}
                          className="min-h-9 rounded-lg border border-slate-200 px-2.5 text-[11px] font-bold text-slate-600 transition-colors hover:border-emerald-500 hover:text-emerald-700"
                        >
                          {item ? 'Editar' : 'Orçar'}
                        </button>
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
        open={aberto}
        title={editado ? `Editar orçamento de ${editado.categoria}` : 'Novo orçamento'}
        size="md"
        onClose={() => setAberto(false)}
        footer={(
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setAberto(false)} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancelar</button>
            <button type="button" onClick={salvar} className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800">Salvar orçamento</button>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">
            Competência
            <input type="month" value={form.competencia} onChange={event => setForm({ ...form, competencia: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Categoria
            <select value={form.categoria} onChange={event => setForm({ ...form, categoria: event.target.value as CategoriaCusto })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              {CATEGORIAS.map(categoria => <option key={categoria} value={categoria}>{categoria}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Valor orçado (R$)
            <input type="number" min={0} step="0.01" value={form.valorOrcado} onChange={event => setForm({ ...form, valorOrcado: Number(event.target.value) })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Obra
            <select value={form.obraId} onChange={event => setForm({ ...form, obraId: event.target.value })} className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500">
              <option value="">Todas</option>
              {obras.map(obra => <option key={obra.id} value={obra.id}>{obra.nome}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600 sm:col-span-2">
            Observação
            <textarea value={form.observacao} onChange={event => setForm({ ...form, observacao: event.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500" />
          </label>
          {erro && <p className="sm:col-span-2 text-xs font-bold text-rose-700">{erro}</p>}
        </div>
      </Modal>
    </div>
  );
}
