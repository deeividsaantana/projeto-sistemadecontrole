/**
 * Combustível: lançar o abastecimento com o fluxo da planilha macro.
 * A máquina ainda consulta as últimas leituras do controle, mas o cadastro
 * rápido fica focado em prefixo, litros, comboio, combustível e bomba.
 *
 * Teclas, fora de campo de texto: N novo abastecimento, / busca no histórico.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { BarChart3, CalendarDays, CheckCircle2, Download, Droplets, FileSpreadsheet, Fuel, Gauge, History, Maximize2, Minimize2, PieChart, Plus, RotateCcw, Search, X } from 'lucide-react';
import type { Abastecimento, Comboio, ControleEquipamentoDiario, Empresa, Equipamento, GrupoEquipe, TipoCombustivel } from '../types';
import type { FuelImportedMasterData } from '../utils/fuelMasterDataImport';
import { ConfirmDialog, isoDay } from '../shared/ui';
import { PageHeader } from '../shared/ui/PageHeader';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO, ROTULO } from './cadastros/estilos';
import type { FuelHistoryGroup } from '../modules/frota/fuelHistoryAnalytics';
import ConsumoPorMaquina from './combustivel/ConsumoPorMaquina';
import HistoricoCombustivel, { type FiltrosExportacao } from './combustivel/HistoricoCombustivel';
import LancamentoCombustivel from './combustivel/LancamentoCombustivel';
import { buildFuelReport, getFuelCompetencePeriodLabel, getFuelRecordCompetence, type FuelReportExcelRow, type FuelReportFilters } from '../modules/frota/fuelReport';

interface Props {
  empresas: Empresa[];
  equipamentos: Equipamento[];
  comboios: Comboio[];
  combustiveis: TipoCombustivel[];
  abastecimentos: Abastecimento[];
  /** Canteiros do cadastro; sem isso usa a lista fixa de reserva. */
  canteiros?: readonly string[];
  /** Lançamentos do Controle de Frotas; dão operador, canteiro e situação do dia. */
  registros?: ControleEquipamentoDiario[];
  gruposEquipe?: GrupoEquipe[];
  /** Quem está usando o sistema; entra como responsável do lançamento. */
  usuario?: string;
  onSaveAbastecimento: (item: Abastecimento, isNew: boolean) => void;
  onDeleteAbastecimento: (id: string) => void;
  /** Exclui vários de uma vez; sem ele, o histórico só exclui um por vez. */
  onDeleteAbastecimentos?: (ids: string[]) => void;
  onImportAbastecimentos?: (items: Abastecimento[], combustiveisImportados?: TipoCombustivel[], cadastrosImportados?: Partial<FuelImportedMasterData>) => void;
  onOpenLubrificacao: () => void;
  onOpenCadastros?: () => void;
  onOpenControle?: () => void;
  onOpenSpreadsheetImport: () => void;
  isParsingSpreadsheet: boolean;
  openHistorySignal?: number;
  initialView?: View;
  listaSomente?: boolean;
}

type View = 'resumo' | 'novo' | 'historico' | 'relatorio' | 'consumo';

interface FiltrosRelatorio {
  texto: string;
  competencia: string;
  dataInicio: string;
  dataFim: string;
  empresaId: string;
  equipamentoId: string;
  comboioId: string;
  combustivelId: string;
  status: string;
  apenasConferencia: boolean;
}

const CHAVE_TELA_CHEIA = 'renea_combustivel_tela_cheia_v1';
const FILTROS_RELATORIO_VAZIOS: FiltrosRelatorio = {
  texto: '', competencia: '', dataInicio: '', dataFim: '', empresaId: '', equipamentoId: '', comboioId: '', combustivelId: '', status: '', apenasConferencia: false,
};
const CORES_GRAFICO_COMBUSTIVEL = ['#176b4d', '#f26a2e', '#718087', '#f7f8f6'];

const hoje = () => isoDay(new Date());
const dataCurta = (dia: string) => dia ? new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem data';
const litrosTexto = (valor: number) => `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`;
const numeroTexto = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
type AgrupamentoRelatorio = 'competencia' | 'empresa' | 'equipamento' | 'comboio' | 'combustivel';

