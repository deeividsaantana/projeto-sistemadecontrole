import { useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ArrowDownUp, Download, FileSpreadsheet, Search } from 'lucide-react';
import type { Empresa, Funcionario, PresencaApontamento } from '../../types';
import { PeriodFilter, buildPeriod, type PeriodValue } from '../../shared/ui';
import { normalizeComparable } from '../../utils/canonicalIdentity';
import {
  pessoasDia,
  pizzaDasSituacoes,
  pizzaEmCampoPorEmpresa,
  relatorioPorColaborador,
  relatorioPorEquipe,
  resumoDoPeriodo,
  serieDiaria,
  type LinhaColaborador,
} from '../../utils/relatorioPresenca';
import {
  addCorporateSummarySheet,
  configureCorporateWorkbook,
  createCorporateWorkbook,
  downloadCorporateWorkbook,
  styleCorporateWorksheet,
} from '../../utils/excelCorporate';
import GraficoPizza from '../materiais/GraficoPizza';
import GraficoLinhasPresenca from './GraficoLinhasPresenca';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO, reduzMovimento } from '../cadastros/estilos';

const POR_PAGINA = 25;
const dataBr = (iso: string) => iso.split('-').reverse().join('/');
const pessoas = (valor: number) => `${valor.toLocaleString('pt-BR')} ${valor === 1 ? 'pessoa-dia' : 'pessoas-dia'}`;

type Ordem = 'faltas' | 'taxa' | 'nome' | 'dias';
const ORDENS: Array<{ id: Ordem; rotulo: string }> = [
  { id: 'faltas', rotulo: 'Mais faltas' },
  { id: 'taxa', rotulo: 'Menor presença' },
  { id: 'dias', rotulo: 'Mais dias' },
  { id: 'nome', rotulo: 'Nome (A-Z)' },
];

const ordenar = (linhas: LinhaColaborador[], ordem: Ordem) => [...linhas].sort((a, b) => {
  if (ordem === 'nome') return a.nome.localeCompare(b.nome, 'pt-BR');
  if (ordem === 'dias') return b.dias - a.dias || a.nome.localeCompare(b.nome, 'pt-BR');
  if (ordem === 'taxa') return (a.taxa ?? 101) - (b.taxa ?? 101) || b.faltas - a.faltas;
  return b.faltas - a.faltas || (a.taxa ?? 101) - (b.taxa ?? 101);
});

const tomDaTaxa = (taxa: number | null) => {
  if (taxa === null) return 'text-slate-400';
  if (taxa >= 90) return 'text-emerald-700';
  if (taxa >= 75) return 'text-amber-700';
  return 'text-rose-700';
};
const barraDaTaxa = (taxa: number | null) => {
  if (taxa === null) return 'bg-slate-200';
  if (taxa >= 90) return 'bg-emerald-500';
  if (taxa >= 75) return 'bg-amber-500';
  return 'bg-rose-500';
};

interface Props {
  /** Registros já recortados pelos filtros da aba (empresa, equipe, ramo...), de todos os dias. */
  registros: readonly PresencaApontamento[];
  funcionarios: readonly Funcionario[];
  empresas: readonly Empresa[];
  /** Descrição curta dos filtros da aba, para o arquivo exportado. */
  filtrosDescritos: string[];
  /** Abre os registros de uma pessoa para conferir ou corrigir. */
  onVerPessoa: (nome: string) => void;
}

/**
 * Relatório de um período: taxa de presença, linhas por dia, pizzas por
 * situação e por empresa, cada equipe e cada pessoa. Tudo sai do mesmo
 * conjunto de pessoas-dia, para os números nunca discordarem entre si.
 */
