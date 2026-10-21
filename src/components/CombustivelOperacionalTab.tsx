/**
 * Combustível: lançar o abastecimento com o fluxo da planilha macro, ver a
 * lista no modelo da planilha e os relatórios. A máquina ainda consulta as
 * últimas leituras do controle, mas o cadastro rápido fica focado em prefixo,
 * litros, comboio, combustível e bomba. Lançamento repetido no dia trava, e
 * vários marcados na lista mudam de data de uma vez, com Desfazer.
 *
 * Teclas, fora de campo de texto: N novo abastecimento, / busca no histórico,
 * R relatórios.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { BarChart3, CheckCircle2, Droplets, History, Plus, Undo2 } from 'lucide-react';
import type { Abastecimento, Comboio, ControleEquipamentoDiario, Empresa, Equipamento, GrupoEquipe, TipoCombustivel } from '../types';
import type { FuelImportedMasterData } from '../utils/fuelMasterDataImport';
import { ConfirmDialog, isoDay } from '../shared/ui';
import { PageHeader } from '../shared/ui/PageHeader';
import { AbasDaTela, idDaAba } from '../shared/ui/AbasDaTela';
import { TelaCheia } from '../shared/ui/TelaCheia';
import { BOTAO_SECUNDARIO, FOCO } from './cadastros/estilos';
import HistoricoCombustivel, { type FiltrosExportacao, type PedidoFiltro } from './combustivel/HistoricoCombustivel';
import LancamentoCombustivel from './combustivel/LancamentoCombustivel';
import RelatorioDiesel from './combustivel/RelatorioDiesel';
import TrocarDataLote from './combustivel/TrocarDataLote';
import { buildFuelReport, type FuelReportExcelRow } from '../modules/frota/fuelReport';
import { ligarPeloPrefixo } from '../modules/frota/vinculoPrefixo';
import { trocarData } from '../modules/frota/repetidosDiesel';

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
  /** Grava vários de uma vez (trocar data em lote); sem ele, a lista não mostra Trocar data. */
  onSaveAbastecimentos?: (itens: Abastecimento[], descricao: string) => void;
  /** Sem os de excluir, a tela não mostra Excluir: só o administrador exclui (A7). */
  onDeleteAbastecimento?: (id: string) => void;
  /** Manda para a Lixeira e devolve as exclusões; sem ele, o histórico só exclui um por vez. */
  onDeleteAbastecimentos?: (ids: string[]) => string[];
  /** Desfazer a exclusão: devolve da Lixeira. */
  onRestaurarAbastecimentos?: (exclusaoIds: string[]) => { ok: boolean; mensagem: string };
  onImportAbastecimentos?: (items: Abastecimento[], combustiveisImportados?: TipoCombustivel[], cadastrosImportados?: Partial<FuelImportedMasterData>) => void;
  onOpenLubrificacao: () => void;
  onOpenCadastros?: () => void;
  onOpenControle?: () => void;
  onOpenSpreadsheetImport: () => void;
  isParsingSpreadsheet: boolean;
  openHistorySignal?: number;
  initialView?: View;
  listaSomente?: boolean;
  /** Abre já no consumo por máquina (pedido pela aba Relatórios). */
  porMaquinaInicial?: boolean;
}

/** Três telas: lançar, ver os lançamentos e os relatórios (com o consumo por máquina dentro). */
type View = 'novo' | 'historico' | 'relatorios';

const hoje = () => isoDay(new Date());
const dataCurta = (dia: string) => dia ? new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem data';
const litrosTexto = (valor: number) => `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`;
const numeroTexto = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

