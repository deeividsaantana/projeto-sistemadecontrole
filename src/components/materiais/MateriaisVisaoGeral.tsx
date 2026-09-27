import { useMemo, useState } from 'react';
import { FileSpreadsheet, Package, PackageX, SlidersHorizontal } from 'lucide-react';
import type { Material, MovimentoMaterial, TipoMovimentoMaterial } from '../../types';
import type { PosicaoEstoque } from '../../utils/estoque';
import { pendenciasDeRecebimento, resumoDeRecebimento } from '../../utils/recebimentoMaterial';
import { buildMaterialsOperationalSummary, getDefaultMaterialsPeriod } from '../../utils/materialsAnalytics';
import { summarizeMaterialsStock } from '../../utils/materialsDashboard';
import { rankingPor, type AvisoMaterial } from '../../modules/materials/avisosMateriais';
import { normalizeComparable } from '../../utils/canonicalIdentity';
import { formatarData, moeda, numero } from '../../utils/formato';
import { EmptyState } from '../../shared/ui';
import AvisosMateriais from './AvisosMateriais';
import BarrasRanking from './BarrasRanking';
import GraficoSemanas from './GraficoSemanas';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO, ROTULO } from '../cadastros/estilos';

const TIPOS: TipoMovimentoMaterial[] = ['Entrada', 'Saída', 'Transferência', 'Ajuste'];
const FILTROS_VAZIOS = { material: '', fornecedor: '', local: '', tipo: '' };

interface Props {
  hoje: string;
  materiais: Material[];
  movimentos: MovimentoMaterial[];
  movimentosVigentes: MovimentoMaterial[];
  posicoes: PosicaoEstoque[];
  podeEditar: boolean;
  avisos: readonly AvisoMaterial[];
  onEditarMaterial: (material: Material) => void;
  onVerMovimentos: (busca: string) => void;
}

/**
 * Visão geral de Materiais: o que falta chegar, o que está abaixo do mínimo,
 * como o estoque está e o que se mexeu no período. O que pede ação vem antes
 * dos números de acompanhamento.
 */