export default function RelatoriosPresenca({ registros, funcionarios, empresas, filtrosDescritos, onVerPessoa }: Props) {
  const raiz = useRef<HTMLDivElement>(null);
  const [periodo, setPeriodo] = useState<PeriodValue>(() => buildPeriod('mes'));
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState<Ordem>('faltas');
  const [quantos, setQuantos] = useState(POR_PAGINA);
  const [exportando, setExportando] = useState(false);

  const linhas = useMemo(() => pessoasDia(registros, periodo.from, periodo.to), [periodo.from, periodo.to, registros]);
  const resumo = useMemo(() => resumoDoPeriodo(linhas, periodo.from, periodo.to), [linhas, periodo.from, periodo.to]);
  const serie = useMemo(() => serieDiaria(linhas, periodo.from, periodo.to), [linhas, periodo.from, periodo.to]);
  const pizzaSituacoes = useMemo(() => pizzaDasSituacoes(linhas), [linhas]);
  const pizzaEmpresas = useMemo(() => pizzaEmCampoPorEmpresa(linhas, funcionarios, empresas), [empresas, funcionarios, linhas]);
  const equipes = useMemo(() => relatorioPorEquipe(linhas), [linhas]);
  const colaboradores = useMemo(() => relatorioPorColaborador(linhas, funcionarios), [funcionarios, linhas]);
  const termo = normalizeComparable(busca.trim());
  const colaboradoresVisiveis = useMemo(() => ordenar(
    colaboradores.filter(item => !termo || normalizeComparable(`${item.nome} ${item.matricula} ${item.funcao} ${item.equipe}`).includes(termo)),
    ordem,
  ), [colaboradores, ordem, termo]);

  useGSAP(() => {
    const escopo = raiz.current;
    if (!escopo || reduzMovimento()) return;
    gsap.fromTo(
      escopo.querySelectorAll('[data-presenca-reveal]'),
      { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power3.out', stagger: 0.06, clearProps: 'transform,opacity,visibility' },
    );
    const barras = escopo.querySelectorAll<HTMLElement>('[data-barra-taxa]');
    if (barras.length) gsap.fromTo(barras, { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: 'power3.out', stagger: 0.03, transformOrigin: 'left' });
    escopo.querySelectorAll<HTMLElement>('[data-conta]').forEach(no => {
      const alvo = Number(no.dataset.conta || 0);
      const contador = { valor: 0 };
      gsap.to(contador, {
        valor: alvo,
        duration: 0.7,
        ease: 'power2.out',
        onUpdate: () => { no.textContent = Math.round(contador.valor).toLocaleString('pt-BR'); },
      });
    });
  }, { scope: raiz, dependencies: [periodo.from, periodo.to, registros] });

  const exportarExcel = async () => {
    setExportando(true);
    try {
      const titulo = 'Relatório de presença do período';
      const workbook = await createCorporateWorkbook();
      configureCorporateWorkbook(workbook, titulo);
      const porPessoa = workbook.addWorksheet('Por pessoa');
      porPessoa.columns = [
        { header: 'Colaborador', key: 'nome', width: 34 },
        { header: 'Matrícula', key: 'matricula', width: 14 },
        { header: 'Função', key: 'funcao', width: 26 },
        { header: 'Equipe', key: 'equipe', width: 26 },
        { header: 'Dias apontados', key: 'dias', width: 14 },
        { header: 'Em campo', key: 'emCampo', width: 12 },
        { header: 'Atrasos', key: 'atrasos', width: 10 },
        { header: 'Faltas', key: 'faltas', width: 10 },
        { header: 'Justificadas', key: 'justificadas', width: 14 },
        { header: 'Afastamentos', key: 'afastamentos', width: 14 },
        { header: 'Presença %', key: 'taxa', width: 12 },
      ];
      colaboradoresVisiveis.forEach(item => porPessoa.addRow([
        item.nome, item.matricula, item.funcao, item.equipe, item.dias, item.emCampo,
        item.atrasos, item.faltas, item.justificadas, item.afastamentos, item.taxa ?? '',
      ]));
      styleCorporateWorksheet(porPessoa, { title: titulo, headerRow: 1, lastColumn: 11, recordCount: colaboradoresVisiveis.length });
      const porEquipe = workbook.addWorksheet('Por equipe');
      porEquipe.columns = [
        { header: 'Equipe', key: 'nome', width: 30 },
        { header: 'Frente', key: 'frente', width: 28 },
        { header: 'Dias com envio', key: 'dias', width: 14 },
        { header: 'Em campo', key: 'emCampo', width: 12 },
        { header: 'Faltas', key: 'faltas', width: 10 },
        { header: 'Justificadas', key: 'justificadas', width: 14 },
        { header: 'Presença %', key: 'taxa', width: 12 },
      ];
      equipes.forEach(item => porEquipe.addRow([item.nome, item.frente, item.dias, item.emCampo, item.faltas, item.justificadas, item.taxa ?? '']));
      styleCorporateWorksheet(porEquipe, { title: titulo, headerRow: 1, lastColumn: 7, recordCount: equipes.length });
      const porDia = workbook.addWorksheet('Por dia');
      porDia.columns = [
        { header: 'Dia', key: 'dia', width: 14 },
        { header: 'Em campo', key: 'emCampo', width: 12 },
        { header: 'Faltas', key: 'faltas', width: 10 },
        { header: 'Justificadas', key: 'justificadas', width: 14 },
        { header: 'Total apontado', key: 'total', width: 14 },
        { header: 'Presença %', key: 'taxa', width: 12 },
      ];
      serie.filter(item => item.total > 0).forEach(item => porDia.addRow([dataBr(item.iso), item.emCampo, item.faltas, item.justificadas, item.total, item.taxa ?? '']));
      styleCorporateWorksheet(porDia, { title: titulo, headerRow: 1, lastColumn: 6, recordCount: resumo.diasComEnvio });
      addCorporateSummarySheet(workbook, titulo, [
        ['Período', `${dataBr(periodo.from)} a ${dataBr(periodo.to)}`],
        ['Filtros', filtrosDescritos.join(' · ') || 'Nenhum'],
        ['Presença no período (%)', resumo.taxa ?? '—'],
        ['Média em campo por dia', resumo.mediaEmCampo],
        ['Faltas', resumo.faltas],
        ['Justificadas e atestados', resumo.justificadas],
        ['Pessoas diferentes', resumo.pessoas],
        ['Dias com envio', `${resumo.diasComEnvio} de ${resumo.diasNoPeriodo}`],
      ]);
      await downloadCorporateWorkbook(workbook, `RENEA_presenca_${periodo.from}_a_${periodo.to}.xlsx`);
    } finally {
      setExportando(false);
    }
  };

  const exportarCsv = () => {
    const linhasCsv = [
      ['Colaborador', 'Matrícula', 'Função', 'Equipe', 'Dias', 'Em campo', 'Atrasos', 'Faltas', 'Justificadas', 'Afastamentos', 'Presença %'],
      ...colaboradoresVisiveis.map(item => [item.nome, item.matricula, item.funcao, item.equipe, item.dias, item.emCampo, item.atrasos, item.faltas, item.justificadas, item.afastamentos, item.taxa ?? '']),
    ].map(linha => linha.map(valor => `"${String(valor ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([`﻿${linhasCsv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `presenca-${periodo.from}-a-${periodo.to}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const cartoes = [
    { rotulo: 'Presença', valor: resumo.taxa, sufixo: '%', nota: resumo.taxa === null ? 'Sem gente esperada no período' : 'Em campo sobre quem devia vir', tom: tomDaTaxa(resumo.taxa) },
    { rotulo: 'Em campo/dia', valor: resumo.mediaEmCampo, sufixo: '', nota: 'Média dos dias com envio', tom: 'text-slate-900' },
    { rotulo: 'Faltas', valor: resumo.faltas, sufixo: '', nota: 'Sem justificativa', tom: resumo.faltas ? 'text-rose-700' : 'text-slate-900' },
    { rotulo: 'Justificadas', valor: resumo.justificadas, sufixo: '', nota: 'Faltas justificadas e atestados', tom: 'text-slate-900' },
    { rotulo: 'Pessoas', valor: resumo.pessoas, sufixo: '', nota: 'Diferentes, apontadas no período', tom: 'text-slate-900' },
    { rotulo: 'Dias com envio', valor: resumo.diasComEnvio, sufixo: ` de ${resumo.diasNoPeriodo}`, nota: 'Dias em que alguma equipe apontou', tom: 'text-slate-900' },
  ];

  return (
    <div ref={raiz} className="space-y-4" data-testid="presenca-relatorios">
      <div data-presenca-reveal className={`${CARTAO} flex flex-wrap items-center justify-between gap-3 p-3`}>
        <PeriodFilter value={periodo} onChange={valor => { setPeriodo(valor); setQuantos(POR_PAGINA); }} />
        <div className="flex gap-2">
          <button type="button" onClick={() => void exportarExcel()} disabled={exportando || !linhas.length} className={BOTAO_PRIMARIO}>
            <FileSpreadsheet className="size-4" aria-hidden="true" /> {exportando ? 'Gerando...' : 'Baixar Excel'}
          </button>
          <button type="button" onClick={exportarCsv} disabled={!linhas.length} className={BOTAO_SECUNDARIO} aria-label="Baixar CSV" title="Baixar CSV">
            <Download className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cartoes.map(cartao => (
          <article key={cartao.rotulo} data-presenca-reveal className={`${CARTAO} min-w-0 p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-16px_rgba(16,24,32,0.3)]`}>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">{cartao.rotulo}</p>
            <p className={`mt-2 text-3xl font-black tabular-nums tracking-tight ${cartao.tom}`}>
              {cartao.valor === null ? '—' : <span data-conta={cartao.valor}>{cartao.valor.toLocaleString('pt-BR')}</span>}
              {cartao.valor !== null && cartao.sufixo && <span className="text-base font-bold text-slate-500">{cartao.sufixo}</span>}
            </p>
            <p className="mt-1 text-xs leading-snug text-slate-500">{cartao.nota}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <GraficoLinhasPresenca pontos={serie} />
        <div className="min-w-0 [&>section]:h-full lg:col-span-4">
          <GraficoPizza
            id="presenca-pizza-situacoes"
            titulo="Como foi o período"
            subtitulo="Situação de cada pessoa-dia"
            pizza={pizzaSituacoes}
            formatar={pessoas}
            formatarCurto={valor => valor.toLocaleString('pt-BR')}
            vazio="Nenhum envio de presença neste período."
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <article data-presenca-reveal className={`${CARTAO} min-w-0 p-4 lg:col-span-7`} aria-labelledby="presenca-por-equipe">
          <h2 id="presenca-por-equipe" className="text-base font-bold text-slate-900">Presença por equipe</h2>
          <p className="text-sm text-slate-500">Quem precisa de atenção aparece primeiro</p>
          {equipes.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Nenhuma equipe apontou neste período.</p>
          ) : (
            <ol className="mt-3 max-h-96 space-y-1 overflow-y-auto pr-1">
              {equipes.map(item => (
                <li key={item.chave} className="rounded-xl px-2 py-2 transition hover:bg-slate-50">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800" title={item.nome}>{item.nome}</p>
                      <p className="truncate text-xs text-slate-500">{item.frente || 'Sem frente'} · {item.dias} {item.dias === 1 ? 'dia' : 'dias'} · {item.faltas} {item.faltas === 1 ? 'falta' : 'faltas'}</p>
                    </div>
                    <strong className={`shrink-0 text-base font-black tabular-nums ${tomDaTaxa(item.taxa)}`}>{item.taxa === null ? '—' : `${item.taxa}%`}</strong>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div data-barra-taxa className={`h-full rounded-full ${barraDaTaxa(item.taxa)}`} style={{ width: `${item.taxa ?? 0}%` }} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </article>
        <div className="min-w-0 [&>section]:h-full lg:col-span-5">
          <GraficoPizza
            id="presenca-pizza-empresas"
            titulo="Em campo por empresa"
            subtitulo="Quem entregou o efetivo no período"
            pizza={pizzaEmpresas}
            formatar={pessoas}
            formatarCurto={valor => valor.toLocaleString('pt-BR')}
            notaDeFora={pizzaEmpresas.deFora ? `${pessoas(pizzaEmpresas.deFora)} sem empresa no cadastro ficaram de fora.` : undefined}
            vazio="Ninguém em campo neste período."
          />
        </div>
      </div>

      <article data-presenca-reveal className={`${CARTAO} min-w-0 overflow-hidden`} aria-labelledby="presenca-por-pessoa">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <h2 id="presenca-por-pessoa" className="text-base font-bold text-slate-900">Presença por pessoa</h2>
            <p className="text-sm text-slate-500">{colaboradoresVisiveis.length.toLocaleString('pt-BR')} {colaboradoresVisiveis.length === 1 ? 'pessoa' : 'pessoas'} · toque numa linha para ver os registros</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <label className="relative sm:w-64">
              <span className="sr-only">Buscar pessoa no relatório</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input type="search" value={busca} onChange={evento => { setBusca(evento.target.value); setQuantos(POR_PAGINA); }} placeholder="Nome, matrícula ou função" className={`${CAMPO} pl-9`} />
            </label>
            <label className="relative sm:w-48">
              <span className="sr-only">Ordenar</span>
              <ArrowDownUp className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <select value={ordem} onChange={evento => setOrdem(evento.target.value as Ordem)} className={`${CAMPO} pl-9`}>
                {ORDENS.map(item => <option key={item.id} value={item.id}>{item.rotulo}</option>)}
              </select>
            </label>
          </div>
        </div>

        {colaboradoresVisiveis.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">{linhas.length ? 'Ninguém com esse nome no período.' : 'Nenhum envio de presença neste período.'}</p>
        ) : (
          <>
            {/* Celular: cartões. Computador: tabela. */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {colaboradoresVisiveis.slice(0, quantos).map(item => (
                <li key={item.chave}>
                  <button type="button" onClick={() => onVerPessoa(item.nome)} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 ${FOCO}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">{item.nome}</p>
                      <p className="truncate text-xs text-slate-500">{[item.funcao, item.equipe].filter(Boolean).join(' · ')}</p>
                      <p className="mt-1 text-xs tabular-nums text-slate-600">{item.emCampo} em campo · <span className={item.faltas ? 'font-bold text-rose-700' : ''}>{item.faltas} {item.faltas === 1 ? 'falta' : 'faltas'}</span> · {item.justificadas} justif.</p>
                    </div>
                    <strong className={`shrink-0 text-lg font-black tabular-nums ${tomDaTaxa(item.taxa)}`}>{item.taxa === null ? '—' : `${item.taxa}%`}</strong>
                  </button>
                </li>
              ))}
            </ul>
            <div className="hidden md:block">
              <table className="w-full table-fixed text-left text-sm">
                <caption className="sr-only">Presença por pessoa no período</caption>
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-[30%] px-4 py-2.5">Colaborador</th>
                    <th className="w-[20%] px-2 py-2.5">Equipe</th>
                    <th className="px-2 py-2.5 text-right">Dias</th>
                    <th className="px-2 py-2.5 text-right">Em campo</th>
                    <th className="px-2 py-2.5 text-right">Atrasos</th>
                    <th className="px-2 py-2.5 text-right">Faltas</th>
                    <th className="px-2 py-2.5 text-right">Justif.</th>
                    <th className="w-[12%] px-4 py-2.5 text-right">Presença</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {colaboradoresVisiveis.slice(0, quantos).map(item => (
                    <tr key={item.chave} onClick={() => onVerPessoa(item.nome)} className="cursor-pointer transition hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <button type="button" onClick={evento => { evento.stopPropagation(); onVerPessoa(item.nome); }} className={`block max-w-full truncate text-left font-semibold text-slate-900 hover:text-[#176b4d] ${FOCO}`} title={item.nome}>{item.nome}</button>
                        <span className="block truncate text-xs text-slate-500">{[item.matricula, item.funcao].filter(Boolean).join(' · ')}</span>
                      </td>
                      <td className="truncate px-2 py-2.5 text-slate-600" title={item.equipe}>{item.equipe}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">{item.dias}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">{item.emCampo}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">{item.atrasos}</td>
                      <td className={`px-2 py-2.5 text-right tabular-nums ${item.faltas ? 'font-bold text-rose-700' : 'text-slate-700'}`}>{item.faltas}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-slate-700">{item.justificadas}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-2">
                          <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-slate-100 xl:block"><span className={`block h-full rounded-full ${barraDaTaxa(item.taxa)}`} style={{ width: `${item.taxa ?? 0}%` }} /></span>
                          <strong className={`tabular-nums ${tomDaTaxa(item.taxa)}`}>{item.taxa === null ? '—' : `${item.taxa}%`}</strong>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {colaboradoresVisiveis.length > quantos && (
              <div className="border-t border-slate-100 p-3 text-center">
                <button type="button" onClick={() => setQuantos(atual => atual + POR_PAGINA)} className={BOTAO_SECUNDARIO}>
                  Mostrar mais {Math.min(POR_PAGINA, colaboradoresVisiveis.length - quantos)} de {colaboradoresVisiveis.length - quantos}
                </button>
              </div>
            )}
          </>
        )}
      </article>
    </div>
  );
}