export default function CombustivelOperacionalTab({
  empresas, equipamentos, comboios, combustiveis, abastecimentos, registros = [], gruposEquipe = [], usuario = '',
  onSaveAbastecimento, onDeleteAbastecimento, onDeleteAbastecimentos, onOpenLubrificacao, onOpenSpreadsheetImport, isParsingSpreadsheet,
  openHistorySignal = 0, initialView = 'resumo', listaSomente = false,
}: Props) {
  const escopo = useRef<HTMLElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>(listaSomente ? 'historico' : initialView);
  const [filtrosRelatorio, setFiltrosRelatorio] = useState<FiltrosRelatorio>(FILTROS_RELATORIO_VAZIOS);
  const [abaDashboard, setAbaDashboard] = useState<'resumo' | 'ranking'>('resumo');
  const [agrupamentoRelatorio, setAgrupamentoRelatorio] = useState<AgrupamentoRelatorio>('competencia');
  const [exportandoHistorico, setExportandoHistorico] = useState<'' | 'excel' | 'pdf'>('');
  const [excluindo, setExcluindo] = useState<Abastecimento[]>([]);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  /** Lançamento aberto: a chave remonta o formulário a cada novo pedido. */
  const [lancamento, setLancamento] = useState<{ chave: number; emEdicao?: Abastecimento; prefixo?: string; comboioId?: string; daLista?: boolean }>({ chave: 0 });
  const [vistaAnterior, setVistaAnterior] = useState<View>('resumo');
  /** A janela de lançamento mostra o formulário ou a lista, do mesmo tamanho. */
  const [abaJanela, setAbaJanela] = useState<'lancar' | 'lista'>('lancar');
  const [telaCheia, setTelaCheia] = useState(() => {
    try { return window.localStorage.getItem(CHAVE_TELA_CHEIA) === '1'; } catch { return false; }
  });

  useEffect(() => {
    if (openHistorySignal > 0) setView('historico');
  }, [openHistorySignal]);

  useEffect(() => {
    if (listaSomente) setView('historico');
  }, [listaSomente]);

  useEffect(() => {
    try { window.localStorage.setItem(CHAVE_TELA_CHEIA, telaCheia ? '1' : '0'); } catch { /* aba anônima */ }
  }, [telaCheia]);

  const ativos = useMemo(() => abastecimentos
    .filter(item => !item.inativoEm && item.status !== 'Cancelado')
    .sort((a, b) => `${b.data}${b.hora}`.localeCompare(`${a.data}${a.hora}`)), [abastecimentos]);
  const porId = useMemo(() => new Map(equipamentos.map(item => [item.id, item])), [equipamentos]);
  const empresaPorId = useMemo(() => new Map<string, string>(empresas.map(item => [item.id, item.nome])), [empresas]);
  const competenciasDisponiveis = useMemo(() => {
    const chaves = new Set(ativos.map(item => getFuelRecordCompetence(item)).filter(Boolean));
    return [...chaves].sort((a, b) => b.localeCompare(a)).map(chave => ({
      chave,
      rotulo: /^\d{4}-\d{2}$/.test(chave)
        ? `${new Date(`${chave}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()} · ${getFuelCompetencePeriodLabel(chave)}`
        : 'Sem data',
    }));
  }, [ativos]);
  const filtrosRelatorioAplicados = useMemo<FuelReportFilters>(() => ({
    competencias: filtrosRelatorio.competencia ? [filtrosRelatorio.competencia] : [],
    dataInicio: filtrosRelatorio.dataInicio,
    dataFim: filtrosRelatorio.dataFim,
    empresaIds: filtrosRelatorio.empresaId ? [filtrosRelatorio.empresaId] : [],
    equipamentoIds: filtrosRelatorio.equipamentoId ? [filtrosRelatorio.equipamentoId] : [],
    comboioIds: filtrosRelatorio.comboioId ? [filtrosRelatorio.comboioId] : [],
    combustivelIds: filtrosRelatorio.combustivelId ? [filtrosRelatorio.combustivelId] : [],
    status: filtrosRelatorio.status ? [filtrosRelatorio.status] : [],
    apenasConferencia: filtrosRelatorio.apenasConferencia,
    texto: filtrosRelatorio.texto,
  }), [filtrosRelatorio]);
  const relatorioCombustivel = useMemo(() => buildFuelReport({
    records: ativos, equipamentos, empresas, comboios, combustiveis,
  }, filtrosRelatorioAplicados), [ativos, comboios, combustiveis, empresas, equipamentos, filtrosRelatorioAplicados]);

  /**
   * Excel no modelo da planilha "FORNECIMENTO DIESEL": Resumo Geral,
   * Equipamentos e uma aba por mês do diesel. A aba CONFERÊNCIA só entra
   * quando há lançamento para conferir.
   */
  const exportarPlanilha = async (linhas: FuelReportExcelRow[], assunto: string, arquivo: string) => {
    const { configureCorporateWorkbook, createCorporateWorkbook, downloadCorporateWorkbook } = await import('../utils/excelCorporate');
    const { preencherPlanilhaDiesel } = await import('../modules/frota/exportarPlanilhaDiesel');
    const workbook = await createCorporateWorkbook();
    configureCorporateWorkbook(workbook, assunto);
    preencherPlanilhaDiesel(workbook, linhas, equipamentos.map(item => ({
      prefixo: item.prefixo,
      nome: item.nome,
      familia: item.familia || item.tipo || '',
      empresa: empresaPorId.get(item.empresaId) || '',
      status: item.status,
    })));
    const aConferir = linhas.filter(linha => linha.status === 'Conferência necessária');
    if (aConferir.length) {
      const conferencia = workbook.addWorksheet('CONFERÊNCIA', { views: [{ state: 'frozen', ySplit: 1 }] });
      conferencia.columns = [
        { header: 'Data', key: 'data', width: 13 }, { header: 'Prefixo', key: 'prefixo', width: 12 },
        { header: 'Descrição do equipamento', key: 'descricao', width: 32 }, { header: 'Litros', key: 'litros', width: 11 },
        { header: 'Comboio', key: 'comboio', width: 16 }, { header: 'Empresa', key: 'empresa', width: 22 },
        { header: 'Observação', key: 'observacao', width: 48 },
      ];
      conferencia.getRow(1).font = { bold: true };
      aConferir.forEach(linha => conferencia.addRow({ ...linha, data: dataCurta(linha.data) }));
    }
    await downloadCorporateWorkbook(workbook, arquivo);
  };

  const exportarRelatorioExcel = async () => {
    setExportandoHistorico('excel');
    try {
      await exportarPlanilha(relatorioCombustivel.linhasExcel, 'Relatório de combustível', `FORNECIMENTO DIESEL - RELATORIO ${hoje()}.xlsx`);
      setAviso(`${relatorioCombustivel.totalRegistros} registro(s) exportado(s) para Excel.`);
    } catch (falha) {
      setErro(falha instanceof Error ? `Falha ao exportar Excel: ${falha.message}` : 'Falha ao exportar Excel.');
    } finally {
      setExportandoHistorico('');
    }
  };

  const exportarHistoricoExcel = async ({ itens }: FiltrosExportacao) => {
    setExportandoHistorico('excel');
    try {
      const relatorio = buildFuelReport({ records: itens, equipamentos, empresas, comboios, combustiveis });
      await exportarPlanilha(relatorio.linhasExcel, 'Histórico de abastecimentos', `FORNECIMENTO DIESEL - ${hoje()}.xlsx`);
      setAviso(`${itens.length} registro(s) exportado(s) para Excel.`);
    } catch (falha) {
      setErro(falha instanceof Error ? `Falha ao exportar Excel: ${falha.message}` : 'Falha ao exportar Excel.');
    } finally {
      setExportandoHistorico('');
    }
  };

  const exportarHistoricoPdf = async ({ itens, filtros, periodo }: FiltrosExportacao) => {
    setExportandoHistorico('pdf');
    try {
      const relatorio = buildFuelReport({ records: itens, equipamentos, empresas, comboios, combustiveis });
      const maquinas = new Set(itens.map(item => item.equipamentoId || item.prefixoInformado).filter(Boolean)).size;
      const empresasNoFiltro = new Set(itens.map(item => porId.get(item.equipamentoId)?.empresaId).filter(Boolean)).size;
      const { generateUniversalPdfReport } = await import('../utils/universalPdfReport');
      await generateUniversalPdfReport({
        title: 'Histórico de Combustível', subtitle: `${itens.length} registro(s) no resultado filtrado`,
        orientation: 'landscape', period: periodo, filters: filtros,
        columns: [
          { header: 'Aba', dataKey: 'aba' }, { header: 'Linha', dataKey: 'linha' },
          { header: 'Data', dataKey: 'data' }, { header: 'Prefixo', dataKey: 'prefixo' },
          { header: 'Empresa', dataKey: 'empresa' }, { header: 'Comboio', dataKey: 'comboio' },
          { header: 'Combustível', dataKey: 'tipoCombustivel' }, { header: 'Litros', dataKey: 'litros' },
          { header: 'Bomba inicial', dataKey: 'bombaInicial' }, { header: 'Bomba final', dataKey: 'bombaFinal' },
          { header: 'KM', dataKey: 'kmInicial' }, { header: 'Horímetro', dataKey: 'horimetro' }, { header: 'Status', dataKey: 'status' },
        ],
        rows: relatorio.linhasExcel.map(linha => ({
          ...linha,
          data: dataCurta(linha.data),
          litros: litrosTexto(linha.litros),
          bombaInicial: typeof linha.bombaInicial === 'number' ? numeroTexto(linha.bombaInicial) : '',
          bombaFinal: typeof linha.bombaFinal === 'number' ? numeroTexto(linha.bombaFinal) : '',
          kmInicial: typeof linha.kmInicial === 'number' ? numeroTexto(linha.kmInicial) : '',
          horimetro: typeof linha.horimetro === 'number' ? numeroTexto(linha.horimetro) : '',
        })),
        summary: [
          { label: 'Registros', value: itens.length }, { label: 'Volume total', value: litrosTexto(relatorio.totalLitros) },
          { label: 'Equipamentos', value: maquinas }, { label: 'Empresas', value: empresasNoFiltro },
        ], fileName: `RENEA_historico_combustivel_${hoje()}.pdf`,
      });
      setAviso(`${itens.length} registro(s) exportado(s) para PDF.`);
    } catch (falha) {
      setErro(falha instanceof Error ? `Falha ao exportar PDF: ${falha.message}` : 'Falha ao exportar PDF.');
    } finally {
      setExportandoHistorico('');
    }
  };

  const abrirNovo = (pedido: { emEdicao?: Abastecimento; prefixo?: string; comboioId?: string; daLista?: boolean } = {}) => {
    if (view !== 'novo') setVistaAnterior(view);
    setLancamento({ chave: Date.now(), ...pedido });
    setAbaJanela('lancar');
    setErro('');
    setView('novo');
  };

  const fecharLancamento = () => {
    // Correção aberta pela lista da janela volta para a lista, não fecha tudo.
    if (lancamento.daLista && abaJanela === 'lancar') {
      setLancamento({ chave: Date.now() });
      setAbaJanela('lista');
      return;
    }
    setView(vistaAnterior === 'novo' ? 'resumo' : vistaAnterior);
  };

  const excluirConfirmado = () => {
    if (excluindo.length === 1) onDeleteAbastecimento(excluindo[0].id);
    else if (excluindo.length > 1) {
      if (onDeleteAbastecimentos) onDeleteAbastecimentos(excluindo.map(item => item.id));
      else setErro('Excluir vários de uma vez não está disponível nesta tela.');
    }
    if (excluindo.length) setAviso(excluindo.length === 1 ? 'Abastecimento excluído.' : `${excluindo.length} abastecimentos excluídos.`);
    setExcluindo([]);
  };
  useEffect(() => {
    if (!aviso) return undefined;
    const tempo = window.setTimeout(() => setAviso(''), 4000);
    return () => window.clearTimeout(tempo);
  }, [aviso]);

  useEffect(() => {
    const teclar = (event: KeyboardEvent) => {
      const alvo = event.target as HTMLElement | null;
      if (event.key === 'Escape' && telaCheia && !excluindo.length && !alvo?.matches('input, textarea, select')) {
        setTelaCheia(false);
        return;
      }
      if (view === 'novo' && abaJanela === 'lista' && event.key === 'Escape' && !excluindo.length && !alvo?.matches('input, textarea, select')) {
        fecharLancamento();
        return;
      }
      if (view === 'novo' || alvo?.matches('input, textarea, select, [contenteditable="true"]') || event.ctrlKey || event.metaKey || event.altKey || excluindo.length) return;
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        abrirNovo();
      } else if (event.key === '/') {
        event.preventDefault();
        setView('historico');
        window.setTimeout(() => buscaRef.current?.focus(), 60);
      }
    };
    document.addEventListener('keydown', teclar);
    return () => document.removeEventListener('keydown', teclar);
  });
  useGSAP(() => {
    const raiz = escopo.current;
    if (!raiz || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(raiz.querySelectorAll('[data-comb-reveal]'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: 'power3.out', clearProps: 'transform,opacity' });
  }, { scope: escopo, dependencies: [view, agrupamentoRelatorio] });

  const vistas = [['resumo', 'Resumo', Fuel], ['novo', 'Lançar', Plus], ['historico', 'Histórico', History], ['relatorio', 'Relatório', FileSpreadsheet], ['consumo', 'Por máquina', Gauge]] as const;
  const abasDashboard = [
    ['resumo', 'Resumo', PieChart],
    ['ranking', 'Ranking', BarChart3],
  ] as const;
  const gruposRelatorio = {
    competencia: relatorioCombustivel.porCompetencia,
    empresa: relatorioCombustivel.porEmpresa,
    equipamento: relatorioCombustivel.porEquipamento,
    comboio: relatorioCombustivel.porComboio,
    combustivel: relatorioCombustivel.porCombustivel,
  } satisfies Record<AgrupamentoRelatorio, FuelHistoryGroup[]>;
  const agrupamentosRelatorio = [
    ['competencia', 'Mês', CalendarDays],
    ['empresa', 'Empresa', PieChart],
    ['equipamento', 'Equipamento', Fuel],
    ['comboio', 'Comboio', History],
    ['combustivel', 'Combustível', Droplets],
  ] as const;
  const rankingDashboardCards: Array<{ titulo: string; grupos: FuelHistoryGroup[]; medida: 'litros' | 'registros'; ajuda: string }> = [
    { titulo: 'Top empresas', grupos: relatorioCombustivel.porEmpresa, medida: 'litros', ajuda: 'Ordenado por volume abastecido.' },
    { titulo: 'Top equipamentos', grupos: relatorioCombustivel.porEquipamento, medida: 'litros', ajuda: 'Ordenado por volume abastecido.' },
    { titulo: 'Comboios', grupos: relatorioCombustivel.porComboio, medida: 'registros', ajuda: 'Ordenado por quantidade de lançamentos.' },
    { titulo: 'Combustíveis', grupos: relatorioCombustivel.porCombustivel, medida: 'litros', ajuda: 'Ordenado por volume abastecido.' },
  ];

  return (
    <section ref={escopo} id="combustivel-tab" data-testid="combustivel-tab" aria-label="Combustível"
      className={`w-full max-w-none flex-col ${telaCheia ? 'fixed inset-0 z-40 block overflow-y-auto bg-[#f7f8f6] p-2 sm:p-3 xl:flex xl:overflow-hidden' : listaSomente ? 'flex h-[calc(100dvh-0.5rem)] overflow-hidden' : 'flex xl:h-[calc(100dvh-6rem)] xl:min-h-[34rem] xl:overflow-hidden'}`}>
      {!listaSomente && <div data-comb-reveal className="mb-2 shrink-0">
        <PageHeader eyebrow="Frota" title="Combustível" className={telaCheia ? 'mb-1' : 'mb-2'} actions={<>
          <button type="button" onClick={() => setTelaCheia(atual => !atual)} aria-pressed={telaCheia} title={telaCheia ? 'Sair da tela cheia (Esc)' : 'Usar a tela toda'} className={`${BOTAO_SECUNDARIO} size-10 justify-center px-0 sm:w-auto sm:px-3`} data-testid="combustivel-tela-cheia">
            {telaCheia ? <Minimize2 className="size-4" aria-hidden="true" /> : <Maximize2 className="size-4" aria-hidden="true" />}<span className="hidden sm:inline">{telaCheia ? 'Sair da tela cheia' : 'Tela cheia'}</span>
          </button>
          <button type="button" onClick={onOpenLubrificacao} aria-label="Lubrificação" title="Lubrificação" className={`${BOTAO_SECUNDARIO} size-10 justify-center px-0 sm:w-auto sm:px-3`}><Droplets className="size-4" aria-hidden="true" /><span className="hidden lg:inline">Lubrificação</span></button>
          <button type="button" onClick={() => abrirNovo()} className={`${BOTAO_PRIMARIO} min-h-10 px-3 sm:px-4`} data-testid="combustivel-novo"><Plus className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Novo abastecimento</span><span className="sm:hidden">Lançar</span><kbd title="Atalho de teclado: N" aria-label="Atalho de teclado: N" className="hidden rounded-md bg-white/15 px-1.5 font-mono text-xs sm:inline-flex">N</kbd></button>
        </>} />
        <nav aria-label="Área de combustível" className="grid w-full grid-cols-3 gap-1 rounded-xl bg-white p-1 ring-1 ring-inset ring-slate-200 sm:grid-cols-5">
          {vistas.map(([id, rotulo, Icone]) => <button key={id} type="button" aria-pressed={view === id} onClick={() => (id === 'novo' ? (view === 'novo' ? undefined : abrirNovo()) : setView(id))} data-testid={`combustivel-vista-${id}`} className={`inline-flex min-h-10 min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-1 text-xs font-bold sm:gap-2 sm:px-2 sm:text-sm transition sm:gap-2 ${view === id ? 'bg-[#176b4d] text-white shadow-sm' : 'text-slate-600 hover:bg-[#f7f8f6] hover:text-slate-900'} ${FOCO}`}><Icone className="size-4 shrink-0" aria-hidden="true" />{id === 'novo' && lancamento.emEdicao && view === 'novo' ? 'Corrigindo' : rotulo}</button>)}
        </nav>
      </div>}

      <p role="status" aria-live="polite" className={`${aviso ? 'mb-2' : 'sr-only'} flex shrink-0 items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900 ring-1 ring-inset ring-emerald-200`} data-testid="combustivel-aviso">
        {aviso && <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />}
        {aviso}
      </p>
      {view === 'resumo' && <div className="flex min-h-0 flex-1 flex-col gap-2" data-testid="combustivel-dashboard">
        <section className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 xl:flex xl:items-center xl:gap-5">
              {[
                ['Registros', relatorioCombustivel.totalRegistros.toLocaleString('pt-BR')],
                ['Litros', litrosTexto(relatorioCombustivel.totalLitros)],
                ['A conferir', relatorioCombustivel.totalConferencia.toLocaleString('pt-BR')],
                ['Equipamentos', relatorioCombustivel.porEquipamento.filter(item => item.litros > 0).length.toLocaleString('pt-BR')],
              ].map(([titulo, valor]) => <div key={titulo} className="min-w-0"><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{titulo}</p><p className="truncate text-lg font-black tabular-nums text-slate-950">{valor}</p></div>)}
            </div>
            <nav aria-label="Painéis do resumo de combustível" className="grid shrink-0 grid-cols-2 rounded-lg bg-slate-100 p-1 xl:w-80">
              {abasDashboard.map(([id, rotulo, Icone]) => <button key={id} type="button" aria-pressed={abaDashboard === id} onClick={() => setAbaDashboard(id)} className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-bold transition ${abaDashboard === id ? 'bg-white text-[#176b4d] shadow-sm' : 'text-slate-600 hover:text-slate-900'} ${FOCO}`}><Icone className="size-4" aria-hidden="true" />{rotulo}</button>)}
            </nav>
          </div>
        </section>
        {abaDashboard === 'resumo' && <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[1.15fr_0.85fr]" data-testid="combustivel-dashboard-consumo">
          <section className={`${CARTAO} flex min-h-0 flex-col overflow-hidden p-4`}>
            <header className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-950">Resumo operacional</h3>
                <p className="text-xs font-semibold text-slate-500">Leitura rápida do consumo e da conferência.</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-[#176b4d]">{relatorioCombustivel.totalConferencia ? `${relatorioCombustivel.totalConferencia} conferir` : 'Sem pendência'}</span>
            </header>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {[
                ['Volume total', litrosTexto(relatorioCombustivel.totalLitros)],
                ['Registros', relatorioCombustivel.totalRegistros.toLocaleString('pt-BR')],
                ['Média por lançamento', relatorioCombustivel.totalRegistros ? litrosTexto(relatorioCombustivel.totalLitros / relatorioCombustivel.totalRegistros) : '0 L'],
                ['Equipamentos', relatorioCombustivel.porEquipamento.filter(item => item.litros > 0).length.toLocaleString('pt-BR')],
                ['Empresas', relatorioCombustivel.porEmpresa.filter(item => item.litros > 0).length.toLocaleString('pt-BR')],
                ['Comboios', relatorioCombustivel.porComboio.filter(item => item.litros > 0).length.toLocaleString('pt-BR')],
              ].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3"><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 truncate text-xl font-black tabular-nums text-slate-950">{value}</p></div>)}
            </div>
            <div className="mt-4 grid min-h-0 flex-1 gap-2 lg:grid-cols-2">
              <GraficoRosca titulo="Empresas" grupos={relatorioCombustivel.porEmpresa} vazio="Sem abastecimentos por empresa." />
              <GraficoBarras titulo="Mês operacional" grupos={relatorioCombustivel.porCompetencia} medida="litros" vazio="Sem competência com lançamento." />
            </div>
          </section>
          <section className={`${CARTAO} flex min-h-0 flex-col overflow-hidden`}>
            <header className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-base font-black text-slate-950">Mês operacional</h3>
              <p className="text-xs font-semibold text-slate-500">Competência considera o período de 21 a 20.</p>
            </header>
            <RankingRelatorioCombustivel grupos={relatorioCombustivel.porCompetencia} medida="litros" />
          </section>
        </div>}
        {abaDashboard === 'ranking' && <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-2" data-testid="combustivel-dashboard-ranking">
          {rankingDashboardCards.map(({ titulo, grupos, medida, ajuda }) => <section key={titulo} className={`${CARTAO} flex min-h-0 flex-col overflow-hidden`}>
            <header className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-base font-black text-slate-950">{titulo}</h3>
              <p className="text-xs font-semibold text-slate-500">{ajuda}</p>
            </header>
            <RankingRelatorioCombustivel grupos={grupos} medida={medida} />
          </section>)}
        </div>}
      </div>}

      {view === 'consumo' && erro && <p role="alert" className="mb-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 ring-1 ring-inset ring-rose-200">{erro}</p>}
      {view === 'consumo' && <ConsumoPorMaquina abastecimentos={ativos} equipamentos={equipamentos} empresas={empresas} onErro={setErro} onAviso={setAviso} />}

      {view === 'relatorio' && <div className="flex min-h-0 flex-1 flex-col gap-2" data-testid="combustivel-relatorio">
        <section data-comb-reveal aria-label="Filtros do relatório de combustível" className="shrink-0 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
            <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-2 xl:grid-cols-[1.15fr_repeat(7,minmax(0,1fr))]">
            <label className="md:col-span-2 xl:col-span-1"><span className={`${ROTULO} mb-1 block`}>Busca</span><span className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input value={filtrosRelatorio.texto} onChange={event => setFiltrosRelatorio(atual => ({ ...atual, texto: event.target.value }))} placeholder="Prefixo, empresa, comboio, aba..." className={`${CAMPO} pl-9`} /></span></label>
            <label><span className={`${ROTULO} mb-1 block`}>Competência</span><select value={filtrosRelatorio.competencia} onChange={event => setFiltrosRelatorio(atual => ({ ...atual, competencia: event.target.value }))} className={CAMPO}><option value="">Todas</option>{competenciasDisponiveis.map(item => <option key={item.chave} value={item.chave}>{item.rotulo}</option>)}</select></label>
            <label><span className={`${ROTULO} mb-1 block`}>Data inicial</span><input type="date" value={filtrosRelatorio.dataInicio} onChange={event => setFiltrosRelatorio(atual => ({ ...atual, dataInicio: event.target.value }))} className={CAMPO} /></label>
            <label><span className={`${ROTULO} mb-1 block`}>Data final</span><input type="date" value={filtrosRelatorio.dataFim} onChange={event => setFiltrosRelatorio(atual => ({ ...atual, dataFim: event.target.value }))} className={CAMPO} /></label>
            <label><span className={`${ROTULO} mb-1 block`}>Empresa</span><select value={filtrosRelatorio.empresaId} onChange={event => setFiltrosRelatorio(atual => ({ ...atual, empresaId: event.target.value }))} className={CAMPO}><option value="">Todas</option>{empresas.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
            <label><span className={`${ROTULO} mb-1 block`}>Equipamento</span><select value={filtrosRelatorio.equipamentoId} onChange={event => setFiltrosRelatorio(atual => ({ ...atual, equipamentoId: event.target.value }))} className={CAMPO}><option value="">Todos</option>{equipamentos.map(item => <option key={item.id} value={item.id}>{item.prefixo} · {item.nome}</option>)}</select></label>
            <label><span className={`${ROTULO} mb-1 block`}>Comboio</span><select value={filtrosRelatorio.comboioId} onChange={event => setFiltrosRelatorio(atual => ({ ...atual, comboioId: event.target.value }))} className={CAMPO}><option value="">Todos</option>{comboios.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
            <label><span className={`${ROTULO} mb-1 block`}>Combustível</span><select value={filtrosRelatorio.combustivelId} onChange={event => setFiltrosRelatorio(atual => ({ ...atual, combustivelId: event.target.value }))} className={CAMPO}><option value="">Todos</option>{combustiveis.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
            </div>
            <span className="grid shrink-0 grid-cols-2 gap-2 xl:w-56">
              <button type="button" onClick={exportarRelatorioExcel} disabled={Boolean(exportandoHistorico)} className={`${BOTAO_PRIMARIO} min-h-10 justify-center px-3`}><Download className="size-4" aria-hidden="true" />{exportandoHistorico === 'excel' ? 'Gerando...' : 'Excel'}</button>
              <button type="button" onClick={() => setFiltrosRelatorio(FILTROS_RELATORIO_VAZIOS)} disabled={!Object.values(filtrosRelatorio).some(Boolean)} title="Limpar filtros do relatório" className={`${BOTAO_SECUNDARIO} min-h-10 justify-center px-3`}><RotateCcw className="size-4" aria-hidden="true" />Limpar</button>
            </span>
          </div>
        </section>
        <div className="grid shrink-0 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Lançamentos', relatorioCombustivel.totalRegistros.toLocaleString('pt-BR')],
            ['Volume abastecido', litrosTexto(relatorioCombustivel.totalLitros)],
            ['Conferência', relatorioCombustivel.totalConferencia.toLocaleString('pt-BR')],
            ['Equipamentos', relatorioCombustivel.porEquipamento.filter(item => item.litros > 0).length.toLocaleString('pt-BR')],
          ].map(([titulo, valor]) => <div key={titulo} data-comb-reveal className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{titulo}</p><p className="mt-1 text-xl font-black tabular-nums text-slate-950">{valor}</p></div>)}
        </div>
        <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)]">
          <section data-comb-reveal className={`${CARTAO} flex min-h-0 flex-col overflow-hidden`}>
            <header className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-black text-slate-900">Agrupamento</h3>
              <nav aria-label="Agrupar relatório de combustível" className="mt-3 grid grid-cols-2 gap-2">
                {agrupamentosRelatorio.map(([id, rotulo, Icone]) => <button key={id} type="button" aria-pressed={agrupamentoRelatorio === id} onClick={() => setAgrupamentoRelatorio(id)} className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border px-2 text-xs font-bold ${agrupamentoRelatorio === id ? 'border-[#176b4d] bg-emerald-50 text-[#176b4d]' : 'border-slate-200 bg-white text-slate-600'} ${FOCO}`}><Icone className="size-4" aria-hidden="true" />{rotulo}</button>)}
              </nav>
            </header>
            <RankingRelatorioCombustivel grupos={gruposRelatorio[agrupamentoRelatorio]} medida={agrupamentoRelatorio === 'comboio' ? 'registros' : 'litros'} />
          </section>
          <PainelLinhasCombustivel linhas={relatorioCombustivel.linhasExcel.slice(0, 160)} total={relatorioCombustivel.linhasExcel.length} />
        </div>
      </div>}

      {view === 'novo' && createPortal(
        <section aria-labelledby="janela-lancamento-titulo" className="fixed inset-0 z-[100] flex flex-col bg-[#f7f8f6]" data-testid="combustivel-janela">
          <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 bg-white px-3 py-2 sm:px-6">
            <span className="hidden size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-[#176b4d] sm:grid"><Fuel className="size-5" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1 md:flex-none">
              <h2 id="janela-lancamento-titulo" className="truncate text-base font-black text-slate-950 sm:text-lg">{lancamento.emEdicao && abaJanela === 'lancar' ? 'Corrigir abastecimento' : 'Lançamento de abastecimento'}</h2>
              <p className="hidden truncate text-xs font-semibold text-slate-500 sm:block">Fornecimento diesel · Enter passa de campo · Ctrl + S salva · Esc fecha</p>
            </div>
            <button type="button" onClick={fecharLancamento} aria-label="Fechar" title="Fechar (Esc)" className={`${BOTAO_SECUNDARIO} order-2 size-11 shrink-0 px-0 md:order-3`}><X className="size-5" aria-hidden="true" /></button>
            <nav aria-label="Lançar ou ver lançamentos" className="order-3 grid w-full grid-cols-2 gap-1 rounded-xl bg-[#f7f8f6] p-1 ring-1 ring-inset ring-slate-200 md:order-2 md:mx-auto md:w-auto md:min-w-[22rem]">
              {([['lancar', 'Lançar', Plus], ['lista', 'Ver lançamentos', History]] as const).map(([id, rotulo, Icone]) => (
                <button key={id} type="button" aria-pressed={abaJanela === id} onClick={() => setAbaJanela(id)} data-testid={`combustivel-janela-${id}`}
                  className={`inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-bold transition ${abaJanela === id ? 'bg-[#176b4d] text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-900'} ${FOCO}`}>
                  <Icone className="size-4" aria-hidden="true" />{rotulo}
                </button>
              ))}
            </nav>
          </header>
          <p role="status" aria-live="polite" className={`${aviso ? 'mx-3 mt-2 sm:mx-6' : 'sr-only'} flex shrink-0 items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 ring-1 ring-inset ring-emerald-200`}>
            {aviso && <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />}
            {aviso}
          </p>
          {abaJanela === 'lancar' ? (
            <LancamentoCombustivel
              key={lancamento.chave}
              abastecimentos={ativos}
              equipamentos={equipamentos}
              empresas={empresas}
              comboios={comboios}
              combustiveis={combustiveis}
              registros={registros}
              gruposEquipe={gruposEquipe}
              usuario={usuario}
              emEdicao={lancamento.emEdicao}
              prefixoInicial={lancamento.prefixo}
              comboioInicial={lancamento.comboioId}
              onSalvar={onSaveAbastecimento}
              onFechar={fecharLancamento}
              onAviso={setAviso}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col px-2 py-2 sm:px-4">
              <HistoricoCombustivel
                abastecimentos={ativos}
                equipamentos={equipamentos}
                empresas={empresas}
                comboios={comboios}
                combustiveis={combustiveis}
                buscaRef={buscaRef}
                exportando={exportandoHistorico}
                isParsingSpreadsheet={isParsingSpreadsheet}
                compacto
                onImportar={onOpenSpreadsheetImport}
                onExportarExcel={dados => void exportarHistoricoExcel(dados)}
                onExportarPdf={dados => void exportarHistoricoPdf(dados)}
                onEditar={item => abrirNovo({ emEdicao: item, daLista: true })}
                onRepetir={item => abrirNovo({ prefixo: porId.get(item.equipamentoId)?.prefixo || item.prefixoInformado || '', comboioId: item.comboioId, daLista: true })}
                onExcluir={setExcluindo}
              />
            </div>
          )}
        </section>,
        document.body,
      )}

      {view === 'historico' && (
        <>
          {erro && <p role="alert" className="mb-2 shrink-0 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 ring-1 ring-inset ring-rose-200" data-testid="combustivel-erro">{erro}</p>}
          <HistoricoCombustivel
            abastecimentos={ativos}
            equipamentos={equipamentos}
            empresas={empresas}
            comboios={comboios}
            combustiveis={combustiveis}
            buscaRef={buscaRef}
            exportando={exportandoHistorico}
            isParsingSpreadsheet={isParsingSpreadsheet}
            compacto={listaSomente}
            onImportar={onOpenSpreadsheetImport}
            onExportarExcel={dados => void exportarHistoricoExcel(dados)}
            onExportarPdf={dados => void exportarHistoricoPdf(dados)}
            onEditar={item => abrirNovo({ emEdicao: item })}
            onRepetir={item => abrirNovo({ prefixo: porId.get(item.equipamentoId)?.prefixo || item.prefixoInformado || '', comboioId: item.comboioId })}
            onExcluir={setExcluindo}
          />
        </>
      )}

      <ConfirmDialog
        open={excluindo.length > 0}
        title={excluindo.length > 1 ? `Excluir ${excluindo.length} abastecimentos?` : `Excluir o abastecimento de ${excluindo[0] ? porId.get(excluindo[0].equipamentoId)?.prefixo || excluindo[0].prefixoInformado || 'máquina' : ''}?`}
        description={excluindo.length > 1 ? `Somam ${litrosTexto(excluindo.reduce((soma, item) => soma + Number(item.quantidadeLitros || 0), 0))}. Os registros são apagados e não voltam pela sincronização.` : 'O registro é apagado e não volta pela sincronização.'}
        confirmLabel={excluindo.length > 1 ? `Excluir ${excluindo.length}` : 'Excluir abastecimento'}
        tone="danger"
        onCancel={() => setExcluindo([])}
        onConfirm={excluirConfirmado}
      />
    </section>
  );
}
function GraficoRosca({ titulo, grupos, vazio }: { titulo: string; grupos: FuelHistoryGroup[]; vazio: string }) {
  const dados = grupos.filter(item => item.litros > 0).slice(0, 6);
  let acumulado = 0;
  const fatias = dados.map((item, indice) => {
    const inicio = acumulado;
    acumulado += item.percentual;
    return `${CORES_GRAFICO_COMBUSTIVEL[indice % CORES_GRAFICO_COMBUSTIVEL.length]} ${inicio}% ${acumulado}%`;
  });

  return <section className={`${CARTAO} flex min-h-0 flex-col overflow-hidden p-3`}>
    <h3 className="shrink-0 truncate text-xs font-bold text-slate-800 sm:text-sm">{titulo}</h3>
    {dados.length === 0 ? <p className="grid min-h-0 flex-1 place-items-center text-center text-xs text-slate-500">{vazio}</p> : <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] items-center gap-2 pt-2">
      <div className="grid min-h-0 place-items-center">
        <div role="img" aria-label={`${titulo}: ${dados.map(item => `${item.nome} ${item.percentual}%`).join(', ')}`} className="relative aspect-square h-full max-h-36 rounded-full" style={{ background: `conic-gradient(${fatias.join(', ')})` }}>
          <div className="absolute inset-[24%] grid place-content-center rounded-full bg-white text-center"><span className="text-sm font-black tabular-nums text-slate-900">{litrosTexto(grupos.reduce((soma, item) => soma + item.litros, 0))}</span><span className="text-[9px] text-slate-500">total</span></div>
        </div>
      </div>
      <ul className="grid gap-x-2 gap-y-1 sm:grid-cols-2">
        {dados.slice(0, 4).map((item, indice) => <li key={item.chave} className="flex min-w-0 items-center gap-1.5 text-[10px]" title={`${item.nome}: ${litrosTexto(item.litros)} (${item.percentual}%)`}>
          <span className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: CORES_GRAFICO_COMBUSTIVEL[indice % CORES_GRAFICO_COMBUSTIVEL.length] }} /><span className="min-w-0 flex-1 truncate text-slate-600">{item.nome}</span><span className="shrink-0 font-semibold tabular-nums text-slate-800">{item.percentual}%</span>
        </li>)}
      </ul>
    </div>}
  </section>;
}

function RankingRelatorioCombustivel({ grupos, medida }: { grupos: FuelHistoryGroup[]; medida: 'litros' | 'registros' }) {
  const maior = Math.max(1, ...grupos.map(item => medida === 'litros' ? item.litros : item.registros));
  return <div className="min-h-0 flex-1 overflow-auto p-3">
    {grupos.length === 0 ? <p className="grid min-h-52 place-items-center text-center text-sm text-slate-500">Sem dados para o agrupamento selecionado.</p> : <ol className="space-y-2">
      {grupos.slice(0, 30).map((grupo, index) => {
        const valor = medida === 'litros' ? grupo.litros : grupo.registros;
        return <li key={grupo.chave} data-comb-reveal className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">#{index + 1}</p>
              <p className="truncate text-sm font-black text-slate-950" title={grupo.nome}>{grupo.nome}</p>
              <p className="text-xs text-slate-500">{grupo.registros.toLocaleString('pt-BR')} registro(s) · {grupo.percentual}%</p>
            </div>
            <strong className="shrink-0 text-right text-sm font-black tabular-nums text-[#176b4d]">{medida === 'litros' ? litrosTexto(grupo.litros) : grupo.registros.toLocaleString('pt-BR')}</strong>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-[#176b4d]" style={{ width: `${Math.max(4, valor / maior * 100)}%` }} /></div>
        </li>;
      })}
    </ol>}
  </div>;
}

function PainelLinhasCombustivel({ linhas, total }: { linhas: FuelReportExcelRow[]; total: number }) {
  return <section className={`${CARTAO} flex min-h-0 flex-1 flex-col overflow-hidden`} data-testid="combustivel-linhas-relatorio">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
      <div>
        <h3 className="text-sm font-black text-slate-900">Lançamentos do relatório</h3>
        <p className="text-xs text-slate-500">{linhas.length.toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')} linha(s) exibidas</p>
      </div>
      {total > linhas.length && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Use os filtros para refinar</span>}
    </header>
    {linhas.length === 0 ? <div className="grid min-h-0 flex-1 place-items-center px-4 py-12 text-center text-sm text-slate-500">Nenhum lançamento encontrado para os filtros atuais.</div> : <div className="min-h-0 flex-1 overflow-auto p-3">
      <ol className="grid gap-2 xl:grid-cols-2">
        {linhas.map((linha, index) => <li key={`${linha.aba}-${linha.linha}-${linha.prefixo}-${linha.data}-${index}`} data-comb-reveal className={`rounded-xl border p-3 ${linha.status === 'Conferência necessária' ? 'border-amber-200 bg-amber-50/70' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-500">{dataCurta(linha.data)} · {linha.hora || 'Sem hora'} · {linha.aba}</p>
              <h4 className="mt-1 truncate font-mono text-lg font-black text-slate-950">{linha.prefixo || 'Sem prefixo'}</h4>
              <p className="truncate text-sm text-slate-600" title={linha.descricao}>{linha.descricao || 'Equipamento não informado'}</p>
            </div>
            <strong className="shrink-0 text-xl font-black tabular-nums text-[#176b4d]">{litrosTexto(linha.litros)}</strong>
          </div>
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
            <div><dt className="font-black uppercase text-slate-400">Comboio</dt><dd className="truncate font-semibold text-slate-700">{linha.comboio || '—'}</dd></div>
            <div><dt className="font-black uppercase text-slate-400">Combustível</dt><dd className="truncate font-semibold text-slate-700">{linha.tipoCombustivel || '—'}</dd></div>
            <div><dt className="font-black uppercase text-slate-400">Empresa</dt><dd className="truncate font-semibold text-slate-700">{linha.empresa || '—'}</dd></div>
            <div><dt className="font-black uppercase text-slate-400">Bomba</dt><dd className="font-mono text-slate-700">{typeof linha.bombaInicial === 'number' ? numeroTexto(linha.bombaInicial) : '—'} → {typeof linha.bombaFinal === 'number' ? numeroTexto(linha.bombaFinal) : '—'}</dd></div>
            <div><dt className="font-black uppercase text-slate-400">KM</dt><dd className="font-mono text-slate-700">{typeof linha.kmInicial === 'number' ? numeroTexto(linha.kmInicial) : '—'}</dd></div>
            <div><dt className="font-black uppercase text-slate-400">Horímetro</dt><dd className="font-mono text-slate-700">{typeof linha.horimetro === 'number' ? numeroTexto(linha.horimetro) : '—'}</dd></div>
          </dl>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500">Linha {linha.linha || '—'}</span>
            {linha.status === 'Conferência necessária' ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-900">Conferir</span> : <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-800">{linha.status || 'OK'}</span>}
          </div>
        </li>)}
      </ol>
    </div>}
  </section>;
}

