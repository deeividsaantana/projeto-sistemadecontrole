/**
 * Combustível: lançar o abastecimento com o fluxo da planilha macro.
 * A máquina ainda consulta as últimas leituras do controle, mas o cadastro
 * rápido fica focado em prefixo, litros, comboio, combustível e bomba.
 *
 * Teclas, fora de campo de texto: N novo abastecimento, / busca no histórico.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { CheckCircle2, Droplets, Gauge, History, Maximize2, Minimize2, Plus } from 'lucide-react';
import type { Abastecimento, Comboio, ControleEquipamentoDiario, Empresa, Equipamento, GrupoEquipe, TipoCombustivel } from '../types';
import type { FuelImportedMasterData } from '../utils/fuelMasterDataImport';
import { ConfirmDialog, isoDay } from '../shared/ui';
import { PageHeader } from '../shared/ui/PageHeader';
import { BOTAO_SECUNDARIO, FOCO } from './cadastros/estilos';
import ConsumoPorMaquina from './combustivel/ConsumoPorMaquina';
import HistoricoCombustivel, { type FiltrosExportacao } from './combustivel/HistoricoCombustivel';
import LancamentoCombustivel from './combustivel/LancamentoCombustivel';
import { buildFuelReport, type FuelReportExcelRow } from '../modules/frota/fuelReport';

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

/** Duas telas só: lançar e ver os lançamentos (com o consumo no topo). */
type View = 'novo' | 'historico';

const CHAVE_TELA_CHEIA = 'renea_combustivel_tela_cheia_v1';

const hoje = () => isoDay(new Date());
const dataCurta = (dia: string) => dia ? new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem data';
const litrosTexto = (valor: number) => `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`;
const numeroTexto = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