export default function CombustivelOperacionalTab({
  empresas, equipamentos, comboios, combustiveis, abastecimentos, registros = [], gruposEquipe = [], usuario = '',
  onSaveAbastecimento, onSaveAbastecimentos, onDeleteAbastecimento, onDeleteAbastecimentos, onRestaurarAbastecimentos, onOpenLubrificacao, onOpenSpreadsheetImport, isParsingSpreadsheet,
  openHistorySignal = 0, initialView = 'historico', listaSomente = false, porMaquinaInicial = false,
}: Props) {
  const escopo = useRef<HTMLElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>(listaSomente ? 'historico' : porMaquinaInicial ? 'relatorios' : initialView);
  /** Filtro pedido pelo relatório; a lista aplica quando a chave muda. */
  const [pedidoFiltro, setPedidoFiltro] = useState<PedidoFiltro | undefined>();
  const [trocandoData, setTrocandoData] = useState<Abastecimento[]>([]);
  const [exportandoHistorico, setExportandoHistorico] = useState<'' | 'excel' | 'pdf'>('');
  const [excluindo, setExcluindo] = useState<Abastecimento[]>([]);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  /** Exclusões que o Desfazer do aviso ainda devolve. */
  const [desfazer, setDesfazer] = useState<string[]>([]);
  /** Como estavam antes da troca de data, para o Desfazer devolver. */
  const [datasAntigas, setDatasAntigas] = useState<Abastecimento[]>([]);
  const avisoRef = useRef<HTMLParagraphElement>(null);
  /** Lançamento aberto: a chave remonta o formulário a cada novo pedido. */
  const [lancamento, setLancamento] = useState<{ chave: number; emEdicao?: Abastecimento; prefixo?: string; comboioId?: string }>({ chave: 0 });

  useEffect(() => {
    if (openHistorySignal > 0) setView('historico');
  }, [openHistorySignal]);

  useEffect(() => {
    if (listaSomente) setView('historico');
  }, [listaSomente]);

  const ativos = useMemo(() => ligarPeloPrefixo(abastecimentos
    .filter(item => !item.inativoEm && item.status !== 'Cancelado'), equipamentos)
    .sort((a, b) => `${b.data}${b.hora}`.localeCompare(`${a.data}${a.hora}`)), [abastecimentos, equipamentos]);
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
    let exclusoes: string[] = [];
    if (onDeleteAbastecimentos && excluindo.length) exclusoes = onDeleteAbastecimentos(excluindo.map(item => item.id));
    else if (excluindo.length === 1 && onDeleteAbastecimento) onDeleteAbastecimento(excluindo[0].id);
    else if (excluindo.length > 1) setErro('Excluir vários de uma vez não está disponível nesta tela.');
    if (excluindo.length) setAviso(excluindo.length === 1 ? 'Abastecimento excluído.' : `${excluindo.length} abastecimentos excluídos.`);
    setDesfazer(onRestaurarAbastecimentos ? exclusoes : []);
    setDatasAntigas([]);
    setExcluindo([]);
  };
  const trocarDataConfirmada = (novaData: string) => {
    if (!onSaveAbastecimentos) return;
    const mudar = trocandoData.filter(item => item.data !== novaData);
    if (mudar.length) {
      const dia = new Date(`${novaData}T12:00:00`).toLocaleDateString('pt-BR');
      onSaveAbastecimentos(trocarData(mudar, novaData, new Date().toISOString()), `Trocou a data de ${mudar.length} abastecimento(s) para ${dia}.`);
      setAviso(mudar.length === 1 ? `Abastecimento levado para ${dia}.` : `${mudar.length} abastecimentos levados para ${dia}.`);
      setDatasAntigas(mudar);
      setDesfazer([]);
    }
    setTrocandoData([]);
  };
  const desfazerTrocaDeData = () => {
    if (!onSaveAbastecimentos || !datasAntigas.length) return;
    onSaveAbastecimentos(datasAntigas.map(item => ({ ...item, atualizadoEm: new Date().toISOString() })), `Desfez a troca de data de ${datasAntigas.length} abastecimento(s).`);
    setAviso(datasAntigas.length === 1 ? 'Data devolvida.' : `Datas de ${datasAntigas.length} abastecimentos devolvidas.`);
    setDatasAntigas([]);
  };
  const abrirLista = (pedido: Omit<PedidoFiltro, 'chave'>) => {
    setPedidoFiltro({ chave: Date.now(), ...pedido });
    setView('historico');
  };
  const desfazerExclusao = () => {
    if (!onRestaurarAbastecimentos || !desfazer.length) return;
    const resultado = onRestaurarAbastecimentos(desfazer);
    setDesfazer([]);
    if (resultado.ok) setAviso(desfazer.length === 1 ? 'Abastecimento devolvido.' : `${desfazer.length} abastecimentos devolvidos.`);
    else setErro(resultado.mensagem);
  };
  // No celular a ficha fica lá embaixo: o aviso com Desfazer vem até a vista.
  const temDesfazer = desfazer.length > 0 || datasAntigas.length > 0;
  useEffect(() => {
    if (temDesfazer) avisoRef.current?.scrollIntoView({ block: 'nearest' });
  }, [temDesfazer]);
  useEffect(() => {
    if (!aviso) return undefined;
    // Com Desfazer na tela, o aviso fica mais tempo para dar tempo de tocar.
    const tempo = window.setTimeout(() => { setAviso(''); setDesfazer([]); setDatasAntigas([]); }, temDesfazer ? 10000 : 4000);
    return () => window.clearTimeout(tempo);
  }, [aviso, temDesfazer]);

  useEffect(() => {
    const teclar = (event: KeyboardEvent) => {
      const alvo = event.target as HTMLElement | null;
      if (view === 'novo' || alvo?.matches('input, textarea, select, [contenteditable="true"]') || event.ctrlKey || event.metaKey || event.altKey || excluindo.length || trocandoData.length) return;
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        abrirNovo();
      } else if (event.key === '/') {
        event.preventDefault();
        setView('historico');
        window.setTimeout(() => buscaRef.current?.focus(), 60);
      } else if (event.key.toLowerCase() === 'r' && !listaSomente) {
        event.preventDefault();
        setView('relatorios');
      }
    };
    document.addEventListener('keydown', teclar);
    return () => document.removeEventListener('keydown', teclar);
  });
  useGSAP(() => {
    const raiz = escopo.current;
    if (!raiz || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(raiz.querySelectorAll('[data-comb-reveal]'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: 'power3.out', clearProps: 'transform,opacity' });
  }, { scope: escopo, dependencies: [view] });

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

  const vistas = [
    { id: 'novo' as const, rotulo: view === 'novo' && lancamento.emEdicao ? 'Corrigindo' : 'Lançar', icone: Plus, testId: 'combustivel-vista-novo' },
    { id: 'historico' as const, rotulo: 'Lançamentos', icone: History, testId: 'combustivel-vista-historico' },
    { id: 'relatorios' as const, rotulo: 'Relatórios', icone: BarChart3, testId: 'combustivel-vista-relatorios' },
  ];
  const trocarVista = (id: View) => {
    if (id === 'novo') { if (view !== 'novo') abrirNovo(); return; }
    if (id === 'historico') setPedidoFiltro(undefined);
    setView(id);
  };
  const cartoes = [
    { titulo: 'Hoje', valor: litrosTexto(numeros.litrosHoje), detalhe: `${numeros.lancamentosHoje} lançamento(s)` },
    { titulo: 'Mês', valor: litrosTexto(numeros.litrosMes), detalhe: `${numeros.maquinasMes} máquina(s)` },
    { titulo: 'A conferir', valor: numeros.aConferir.toLocaleString('pt-BR'), detalhe: numeros.aConferir ? 'Abra e corrija' : 'Tudo certo', alerta: numeros.aConferir > 0 },
  ];

  return (
    <TelaCheia ref={escopo} id="combustivel-tab" testId="combustivel-tab" rotulo="Combustível"
      idAbaAtiva={listaSomente ? undefined : idDaAba('combustivel', view)} idDados="combustivel-dados" chaveRolagem={view}
      cabecalho={listaSomente ? undefined : <div data-comb-reveal>
        <PageHeader eyebrow="Frota" title="Combustível"
          abas={<AbasDaTela id="combustivel" rotulo="Área de combustível" abas={vistas} ativa={view} onTrocar={trocarVista} idPainel="combustivel-dados" />}
          actions={<>
            {view === 'historico' && <ul className="hidden min-w-0 flex-wrap items-center gap-1.5 md:flex" data-testid="combustivel-numeros">
              {cartoes.map(cartao => <li key={cartao.titulo} title={cartao.detalhe} className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 ring-inset ${cartao.alerta ? 'bg-amber-50 text-amber-900 ring-amber-200' : 'bg-white text-slate-600 ring-slate-200'}`}>
                {cartao.titulo} <strong className="tabular-nums text-slate-950">{cartao.valor}</strong>
              </li>)}
            </ul>}
            <button type="button" onClick={onOpenLubrificacao} aria-label="Lubrificação" title="Lubrificação" className={`${BOTAO_SECUNDARIO} size-10 shrink-0 justify-center !px-0`}><Droplets className="size-4 shrink-0" aria-hidden="true" /></button>
          </>} />
      </div>}
      faixa={<>
        <p ref={avisoRef} role="status" aria-live="polite" className={`${aviso ? '' : 'sr-only'} flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900 ring-1 ring-inset ring-emerald-200`} data-testid="combustivel-aviso">
          {aviso && <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />}
          <span className="min-w-0 flex-1">{aviso}</span>
          {aviso && temDesfazer && (
            <button type="button" onClick={datasAntigas.length ? desfazerTrocaDeData : desfazerExclusao} className={`${BOTAO_SECUNDARIO} min-h-9 shrink-0`} data-testid="combustivel-desfazer">
              <Undo2 className="size-4" aria-hidden="true" />Desfazer
            </button>
          )}
        </p>
        {view !== 'novo' && erro && <p role="alert" className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 ring-1 ring-inset ring-rose-200" data-testid="combustivel-erro">{erro}</p>}
      </>}>
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
          onAbrirExistente={item => abrirNovo({ emEdicao: item })}
          onFechar={fecharLancamento}
          onAviso={setAviso}
        />
      </div>}

      {view === 'relatorios' && (
        <RelatorioDiesel
          abastecimentos={ativos}
          equipamentos={equipamentos}
          empresas={empresas}
          comboios={comboios}
          combustiveis={combustiveis}
          parteInicial={porMaquinaInicial ? 'consumo' : 'resumo'}
          onAbrirLista={abrirLista}
          onErro={setErro}
          onAviso={setAviso}
        />
      )}

      {view === 'historico' && (
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
          onExcluir={onDeleteAbastecimento || onDeleteAbastecimentos ? setExcluindo : undefined}
          onTrocarData={onSaveAbastecimentos ? setTrocandoData : undefined}
          pedidoFiltro={pedidoFiltro}
        />
      )}

      <TrocarDataLote
        aberto={trocandoData.length > 0}
        itens={trocandoData}
        todos={ativos}
        onConfirmar={trocarDataConfirmada}
        onFechar={() => setTrocandoData([])}
      />

      <ConfirmDialog
        open={excluindo.length > 0}
        title={excluindo.length > 1 ? `Excluir ${excluindo.length} abastecimentos?` : `Excluir o abastecimento de ${excluindo[0] ? porId.get(excluindo[0].equipamentoId)?.prefixo || excluindo[0].prefixoInformado || 'máquina' : ''}?`}
        description={excluindo.length > 1 ? `Somam ${litrosTexto(excluindo.reduce((soma, item) => soma + Number(item.quantidadeLitros || 0), 0))}. Vão para a Lixeira de Cadastros: dá para desfazer logo depois ou o administrador devolve de lá.` : 'Vai para a Lixeira de Cadastros: dá para desfazer logo depois ou o administrador devolve de lá.'}
        confirmLabel={excluindo.length > 1 ? `Excluir ${excluindo.length}` : 'Excluir abastecimento'}
        tone="danger"
        onCancel={() => setExcluindo([])}
        onConfirm={excluirConfirmado}
      />
    </TelaCheia>
  );
}