function GraficoBarras({ titulo, grupos, medida, vazio }: { titulo: string; grupos: FuelHistoryGroup[]; medida: 'litros' | 'registros'; vazio: string }) {
  const dados = grupos.filter(item => item[medida] > 0).slice(0, 6);
  const maior = Math.max(1, ...dados.map(item => item[medida]));
  return <section className={`${CARTAO} flex min-h-0 flex-col overflow-hidden p-3`}>
    <h3 className="shrink-0 truncate text-xs font-bold text-slate-800 sm:text-sm">{titulo}</h3>
    {dados.length === 0 ? <p className="grid min-h-0 flex-1 place-items-center text-center text-xs text-slate-500">{vazio}</p> : <ol className="mt-2 grid min-h-0 flex-1 content-evenly gap-2 overflow-hidden">
      {dados.map((item, indice) => <li key={item.chave} className="min-w-0" title={`${item.nome}: ${medida === 'litros' ? litrosTexto(item.litros) : `${item.registros} lançamentos`}`}>
        <div className="mb-0.5 flex min-w-0 items-center justify-between gap-2 text-[10px]"><span className="min-w-0 truncate font-medium text-slate-700">{indice + 1}. {item.nome}</span><span className="shrink-0 font-bold tabular-nums text-slate-900">{medida === 'litros' ? litrosTexto(item.litros) : item.registros}</span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${Math.max(3, item[medida] / maior * 100)}%`, backgroundColor: CORES_GRAFICO_COMBUSTIVEL[indice % CORES_GRAFICO_COMBUSTIVEL.length] }} /></div>
      </li>)}
    </ol>}
  </section>;
}