export default function CombustivelOperacionalTab({
  empresas, equipamentos, comboios, combustiveis, abastecimentos, registros = [], gruposEquipe = [], usuario = '',
  onSaveAbastecimento, onDeleteAbastecimento, onDeleteAbastecimentos, onOpenLubrificacao, onOpenSpreadsheetImport, isParsingSpreadsheet,
  openHistorySignal = 0, initialView = 'historico', listaSomente = false,
}: Props) {
  const escopo = useRef<HTMLElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>(listaSomente ? 'historico' : initialView);
  const [porMaquina, setPorMaquina] = useState(false);
  const [exportandoHistorico, setExportandoHistorico] = useState<'' | 'excel' | 'pdf'>('');
  const [excluindo, setExcluindo] = useState<Abastecimento[]>([]);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  /** Lançamento aberto: a chave remonta o formulário a cada novo pedido. */
  const [lancamento, setLancamento] = useState<{ chave: number; emEdicao?: Abastecimento; prefixo?: string; comboioId?: string }>({ chave: 0 });
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

  const abrirNovo = (pedido: { emEdicao?: Abastecimento; prefixo?: string; comboioId?: string } = {}) => {
    setLancamento({ chave: Date.now(), ...pedido });
    setErro('');
    setView('novo');
  };

  const fecharLancamento = () => {
    setLancamento({ chave: Date.now() });
    setView('historico');
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
  }, { scope: escopo, dependencies: [view, porMaquina] });

  /** Números do topo da lista: o que a pessoa quer saber de relance. */
  const numeros = useMemo(() => {
    const dia = hoje();
    const mes = dia.slice(0, 7);
    const soma = (lista: Abastecimento[]) => lista.reduce((total, item) => total + Number(item.quantidadeLitros || 0), 0);
    const doDia = ativos.filter(item => item.data === dia);
    const doMes = ativos.filter(item => String(item.data || '').startsWith(mes));
    return {
      litrosHoje: soma(doDia),
      lancamentosHoje: doDia.length,
      litrosMes: soma(doMes),
      maquinasMes: new Set(doMes.map(item => item.equipamentoId || item.prefixoInformado).filter(Boolean)).size,
      aConferir: ativos.filter(item => item.status === 'Conferência necessária').length,
    };
  }, [ativos]);

  const vistas = [['novo', 'Lançar', Plus], ['historico', 'Lançamentos', History]] as const;
  const cartoes = [
    { titulo: 'Hoje', valor: litrosTexto(numeros.litrosHoje), detalhe: `${numeros.lancamentosHoje} lançamento(s)` },
    { titulo: 'Mês', valor: litrosTexto(numeros.litrosMes), detalhe: `${numeros.maquinasMes} máquina(s)` },
    { titulo: 'A conferir', valor: numeros.aConferir.toLocaleString('pt-BR'), detalhe: numeros.aConferir ? 'Abra e corrija' : 'Tudo certo', alerta: numeros.aConferir > 0 },
  ];

  return (
    <section ref={escopo} id="combustivel-tab" data-testid="combustivel-tab" aria-label="Combustível"
      className={`w-full max-w-none flex-col ${telaCheia ? 'fixed inset-0 z-[90] block overflow-y-auto bg-[#f7f8f6] p-2 sm:p-3 xl:flex xl:overflow-hidden' : listaSomente ? 'flex h-[calc(100dvh-0.5rem)] overflow-hidden' : 'flex xl:h-[calc(100dvh-6.5rem)] xl:min-h-[34rem] xl:overflow-hidden'}`}>
      {!listaSomente && <div data-comb-reveal className="mb-1.5 shrink-0">
        <PageHeader title="Combustível" className="mb-0 !items-center !gap-2 !p-0 [&_h1]:!text-lg [&_.renea-page-actions]:!flex-wrap" actions={<>
          <nav aria-label="Área de combustível" className="grid grid-cols-2 gap-1 rounded-xl bg-white p-1 ring-1 ring-inset ring-slate-200">
            {vistas.map(([id, rotulo, Icone]) => <button key={id} type="button" aria-pressed={view === id} onClick={() => (id === 'novo' ? (view === 'novo' ? undefined : abrirNovo()) : setView(id))} data-testid={`combustivel-vista-${id}`} className={`inline-flex min-h-9 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-bold transition ${view === id ? 'bg-[#176b4d] text-white shadow-sm' : 'text-slate-600 hover:bg-[#f7f8f6] hover:text-slate-900'} ${FOCO}`}><Icone className="size-4 shrink-0" aria-hidden="true" />{id === 'novo' && lancamento.emEdicao && view === 'novo' ? 'Corrigindo' : rotulo}</button>)}
          </nav>
          {view === 'historico' && <ul className="hidden min-w-0 flex-wrap items-center gap-1.5 md:flex" data-testid="combustivel-numeros">
            {cartoes.map(cartao => <li key={cartao.titulo} title={cartao.detalhe} className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 ring-inset ${cartao.alerta ? 'bg-amber-50 text-amber-900 ring-amber-200' : 'bg-white text-slate-600 ring-slate-200'}`}>
              {cartao.titulo} <strong className="tabular-nums text-slate-950">{cartao.valor}</strong>
            </li>)}
          </ul>}
          {view === 'historico' && <button type="button" aria-pressed={porMaquina} onClick={() => setPorMaquina(atual => !atual)} title={porMaquina ? 'Voltar para a lista' : 'Consumo por máquina'} className={`${BOTAO_SECUNDARIO} min-h-9 px-2.5`} data-testid="combustivel-por-maquina">
            {porMaquina ? <History className="size-4" aria-hidden="true" /> : <Gauge className="size-4" aria-hidden="true" />}<span className="hidden xl:inline">{porMaquina ? 'Lista' : 'Por máquina'}</span>
          </button>}
          <button type="button" onClick={() => setTelaCheia(atual => !atual)} aria-pressed={telaCheia} aria-label={telaCheia ? 'Sair da tela cheia' : 'Tela cheia'} title={telaCheia ? 'Sair da tela cheia (Esc)' : 'Usar a tela toda'} className={`${BOTAO_SECUNDARIO} hidden size-9 shrink-0 justify-center !px-0 sm:inline-flex`} data-testid="combustivel-tela-cheia">
            {telaCheia ? <Minimize2 className="size-4 shrink-0" aria-hidden="true" /> : <Maximize2 className="size-4 shrink-0" aria-hidden="true" />}
          </button>
          <button type="button" onClick={onOpenLubrificacao} aria-label="Lubrificação" title="Lubrificação" className={`${BOTAO_SECUNDARIO} size-9 shrink-0 justify-center !px-0`}><Droplets className="size-4 shrink-0" aria-hidden="true" /></button>
        </>} />
      </div>}

      <p role="status" aria-live="polite" className={`${aviso ? 'mb-2' : 'sr-only'} flex shrink-0 items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900 ring-1 ring-inset ring-emerald-200`} data-testid="combustivel-aviso">
        {aviso && <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />}
        {aviso}
      </p>

      {view === 'novo' && <div data-comb-reveal className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-white ring-1 ring-inset ring-slate-200" data-testid="combustivel-lancar">
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
      </div>}

      {view === 'historico' && (
        <>
          {erro && <p role="alert" className="mb-2 shrink-0 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 ring-1 ring-inset ring-rose-200" data-testid="combustivel-erro">{erro}</p>}
          {porMaquina && !listaSomente
            ? <ConsumoPorMaquina abastecimentos={ativos} equipamentos={equipamentos} empresas={empresas} onErro={setErro} onAviso={setAviso} />
            : <HistoricoCombustivel
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
            />}
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
