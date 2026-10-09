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
import { AlertTriangle, ArrowLeft, BarChart3, CalendarDays, ChevronLeft, ChevronRight, CheckCircle2, Download, Droplets, FileSpreadsheet, FileText, Filter, Fuel, History, Info, PieChart, Plus, RotateCcw, Save, Search, Trash2 } from 'lucide-react';
import type { Abastecimento, Comboio, ControleEquipamentoDiario, Empresa, Equipamento, GrupoEquipe, TipoCombustivel } from '../types';
import type { FuelImportedMasterData } from '../utils/fuelMasterDataImport';
import { ConfirmDialog, isoDay } from '../shared/ui';
import { PageHeader } from '../shared/ui/PageHeader';
import { montarQuadro } from '../modules/frota/quadroFrota';
import { avisosDoAbastecimento, contextoDoAbastecimento, lerNumero } from '../modules/frota/combustivelDoDia';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO, ROTULO } from './cadastros/estilos';
import { normalizeQuickTime } from '../utils/combustivelValidation';
import { buildMacroFuelingRecord, getDefaultDieselFuelId, parseFuelFormNumber, resolveMacroPumpReadings } from '../utils/fuelMacroForm';
import type { FuelHistoryGroup } from '../modules/frota/fuelHistoryAnalytics';
import { buildFuelReport, type FuelReportExcelRow, type FuelReportFilters } from '../modules/frota/fuelReport';

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
  onImportAbastecimentos?: (items: Abastecimento[], combustiveisImportados?: TipoCombustivel[], cadastrosImportados?: Partial<FuelImportedMasterData>) => void;
  onOpenLubrificacao: () => void;
  onOpenCadastros?: () => void;
  onOpenControle?: () => void;
  onOpenSpreadsheetImport: () => void;
  isParsingSpreadsheet: boolean;
  openHistorySignal?: number;
}

type View = 'resumo' | 'novo' | 'historico';

interface Formulario {
  data: string;
  hora: string;
  prefixo: string;
  tipoCombustivelId: string;
  comboioId: string;
  litros: string;
  bombaInicial: string;
  horimetro: string;
  km: string;
  responsavel: string;
  observacao: string;
}

interface FiltrosHistorico {
  texto: string;
  dataInicio: string;
  dataFim: string;
  comboioId: string;
  equipamentoId: string;
  empresaId: string;
  combustivelId: string;
}

interface FiltrosRelatorio {
  texto: string;
  competencia: string;
  empresaId: string;
  equipamentoId: string;
  comboioId: string;
  combustivelId: string;
  status: string;
  apenasConferencia: boolean;
}

const TAMANHO_PAGINA_HISTORICO = 50;
const FILTROS_HISTORICO_VAZIOS: FiltrosHistorico = {
  texto: '', dataInicio: '', dataFim: '', comboioId: '', equipamentoId: '', empresaId: '', combustivelId: '',
};
const FILTROS_RELATORIO_VAZIOS: FiltrosRelatorio = {
  texto: '', competencia: '', empresaId: '', equipamentoId: '', comboioId: '', combustivelId: '', status: '', apenasConferencia: false,
};
const CORES_GRAFICO_COMBUSTIVEL = ['#176b4d', '#f26a2e', '#718087', '#f7f8f6'];

