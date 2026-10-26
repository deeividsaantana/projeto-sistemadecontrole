import { useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Download, FileSpreadsheet, Search } from 'lucide-react';
import type { Empresa, Funcionario, PresencaApontamento } from '../../types';
import { PeriodFilter, buildPeriod, type PeriodValue } from '../../shared/ui';
import { TabelaPadrao, type ColunaTabela } from '../../shared/ui/TabelaPadrao';
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
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, reduzMovimento } from '../cadastros/estilos';

const dataBr = (iso: string) => iso.split('-').reverse().join('/');
const pessoas = (valor: number) => `${valor.toLocaleString('pt-BR')} ${valor === 1 ? 'pessoa-dia' : 'pessoas-dia'}`;

// A lista abre com quem mais falta em cima; os títulos da tabela ordenam por
// nome, dias, faltas ou presença.
const porFaltas = (linhas: LinhaColaborador[]) => [...linhas].sort((a, b) => b.faltas - a.faltas || (a.taxa ?? 101) - (b.taxa ?? 101));

const numero = (chave: keyof LinhaColaborador & string, titulo: string): ColunaTabela<LinhaColaborador> => ({
  chave, titulo, alinhamento: 'direita', valorOrdenacao: item => item[chave] as number, render: item => item[chave] as number,
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
  const [exportando, setExportando] = useState(false);

  const linhas = useMemo(() => pessoasDia(registros, periodo.from, periodo.to), [periodo.from, periodo.to, registros]);
  const resumo = useMemo(() => resumoDoPeriodo(linhas, periodo.from, periodo.to), [linhas, periodo.from, periodo.to]);
  const serie = useMemo(() => serieDiaria(linhas, periodo.from, periodo.to), [linhas, periodo.from, periodo.to]);
  const pizzaSituacoes = useMemo(() => pizzaDasSituacoes(linhas), [linhas]);
  const pizzaEmpresas = useMemo(() => pizzaEmCampoPorEmpresa(linhas, funcionarios, empresas), [empresas, funcionarios, linhas]);
  const equipes = useMemo(() => relatorioPorEquipe(linhas), [linhas]);
  const colaboradores = useMemo(() => relatorioPorColaborador(linhas, funcionarios), [funcionarios, linhas]);
  const termo = normalizeComparable(busca.trim());
  const colaboradoresVisiveis = useMemo(() => porFaltas(
    colaboradores.filter(item => !termo || normalizeComparable(`${item.nome} ${item.matricula} ${item.funcao} ${item.equipe}`).includes(termo)),
  ), [colaboradores, termo]);

  const colunasPessoas: ColunaTabela<LinhaColaborador>[] = [
    {
      chave: 'nome',
      titulo: 'Colaborador',
      larguraMinima: 220,
      valorOrdenacao: item => item.nome,
      dica: item => [item.nome, item.matricula, item.funcao].filter(Boolean).join(' · '),
      render: item => (
        <>
          <span className="font-semibold text-slate-900">{item.nome}</span>
          {(item.matricula || item.funcao) && <span className="text-[#5b6870]"> · {[item.matricula, item.funcao].filter(Boolean).join(' · ')}</span>}
        </>
      ),
    },
    { chave: 'equipe', titulo: 'Equipe', larguraMinima: 160, valorOrdenacao: item => item.equipe, render: item => item.equipe || '—' },
    numero('dias', 'Dias'),
    numero('emCampo', 'Em campo'),
    numero('atrasos', 'Atrasos'),
    {
      ...numero('faltas', 'Faltas'),
      render: item => <span className={item.faltas ? 'font-bold text-rose-700' : undefined}>{item.faltas}</span>,
    },
    numero('justificadas', 'Justificadas'),
    {
      chave: 'taxa',
      titulo: 'Presença',
      alinhamento: 'direita',
      larguraMinima: 110,
      valorOrdenacao: item => item.taxa,
      dica: item => (item.taxa === null ? 'Sem dia esperado no período' : `${item.taxa}% de presença`),
      render: item => (
        <span className="inline-flex items-center justify-end gap-2">
          <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-slate-100 xl:block" aria-hidden="true"><span className={`block h-full rounded-full ${barraDaTaxa(item.taxa)}`} style={{ width: `${item.taxa ?? 0}%` }} /></span>
          <strong className={`tabular-nums ${tomDaTaxa(item.taxa)}`}>{item.taxa === null ? '—' : `${item.taxa}%`}</strong>
        </span>
      ),
    },
  ];

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
        <PeriodFilter value={periodo} onChange={setPeriodo} />
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

      <article data-presenca-reveal className={`${CARTAO} flex min-w-0 flex-col overflow-hidden [--tabela-altura-max:32rem]`} aria-labelledby="presenca-por-pessoa">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <h2 id="presenca-por-pessoa" className="text-base font-bold text-slate-900">Presença por pessoa</h2>
            <p className="text-sm text-[#5b6870]">Quem mais falta aparece primeiro. Toque numa pessoa para ver os registros dela.</p>
          </div>
          <label className="relative w-full sm:w-72">
            <span className="sr-only">Buscar pessoa no relatório</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#5b6870]" aria-hidden="true" />
            <input type="search" value={busca} onChange={evento => setBusca(evento.target.value)} placeholder="Nome, matrícula ou função" className={`${CAMPO} pl-9`} />
          </label>
        </div>
        <TabelaPadrao
          titulo="Presença por pessoa no período"
          linhas={colaboradoresVisiveis}
          colunas={colunasPessoas}
          idDaLinha={item => item.chave}
          nomeDoItem={{ um: 'pessoa', varios: 'pessoas' }}
          vazio={linhas.length ? 'Ninguém com esse nome no período.' : 'Nenhum envio de presença neste período.'}
          onAbrirLinha={item => onVerPessoa(item.nome)}
          porPaginaInicial={25}
          className="rounded-none border-0"
          testId="presenca-por-pessoa"
        />
      </article>
    </div>
  );
}