export default function MateriaisVisaoGeral({ hoje, materiais, movimentos, movimentosVigentes, posicoes, podeEditar, avisos, onEditarMaterial, onVerMovimentos }: Props) {
  const [periodo, setPeriodo] = useState(() => getDefaultMaterialsPeriod(hoje));
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [maisFiltros, setMaisFiltros] = useState(false);

  const pendencias = useMemo(() => pendenciasDeRecebimento(movimentosVigentes), [movimentosVigentes]);
  const recebimento = useMemo(() => resumoDeRecebimento(movimentosVigentes), [movimentosVigentes]);
  const estoque = useMemo(() => summarizeMaterialsStock(posicoes), [posicoes]);
  const resumo = useMemo(() => buildMaterialsOperationalSummary(movimentosVigentes, { from: periodo.from, to: periodo.to, ...filtros }), [filtros, movimentosVigentes, periodo]);
  const opcoes = useMemo(() => {
    const ordenar = (valores: Iterable<string>) => [...new Set(valores)].filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return {
      materiais: ordenar(movimentos.map(item => item.materialDescricao)),
      fornecedores: ordenar(movimentos.map(item => item.fornecedorNome || '')),
      locais: ordenar(movimentos.flatMap(item => [item.destino || '', item.origem || ''])),
    };
  }, [movimentos]);
  const filtrosAtivos = Object.values(filtros).filter(Boolean).length;
  const porFornecedor = useMemo(() => rankingPor(resumo.filteredMovements, item => item.fornecedorNome), [resumo.filteredMovements]);
  const porLocal = useMemo(() => rankingPor(resumo.filteredMovements, item => item.destino || item.origem, 10), [resumo.filteredMovements]);

  const exportarCsv = () => {
    const cabecalho = ['Data', 'Tipo', 'Material', 'Unidade', 'Quantidade', 'Fator', 'Fornecedor', 'Placa', 'Ticket', 'Local', 'Valor unitario', 'Valor total'];
    const linhas = resumo.filteredMovements.map(item => [
      item.data,
      item.tipo,
      item.materialDescricao,
      item.unidade,
      String(item.quantidade).replace('.', ','),
      item.fatorConversao ? String(item.fatorConversao).replace('.', ',') : '',
      item.fornecedorNome || '',
      item.placa || '',
      item.ticket || item.notaFiscal || '',
      item.destino || item.origem || '',
      item.valorUnitario ? String(item.valorUnitario).replace('.', ',') : '',
      item.valorTotal ? String(item.valorTotal).replace('.', ',') : '',
    ]);
    const csv = [cabecalho, ...linhas]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `materiais-${periodo.from}-a-${periodo.to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const indicadores = [
    { rotulo: 'Materiais ativos', valor: estoque.total, detalhe: 'no cadastro' },
    { rotulo: 'Movimentos', valor: movimentos.length, detalhe: 'no histórico' },
    { rotulo: 'Abaixo do mínimo', valor: estoque.abaixoDoMinimo, detalhe: 'pedem reposição', alerta: estoque.abaixoDoMinimo > 0 },
    { rotulo: 'Sem saldo', valor: estoque.semSaldo, detalhe: 'sem nada no estoque', alerta: estoque.semSaldo > 0 },
  ];

  return (
    <div className="space-y-4">
      <section aria-label="Indicadores de materiais" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {indicadores.map(item => (
          <article key={item.rotulo} data-materiais-reveal className={`${CARTAO} p-4`}>
            <p className="text-sm font-semibold text-slate-600">{item.rotulo}</p>
            <strong className={`mt-1 block text-3xl font-black tabular-nums ${item.alerta ? 'text-[#f26a2e]' : 'text-slate-950'}`}>{item.valor.toLocaleString('pt-BR')}</strong>
            <span className="text-xs text-slate-500">{item.detalhe}</span>
          </article>
        ))}
      </section>

      <AvisosMateriais avisos={avisos} onVerMovimentos={onVerMovimentos} />

      {/* Carga que a nota prometeu e não chegou é nota paga sem material na
          obra: é a conversa mais cara, por isso vem antes dos gráficos. */}
      {pendencias.length > 0 && (
        <section id="recebimentos-pendentes" data-materiais-reveal className="overflow-hidden rounded-2xl border border-rose-200 bg-white">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-200 bg-rose-50 px-4 py-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-rose-900">
              <PackageX className="size-5 shrink-0 text-rose-600" aria-hidden="true" />
              {pendencias.length} entrega(s) com carga faltando
            </h2>
            <span className="text-sm font-semibold text-rose-800">{recebimento.percentualRecebido}% do que as notas prometeram já chegou</span>
          </header>
          <table className="hidden w-full text-left text-sm sm:table">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="p-3">Material</th>
                <th className="p-3">SC / Nota</th>
                <th className="p-3">Aplicação</th>
                <th className="p-3 text-right">Nota</th>
                <th className="p-3 text-right">Recebido</th>
                <th className="p-3 text-right">Falta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendencias.map(item => (
                <tr key={item.movimentoId}>
                  <td className="p-3">
                    <strong className="block text-slate-900">{item.material}</strong>
                    <span className="text-xs text-slate-500">{formatarData(item.data)}</span>
                  </td>
                  <td className="p-3 text-slate-600">{[item.solicitacaoCompra, item.notaFiscal && `NF ${item.notaFiscal}`].filter(Boolean).join(' · ') || '-'}</td>
                  <td className="p-3 text-slate-600">{item.destino || '-'}</td>
                  <td className="p-3 text-right tabular-nums text-slate-700">{item.quantidadeNota.toLocaleString('pt-BR')}</td>
                  <td className="p-3 text-right tabular-nums text-slate-700">{item.quantidadeRecebida.toLocaleString('pt-BR')}</td>
                  <td className="p-3 text-right font-black tabular-nums text-rose-700">{item.faltante.toLocaleString('pt-BR')} {item.unidade}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="divide-y divide-slate-100 sm:hidden">
            {pendencias.map(item => (
              <li key={item.movimentoId} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <strong className="min-w-0 text-base text-slate-900">{item.material}</strong>
                  <span className="shrink-0 text-base font-black tabular-nums text-rose-700">falta {item.faltante.toLocaleString('pt-BR')} {item.unidade}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{[item.solicitacaoCompra, item.notaFiscal && `NF ${item.notaFiscal}`, item.destino].filter(Boolean).join(' · ')}</p>
                <p className="text-sm text-slate-500">{formatarData(item.data)} · nota {item.quantidadeNota.toLocaleString('pt-BR')} · chegou {item.quantidadeRecebida.toLocaleString('pt-BR')}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-12" aria-label="Estoque e movimentação">
        <article data-materiais-reveal className={`${CARTAO} p-4 lg:col-span-4`} aria-labelledby="materiais-cobertura">
          <h2 id="materiais-cobertura" className="text-base font-bold text-slate-900">Como está o estoque</h2>
          <div className="mt-3 flex items-center gap-5">
            <div className="relative size-28 shrink-0" role="img" aria-label={`${estoque.coberturaPercentual ?? 0}% dos materiais com saldo regular`}>
              <svg viewBox="0 0 112 112" className="size-28 -rotate-90" aria-hidden="true">
                <circle cx="56" cy="56" r="43" fill="none" strokeWidth="10" className="stroke-slate-100" />
                <circle cx="56" cy="56" r="43" fill="none" strokeWidth="10" strokeLinecap="round" pathLength="100" strokeDasharray={`${estoque.coberturaPercentual ?? 0} 100`} className="stroke-[#176b4d]" />
              </svg>
              <strong className="absolute inset-0 grid place-items-center text-xl font-black tabular-nums text-slate-950">{estoque.coberturaPercentual == null ? '-' : `${estoque.coberturaPercentual}%`}</strong>
            </div>
            <dl className="min-w-0 flex-1 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2"><dt className="text-slate-600">Regular</dt><dd className="font-black tabular-nums text-[#176b4d]">{estoque.regulares}</dd></div>
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2"><dt className="text-slate-600">Abaixo do mínimo</dt><dd className="font-black tabular-nums text-amber-700">{estoque.abaixoDoMinimo}</dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-slate-600">Sem saldo</dt><dd className="font-black tabular-nums text-rose-700">{estoque.semSaldo}</dd></div>
            </dl>
          </div>
        </article>

        <GraficoSemanas hoje={hoje} materiais={materiais} movimentos={movimentosVigentes} />
      </section>

      <section data-materiais-reveal aria-labelledby="materiais-periodo" className={`${CARTAO} space-y-3 p-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="materiais-periodo" className="text-base font-bold text-slate-900">No período</h2>
          <p className="text-sm font-semibold text-slate-600">
            {resumo.filteredMovements.length.toLocaleString('pt-BR')} lançamento(s) · {moeda(resumo.totals.valorTotal)}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block space-y-1">
            <span className={ROTULO}>De</span>
            <input type="date" value={periodo.from} onChange={event => setPeriodo({ ...periodo, from: event.target.value })} className={CAMPO} />
          </label>
          <label className="block space-y-1">
            <span className={ROTULO}>Até</span>
            <input type="date" value={periodo.to} onChange={event => setPeriodo({ ...periodo, to: event.target.value })} className={CAMPO} />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPeriodo(getDefaultMaterialsPeriod(hoje))} className={`${BOTAO_SECUNDARIO} flex-1`}>Mês atual</button>
            <button type="button" onClick={() => setMaisFiltros(atual => !atual)} aria-expanded={maisFiltros} className={`${BOTAO_SECUNDARIO} flex-1`}>
              <SlidersHorizontal className="size-5" aria-hidden="true" />
              Filtros{filtrosAtivos ? ` (${filtrosAtivos})` : ''}
            </button>
          </div>
        </div>
        {maisFiltros && (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <label className="block space-y-1">
              <span className={ROTULO}>Material</span>
              <select value={filtros.material} onChange={event => setFiltros({ ...filtros, material: event.target.value })} className={CAMPO}>
                <option value="">Todos</option>
                {opcoes.materiais.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="block space-y-1">
              <span className={ROTULO}>Fornecedor</span>
              <select value={filtros.fornecedor} onChange={event => setFiltros({ ...filtros, fornecedor: event.target.value })} className={CAMPO}>
                <option value="">Todos</option>
                {opcoes.fornecedores.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="block space-y-1">
              <span className={ROTULO}>Local</span>
              <input list="materiais-locais-resumo" value={filtros.local} onChange={event => setFiltros({ ...filtros, local: event.target.value })} placeholder="Ramo, base ou estoque" className={CAMPO} />
              <datalist id="materiais-locais-resumo">{opcoes.locais.map(item => <option key={item} value={item} />)}</datalist>
            </label>
            <label className="block space-y-1">
              <span className={ROTULO}>Tipo</span>
              <select value={filtros.tipo} onChange={event => setFiltros({ ...filtros, tipo: event.target.value })} className={CAMPO}>
                <option value="">Todos</option>
                {TIPOS.map(item => <option key={item}>{item}</option>)}
              </select>
            </label>
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
          {filtrosAtivos > 0 && <button type="button" onClick={() => setFiltros(FILTROS_VAZIOS)} className={BOTAO_SECUNDARIO}>Limpar filtros</button>}
          <button type="button" onClick={exportarCsv} disabled={resumo.filteredMovements.length === 0} className={BOTAO_PRIMARIO}>
            <FileSpreadsheet className="size-5" aria-hidden="true" />
            Baixar planilha do período
          </button>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <section data-materiais-reveal className={`${CARTAO} overflow-hidden`} aria-labelledby="materiais-no-periodo">
          <h2 id="materiais-no-periodo" className="border-b border-slate-100 px-4 py-3 text-base font-bold text-slate-900">Materiais no período</h2>
          {resumo.materials.length === 0 ? (
            <EmptyState icon={Package} title="Nada lançado no período" description="Mude as datas ou tire os filtros." />
          ) : (
            <div className="grid gap-2 p-3 sm:grid-cols-2 2xl:grid-cols-3">
              {resumo.materials.slice(0, 12).map(item => {
                const ativo = normalizeComparable(filtros.material) === normalizeComparable(item.material);
                const cadastro = materiais.find(material => normalizeComparable(material.descricao) === normalizeComparable(item.material));
                return (
                  <div key={item.material} className={`rounded-xl border p-3 transition duration-200 ${ativo ? 'border-[#176b4d] bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                    <button type="button" onClick={() => setFiltros({ ...filtros, material: ativo ? '' : item.material })} className={`block w-full rounded-lg text-left ${FOCO}`} aria-pressed={ativo}>
                      <span className="block truncate text-sm font-bold text-slate-700">{item.material}</span>
                      <strong className="mt-1 block text-xl font-black tabular-nums text-slate-950">{numero(item.quantidade)} {item.unidade}</strong>
                      {(item.toneladas > 0 || item.metrosCubicos > 0) && (
                        <span className="block text-xs font-semibold text-[#176b4d]">
                          {[item.toneladas > 0 ? `${numero(item.toneladas)} t` : null, item.metrosCubicos > 0 ? `${numero(item.metrosCubicos)} m³` : null].filter(Boolean).join(' · ')}
                        </span>
                      )}
                      <span className="block text-xs text-slate-500">{item.viagens.toLocaleString('pt-BR')} viagem(ns) · {item.custoMedio ? `${moeda(item.custoMedio)}/un` : 'sem custo'}</span>
                    </button>
                    {podeEditar && cadastro && (
                      <button type="button" onClick={() => onEditarMaterial(cadastro)} className={`mt-2 min-h-9 rounded-lg px-2 text-xs font-bold text-[#176b4d] hover:bg-emerald-50 ${FOCO}`}>Editar cadastro</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <BarrasRanking
          id="materiais-fornecedores"
          titulo="Fornecedores"
          subtitulo="Lançamentos no período. Toque para filtrar."
          linhas={porFornecedor}
          vazio="Nenhum fornecedor no período."
          escolhido={filtros.fornecedor}
          onEscolher={fornecedor => setFiltros({ ...filtros, fornecedor })}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <BarrasRanking
          id="materiais-por-local"
          titulo="Por local"
          subtitulo="Onde mais chegou ou saiu material no período. Toque para filtrar."
          linhas={porLocal}
          vazio="Nenhum local no período."
          escolhido={filtros.local}
          onEscolher={local => setFiltros({ ...filtros, local })}
        />

        <section data-materiais-reveal className={`${CARTAO} overflow-hidden`} aria-labelledby="materiais-viagens">
          <h2 id="materiais-viagens" className="border-b border-slate-100 px-4 py-3 text-base font-bold text-slate-900">Viagens de bota-fora e solo</h2>
          {resumo.trips.length > 0 && (
            <div className="grid grid-cols-[1fr_repeat(3,4.5rem)] gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 sm:grid-cols-[1fr_repeat(3,6rem)]">
              <span>Local</span><span className="text-right">Lixo</span><span className="text-right">Solo cont.</span><span className="text-right">Solo</span>
            </div>
          )}
          <ul className="divide-y divide-slate-100">
            {resumo.trips.slice(0, 12).map(item => (
              <li key={item.local} className="grid grid-cols-[1fr_repeat(3,4.5rem)] items-center gap-2 px-4 py-2.5 text-sm sm:grid-cols-[1fr_repeat(3,6rem)]">
                <strong className="min-w-0 truncate text-slate-800">{item.local}</strong>
                <span className="text-right tabular-nums text-slate-900">{numero(item.lixo)}</span>
                <span className="text-right tabular-nums text-slate-900">{numero(item.soloContaminado)}</span>
                <span className="text-right tabular-nums text-slate-900">{numero(item.solo)}</span>
              </li>
            ))}
          </ul>
          {resumo.trips.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Nenhuma viagem de bota-fora ou solo no período.</p>}
        </section>
      </div>
    </div>
  );
}