const agoraHora = () => new Date().toTimeString().slice(0, 5);
const hoje = () => isoDay(new Date());
const dataCurta = (dia: string) => dia ? new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR') : 'Sem data';
const mesOperacional = (dia: string) => dia ? new Date(`${dia}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase() : '';
const mesMacro = (dia: string) => mesOperacional(dia).replace(' DE ', ' ');
const litrosTexto = (valor: number) => `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`;
const numeroTexto = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const semAcento = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const CAMPO_MACRO = 'h-8 w-full rounded-none border border-[#718087] bg-white px-3 text-sm font-medium text-slate-950 shadow-[inset_1px_1px_0_rgba(15,23,42,0.18)] outline-none transition focus:border-[#176b4d] focus:ring-2 focus:ring-[#176b4d]/20 disabled:text-slate-500';
const ROTULO_MACRO = 'flex h-8 items-center text-sm font-black text-black';

const vazio = (usuario: string, data = hoje()): Formulario => ({
  data, hora: agoraHora(), prefixo: '', tipoCombustivelId: '', comboioId: '', litros: '', bombaInicial: '', horimetro: '', km: '',
  responsavel: usuario, observacao: '',
});

export default function CombustivelOperacionalTab({
  empresas, equipamentos, comboios, combustiveis, abastecimentos, registros = [], gruposEquipe = [], usuario = '',
  onSaveAbastecimento, onDeleteAbastecimento, onOpenLubrificacao, onOpenSpreadsheetImport, isParsingSpreadsheet,
  openHistorySignal = 0,
}: Props) {
  const escopo = useRef<HTMLElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);
  const prefixoRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>('resumo');
  const [dia, setDia] = useState(hoje);
  const [filtrosHistorico, setFiltrosHistorico] = useState<FiltrosHistorico>(FILTROS_HISTORICO_VAZIOS);
  const [filtrosRelatorio, setFiltrosRelatorio] = useState<FiltrosRelatorio>(FILTROS_RELATORIO_VAZIOS);
  const [paginaHistorico, setPaginaHistorico] = useState(0);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [abaDashboard, setAbaDashboard] = useState<'resumo' | 'planilha' | 'ranking' | 'conferencia'>('resumo');
  const [exportandoHistorico, setExportandoHistorico] = useState<'' | 'excel' | 'pdf'>('');
  const [excluindo, setExcluindo] = useState<Abastecimento | null>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [form, setForm] = useState<Formulario>(() => vazio(usuario));
  const [comboioFixoId, setComboioFixoId] = useState('');
  /** Campos que a pessoa mexeu; o que vem do lançamento do dia não passa por cima deles. */
  const [mexidos, setMexidos] = useState<ReadonlySet<keyof Formulario>>(() => new Set());

  useEffect(() => {
    if (openHistorySignal > 0) setView('historico');
  }, [openHistorySignal]);

  const ativos = useMemo(() => abastecimentos
    .filter(item => !item.inativoEm && item.status !== 'Cancelado')
    .sort((a, b) => `${b.data}${b.hora}`.localeCompare(`${a.data}${a.hora}`)), [abastecimentos]);
  const porId = useMemo(() => new Map(equipamentos.map(item => [item.id, item])), [equipamentos]);
  const empresaPorId = useMemo(() => new Map<string, string>(empresas.map(item => [item.id, item.nome])), [empresas]);
  const comboioPorId = useMemo(() => new Map(comboios.map(item => [item.id, item.nome])), [comboios]);
  const nomeCombustivel = useMemo(() => new Map(combustiveis.map(item => [item.id, item.nome])), [combustiveis]);
  const combustivelPadraoId = useMemo(() => getDefaultDieselFuelId(combustiveis), [combustiveis]);
  const competenciasDisponiveis = useMemo(() => {
    const chaves = new Set(ativos.map(item => item.competencia && /^\d{4}-\d{2}$/.test(item.competencia) ? item.competencia : item.data.slice(0, 7)).filter(Boolean));
    return [...chaves].sort((a, b) => b.localeCompare(a)).map(chave => ({
      chave,
      rotulo: /^\d{4}-\d{2}$/.test(chave) ? new Date(`${chave}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase() : 'Sem data',
    }));
  }, [ativos]);
  const filtrosRelatorioAplicados = useMemo<FuelReportFilters>(() => ({
    competencias: filtrosRelatorio.competencia ? [filtrosRelatorio.competencia] : [],
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
  const cartoesDoDia = useMemo(() => montarQuadro({ dia, equipamentos, registros, gruposEquipe, abastecimentos }), [abastecimentos, dia, equipamentos, gruposEquipe, registros]);
  const cartoesDoForm = useMemo(
    () => (form.data === dia ? cartoesDoDia : montarQuadro({ dia: form.data, equipamentos, registros, gruposEquipe, abastecimentos })),
    [abastecimentos, cartoesDoDia, dia, equipamentos, form.data, gruposEquipe, registros],
  );
  // Máquina escolhida pelo prefixo digitado ("CB726" ou "CB726 · Caminhão").
  const equipamento = useMemo(() => {
    const texto = semAcento(form.prefixo.split('·')[0].trim());
    if (!texto) return undefined;
    return equipamentos.find(item => semAcento(item.prefixo) === texto);
  }, [equipamentos, form.prefixo]);
  const empresaEquipamento = equipamento ? empresaPorId.get(equipamento.empresaId) || '' : '';
  const cartao = equipamento ? cartoesDoForm.find(item => item.equipamentoId === equipamento.id) : undefined;
  const contexto = cartao ? contextoDoAbastecimento({ dia: form.data, hora: form.hora, cartao, abastecimentos: ativos }) : undefined;
  const avisos = contexto ? avisosDoAbastecimento({ contexto, horimetro: lerNumero(form.horimetro), km: lerNumero(form.km) }) : [];
  const leiturasBomba = useMemo(() => resolveMacroPumpReadings({
    records: ativos,
    comboioId: form.comboioId,
    litros: form.litros,
    bombaInicialManual: form.bombaInicial,
  }), [ativos, form.bombaInicial, form.comboioId, form.litros]);

  // Ao escolher a máquina, puxa do lançamento do dia o que a pessoa ainda não digitou.
  useEffect(() => {
    if (!equipamento || !contexto) return;
    const ultimoCombustivel = ativos.find(item => item.equipamentoId === equipamento.id && item.tipoCombustivelId)?.tipoCombustivelId;
    setForm(atual => ({
      ...atual,
      tipoCombustivelId: mexidos.has('tipoCombustivelId') || atual.tipoCombustivelId ? atual.tipoCombustivelId : ultimoCombustivel || combustivelPadraoId,
    }));
    // Só roda quando a máquina ou o dia mudam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipamento?.id, form.data]);

  const bombaInicialDoComboio = (comboioId: string) => {
    const leitura = resolveMacroPumpReadings({ records: ativos, comboioId, litros: 0 });
    return leitura.bombaInicial > 0 ? String(leitura.bombaInicial).replace('.', ',') : '';
  };

  const mudar = (campo: keyof Formulario, valor: string) => {
    if (campo === 'comboioId') {
      setForm(atual => ({ ...atual, comboioId: valor, bombaInicial: bombaInicialDoComboio(valor) }));
      setComboioFixoId(valor);
    } else {
      setForm(atual => ({ ...atual, [campo]: valor }));
    }
    setMexidos(atual => new Set(atual).add(campo));
    setErro('');
  };

  const abrirNovo = (prefixo = '') => {
    setForm({ ...vazio(usuario, dia), prefixo, comboioId: comboioFixoId, bombaInicial: bombaInicialDoComboio(comboioFixoId), tipoCombustivelId: combustivelPadraoId });
    setMexidos(new Set());
    setErro('');
    setView('novo');
    window.setTimeout(() => (prefixo ? document.getElementById('combustivel-litros') : prefixoRef.current)?.focus(), 60);
  };

  const limparLancamento = () => {
    setForm(atual => ({
      ...vazio(usuario, atual.data),
      comboioId: atual.comboioId,
      bombaInicial: bombaInicialDoComboio(atual.comboioId),
      tipoCombustivelId: atual.tipoCombustivelId || combustivelPadraoId,
      responsavel: atual.responsavel,
    }));
    setMexidos(new Set());
    setErro('');
    window.setTimeout(() => prefixoRef.current?.focus(), 60);
  };

  const salvar = (outro: boolean) => {
    const horaNormalizada = normalizeQuickTime(form.hora);
    const litros = parseFuelFormNumber(form.litros, 0);
    if (!equipamento) return setErro('Escolha a máquina pelo prefixo.');
    if (!horaNormalizada.valid) return setErro('Digite a hora no formato 1005 ou 10:05.');
    if (!form.tipoCombustivelId) return setErro('Escolha o combustível.');
    if (!form.comboioId) return setErro('Selecione o comboio.');
    if (litros <= 0) return setErro('Informe quantos litros foram abastecidos.');
    if (leiturasBomba.bombaInicial <= 0) return setErro('Bomba inicial não encontrada para este comboio.');
    if (leiturasBomba.bombaFinal <= 0) return setErro('Bomba final não calculada.');
    const agora = new Date().toISOString();
    onSaveAbastecimento(buildMacroFuelingRecord({
      id: crypto.randomUUID(),
      equipment: equipamento,
      records: ativos,
      data: form.data,
      hora: form.hora,
      litros: form.litros,
      horimetro: form.horimetro,
      km: form.km,
      tipoCombustivelId: form.tipoCombustivelId,
      comboioId: form.comboioId,
      responsavel: form.responsavel,
      bombaInicialManual: form.bombaInicial,
      observacao: form.observacao,
      nowIso: agora,
    }), true);
    setAviso(`${equipamento.prefixo} abastecido com ${litrosTexto(litros)}.`);
    if (outro) {
      setForm(atual => {
        const proximaBombaInicial = leiturasBomba.bombaFinal > 0 ? String(leiturasBomba.bombaFinal).replace('.', ',') : bombaInicialDoComboio(atual.comboioId);
        return { ...vazio(usuario, atual.data), responsavel: atual.responsavel, comboioId: atual.comboioId, bombaInicial: proximaBombaInicial, tipoCombustivelId: atual.tipoCombustivelId || combustivelPadraoId };
      });
      setMexidos(new Set());
      window.setTimeout(() => prefixoRef.current?.focus(), 60);
    } else {
      setView('resumo');
    }
  };

  const historicoFiltrado = useMemo(() => {
    const termo = semAcento(filtrosHistorico.texto.trim());
    return ativos.filter(item => {
      const maquina = porId.get(item.equipamentoId);
      const empresaId = maquina?.empresaId || '';
      if (filtrosHistorico.dataInicio && item.data < filtrosHistorico.dataInicio) return false;
      if (filtrosHistorico.dataFim && item.data > filtrosHistorico.dataFim) return false;
      if (filtrosHistorico.comboioId && item.comboioId !== filtrosHistorico.comboioId) return false;
      if (filtrosHistorico.equipamentoId && item.equipamentoId !== filtrosHistorico.equipamentoId) return false;
      if (filtrosHistorico.empresaId && empresaId !== filtrosHistorico.empresaId) return false;
      if (filtrosHistorico.combustivelId && item.tipoCombustivelId !== filtrosHistorico.combustivelId) return false;
      if (!termo) return true;
      return semAcento([
        item.data, item.hora, maquina?.prefixo, item.prefixoInformado, maquina?.nome, maquina?.tipo,
        empresaPorId.get(empresaId), comboioPorId.get(item.comboioId), nomeCombustivel.get(item.tipoCombustivelId),
        item.responsavel, item.operadorNome, item.localAbastecimento, item.observacao,
      ].filter(Boolean).join(' ')).includes(termo);
    });
  }, [ativos, comboioPorId, empresaPorId, filtrosHistorico, nomeCombustivel, porId]);
  const relatorioHistorico = useMemo(() => buildFuelReport({
    records: historicoFiltrado, equipamentos, empresas, comboios, combustiveis,
  }), [comboios, combustiveis, empresas, equipamentos, historicoFiltrado]);
  const totalPaginasHistorico = Math.max(1, Math.ceil(historicoFiltrado.length / TAMANHO_PAGINA_HISTORICO));
  const paginaHistoricoAtual = Math.min(paginaHistorico, totalPaginasHistorico - 1);
  const historicoPaginado = historicoFiltrado.slice(
    paginaHistoricoAtual * TAMANHO_PAGINA_HISTORICO,
    (paginaHistoricoAtual + 1) * TAMANHO_PAGINA_HISTORICO,
  );
  const totalLitrosHistorico = relatorioHistorico.totalLitros;
  const maquinasHistorico = new Set(historicoFiltrado.map(item => item.equipamentoId || item.prefixoInformado).filter(Boolean)).size;
  const empresasHistorico = new Set(historicoFiltrado.map(item => porId.get(item.equipamentoId)?.empresaId).filter(Boolean)).size;

  const filtrosHistoricoAplicados = useMemo(() => [
    filtrosHistorico.dataInicio ? `De ${dataCurta(filtrosHistorico.dataInicio)}` : '',
    filtrosHistorico.dataFim ? `Até ${dataCurta(filtrosHistorico.dataFim)}` : '',
    filtrosHistorico.comboioId ? `Comboio: ${comboioPorId.get(filtrosHistorico.comboioId) || filtrosHistorico.comboioId}` : '',
    filtrosHistorico.equipamentoId ? `Equipamento: ${porId.get(filtrosHistorico.equipamentoId)?.prefixo || filtrosHistorico.equipamentoId}` : '',
    filtrosHistorico.empresaId ? `Empresa: ${empresaPorId.get(filtrosHistorico.empresaId) || filtrosHistorico.empresaId}` : '',
    filtrosHistorico.combustivelId ? `Combustível: ${nomeCombustivel.get(filtrosHistorico.combustivelId) || filtrosHistorico.combustivelId}` : '',
    filtrosHistorico.texto.trim() ? `Busca: ${filtrosHistorico.texto.trim()}` : '',
  ].filter(Boolean), [comboioPorId, empresaPorId, filtrosHistorico, nomeCombustivel, porId]);

  const atualizarFiltroHistorico = (campo: keyof FiltrosHistorico, valor: string) => {
    setFiltrosHistorico(atual => ({ ...atual, [campo]: valor }));
    setPaginaHistorico(0);
  };

  const linhasHistoricoExportacao = () => relatorioHistorico.linhasExcel;

  const exportarHistoricoExcel = async () => {
    setExportandoHistorico('excel');
    try {
      const { addCorporateSummarySheet, configureCorporateWorkbook, createCorporateWorkbook, downloadCorporateWorkbook, styleCorporateWorksheet } = await import('../utils/excelCorporate');
      const workbook = await createCorporateWorkbook();
      configureCorporateWorkbook(workbook, 'Histórico de abastecimentos');
      addCorporateSummarySheet(workbook, 'Histórico de Combustível', [
        ['Registros filtrados', historicoFiltrado.length], ['Volume total', `${numeroTexto(totalLitrosHistorico)} L`],
        ['Equipamentos', maquinasHistorico], ['Empresas', empresasHistorico],
      ], filtrosHistoricoAplicados);
      const worksheet = workbook.addWorksheet('HISTÓRICO', { views: [{ showGridLines: false }] });
      worksheet.columns = [
        { header: 'Aba', key: 'aba', width: 16 }, { header: 'Linha', key: 'linha', width: 9 },
        { header: 'Dia', key: 'dia', width: 8 }, { header: 'Data', key: 'data', width: 13 },
        { header: 'Prefixo', key: 'prefixo', width: 13 }, { header: 'Descrição do equipamento', key: 'descricao', width: 28 },
        { header: 'KM inicial', key: 'kmInicial', width: 14 }, { header: 'Horímetro', key: 'horimetro', width: 14 },
        { header: 'Litros', key: 'litros', width: 13 }, { header: 'Hora', key: 'hora', width: 9 },
        { header: 'Comboio', key: 'comboio', width: 18 }, { header: 'Tipo de combustível', key: 'tipoCombustivel', width: 20 },
        { header: 'Empresa', key: 'empresa', width: 24 }, { header: 'Bomba inicial', key: 'bombaInicial', width: 15 },
        { header: 'Bomba final', key: 'bombaFinal', width: 15 }, { header: 'Status', key: 'status', width: 18 },
        { header: 'Observação', key: 'observacao', width: 32 },
      ];
      worksheet.getRow(4).values = ['Aba', 'Linha', 'Dia', 'Data', 'Prefixo', 'Descrição do equipamento', 'KM inicial', 'Horímetro', 'Litros', 'Hora', 'Comboio', 'Tipo de combustível', 'Empresa', 'Bomba inicial', 'Bomba final', 'Status', 'Observação'];
      linhasHistoricoExportacao().forEach(linha => worksheet.addRow(linha));
      styleCorporateWorksheet(worksheet, { title: 'Histórico de Combustível', headerRow: 4, lastColumn: 17, dataStartRow: 5, recordCount: historicoFiltrado.length, filters: filtrosHistoricoAplicados });
      await downloadCorporateWorkbook(workbook, `RENEA_historico_combustivel_${hoje()}.xlsx`);
      setAviso(`${historicoFiltrado.length} registro(s) exportado(s) para Excel.`);
    } catch (falha) {
      setErro(falha instanceof Error ? `Falha ao exportar Excel: ${falha.message}` : 'Falha ao exportar Excel.');
    } finally {
      setExportandoHistorico('');
    }
  };

  const exportarHistoricoPdf = async () => {
    setExportandoHistorico('pdf');
    try {
      const { generateUniversalPdfReport } = await import('../utils/universalPdfReport');
      const linhas = linhasHistoricoExportacao();
      await generateUniversalPdfReport({
        title: 'Histórico de Combustível', subtitle: `${historicoFiltrado.length} registro(s) no resultado filtrado`,
        orientation: 'landscape', period: filtrosHistorico.dataInicio || filtrosHistorico.dataFim
          ? `${filtrosHistorico.dataInicio ? dataCurta(filtrosHistorico.dataInicio) : 'Início'} a ${filtrosHistorico.dataFim ? dataCurta(filtrosHistorico.dataFim) : 'Hoje'}`
          : 'Todo o período', filters: filtrosHistoricoAplicados,
        columns: [
          { header: 'Aba', dataKey: 'aba' }, { header: 'Linha', dataKey: 'linha' },
          { header: 'Data', dataKey: 'data' }, { header: 'Prefixo', dataKey: 'prefixo' },
          { header: 'Empresa', dataKey: 'empresa' }, { header: 'Comboio', dataKey: 'comboio' },
          { header: 'Combustível', dataKey: 'tipoCombustivel' }, { header: 'Litros', dataKey: 'litros' },
          { header: 'Bomba inicial', dataKey: 'bombaInicial' }, { header: 'Bomba final', dataKey: 'bombaFinal' },
          { header: 'KM', dataKey: 'kmInicial' }, { header: 'Horímetro', dataKey: 'horimetro' }, { header: 'Status', dataKey: 'status' },
        ],
        rows: linhas.map(linha => ({
          ...linha,
          data: dataCurta(linha.data),
          litros: litrosTexto(linha.litros),
          bombaInicial: typeof linha.bombaInicial === 'number' ? numeroTexto(linha.bombaInicial) : '',
          bombaFinal: typeof linha.bombaFinal === 'number' ? numeroTexto(linha.bombaFinal) : '',
          kmInicial: typeof linha.kmInicial === 'number' ? numeroTexto(linha.kmInicial) : '',
          horimetro: typeof linha.horimetro === 'number' ? numeroTexto(linha.horimetro) : '',
        })),
        summary: [
          { label: 'Registros', value: historicoFiltrado.length }, { label: 'Volume total', value: litrosTexto(totalLitrosHistorico) },
          { label: 'Equipamentos', value: maquinasHistorico }, { label: 'Empresas', value: empresasHistorico },
        ], fileName: `RENEA_historico_combustivel_${hoje()}.pdf`,
      });
      setAviso(`${historicoFiltrado.length} registro(s) exportado(s) para PDF.`);
    } catch (falha) {
      setErro(falha instanceof Error ? `Falha ao exportar PDF: ${falha.message}` : 'Falha ao exportar PDF.');
    } finally {
      setExportandoHistorico('');
    }
  };

  useEffect(() => {
    if (!aviso) return undefined;
    const tempo = window.setTimeout(() => setAviso(''), 4000);
    return () => window.clearTimeout(tempo);
  }, [aviso]);

  useEffect(() => {
    const teclar = (event: KeyboardEvent) => {
      const alvo = event.target as HTMLElement | null;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && view === 'novo' && !excluindo) {
        event.preventDefault();
        salvar(true);
        return;
      }
      if (alvo?.matches('input, textarea, select, [contenteditable="true"]') || event.ctrlKey || event.metaKey || event.altKey || excluindo) return;
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
  }, { scope: escopo, dependencies: [view, dia] });

  const vistas = [['resumo', 'Resumo', Fuel], ['novo', 'Lançar', Plus], ['historico', 'Histórico', History]] as const;
  const abasDashboard = [
    ['resumo', 'Resumo', PieChart],
    ['planilha', 'Planilha', FileSpreadsheet],
    ['ranking', 'Ranking', BarChart3],
    ['conferencia', 'Conferência', AlertTriangle],
  ] as const;

  return (
    <section ref={escopo} id="combustivel-tab" data-testid="combustivel-tab" aria-label="Combustível" className={view === 'novo' ? 'space-y-4' : 'mx-auto flex h-[calc(100dvh-7rem)] min-h-[34rem] w-full max-w-[96rem] flex-col overflow-hidden'}>
      {view !== 'novo' && <div data-comb-reveal className="mb-2 shrink-0">
        <PageHeader eyebrow="Frota" title="Combustível" className="mb-2" actions={<>
          <button type="button" onClick={onOpenLubrificacao} aria-label="Lubrificação" title="Lubrificação" className={`${BOTAO_SECUNDARIO} size-10 justify-center px-0 sm:w-auto sm:px-3`}><Droplets className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Lubrificação</span></button>
          <button type="button" onClick={() => abrirNovo()} className={`${BOTAO_PRIMARIO} min-h-10 px-3 sm:px-4`} data-testid="combustivel-novo"><Plus className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Novo abastecimento</span><span className="sm:hidden">Lançar</span><kbd title="Atalho de teclado: N" aria-label="Atalho de teclado: N" className="inline-flex rounded-md bg-white/15 px-1.5 font-mono text-xs">N</kbd></button>
        </>} />
        <nav aria-label="Área de combustível" className="grid w-full grid-cols-3 gap-1 rounded-xl bg-[#f7f8f6] p-1 ring-1 ring-inset ring-slate-200">
          {vistas.map(([id, rotulo, Icone]) => <button key={id} type="button" aria-pressed={view === id} onClick={() => (id === 'novo' ? abrirNovo() : setView(id))} data-testid={`combustivel-vista-${id}`} className={`inline-flex min-h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-xs font-bold transition sm:gap-2 sm:px-3 sm:text-sm ${view === id ? 'bg-white text-[#176b4d] shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'} ${FOCO}`}><Icone className="size-4" aria-hidden="true" />{rotulo}</button>)}
        </nav>
      </div>}

      <p role="status" aria-live="polite" className={`${aviso ? '' : 'sr-only'} flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 ring-1 ring-inset ring-emerald-200`} data-testid="combustivel-aviso">
        {aviso && <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />}
        {aviso}
      </p>

      {view === 'resumo' && <div className="flex min-h-0 flex-1 flex-col gap-2" data-testid="combustivel-dashboard">
        <section data-comb-reveal aria-label="Filtros do relatório de combustível" className={`${CARTAO} shrink-0 p-3`}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.2fr_repeat(5,minmax(0,1fr))_auto]">
            <label className="sm:col-span-2 lg:col-span-1"><span className={`${ROTULO} mb-1 block`}>Busca do relatório</span><span className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input value={filtrosRelatorio.texto} onChange={event => setFiltrosRelatorio(atual => ({ ...atual, texto: event.target.value }))} placeholder="Prefixo, empresa, comboio, aba..." className={`${CAMPO} pl-9`} /></span></label>
            <label><span className={`${ROTULO} mb-1 block`}>Competência</span><select value={filtrosRelatorio.competencia} onChange={event => setFiltrosRelatorio(atual => ({ ...atual, competencia: event.target.value }))} className={CAMPO}><option value="">Todas</option>{competenciasDisponiveis.map(item => <option key={item.chave} value={item.chave}>{item.rotulo}</option>)}</select></label>
            <label><span className={`${ROTULO} mb-1 block`}>Empresa</span><select value={filtrosRelatorio.empresaId} onChange={event => setFiltrosRelatorio(atual => ({ ...atual, empresaId: event.target.value }))} className={CAMPO}><option value="">Todas</option>{empresas.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
            <label><span className={`${ROTULO} mb-1 block`}>Equipamento</span><select value={filtrosRelatorio.equipamentoId} onChange={event => setFiltrosRelatorio(atual => ({ ...atual, equipamentoId: event.target.value }))} className={CAMPO}><option value="">Todos</option>{equipamentos.map(item => <option key={item.id} value={item.id}>{item.prefixo} · {item.nome}</option>)}</select></label>
            <label><span className={`${ROTULO} mb-1 block`}>Comboio</span><select value={filtrosRelatorio.comboioId} onChange={event => setFiltrosRelatorio(atual => ({ ...atual, comboioId: event.target.value }))} className={CAMPO}><option value="">Todos</option>{comboios.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
            <label><span className={`${ROTULO} mb-1 block`}>Combustível</span><select value={filtrosRelatorio.combustivelId} onChange={event => setFiltrosRelatorio(atual => ({ ...atual, combustivelId: event.target.value }))} className={CAMPO}><option value="">Todos</option>{combustiveis.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
            <div className="flex items-end gap-2">
              <button type="button" aria-pressed={filtrosRelatorio.apenasConferencia} onClick={() => setFiltrosRelatorio(atual => ({ ...atual, apenasConferencia: !atual.apenasConferencia }))} className={`${filtrosRelatorio.apenasConferencia ? BOTAO_PRIMARIO : BOTAO_SECUNDARIO} min-h-10 px-3`}><AlertTriangle className="size-4" aria-hidden="true" />Conferir</button>
              <button type="button" onClick={() => setFiltrosRelatorio(FILTROS_RELATORIO_VAZIOS)} disabled={!Object.values(filtrosRelatorio).some(Boolean)} title="Limpar filtros do relatório" className={`${BOTAO_SECUNDARIO} min-h-10 px-3`}><RotateCcw className="size-4" aria-hidden="true" /></button>
            </div>
          </div>
        </section>
        <div className="grid shrink-0 grid-cols-4 divide-x divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {[
            ['Lançamentos', relatorioCombustivel.totalRegistros.toLocaleString('pt-BR')],
            ['Volume abastecido', litrosTexto(relatorioCombustivel.totalLitros)],
            ['Conferência', relatorioCombustivel.totalConferencia.toLocaleString('pt-BR')],
            ['Equipamentos', relatorioCombustivel.porEquipamento.filter(item => item.litros > 0).length.toLocaleString('pt-BR')],
          ].map(([titulo, valor]) => <div key={titulo} className="min-w-0 px-2 py-2 sm:px-3"><p className="truncate text-[9px] font-bold uppercase tracking-wide text-slate-500 sm:text-[10px]">{titulo}</p><p className="mt-0.5 truncate text-sm font-black tabular-nums text-slate-950 sm:text-lg">{valor}</p></div>)}
        </div>
        <nav aria-label="Painéis do resumo de combustível" className="grid shrink-0 grid-cols-4 rounded-lg bg-slate-100 p-1">
          {abasDashboard.map(([id, rotulo, Icone]) => <button key={id} type="button" aria-pressed={abaDashboard === id} onClick={() => setAbaDashboard(id)} className={`inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md px-1 text-[11px] font-bold sm:px-2 sm:text-xs ${abaDashboard === id ? 'bg-white text-[#176b4d] shadow-sm' : 'text-slate-600'} ${FOCO}`}><Icone className="size-4" aria-hidden="true" />{rotulo}</button>)}
        </nav>
        {abaDashboard === 'resumo' && <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-2 xl:grid-cols-4 xl:grid-rows-1" data-testid="combustivel-dashboard-consumo">
          <GraficoRosca titulo="Consumo por empresa" grupos={relatorioCombustivel.porEmpresa} vazio="Sem abastecimentos por empresa." />
          <GraficoRosca titulo="Consumo por combustível" grupos={relatorioCombustivel.porCombustivel} vazio="Sem tipo de combustível informado." />
          <GraficoRosca titulo="Consumo por comboio" grupos={relatorioCombustivel.porComboio} vazio="Sem comboio vinculado." />
          <GraficoBarras titulo="Competências" grupos={relatorioCombustivel.porCompetencia} medida="litros" vazio="Sem competência com lançamento." />
        </div>}
        {abaDashboard === 'planilha' && <TabelaPlanilhaCombustivel linhas={relatorioCombustivel.linhasExcel.slice(0, 120)} total={relatorioCombustivel.linhasExcel.length} />}
        {abaDashboard === 'ranking' && <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-2 xl:grid-cols-4 xl:grid-rows-1" data-testid="combustivel-dashboard-ranking">
          <GraficoBarras titulo="Top empresas" grupos={relatorioCombustivel.porEmpresa} medida="litros" vazio="Sem volume por empresa." />
          <GraficoBarras titulo="Top equipamentos" grupos={relatorioCombustivel.porEquipamento} medida="litros" vazio="Sem volume por equipamento." />
          <GraficoBarras titulo="Lançamentos por comboio" grupos={relatorioCombustivel.porComboio} medida="registros" vazio="Sem comboios com lançamento." />
          <GraficoBarras titulo="Volume por combustível" grupos={relatorioCombustivel.porCombustivel} medida="litros" vazio="Sem tipos de combustível." />
        </div>}
        {abaDashboard === 'conferencia' && <TabelaPlanilhaCombustivel linhas={relatorioCombustivel.linhasExcel.filter(item => item.status === 'Conferência necessária').slice(0, 120)} total={relatorioCombustivel.totalConferencia} destaqueConferencia />}
      </div>}

      {view === 'novo' && (
        <form data-comb-reveal onSubmit={event => { event.preventDefault(); salvar(false); }} className="w-full bg-white" data-testid="combustivel-form">
          <div className="bg-white">
            <header className="flex flex-col gap-2 border-b border-slate-200 bg-white px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-black uppercase tracking-[0.12em] text-[#176b4d]">Lançamento de abastecimento</span>
              <span className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setView('resumo')} className={`${BOTAO_SECUNDARIO} min-h-8 rounded-none px-3 py-1`}><ArrowLeft className="size-4" aria-hidden="true" />Voltar</button>
                <button type="button" onClick={limparLancamento} className={`${BOTAO_SECUNDARIO} min-h-8 rounded-none px-3 py-1`}><RotateCcw className="size-4" aria-hidden="true" />Limpar</button>
                <button type="button" onClick={() => salvar(true)} className={`${BOTAO_SECUNDARIO} min-h-8 justify-center rounded-none px-3 py-1`} data-testid="combustivel-salvar-outro"><Save className="size-4" aria-hidden="true" />Salvar e lançar outro</button>
                <button type="submit" className={`${BOTAO_PRIMARIO} min-h-8 rounded-none px-4 py-1`} data-testid="combustivel-salvar"><CheckCircle2 className="size-4" aria-hidden="true" />Salvar</button>
              </span>
            </header>

            <div className="bg-white px-4 py-5 sm:px-12 lg:px-20" data-testid="combustivel-macro-form">
              <fieldset className="grid gap-x-8 gap-y-5 lg:grid-cols-[9.5rem_minmax(18rem,20rem)_8rem_minmax(12rem,16rem)]">
                <legend className="sr-only">Lançamento no layout da macro</legend>

                <label htmlFor="combustivel-mes" className={ROTULO_MACRO}>Mês</label>
                <select id="combustivel-mes" value={mesMacro(form.data)} disabled className={`${CAMPO_MACRO} max-w-[19rem]`}>
                  <option>{mesMacro(form.data)}</option>
                </select>
                <span className="hidden lg:block" />
                <span className="hidden lg:block" />

                <label htmlFor="combustivel-data" className={ROTULO_MACRO}>Data</label>
                <input id="combustivel-data" type="date" value={form.data} onChange={event => mudar('data', event.target.value || hoje())} className={`${CAMPO_MACRO} max-w-[19rem]`} />
                <span className="hidden lg:block" />
                <span className="hidden lg:block" />

                <label htmlFor="combustivel-prefixo" className={ROTULO_MACRO}>Prefixo</label>
                <input id="combustivel-prefixo" ref={prefixoRef} value={form.prefixo} onChange={event => mudar('prefixo', event.target.value.toUpperCase())} placeholder="GM2501" className={`${CAMPO_MACRO} max-w-[19rem] font-mono uppercase`} data-testid="combustivel-prefixo" autoComplete="off" />
                <span className="hidden lg:block" />
                <span className="hidden lg:block" />

                <label htmlFor="combustivel-descricao" className={ROTULO_MACRO}>Descrição</label>
                <input id="combustivel-descricao" value={equipamento?.nome || ''} readOnly className={`${CAMPO_MACRO} lg:col-span-3`} />

                <label htmlFor="combustivel-empresa" className={ROTULO_MACRO}>Empresa</label>
                <input id="combustivel-empresa" value={empresaEquipamento || ''} readOnly className={`${CAMPO_MACRO} lg:col-span-3`} />

                <label htmlFor="combustivel-km" className={ROTULO_MACRO}>KM inicial</label>
                <input id="combustivel-km" inputMode="decimal" value={form.km} onChange={event => mudar('km', event.target.value)} placeholder={contexto?.ultimoKm ? `último: ${numeroTexto(contexto.ultimoKm.valor)}` : '0'} className={`${CAMPO_MACRO} max-w-[19rem] font-mono`} data-testid="combustivel-km" />
                <label htmlFor="combustivel-horimetro" className={`${ROTULO_MACRO} lg:justify-end`}>Horímetro</label>
                <input id="combustivel-horimetro" inputMode="decimal" value={form.horimetro} onChange={event => mudar('horimetro', event.target.value)} placeholder={contexto?.ultimoHorimetro ? `último: ${numeroTexto(contexto.ultimoHorimetro.valor)}` : '0'} className={`${CAMPO_MACRO} font-mono`} data-testid="combustivel-horimetro" />

                <label htmlFor="combustivel-litros" className={ROTULO_MACRO}>Litros</label>
                <input id="combustivel-litros" inputMode="decimal" value={form.litros} onChange={event => mudar('litros', event.target.value)} placeholder="0,0" className={`${CAMPO_MACRO} max-w-[19rem] font-mono`} data-testid="combustivel-litros" />
                <label htmlFor="combustivel-hora" className={`${ROTULO_MACRO} lg:justify-end`}>Hora</label>
                <input id="combustivel-hora" inputMode="numeric" value={form.hora} onChange={event => mudar('hora', event.target.value)} onBlur={() => { const normalized = normalizeQuickTime(form.hora); if (normalized.valid) mudar('hora', normalized.value); }} placeholder="10:49" className={`${CAMPO_MACRO} font-mono`} />

                <label htmlFor="combustivel-comboio" className={ROTULO_MACRO}>Comboio</label>
                <select id="combustivel-comboio" value={form.comboioId} onChange={event => mudar('comboioId', event.target.value)} className={`${CAMPO_MACRO} max-w-[19rem]`}>
                  <option value="">Selecione</option>
                  {comboios.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                </select>
                <span className="hidden lg:block" />
                <span className="hidden lg:block" />

                <label htmlFor="combustivel-tipo" className={ROTULO_MACRO}>Combustível</label>
                <select id="combustivel-tipo" value={form.tipoCombustivelId} onChange={event => mudar('tipoCombustivelId', event.target.value)} className={`${CAMPO_MACRO} lg:col-span-3`} data-testid="combustivel-tipo" disabled={Boolean(combustivelPadraoId)}>
                  <option value="">Escolha</option>
                  {combustiveis.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                </select>

                <label htmlFor="combustivel-bomba-inicial" className={ROTULO_MACRO}>Bomba inicial</label>
                <input id="combustivel-bomba-inicial" inputMode="decimal" value={form.bombaInicial} onChange={event => mudar('bombaInicial', event.target.value)} placeholder={form.comboioId ? 'Digite a leitura inicial' : 'Selecione o comboio'} className={`${CAMPO_MACRO} max-w-[19rem] font-mono`} data-testid="combustivel-bomba-inicial" />
                <span className={`${ROTULO_MACRO} lg:justify-end`}>Bomba final</span>
                <output className={`${CAMPO_MACRO} flex items-center font-mono`} data-testid="combustivel-bomba-final">{leiturasBomba.bombaFinal > 0 ? numeroTexto(leiturasBomba.bombaFinal) : ''}</output>

                <span className="hidden lg:block" />
                <p className={`pt-2 font-black ${equipamento ? 'text-black' : 'text-slate-600'} lg:col-span-3`}>
                  {equipamento ? 'Equipamento localizado.' : 'Digite o prefixo para localizar.'}
                </p>
              </fieldset>

            {avisos.length > 0 && (
              <ul className="space-y-1.5" data-testid="combustivel-avisos">
                {avisos.map(item => (
                  <li key={item.texto} className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm font-semibold ring-1 ring-inset ${item.tom === 'alerta' ? 'bg-amber-50 text-amber-900 ring-amber-200' : 'bg-[#f7f8f6] text-slate-700 ring-slate-200'}`}>
                    {item.tom === 'alerta' ? <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
                    {item.texto}
                  </li>
                ))}
              </ul>
            )}
            {erro && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 ring-1 ring-inset ring-rose-200" data-testid="combustivel-erro">{erro}</p>}

            </div>
          </div>
        </form>
      )}

      {view === 'historico' && <div className="flex min-h-0 flex-1 flex-col gap-2" data-testid="combustivel-historico">
        <section data-comb-reveal className={`${CARTAO} overflow-hidden`}>
          <div className="flex shrink-0 flex-col gap-2 border-b border-slate-100 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="hidden size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-[#176b4d] sm:grid"><History className="size-5" aria-hidden="true" /></span>
              <div>
                <h2 className="text-base font-bold text-slate-950">Histórico de abastecimentos</h2>
                <p className="text-xs text-slate-500">Do mais recente ao mais antigo</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
              <button type="button" onClick={onOpenSpreadsheetImport} disabled={isParsingSpreadsheet} className={`${BOTAO_SECUNDARIO} px-3`}><FileSpreadsheet className="size-4" aria-hidden="true" />{isParsingSpreadsheet ? 'Lendo…' : 'Importar'}</button>
              <button type="button" onClick={exportarHistoricoExcel} disabled={Boolean(exportandoHistorico)} className={`${BOTAO_SECUNDARIO} px-3`}><Download className="size-4" aria-hidden="true" />{exportandoHistorico === 'excel' ? 'Gerando…' : 'Excel'}</button>
              <button type="button" onClick={exportarHistoricoPdf} disabled={Boolean(exportandoHistorico)} className={`${BOTAO_PRIMARIO} px-3`}><FileText className="size-4" aria-hidden="true" />{exportandoHistorico === 'pdf' ? 'Gerando…' : 'PDF'}</button>
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-4 sm:divide-y-0">
            <div className="p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Registros</p><p className="mt-1 text-2xl font-bold tabular-nums text-slate-950">{historicoFiltrado.length.toLocaleString('pt-BR')}</p><p className="text-xs text-slate-500">no resultado filtrado</p></div>
            <div className="p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Volume total</p><p className="mt-1 text-2xl font-bold tabular-nums text-[#176b4d]">{litrosTexto(totalLitrosHistorico)}</p><p className="text-xs text-slate-500">somatório dos litros</p></div>
            <div className="p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Equipamentos</p><p className="mt-1 text-2xl font-bold tabular-nums text-slate-950">{maquinasHistorico.toLocaleString('pt-BR')}</p><p className="text-xs text-slate-500">com abastecimento</p></div>
            <div className="p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Empresas</p><p className="mt-1 text-2xl font-bold tabular-nums text-slate-950">{empresasHistorico.toLocaleString('pt-BR')}</p><p className="text-xs text-slate-500">no resultado filtrado</p></div>
          </div>
        </section>

        <section data-comb-reveal aria-label="Filtros do histórico" className={`${CARTAO} shrink-0 p-2`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input ref={buscaRef} value={filtrosHistorico.texto} onChange={event => atualizarFiltroHistorico('texto', event.target.value)} placeholder="Buscar prefixo, empresa, comboio…" className={`${CAMPO} pl-9`} data-testid="combustivel-busca" /></span>
              <button type="button" aria-expanded={filtrosAbertos} onClick={() => setFiltrosAbertos(aberto => !aberto)} className={`${BOTAO_SECUNDARIO} min-h-10 shrink-0 px-3`}><Filter className="size-4" aria-hidden="true" />{filtrosAbertos ? 'Ocultar' : 'Filtros'}{Object.values(filtrosHistorico).filter(Boolean).length > 0 && <span className="rounded-full bg-emerald-100 px-1.5 text-xs text-emerald-800">{Object.values(filtrosHistorico).filter(Boolean).length}</span>}</button>
            </div>
            <button type="button" onClick={() => { setFiltrosHistorico(FILTROS_HISTORICO_VAZIOS); setPaginaHistorico(0); setErro(''); }} disabled={!Object.values(filtrosHistorico).some(Boolean)} className={`${BOTAO_SECUNDARIO} min-h-10 px-3 text-xs`}>Limpar</button>
          </div>
          {filtrosAbertos && <div className="mt-2 grid gap-2 border-t border-slate-100 pt-2 sm:grid-cols-2 lg:grid-cols-6">
            <label><span className={`${ROTULO} mb-1 block`}>Data inicial</span><input type="date" value={filtrosHistorico.dataInicio} onChange={event => atualizarFiltroHistorico('dataInicio', event.target.value)} className={CAMPO} /></label>
            <label><span className={`${ROTULO} mb-1 block`}>Data final</span><input type="date" value={filtrosHistorico.dataFim} onChange={event => atualizarFiltroHistorico('dataFim', event.target.value)} className={CAMPO} /></label>
            <label><span className={`${ROTULO} mb-1 block`}>Comboio</span><select value={filtrosHistorico.comboioId} onChange={event => atualizarFiltroHistorico('comboioId', event.target.value)} className={CAMPO}><option value="">Todos os comboios</option>{comboios.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
            <label><span className={`${ROTULO} mb-1 block`}>Equipamento</span><select value={filtrosHistorico.equipamentoId} onChange={event => atualizarFiltroHistorico('equipamentoId', event.target.value)} className={CAMPO}><option value="">Todos os equipamentos</option>{equipamentos.map(item => <option key={item.id} value={item.id}>{item.prefixo} · {item.nome}</option>)}</select></label>
            <label><span className={`${ROTULO} mb-1 block`}>Empresa</span><select value={filtrosHistorico.empresaId} onChange={event => atualizarFiltroHistorico('empresaId', event.target.value)} className={CAMPO}><option value="">Todas as empresas</option>{empresas.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
            <label><span className={`${ROTULO} mb-1 block`}>Combustível</span><select value={filtrosHistorico.combustivelId} onChange={event => atualizarFiltroHistorico('combustivelId', event.target.value)} className={CAMPO}><option value="">Todos os combustíveis</option>{combustiveis.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
          </div>}
          {erro && <p role="alert" className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 ring-1 ring-inset ring-rose-200" data-testid="combustivel-erro">{erro}</p>}
        </section>

        <section data-comb-reveal aria-label="Registros de combustível" className={`${CARTAO} flex min-h-0 flex-1 flex-col overflow-hidden`}>
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <div><h3 className="text-sm font-bold text-slate-900">Lançamentos</h3><p className="text-xs text-slate-500">Exportação inclui todos os resultados filtrados.</p></div>
            <span className="text-xs font-semibold tabular-nums text-slate-500">{historicoFiltrado.length ? `${paginaHistoricoAtual * TAMANHO_PAGINA_HISTORICO + 1}–${Math.min((paginaHistoricoAtual + 1) * TAMANHO_PAGINA_HISTORICO, historicoFiltrado.length)} de ${historicoFiltrado.length}` : '0 registros'}</span>
          </header>
          {historicoPaginado.length === 0
            ? <div className="px-4 py-14 text-center"><History className="mx-auto size-8 text-slate-300" aria-hidden="true" /><p className="mt-3 font-semibold text-slate-700">Nenhum abastecimento encontrado</p><p className="mt-1 text-sm text-slate-500">Ajuste os filtros ou limpe a busca para consultar outros lançamentos.</p></div>
            : <div className="min-h-0 flex-1 overflow-auto"><table className="w-full min-w-[1180px] text-left text-sm">
                <thead className="sticky top-0 z-[1] bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500"><tr>
                  <th className="px-3 py-3">Data / hora</th><th className="px-3 py-3">Equipamento</th><th className="px-3 py-3">Empresa</th><th className="px-3 py-3">Comboio</th><th className="px-3 py-3">Combustível</th><th className="px-3 py-3 text-right">Litros</th><th className="px-3 py-3">Bomba inicial → final</th><th className="px-3 py-3">KM / horímetro</th><th className="px-3 py-3">Responsável</th><th className="px-3 py-3">Ação</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {historicoPaginado.map(item => {
                    const maquina = porId.get(item.equipamentoId);
                    const empresa = maquina ? empresaPorId.get(maquina.empresaId) : '';
                    const revisaoPendente = item.revisaoStatus === 'Pendente' || item.status === 'Pendente' || item.alertas?.some(alerta => alerta.severidade !== 'info');
                    return <tr key={item.id} className="transition-colors hover:bg-emerald-50/40">
                      <td className="whitespace-nowrap px-3 py-3"><span className="block font-semibold text-slate-800">{dataCurta(item.data)}</span><span className="font-mono text-xs text-slate-500">{item.hora || '—'}</span></td>
                      <td className="px-3 py-3"><span className="block font-mono font-bold text-slate-950">{maquina?.prefixo || item.prefixoInformado || 'Sem cadastro'}</span><span className="block max-w-44 truncate text-xs text-slate-500">{maquina?.nome || 'Equipamento não cadastrado'}</span></td>
                      <td className="max-w-44 truncate px-3 py-3 text-slate-600">{empresa || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-700">{comboioPorId.get(item.comboioId) || '—'}</td>
                      <td className="px-3 py-3 text-slate-600">{nomeCombustivel.get(item.tipoCombustivelId) || '—'}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-bold tabular-nums text-slate-950">{litrosTexto(Number(item.quantidadeLitros || 0))}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-slate-600">{item.bombaInicial > 0 ? numeroTexto(item.bombaInicial) : '—'} <span className="text-slate-300">→</span> {item.bombaFinal > 0 ? numeroTexto(item.bombaFinal) : '—'}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">{item.kmInicial > 0 ? `${numeroTexto(item.kmInicial)} km` : '—'}{item.horimetroInicial > 0 ? ` · ${numeroTexto(item.horimetroInicial)} h` : ''}</td>
                      <td className="max-w-36 truncate px-3 py-3 text-slate-600">{item.responsavel || '—'}</td>
                      <td className="px-3 py-3"><span className="flex items-center gap-2">{revisaoPendente && <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">Conferir</span>}<button type="button" onClick={() => setExcluindo(item)} aria-label={`Excluir abastecimento de ${maquina?.prefixo || item.prefixoInformado || 'máquina'}`} title="Excluir abastecimento" className={`grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-rose-300 hover:text-rose-700 ${FOCO}`}><Trash2 className="size-4" aria-hidden="true" /></button></span></td>
                    </tr>;
                  })}
                </tbody>
              </table></div>}
          <footer className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-500">Página {paginaHistoricoAtual + 1} de {totalPaginasHistorico}</p>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Página anterior" title="50 lançamentos anteriores" onClick={() => setPaginaHistorico(Math.max(0, paginaHistoricoAtual - 1))} disabled={paginaHistoricoAtual === 0} className={`grid size-10 place-items-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 ${FOCO}`}><ChevronLeft className="size-4" aria-hidden="true" /></button>
              <button type="button" aria-label="Próxima página" title="Próximos 50 lançamentos" onClick={() => setPaginaHistorico(Math.min(totalPaginasHistorico - 1, paginaHistoricoAtual + 1))} disabled={paginaHistoricoAtual >= totalPaginasHistorico - 1} className={`grid size-10 place-items-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 ${FOCO}`}><ChevronRight className="size-4" aria-hidden="true" /></button>
            </div>
          </footer>
        </section>
      </div>}

      <ConfirmDialog
        open={Boolean(excluindo)}
        title={`Excluir o abastecimento de ${excluindo ? porId.get(excluindo.equipamentoId)?.prefixo || 'máquina' : ''}?`}
        description="O registro é apagado e não volta pela sincronização."
        confirmLabel="Excluir abastecimento"
        tone="danger"
        onCancel={() => setExcluindo(null)}
        onConfirm={() => { if (excluindo) onDeleteAbastecimento(excluindo.id); setExcluindo(null); }}
      />
    </section>
  );
}

function ListaDoDia({ itens, porId, nomeCombustivel, titulo, onExcluir, onVerTodos, onCadastros }: {
  itens: readonly Abastecimento[];
  porId: ReadonlyMap<string, Equipamento>;
  nomeCombustivel: ReadonlyMap<string, string>;
  titulo: string;
  onExcluir: (item: Abastecimento) => void;
  onVerTodos?: () => void;
  onCadastros?: () => void;
}) {
  return (
    <section data-comb-reveal aria-label={titulo} className={`${CARTAO} overflow-hidden`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <h2 className="text-base font-bold text-slate-900">{titulo}</h2>
        <span className="flex items-center gap-2">
          {onCadastros && <button type="button" onClick={onCadastros} className={`${BOTAO_SECUNDARIO} px-3`}><Fuel className="size-4" aria-hidden="true" />Cadastrar combustível</button>}
          {onVerTodos && <button type="button" onClick={onVerTodos} className={`${BOTAO_SECUNDARIO} px-3`}>Ver todos</button>}
        </span>
      </header>
      {itens.length === 0
        ? <p className="px-4 py-10 text-center text-sm text-slate-500">Nenhum abastecimento neste dia.</p>
        : <ul className="divide-y divide-slate-100" data-testid="combustivel-lista">
            {itens.map(item => {
              const maquina = porId.get(item.equipamentoId);
              const leitura = [item.horimetroInicial > 0 ? `${numeroTexto(item.horimetroInicial)} h` : '', item.kmInicial > 0 && item.kmInicial !== item.horimetroInicial ? `${numeroTexto(item.kmInicial)} km` : ''].filter(Boolean).join(' · ');
              return (
                <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 transition-colors hover:bg-emerald-50/40 sm:grid-cols-[5rem_minmax(0,1fr)_minmax(0,1fr)_6rem_auto]">
                  <span className="font-mono text-sm font-semibold text-slate-500 max-sm:order-3 max-sm:text-xs">{item.hora || '—'}</span>
                  <span className="min-w-0">
                    <span className="block font-mono text-sm font-bold text-slate-950">{maquina?.prefixo || item.prefixoInformado || 'Sem cadastro'}</span>
                    <span className="block truncate text-xs text-slate-500">{nomeCombustivel.get(item.tipoCombustivelId) || 'Combustível não informado'}{leitura ? ` · ${leitura}` : ''}</span>
                  </span>
                  <span className="min-w-0 text-xs text-slate-600 max-sm:col-span-2 max-sm:order-4">
                    <span className="block truncate text-slate-500">{item.bombaInicial > 0 && item.bombaFinal > 0 ? `Bomba ${numeroTexto(item.bombaInicial)} -> ${numeroTexto(item.bombaFinal)}` : 'Bomba não informada'}</span>
                  </span>
                  <span className="text-right text-base font-bold tabular-nums text-slate-900 max-sm:order-2">{litrosTexto(Number(item.quantidadeLitros || 0))}</span>
                  <button type="button" onClick={() => onExcluir(item)} aria-label={`Excluir abastecimento de ${maquina?.prefixo || 'máquina'}`} className={`grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-rose-300 hover:text-rose-700 max-sm:order-5 max-sm:justify-self-end ${FOCO}`}><Trash2 className="size-4" aria-hidden="true" /></button>
                </li>
              );
            })}
          </ul>}
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

function TabelaPlanilhaCombustivel({ linhas, total, destaqueConferencia = false }: { linhas: FuelReportExcelRow[]; total: number; destaqueConferencia?: boolean }) {
  return <section className={`${CARTAO} flex min-h-0 flex-1 flex-col overflow-hidden`} data-testid="combustivel-planilha">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
      <div>
        <h3 className="text-sm font-bold text-slate-900">{destaqueConferencia ? 'Linhas para conferência' : 'Visualização no formato da planilha'}</h3>
        <p className="text-xs text-slate-500">{linhas.length.toLocaleString('pt-BR')} de {total.toLocaleString('pt-BR')} linha(s) exibidas</p>
      </div>
      {total > linhas.length && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Use os filtros para refinar</span>}
    </header>
    {linhas.length === 0 ? <div className="grid min-h-0 flex-1 place-items-center px-4 py-12 text-center text-sm text-slate-500">Nenhum lançamento encontrado para os filtros atuais.</div> : <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[1320px] text-left text-xs">
        <thead className="sticky top-0 z-[1] bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-3">Aba</th><th className="px-3 py-3">Linha</th><th className="px-3 py-3">Data</th><th className="px-3 py-3">Prefixo</th><th className="px-3 py-3">Descrição do equipamento</th><th className="px-3 py-3 text-right">KM inicial</th><th className="px-3 py-3 text-right">Horímetro</th><th className="px-3 py-3 text-right">Litros</th><th className="px-3 py-3">Hora</th><th className="px-3 py-3">Comboio</th><th className="px-3 py-3">Tipo de combustível</th><th className="px-3 py-3">Empresa</th><th className="px-3 py-3 text-right">Bomba inicial</th><th className="px-3 py-3 text-right">Bomba final</th><th className="px-3 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {linhas.map((linha, index) => <tr key={`${linha.aba}-${linha.linha}-${linha.prefixo}-${linha.data}-${index}`} className={linha.status === 'Conferência necessária' ? 'bg-amber-50/55 hover:bg-amber-50' : 'hover:bg-emerald-50/40'}>
            <td className="whitespace-nowrap px-3 py-2 font-bold text-slate-700">{linha.aba}</td>
            <td className="px-3 py-2 font-mono text-slate-500">{linha.linha || '—'}</td>
            <td className="whitespace-nowrap px-3 py-2">{dataCurta(linha.data)}</td>
            <td className="whitespace-nowrap px-3 py-2 font-mono font-black text-slate-950">{linha.prefixo || '—'}</td>
            <td className="max-w-56 truncate px-3 py-2 text-slate-600">{linha.descricao || '—'}</td>
            <td className="px-3 py-2 text-right tabular-nums">{typeof linha.kmInicial === 'number' ? numeroTexto(linha.kmInicial) : '—'}</td>
            <td className="px-3 py-2 text-right tabular-nums">{typeof linha.horimetro === 'number' ? numeroTexto(linha.horimetro) : '—'}</td>
            <td className="px-3 py-2 text-right font-black tabular-nums text-slate-950">{litrosTexto(linha.litros)}</td>
            <td className="whitespace-nowrap px-3 py-2 font-mono">{linha.hora || '—'}</td>
            <td className="max-w-36 truncate px-3 py-2">{linha.comboio || '—'}</td>
            <td className="max-w-40 truncate px-3 py-2">{linha.tipoCombustivel || '—'}</td>
            <td className="max-w-44 truncate px-3 py-2">{linha.empresa || '—'}</td>
            <td className="px-3 py-2 text-right tabular-nums">{typeof linha.bombaInicial === 'number' ? numeroTexto(linha.bombaInicial) : '—'}</td>
            <td className="px-3 py-2 text-right tabular-nums">{typeof linha.bombaFinal === 'number' ? numeroTexto(linha.bombaFinal) : '—'}</td>
            <td className="px-3 py-2">{linha.status === 'Conferência necessária' ? <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-900">Conferir</span> : <span className="text-slate-500">{linha.status || 'OK'}</span>}</td>
          </tr>)}
        </tbody>
      </table>
    </div>}
  </section>;
}

function GraficoMeses({ grupos }: { grupos: (FuelHistoryGroup & { rotulo: string })[] }) {
  const maior = Math.max(1, ...grupos.map(item => item.litros));
  return <section className={`${CARTAO} flex min-h-0 flex-col overflow-hidden p-3`}>
    <h3 className="shrink-0 text-xs font-bold text-slate-800 sm:text-sm">Consumo mensal</h3>
    <div className="grid min-h-0 flex-1 grid-cols-6 items-end gap-1 pt-3" role="img" aria-label={`Consumo mensal: ${grupos.map(item => `${item.rotulo}, ${litrosTexto(item.litros)}`).join('; ')}`}>
      {grupos.map(item => <div key={item.chave} className="flex h-full min-w-0 flex-col items-center justify-end gap-1" title={`${item.rotulo}: ${litrosTexto(item.litros)} em ${item.registros} lançamentos`}>
        <span className="max-w-full truncate text-[9px] font-semibold tabular-nums text-slate-600">{numeroTexto(item.litros)}</span><div className="flex h-[68%] w-full items-end"><span className="w-full rounded-t bg-[#176b4d]" style={{ height: `${item.litros > 0 ? Math.max(5, item.litros / maior * 100) : 2}%` }} /></div><span className="truncate text-[9px] text-slate-500">{item.rotulo}</span>
      </div>)}
    </div>
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
