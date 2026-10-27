import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import {
  AlertTriangle,
  CalendarDays,
  ClipboardCheck,
  Database,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  History,
  Keyboard,
  LayoutGrid,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  Users,
  X,
  Clock3,
  Truck,
  Wrench,
} from 'lucide-react';
import type {
  ControleEquipamentoDiario,
  Empresa,
  Equipamento,
  Funcionario,
  GrupoEquipe,
  OrdemServico,
} from '../types';
import type {
  FleetCurrentState,
  FleetImportPreview,
  FleetImportRawRow,
  FleetOperationalStatus,
  FleetPersistedRecord,
  FleetReportViewModel,
} from '../fleet/domain';
import { useFleetReport } from '../fleet/useFleetReport';
import { calculateFleetMetrics } from '../fleet/reportService';
import { toLegacyDailyStatus } from '../fleet/status';
import { getOperationalToday, shiftIsoDate } from '../fleet/time';
import { previewFleetImport } from '../fleet/importService';
import type { PreviaCadastroSge } from '../fleet/sgeApontamentos';
import { loadValidatedWorkbook } from '../utils/excelCorporate';
import { generateFleetPdf } from '../fleet/pdfReport';
import { exportFleetExcel } from '../fleet/excelExport';
import { OPERATIONAL_DRIVERS } from '../fleet/operationalDrivers';
import {
  buildWeeklyFleetReport,
  exportWeeklyFleetExcel,
  exportWeeklyFleetPdf,
} from '../fleet/weeklyReport';
import PanoramaDoDia, { type CanteiroDoDia } from './fleet/PanoramaDoDia';
import FleetFilterBar from './fleet/FleetFilterBar';
import FleetDataTable from './fleet/FleetDataTable';
import FleetBulkActions from './fleet/FleetBulkActions';
import FleetDetailDrawer from './fleet/FleetDetailDrawer';
import DailyRecordForm from './fleet/DailyRecordForm';
import FleetReportLayout from './fleet/FleetReportLayout';
import FleetImportPreviewModal, { type FleetImportPreviewRow } from './fleet/FleetImportPreviewModal';
import ImportacaoSge from './fleet/ImportacaoSge';
import { ConfirmDialog, CountUp, Modal, PageHeader } from '../shared/ui';
import { AbasDaTela, idDaAba, type AbaDaTela } from '../shared/ui/AbasDaTela';
import { TelaCheia } from '../shared/ui/TelaCheia';
import { TabelaPadrao, type ColunaTabela } from '../shared/ui/TabelaPadrao';
import { useEntradaDeLista } from '../shared/hooks/useEntradaDeLista';
import FleetDailyReference from './fleet/FleetDailyReference';
import FleetDriverReference from './fleet/FleetDriverReference';
import { repetidosPorDia } from '../fleet/duplicidadeDiaria';
import { montarConferenciaDoDia } from '../fleet/conferenciaDoDia';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO, ROTULO, TOM_SITUACAO } from './cadastros/estilos';

interface Props {
  registros: ControleEquipamentoDiario[];
  equipamentos: Equipamento[];
  empresas: Empresa[];
  funcionarios: Funcionario[];
  operationalDrivers?: Funcionario[];
  gruposEquipe: GrupoEquipe[];
  ordensServico: OrdemServico[];
  onSave: (registro: ControleEquipamentoDiario, isNew: boolean) => void | Promise<void>;
  onImport: (registros: ControleEquipamentoDiario[]) => void;
  /** Grava motorista e horímetro no cadastro dos equipamentos, a partir do apontamento do SGE. */
  onApplyCadastroSge?: (previa: PreviaCadastroSge) => void;
  /** Sem ele, a tela não mostra Excluir: só o administrador exclui (A7). */
  onDeleteMany?: (ids: string[]) => void;
  onOpenMaintenance?: () => void;
  onOpenEquipmentRegistration?: () => void;
  onSaveOperationalDriver?: (driver: Funcionario, isNew: boolean) => void;
  onDeleteOperationalDriver?: (id: string) => void;
  /** Inclui vários motoristas de uma vez (lista de operadores colada na conferência). */
  onAddOperationalDrivers?: (drivers: Funcionario[]) => void;
  canApproveFleet?: boolean;
  /** Nome de quem está usando o sistema; grava a autoria do lançamento. */
  registeredBy?: string;
  onApproveFleetRecord?: (id: string, status: 'APROVADO' | 'REJEITADO') => void;
  /** Vista Quadro: as mesmas máquinas do dia em cartões por canteiro, no dia escolhido aqui. */
  quadro?: (dia: string, verSituacao: () => void) => React.ReactNode;
}

type ConfirmationState =
  | { kind: 'delete'; ids: string[] }
  | { kind: 'status'; ids: string[]; status: FleetOperationalStatus };

type FleetView = 'today' | 'quadro' | 'equipamentos' | 'operadores' | 'history' | 'registry';

const VISTAS_GUARDAVEIS: readonly FleetView[] = ['quadro', 'equipamentos', 'operadores', 'history', 'registry'];

const CHAVE_VISTA = 'renea_frota_vista';
const vistaGuardada = (): FleetView => {
  try {
    const salva = window.localStorage.getItem(CHAVE_VISTA) as FleetView | null;
    return salva && VISTAS_GUARDAVEIS.includes(salva) ? salva : 'today';
  } catch {
    return 'today';
  }
};

const ATALHOS: ReadonlyArray<{ teclas: string; oQueFaz: string }> = [
  { teclas: 'N', oQueFaz: 'Novo lançamento' },
  { teclas: '?', oQueFaz: 'Mostrar esta lista' },
];

const dataLonga = (dia: string) => /^\d{4}-\d{2}-\d{2}$/.test(dia)
  ? new Date(`${dia}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  : dia;

interface FechamentoDoDia {
  date: string;
  total: number;
  operating: number;
  maintenance: number;
  available: number;
  pending: number;
  repeated: string[];
}

const disponibilidadeDo = (dia: FechamentoDoDia) => (dia.total ? Math.round(((dia.operating + dia.available) / dia.total) * 100) : null);

const numeroOuTraco = (valor: number) => (valor ? valor.toLocaleString('pt-BR') : '—');

const COLUNAS_HISTORICO: readonly ColunaTabela<FechamentoDoDia>[] = [
  {
    chave: 'date',
    titulo: 'Dia',
    larguraMinima: 150,
    valorOrdenacao: dia => dia.date,
    render: dia => <span className="font-bold text-slate-900 first-letter:uppercase">{new Date(`${dia.date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>,
  },
  { chave: 'total', titulo: 'Lançadas', alinhamento: 'direita', valorOrdenacao: dia => dia.total, render: dia => dia.total.toLocaleString('pt-BR') },
  { chave: 'operating', titulo: 'Em operação', alinhamento: 'direita', valorOrdenacao: dia => dia.operating, render: dia => <span className="font-semibold text-[#176b4d]">{numeroOuTraco(dia.operating)}</span> },
  { chave: 'maintenance', titulo: 'Manutenção', alinhamento: 'direita', valorOrdenacao: dia => dia.maintenance, render: dia => <span className={dia.maintenance ? 'font-semibold text-rose-700' : ''}>{numeroOuTraco(dia.maintenance)}</span> },
  { chave: 'available', titulo: 'À disposição', alinhamento: 'direita', valorOrdenacao: dia => dia.available, render: dia => numeroOuTraco(dia.available) },
  { chave: 'pending', titulo: 'A confirmar', alinhamento: 'direita', valorOrdenacao: dia => dia.pending, render: dia => <span className={dia.pending ? 'font-semibold text-[#c2410c]' : ''}>{numeroOuTraco(dia.pending)}</span> },
  {
    chave: 'repeated',
    titulo: 'Repetidos',
    larguraMinima: 140,
    valorOrdenacao: dia => dia.repeated.length,
    dica: dia => (dia.repeated.length ? `Lançados mais de uma vez: ${dia.repeated.join(', ')}` : undefined),
    render: dia => (dia.repeated.length ? <span className="font-semibold text-rose-700">{dia.repeated.length}: {dia.repeated.join(', ')}</span> : '—'),
  },
  {
    chave: 'availability',
    titulo: 'Disponível',
    alinhamento: 'direita',
    valorOrdenacao: disponibilidadeDo,
    render: dia => {
      const valor = disponibilidadeDo(dia);
      if (valor === null) return '—';
      return (
        <span className="inline-flex items-center justify-end gap-2">
          <span className="block h-1.5 w-14 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><span className="block h-full rounded-full bg-[#176b4d]" style={{ width: `${valor}%` }} /></span>
          <span className="font-bold text-slate-900">{valor}%</span>
        </span>
      );
    },
  },
];

const COLUNAS_MOTORISTAS: readonly ColunaTabela<Funcionario>[] = [
  { chave: 'matricula', titulo: 'Matrícula', valorOrdenacao: driver => driver.matricula || '', render: driver => <span className="font-mono font-bold text-slate-700">{driver.matricula || '—'}</span> },
  { chave: 'nome', titulo: 'Nome', larguraMinima: 200, valorOrdenacao: driver => driver.nome, render: driver => <span className="font-semibold text-slate-950">{driver.nome}</span> },
  { chave: 'cargo', titulo: 'Função', larguraMinima: 180, valorOrdenacao: driver => driver.cargo, render: driver => driver.cargo || '—' },
];

const asText = (value: unknown): string => String(value ?? '').trim();

const getImportCell = (
  row: { getCell: (index: number) => { value: unknown } },
  index: number,
): unknown => row.getCell(index).value;

const buildSelectionViewModel = (
  source: FleetReportViewModel,
  selected: FleetCurrentState[],
): FleetReportViewModel => {
  const ids = new Set(selected.map(state => state.recordId));
  const metrics = calculateFleetMetrics(selected);
  const history = source.history.filter(event =>
    selected.some(state => state.equipment.equipmentId === event.equipmentId));
  return {
    ...source,
    metrics,
    allRows: selected,
    operating: source.operating.filter(state => ids.has(state.recordId)),
    maintenance: source.maintenance.filter(state => ids.has(state.recordId)),
    available: source.available.filter(state => ids.has(state.recordId)),
    pending: source.pending.filter(state => ids.has(state.recordId)),
    waitingDriver: source.waitingDriver.filter(state => ids.has(state.recordId)),
    other: source.other.filter(state => ids.has(state.recordId)),
    sections: source.sections.map(section => ({
      ...section,
      rows: section.rows.filter(state => ids.has(state.recordId)),
    })),
    history,
  };
};

export default function ControleEquipamentosDiarioTab({
  registros,
  equipamentos,
  empresas,
  funcionarios,
  gruposEquipe,
  ordensServico,
  onSave,
  onImport,
  onApplyCadastroSge,
  onDeleteMany,
  onOpenMaintenance,
  onOpenEquipmentRegistration,
  operationalDrivers: operationalDriversProp,
  onSaveOperationalDriver,
  onDeleteOperationalDriver,
  onAddOperationalDrivers,
  canApproveFleet = false,
  registeredBy = 'Operação',
  onApproveFleetRecord,
  quadro,
}: Props) {
  const pageRef = useRef<HTMLElement>(null);
  const operationalDrivers = useMemo(() => [...(operationalDriversProp || OPERATIONAL_DRIVERS)], [operationalDriversProp]);
  const context = useMemo(() => ({
    records: registros,
    equipment: equipamentos,
    employees: operationalDrivers,
    companies: empresas,
    teams: gruposEquipe,
    maintenanceOrders: ordensServico,
  }), [
    empresas,
    equipamentos,
    gruposEquipe,
    operationalDrivers,
    ordensServico,
    registros,
  ]);
  const {
    filters,
    updateFilter,
    clearFilters,
    activeFilterCount,
    viewModel,
  } = useFleetReport(context);
  const hoje = getOperationalToday();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingRecord, setEditingRecord] = useState<FleetPersistedRecord>();
  const [formOpen, setFormOpen] = useState(false);
  const [formPreset, setFormPreset] = useState<{ prefixo?: string; codigoFuncionario?: string }>();
  const [detailState, setDetailState] = useState<FleetCurrentState>();
  const [confirmation, setConfirmation] = useState<ConfirmationState>();
  const [confirmationBusy, setConfirmationBusy] = useState(false);
  const [importPreview, setImportPreview] = useState<FleetImportPreview>();
  const [importFileName, setImportFileName] = useState('');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'error' | 'info'>('info');
  const [exporting, setExporting] = useState<'pdf' | 'excel' | 'weekly-pdf' | 'weekly-excel' | ''>('');
  const [activeView, setActiveViewState] = useState<FleetView>(vistaGuardada);
  const setActiveView = (view: FleetView) => {
    setActiveViewState(view);
    try {
      window.localStorage.setItem(CHAVE_VISTA, view);
    } catch {
      // Sem memória do aparelho a escolha vale só nesta visita.
    }
  };
  // As relações da conferência ficam no aparelho; quando alguém edita uma
  // delas, o número de "A confirmar" nas abas precisa ser recontado.
  const [versaoRelacao, setVersaoRelacao] = useState(0);
  const relacaoMudou = useCallback(() => setVersaoRelacao(versao => versao + 1), []);
  const [atalhosAberto, setAtalhosAberto] = useState(false);
  const [driverSearch, setDriverSearch] = useState('');
  const [driverEditor, setDriverEditor] = useState<Partial<Funcionario> | null>(null);
  const [driverErro, setDriverErro] = useState('');
  const [driverExclusao, setDriverExclusao] = useState<Funcionario | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useGSAP(() => {
    const root = pageRef.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.fromTo(
      '[data-fleet-enter]',
      { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, duration: 0.48, stagger: 0.075, ease: 'power2.out', clearProps: 'transform,visibility,opacity' },
    );

    // Mesma profundidade do painel principal: o cartão sobe 3px ao receber
    // ponteiro ou foco, sem deslocar o texto a ponto de atrapalhar a leitura.
    const cleanups: Array<() => void> = [];
    root.querySelectorAll<HTMLElement>('[data-fleet-lift]').forEach(target => {
      const lift = gsap.quickTo(target, 'y', { duration: 0.28, ease: 'power3.out' });
      const enter = () => lift(-3);
      const leave = () => lift(0);
      target.addEventListener('pointerenter', enter);
      target.addEventListener('pointerleave', leave);
      target.addEventListener('focusin', enter);
      target.addEventListener('focusout', leave);
      cleanups.push(() => {
        target.removeEventListener('pointerenter', enter);
        target.removeEventListener('pointerleave', leave);
        target.removeEventListener('focusin', enter);
        target.removeEventListener('focusout', leave);
      });
    });

    return () => cleanups.forEach(cleanup => cleanup());
  }, { scope: pageRef });
  // A troca de vista (Dia / Equipamentos / Operadores / Histórico / Motoristas) recriava o
  // conteúdo sem nenhuma transição — a tela "piscava" de uma vista pra outra.
  useGSAP(() => {
    const view = pageRef.current?.querySelector('[data-fleet-view]');
    if (!view || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(
      view,
      { autoAlpha: 0, y: 10 },
      { autoAlpha: 1, y: 0, duration: 0.32, ease: 'power2.out', clearProps: 'transform,visibility,opacity' },
    );
    // As linhas das tabelas entram em cascata curta pelo useEntradaDeLista
    // de cada subtela.
  }, { scope: pageRef, dependencies: [activeView] });
  const filteredOperationalDrivers = useMemo(() => {
    const query = driverSearch.trim().toLocaleUpperCase('pt-BR');
    if (!query) return operationalDrivers;
    return operationalDrivers.filter(driver =>
      `${driver.matricula || ''} ${driver.nome} ${driver.cargo}`
        .toLocaleUpperCase('pt-BR')
        .includes(query));
  }, [driverSearch, operationalDrivers]);
  const driverRoleCounts = useMemo(() => operationalDrivers.reduce<Record<string, number>>(
    (counts, driver) => ({ ...counts, [driver.cargo]: (counts[driver.cargo] || 0) + 1 }),
    {},
  ), [operationalDrivers]);
  const groups = useMemo(() => [...new Set(registros.map(record => record.familia).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, 'pt-BR')), [registros]);
  const equipmentTypes = useMemo(() => [...new Set(equipamentos.map(item => item.tipo).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, 'pt-BR')), [equipamentos]);
  // Canteiros do dia, independente dos outros filtros: cada chip mostra quantas
  // frotas têm lançamento ali, mesmo se a situação/tipo escolhidos escondem a máquina agora.
  const canteirosDoDia = useMemo((): CanteiroDoDia[] => {
    const contagem = new Map<string, CanteiroDoDia>();
    registros.forEach(record => {
      if (record.data !== filters.date) return;
      const local = (record as FleetPersistedRecord).local?.trim();
      if (!local) return;
      const atual = contagem.get(local) || { nome: local, total: 0, operando: 0, manutencao: 0 };
      atual.total += 1;
      if (record.status === 'Em operação') atual.operando += 1;
      if (record.status === 'Em manutenção' || record.status === 'Aguardando manutenção') atual.manutencao += 1;
      contagem.set(local, atual);
    });
    return [...contagem.values()]
      .sort((left, right) => right.total - left.total || left.nome.localeCompare(right.nome, 'pt-BR'));
  }, [registros, filters.date]);
  const escopoHistorico = useEntradaDeLista<HTMLDivElement>([activeView]);
  const escopoMotoristas = useEntradaDeLista<HTMLDivElement>([activeView, driverSearch]);
  const historyByDate = useMemo((): FechamentoDoDia[] => {
    const repetidos = repetidosPorDia(registros);
    const dates = [...new Set(registros.map(record => record.data).filter(Boolean))]
      .sort((left, right) => right.localeCompare(left));
    return dates.map(date => {
      const daily = registros.filter(record => record.data === date);
      return {
        date,
        total: daily.length,
        operating: daily.filter(record => record.status === 'Em operação').length,
        maintenance: daily.filter(record => record.status === 'Em manutenção' || record.status === 'Aguardando manutenção').length,
        available: daily.filter(record => record.status === 'Disponível').length,
        pending: daily.filter(record => record.status === 'A confirmar').length,
        repeated: repetidos.get(date) || [],
      };
    });
  }, [registros]);
  const selectedStates = useMemo(
    () => viewModel.allRows.filter(state => selectedIds.includes(state.recordId)),
    [selectedIds, viewModel.allRows],
  );
  const salvarMotorista = () => {
    if (!driverEditor) return;
    const nome = String(driverEditor.nome || '').trim();
    const matricula = String(driverEditor.matricula || '').trim();
    if (!nome || !matricula) {
      setDriverErro('Informe o nome e a matrícula do motorista.');
      return;
    }
    onSaveOperationalDriver?.({
      ...driverEditor,
      id: String(driverEditor.id),
      nome,
      matricula,
      cargo: String(driverEditor.cargo || 'OPERADOR'),
      empresaId: String(driverEditor.empresaId || empresas[0]?.id || ''),
      telefone: String(driverEditor.telefone || ''),
      ativo: true,
      status: 'ATIVO',
    } as Funcionario, !operationalDrivers.some(item => item.id === driverEditor.id));
    setDriverEditor(null);
    setDriverErro('');
    setMessageTone('success');
    setMessage(`${nome} salvo na lista de motoristas.`);
  };
  const openNewRecord = (preset?: { prefixo?: string; codigoFuncionario?: string }) => {
    setEditingRecord(undefined);
    setFormPreset(preset);
    setFormOpen(true);
  };
  useEffect(() => {
    if (atalhosAberto) return undefined;
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.matches('input, textarea, select, [contenteditable="true"]');
      if (event.altKey && event.key.toLocaleLowerCase('pt-BR') === 'n') {
        event.preventDefault();
        openNewRecord();
        return;
      }
      if (isTyping || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'n') {
        event.preventDefault();
        openNewRecord();
      } else if (event.key === '?' && activeView !== 'quadro') {
        // No Quadro o "?" abre a lista de atalhos do próprio quadro.
        event.preventDefault();
        setAtalhosAberto(true);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [atalhosAberto, activeView]);
  const openEdit = (state: FleetCurrentState) => {
    const raw = registros.find(record => record.id === state.recordId) as FleetPersistedRecord | undefined;
    if (!raw) {
      setMessageTone('error');
      setMessage('O lançamento original não foi localizado.');
      return;
    }
    setDetailState(undefined);
    setEditingRecord(raw);
    setFormOpen(true);
  };
  const handleSaved = async (
    record: ControleEquipamentoDiario,
    isNew: boolean,
  ) => {
    await onSave(record, isNew);
    setMessageTone('success');
    const time = record.horaSaida || record.horaEntradaManutencao || (record as FleetPersistedRecord).disponivelDesde || 'horário não informado';
    setMessage(`${record.prefixo} · ${record.nomeMotorista || 'Sem motorista'} · ${record.status} · ${time} ${isNew ? 'registrado' : 'atualizado'} com histórico.`);
  };
  const handleRefresh = () => {
    clearFilters();
    setSelectedIds([]);
    setMessageTone('info');
    setMessage(`Visão atualizada às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`);
  };
  const handlePdf = async () => {
    if (exporting) return;
    setExporting('pdf');
    setMessageTone('info');
    setMessage('Gerando relatório operacional em PDF...');
    try {
      const result = await generateFleetPdf(viewModel, montarConferenciaDoDia(registros, filters.date));
      setMessageTone('success');
      setMessage(`${result.fileName} gerado com ${result.rows} CB(s) em ${result.pages} página(s).`);
    } catch (error) {
      setMessageTone('error');
      setMessage(error instanceof Error ? error.message : 'Não foi possível gerar o PDF.');
    } finally {
      setExporting('');
    }
  };
  const handleExcel = async (selectionOnly = false) => {
    if (exporting) return;
    setExporting('excel');
    setMessageTone('info');
    setMessage('Gerando relatório Excel profissional...');
    try {
      const report = selectionOnly
        ? buildSelectionViewModel(viewModel, selectedStates)
        : viewModel;
      const result = await exportFleetExcel(report, selectionOnly ? undefined : montarConferenciaDoDia(registros, filters.date));
      setMessageTone('success');
      setMessage(`${result.fileName} gerado com as abas ${result.sheets.join(', ')}.`);
    } catch (error) {
      setMessageTone('error');
      setMessage(error instanceof Error ? error.message : 'Não foi possível gerar o Excel.');
    } finally {
      setExporting('');
    }
  };
  const weeklyReport = useMemo(() => buildWeeklyFleetReport(registros), [registros]);
  const handleWeeklyPdf = async () => {
    if (exporting) return;
    setExporting('weekly-pdf');
    setMessageTone('info');
    setMessage('Gerando relatório semanal em PDF...');
    try {
      const result = await exportWeeklyFleetPdf(weeklyReport);
      setMessageTone('success');
      setMessage(`${result.fileName} gerado com ${result.rows} lançamento(s).`);
    } catch (error) {
      setMessageTone('error');
      setMessage(error instanceof Error ? error.message : 'Não foi possível gerar o PDF semanal.');
    } finally {
      setExporting('');
    }
  };
  const handleWeeklyExcel = async () => {
    if (exporting) return;
    setExporting('weekly-excel');
    setMessageTone('info');
    setMessage('Gerando relatório semanal em Excel...');
    try {
      const result = await exportWeeklyFleetExcel(weeklyReport);
      setMessageTone('success');
      setMessage(`${result.fileName} gerado com as abas ${result.sheets?.join(', ')}.`);
    } catch (error) {
      setMessageTone('error');
      setMessage(error instanceof Error ? error.message : 'Não foi possível gerar o Excel semanal.');
    } finally {
      setExporting('');
    }
  };
  const readImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setMessageTone('info');
    setMessage('Lendo e validando o arquivo antes da importação...');
    try {
      const workbook = await loadValidatedWorkbook(file);
      const sheet = workbook.getWorksheet('LANÇAMENTOS')
        || workbook.worksheets.find(item => item.rowCount > 0);
      if (!sheet) throw new Error('Nenhuma aba com dados foi encontrada.');
      const rawRows: FleetImportRawRow[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber < 7) return;
        const values = Array.from({ length: 13 }, (_, index) =>
          asText(getImportCell(row, index + 1)));
        if (!values.some(Boolean)) return;
        rawRows.push({
          rowNumber,
          date: getImportCell(row, 2),
          employeeCode: getImportCell(row, 3),
          employeeName: getImportCell(row, 4),
          prefix: getImportCell(row, 5),
          status: getImportCell(row, 7),
          departureTime: getImportCell(row, 8),
          maintenanceEntryTime: getImportCell(row, 9),
          releaseTime: getImportCell(row, 10),
          note: getImportCell(row, 11),
          location: getImportCell(row, 12),
          maintenanceReason: getImportCell(row, 13),
        });
      });
      const preview = previewFleetImport(rawRows, context);
      setImportFileName(file.name);
      setImportPreview(preview);
      setMessage('');
    } catch (error) {
      setMessageTone('error');
      setMessage(error instanceof Error ? error.message : 'Falha ao validar o arquivo.');
    }
  };
  const applyImportPreview = () => {
    if (!importPreview?.canApply) return;
    const applicable = importPreview.rows
      .filter(row => row.record && (row.disposition === 'NEW' || row.disposition === 'UPDATE'))
      .map(row => row.record as ControleEquipamentoDiario);
    onImport(applicable);
    setMessageTone('success');
    setMessage(
      `Importação concluída · ${importPreview.newCount} novo(s) · ${importPreview.updateCount} atualizado(s) · ${importPreview.duplicateCount} já existente(s) · ${importPreview.errorCount} rejeitado(s).`,
    );
    setImportPreview(undefined);
    setImportFileName('');
  };
  const executeConfirmation = async () => {
    if (!confirmation || confirmationBusy) return;
    setConfirmationBusy(true);
    try {
      if (confirmation.kind === 'delete') {
        onDeleteMany?.(confirmation.ids);
        setSelectedIds(ids => ids.filter(id => !confirmation.ids.includes(id)));
        setMessageTone('success');
        setMessage(`${confirmation.ids.length} lançamento(s) excluído(s) com confirmação.`);
      } else {
        const now = new Date().toISOString();
        const targetStatus = toLegacyDailyStatus(confirmation.status);
        const targetRecords = registros.filter(record => confirmation.ids.includes(record.id));
        for (const record of targetRecords) {
          await onSave({
            ...record,
            status: targetStatus,
            atualizadoEm: now,
            eventos: [
              ...(record.eventos || []),
              {
                id: `evt-bulk-${Date.now()}-${record.id}`,
                ocorridoEm: now,
                tipo: 'ALTERACAO_STATUS',
                statusAnterior: record.status,
                statusNovo: targetStatus,
                observacao: 'Alteração de status em lote.',
              },
            ],
          }, false);
        }
        setMessageTone('success');
        setMessage(`Status alterado para ${confirmation.status} em ${targetRecords.length} lançamento(s).`);
      }
      setConfirmation(undefined);
    } catch (error) {
      setMessageTone('error');
      setMessage(error instanceof Error ? error.message : 'Não foi possível concluir a ação.');
    } finally {
      setConfirmationBusy(false);
    }
  };
  const conferenciaDoDia = useMemo(
    () => montarConferenciaDoDia(registros, filters.date),
    // versaoRelacao: a relação vem do aparelho e muda sem passar pelos registros.
    [registros, filters.date, versaoRelacao],
  );
  const vistas: ReadonlyArray<AbaDaTela<FleetView>> = [
    { id: 'today', rotulo: 'Situação do dia', curto: 'Dia', icone: CalendarDays },
    ...(quadro ? [{ id: 'quadro' as const, rotulo: 'Quadro', icone: LayoutGrid }] : []),
    { id: 'equipamentos', rotulo: 'Equipamentos', icone: ClipboardCheck, contador: conferenciaDoDia.equipamentos.missing, contadorRotulo: 'a confirmar' },
    { id: 'operadores', rotulo: 'Operadores', icone: Users, contador: conferenciaDoDia.operadores.missing, contadorRotulo: 'a confirmar' },
    { id: 'history', rotulo: 'Histórico', icone: History },
    { id: 'registry', rotulo: 'Motoristas', icone: Database },
  ];
  const ITEM_MENU = `flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-emerald-50 hover:text-[#176b4d] disabled:opacity-50 ${FOCO}`;
  const ROTULO_GRUPO_MENU = 'px-3 pt-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400';
  const aviso = message && (
    <p role={messageTone === 'error' ? 'alert' : 'status'} data-testid="frota-aviso" className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ring-1 ring-inset ${messageTone === 'success' ? 'bg-emerald-50 text-emerald-900 ring-emerald-200' : messageTone === 'error' ? 'bg-rose-50 text-rose-800 ring-rose-200' : 'bg-[#f7f8f6] text-slate-700 ring-slate-200'}`}>
      {messageTone === 'success' ? <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" /> : messageTone === 'error' ? <AlertTriangle className="size-4 shrink-0" aria-hidden="true" /> : <RefreshCw className="size-4 shrink-0" aria-hidden="true" />}
      {message}
      <button type="button" onClick={() => setMessage('')} aria-label="Fechar aviso" className={`ml-auto grid size-8 shrink-0 place-items-center rounded-lg text-current/70 hover:bg-white/60 ${FOCO}`}><X className="size-4" aria-hidden="true" /></button>
    </p>
  );
  return (
    <TelaCheia ref={pageRef} id="controle-equipamentos-tab" rotulo="Controle de Frotas" className="text-slate-800"
      idAbaAtiva={idDaAba('frota', activeView)} idDados="frota-dados" chaveRolagem={activeView} longa={activeView === 'quadro'}
      cabecalho={<div data-fleet-enter>
        <PageHeader
          eyebrow="Frota"
          title="Controle de Frotas"
          abas={<AbasDaTela id="frota" rotulo="Subtelas do controle de frotas" abas={vistas} ativa={activeView} onTrocar={setActiveView} idPainel="frota-dados" testId="frota-aba" />}
          actions={<>
            {/* Dia consultado: vale para Situação do dia, Quadro, Equipamentos e Operadores. */}
            {/* Setas trocam de dia sem abrir o calendário; "Hoje" só aparece
                quando a pessoa está olhando outro dia. */}
            <div className="flex min-w-0 items-center gap-1" role="group" aria-label="Dia dos lançamentos">
              <button type="button" onClick={() => updateFilter('date', shiftIsoDate(filters.date, -1))} aria-label="Dia anterior" title="Dia anterior" className={`${BOTAO_SECUNDARIO} shrink-0 px-0 min-w-11 lg:min-w-10`} data-testid="frota-dia-anterior"><ChevronLeft className="size-5" aria-hidden="true" /></button>
              <label className="relative flex min-w-0 items-center">
                <span className="sr-only">Escolher o dia</span>
                <CalendarDays className="pointer-events-none absolute left-3 size-4 text-slate-400" aria-hidden="true" />
                <input type="date" value={filters.date} onChange={event => event.target.value && updateFilter('date', event.target.value)} className={`${CAMPO} min-w-0 pl-9 font-semibold sm:w-auto`} data-testid="frota-dia" />
              </label>
              <button type="button" onClick={() => updateFilter('date', shiftIsoDate(filters.date, 1))} aria-label="Próximo dia" title="Próximo dia" className={`${BOTAO_SECUNDARIO} shrink-0 px-0 min-w-11 lg:min-w-10`} data-testid="frota-dia-seguinte"><ChevronRight className="size-5" aria-hidden="true" /></button>
              {filters.date !== hoje && <button type="button" onClick={() => updateFilter('date', hoje)} className={`${BOTAO_SECUNDARIO} shrink-0 px-3`} data-testid="frota-hoje">Hoje</button>}
            </div>
            <p className="whitespace-nowrap text-sm font-semibold text-slate-600 first-letter:uppercase max-2xl:hidden">{dataLonga(filters.date)}</p>
            {activeView !== 'quadro' && <button type="button" onClick={() => setAtalhosAberto(true)} className={`${BOTAO_SECUNDARIO} max-lg:hidden`} aria-label="Atalhos do teclado" data-testid="frota-atalhos">
              <Keyboard className="size-4" aria-hidden="true" />
              <kbd className="text-xs">?</kbd>
            </button>}
            <input ref={inputRef} type="file" accept=".xlsx,.xlsm,.xls" className="hidden" onChange={readImport}/>
            <details className="erp-fleet-menu group relative" data-testid="frota-relatorios">
              <summary className={`${BOTAO_SECUNDARIO} cursor-pointer px-3 list-none [&::-webkit-details-marker]:hidden`}>
                <FileSpreadsheet className="size-4" aria-hidden="true" />
                Mais ações
                <ChevronDown className="size-4 transition duration-300 group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="absolute right-0 z-30 mt-2 w-64 min-w-60 space-y-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_40px_-16px_rgba(15,40,31,0.35)]">
                <p className={ROTULO_GRUPO_MENU}>Exportar</p>
                <button type="button" disabled={Boolean(exporting)} onClick={() => void handlePdf()} className={ITEM_MENU}><Printer className="size-4" aria-hidden="true" />{exporting === 'pdf' ? 'Gerando PDF…' : 'Relatório do dia em PDF'}</button>
                <button type="button" disabled={Boolean(exporting)} onClick={() => void handleExcel()} className={ITEM_MENU}><FileSpreadsheet className="size-4" aria-hidden="true" />{exporting === 'excel' ? 'Gerando Excel…' : 'Relatório do dia em Excel'}</button>
                <hr className="my-1 border-slate-100" />
                <p className={ROTULO_GRUPO_MENU}>Importar</p>
                <button type="button" onClick={() => inputRef.current?.click()} className={ITEM_MENU}><Upload className="size-4" aria-hidden="true" />Importar planilha</button>
                <ImportacaoSge
                  equipamentos={equipamentos}
                  registros={registros}
                  motoristas={operationalDrivers}
                  funcionarios={funcionarios}
                  empresas={empresas}
                  onImport={onImport}
                  onApplyCadastroSge={onApplyCadastroSge}
                  onMensagem={(tom, texto) => { setMessageTone(tom); setMessage(texto); }}
                  gatilho={abrir => <button type="button" onClick={abrir} className={ITEM_MENU}><Database className="size-4" aria-hidden="true" />Importar apontamento do SGE</button>}
                />
                <hr className="my-1 border-slate-100" />
                <p className={ROTULO_GRUPO_MENU}>Cadastro e tela</p>
                <button type="button" onClick={handleRefresh} className={ITEM_MENU}><RefreshCw className="size-4" aria-hidden="true" />Limpar filtros e seleção</button>
                {onOpenEquipmentRegistration && <button type="button" onClick={onOpenEquipmentRegistration} className={ITEM_MENU}><Plus className="size-4" aria-hidden="true" />Cadastrar equipamento</button>}
              </div>
            </details>
            <button type="button" onClick={() => openNewRecord()} className={`${BOTAO_PRIMARIO} shrink-0 whitespace-nowrap px-5`} data-testid="frota-novo">
              <Plus className="size-5" aria-hidden="true" />
              Novo lançamento
              <kbd className="hidden rounded-md bg-white/15 px-1.5 font-mono text-xs xl:inline">N</kbd>
            </button>
          </>}
        />
      </div>}
      faixa={aviso || undefined}
    >
      {activeView === 'today' && <div data-fleet-view className="flex min-h-0 flex-1 flex-col gap-3">
        <section aria-label="Resumo do dia" className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="frota-resumo-visualizacao">
          {[
            { rotulo: 'Total da frota', valor: viewModel.metrics.total, Icone: Truck, tom: 'text-slate-950', fundo: 'bg-slate-100 text-slate-700' },
            { rotulo: 'Em operação', valor: viewModel.metrics.operating, Icone: Truck, tom: 'text-emerald-700', fundo: 'bg-emerald-50 text-emerald-700' },
            { rotulo: 'Em manutenção', valor: viewModel.metrics.maintenance + viewModel.metrics.waitingMaintenance, Icone: Wrench, tom: 'text-rose-700', fundo: 'bg-rose-50 text-rose-700' },
            { rotulo: 'A confirmar', valor: viewModel.metrics.pending, Icone: Clock3, tom: 'text-amber-700', fundo: 'bg-amber-50 text-amber-700' },
          ].map(({ rotulo, valor, Icone, tom, fundo }) => (
            <article key={rotulo} className={`${CARTAO} flex items-center gap-4 p-4`}>
              <span className={`grid size-12 shrink-0 place-items-center rounded-xl ${fundo}`}><Icone className="size-6" aria-hidden="true" /></span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#5b6870]">{rotulo}</p>
                <p className={`font-mono text-3xl font-bold tabular-nums ${tom}`}>{valor}</p>
              </div>
            </article>
          ))}
        </section>
        <FleetFilterBar filters={filters} companies={empresas} groups={groups} equipmentTypes={equipmentTypes} activeFilterCount={activeFilterCount} onChange={updateFilter} onClear={clearFilters} avisos={viewModel.integrityWarnings}/>
        <FleetDataTable rows={viewModel.allRows} selectedIds={selectedIds} onSelectionChange={setSelectedIds} onEdit={openEdit} onDetails={setDetailState} onDelete={onDeleteMany ? state => setConfirmation({ kind: 'delete', ids: [state.recordId] }) : undefined} canApprove={canApproveFleet} onApprove={(state, status) => onApproveFleetRecord?.(state.recordId, status)}/>
        <PanoramaDoDia
          metrics={viewModel.metrics}
          status={filters.status}
          onStatus={status => updateFilter('status', status)}
          canteiros={canteirosDoDia}
          canteiro={filters.location || ''}
          onCanteiro={nome => updateFilter('location', nome)}
          equipamentos={{ total: conferenciaDoDia.equipamentos.total, informados: conferenciaDoDia.equipamentos.informed }}
          operadores={{ total: conferenciaDoDia.operadores.total, informados: conferenciaDoDia.operadores.informed }}
          onAbrirEquipamentos={() => setActiveView('equipamentos')}
          onAbrirOperadores={() => setActiveView('operadores')}
        />
      </div>}
      {activeView === 'quadro' && quadro && <div data-fleet-view>
        <React.Suspense fallback={<p className="p-8 text-center text-sm text-slate-500">Abrindo o quadro…</p>}>{quadro(filters.date, () => setActiveView('today'))}</React.Suspense>
      </div>}
      {activeView === 'equipamentos' && <div data-fleet-view className="flex min-h-0 flex-1 flex-col">
        <FleetDailyReference records={registros} date={filters.date} onLancar={openNewRecord} onRelacaoChange={relacaoMudou}/>
      </div>}
      {activeView === 'operadores' && <div data-fleet-view className="flex min-h-0 flex-1 flex-col">
        <FleetDriverReference records={registros} date={filters.date} drivers={operationalDrivers} onAddDrivers={onAddOperationalDrivers} onLancar={openNewRecord} onRelacaoChange={relacaoMudou}/>
      </div>}
      {activeView === 'history' && (
        <section data-fleet-view className="flex min-h-0 flex-1 flex-col gap-3" aria-labelledby="frota-historico-titulo">
          <header className={`${CARTAO} flex shrink-0 flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4`}>
            <div>
              <h2 id="frota-historico-titulo" className="text-lg font-bold text-slate-950">Fechamento por dia</h2>
              <p className="text-sm text-[#5b6870]">Quantas frotas trabalharam, pararam ou ficaram sem informar em cada dia. Toque no dia para abrir.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button type="button" disabled={Boolean(exporting) || !weeklyReport.records.length} onClick={() => void handleWeeklyPdf()} className={BOTAO_SECUNDARIO}><Printer className="size-4" aria-hidden="true"/>{exporting === 'weekly-pdf' ? 'Gerando…' : 'Semana em PDF'}</button>
              <button type="button" disabled={Boolean(exporting) || !weeklyReport.records.length} onClick={() => void handleWeeklyExcel()} className={BOTAO_SECUNDARIO}><FileSpreadsheet className="size-4" aria-hidden="true"/>{exporting === 'weekly-excel' ? 'Gerando…' : 'Semana em Excel'}</button>
            </div>
          </header>
          <div ref={escopoHistorico} className="flex min-h-[16rem] flex-1 flex-col">
            <TabelaPadrao
              titulo="Dias lançados"
              testId="frota-historico"
              linhas={historyByDate}
              colunas={COLUNAS_HISTORICO}
              idDaLinha={item => item.date}
              nomeDoItem={{ um: 'dia', varios: 'dias' }}
              ordenacaoInicial={{ chave: 'date', direcao: 'desc' }}
              onAbrirLinha={item => { updateFilter('date', item.date); setActiveView('today'); }}
              vazio="Nenhum dia lançado ainda."
            />
          </div>
        </section>
      )}
      {activeView === 'registry' && <section data-fleet-view className="flex min-h-0 flex-1 flex-col gap-3 xl:grid xl:grid-cols-[minmax(260px,0.6fr)_minmax(0,1.4fr)] xl:grid-rows-[minmax(0,1fr)]">
        <article data-fleet-lift className={`${CARTAO} shrink-0 self-start p-4`}>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#176b4d]">Frotas cadastradas</p>
          <CountUp value={equipamentos.length} className="mt-1 block text-3xl font-bold tabular-nums text-slate-950" />
          <p className="mt-1 text-sm text-[#5b6870]">Equipamentos que podem ser escolhidos no lançamento.</p>
          <div className="mt-4 flex flex-wrap gap-1.5">{equipmentTypes.slice(0, 8).map(type => <span key={type} className="rounded-full bg-[#f7f8f6] px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">{type}</span>)}</div>
          {onOpenEquipmentRegistration && <button type="button" onClick={onOpenEquipmentRegistration} className={`${BOTAO_SECUNDARIO} mt-4 w-full`}><Plus className="size-4" aria-hidden="true"/>Novo equipamento</button>}
        </article>
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <header className={`${CARTAO} shrink-0 p-3 sm:p-4`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Motoristas e operadores <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 font-mono text-sm text-slate-700">{operationalDrivers.length}</span></h2>
                <p className="mt-1 text-sm text-[#5b6870]">Lista usada no lançamento da frota.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="relative block sm:w-72">
                  <span className="sr-only">Buscar motorista</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true"/>
                  <input type="search" value={driverSearch} onChange={event => setDriverSearch(event.target.value)} placeholder="Matrícula, nome ou função" className={`${CAMPO} pl-9`} data-testid="frota-motoristas-busca"/>
                </label>
                <button type="button" onClick={() => setDriverEditor({ id: `motorista-operacional-${Date.now()}`, nome: '', matricula: '', cargo: 'OPERADOR DE CAMINHAO BASCULANTE', empresaId: empresas[0]?.id || '', telefone: '', ativo: true, status: 'ATIVO', area: 'FROTAS OPERACIONAIS', divisao: 'OPERAÇÃO' })} className={BOTAO_PRIMARIO}><Plus className="size-4" aria-hidden="true"/>Novo motorista</button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">{Object.entries(driverRoleCounts).sort((a, b) => b[1] - a[1]).map(([role, count]) => <span key={role} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-inset ring-emerald-200">{count} · {role}</span>)}</div>
          </header>
          <div ref={escopoMotoristas} className="flex min-h-[16rem] flex-1 flex-col">
            <TabelaPadrao
              titulo="Motoristas e operadores"
              testId="frota-motoristas"
              linhas={filteredOperationalDrivers}
              colunas={COLUNAS_MOTORISTAS}
              idDaLinha={driver => driver.id}
              nomeDoItem={{ um: 'motorista', varios: 'motoristas' }}
              ordenacaoInicial={{ chave: 'nome', direcao: 'asc' }}
              vazio={driverSearch ? `Nenhum motorista encontrado para “${driverSearch}”.` : 'Nenhum motorista cadastrado.'}
              acoes={driver => <>
                <button type="button" onClick={() => setDriverEditor(driver)} aria-label={`Editar ${driver.nome}`} title="Editar" className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-600 hover:border-emerald-400 hover:text-[#176b4d] md:size-8 md:min-h-0 md:min-w-0 md:px-0 ${FOCO}`}><Pencil className="size-4" aria-hidden="true"/><span className="md:hidden">Editar</span></button>
                {onDeleteOperationalDriver && <button type="button" onClick={() => setDriverExclusao(driver)} aria-label={`Excluir ${driver.nome}`} title="Excluir" className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-600 hover:border-rose-300 hover:text-rose-700 md:size-8 md:min-h-0 md:min-w-0 md:px-0 ${FOCO}`}><Trash2 className="size-4" aria-hidden="true"/><span className="md:hidden">Excluir</span></button>}
              </>}
            />
          </div>
        </div>
      </section>}
      <Modal
        open={Boolean(driverEditor)}
        title={driverEditor && operationalDrivers.some(item => item.id === driverEditor.id) ? 'Editar motorista' : 'Novo motorista'}
        size="sm"
        onClose={() => setDriverEditor(null)}
        onSubmit={salvarMotorista}
        footer={<>
          <button type="button" onClick={() => setDriverEditor(null)} className={BOTAO_SECUNDARIO}>Cancelar</button>
          <button type="button" onClick={salvarMotorista} className={BOTAO_PRIMARIO}>Salvar motorista</button>
        </>}
      >
        {driverEditor && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={ROTULO}>Matrícula<input required value={String(driverEditor.matricula || '')} onChange={event => setDriverEditor({ ...driverEditor, matricula: event.target.value })} className={`${CAMPO} mt-1`}/></label>
            <label className={ROTULO}>Nome<input required value={String(driverEditor.nome || '')} onChange={event => setDriverEditor({ ...driverEditor, nome: event.target.value.toUpperCase() })} className={`${CAMPO} mt-1`}/></label>
            <label className={`${ROTULO} sm:col-span-2`}>Função<input value={String(driverEditor.cargo || '')} onChange={event => setDriverEditor({ ...driverEditor, cargo: event.target.value.toUpperCase() })} className={`${CAMPO} mt-1`}/></label>
            {driverErro && <p role="alert" className="text-sm font-semibold text-rose-700 sm:col-span-2">{driverErro}</p>}
          </div>
        )}
      </Modal>
      <ConfirmDialog open={Boolean(driverExclusao)} title={`Excluir ${driverExclusao?.nome || 'motorista'}?`} description="Ele sai da lista de motoristas da frota. Os lançamentos já feitos com ele continuam como estão." confirmLabel="Excluir motorista" tone="danger" onCancel={() => setDriverExclusao(null)} onConfirm={() => { if (driverExclusao) onDeleteOperationalDriver?.(driverExclusao.id); setDriverExclusao(null); }}/>
      <FleetBulkActions count={selectedIds.length} onClear={() => setSelectedIds([])} onDelete={onDeleteMany ? () => setConfirmation({ kind: 'delete', ids: selectedIds }) : undefined} onExport={() => void handleExcel(true)} onChangeStatus={status => setConfirmation({ kind: 'status', ids: selectedIds, status })}/>
      <FleetReportLayout viewModel={viewModel}/>
      {formOpen && <DailyRecordForm record={editingRecord} preset={editingRecord ? undefined : { data: filters.date, ...formPreset }} records={registros} equipment={equipamentos} employees={operationalDrivers} companies={empresas} teams={gruposEquipe} maintenanceOrders={ordensServico} registeredBy={registeredBy} onSave={handleSaved} onClose={() => { setFormOpen(false); setEditingRecord(undefined); }} onOpenDriverRegistry={() => { setFormOpen(false); setEditingRecord(undefined); setActiveView('registry'); }} onOpenEquipmentRegistry={onOpenEquipmentRegistration ? () => { setFormOpen(false); setEditingRecord(undefined); onOpenEquipmentRegistration(); } : undefined} onOpenMaintenance={onOpenMaintenance}/>}
      <FleetDetailDrawer state={detailState} onClose={() => setDetailState(undefined)} onEdit={openEdit}/>
      <ConfirmDialog open={Boolean(confirmation)} title={confirmation?.kind === 'delete' ? `Excluir ${confirmation.ids.length} lançamento(s)?` : `Mudar ${confirmation?.ids.length || 0} lançamento(s)?`} description={confirmation?.kind === 'delete' ? 'Some só o lançamento deste dia. A máquina continua cadastrada e o histórico de alterações fica registrado.' : `A situação passa para "${confirmation?.status}" e cada lançamento ganha um registro no histórico.`} confirmLabel={confirmation?.kind === 'delete' ? 'Excluir lançamentos' : 'Mudar situação'} tone={confirmation?.kind === 'delete' ? 'danger' : 'warning'} busy={confirmationBusy} onCancel={() => setConfirmation(undefined)} onConfirm={executeConfirmation}/>
      <FleetImportPreviewModal
        open={Boolean(importPreview)}
        title={`Conferir a planilha${importFileName ? `: ${importFileName}` : ''}`}
        description="Nada entra no sistema antes de você confirmar. Linhas com erro ficam de fora."
        stats={importPreview ? [
          { label: 'Novos', value: importPreview.newCount, tone: TOM_SITUACAO.ok },
          { label: 'Atualizações', value: importPreview.updateCount, tone: 'bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200' },
          { label: 'Já existentes', value: importPreview.duplicateCount, tone: TOM_SITUACAO.inativo },
          { label: 'Ignorados', value: importPreview.ignoredCount, tone: TOM_SITUACAO.alerta },
          { label: 'Com erro', value: importPreview.errorCount, tone: 'bg-rose-50 text-rose-800 ring-1 ring-inset ring-rose-200' },
        ] : []}
        rows={(importPreview?.rows || []).map((row): FleetImportPreviewRow => ({
          key: `${row.rowNumber}-${row.key}`,
          rowNumber: row.rowNumber,
          dispositionLabel: ({ NEW: 'Novo', UPDATE: 'Atualiza', DUPLICATE: 'Já existe', IGNORED: 'Ignorado', ERROR: 'Erro' } as Record<string, string>)[row.disposition] || row.disposition,
          prefixo: row.record?.prefixo || '',
          pessoa: row.record?.nomeMotorista || '',
          data: row.record?.data || '',
          messages: row.messages.join(' '),
        }))}
        applyCount={(importPreview?.newCount || 0) + (importPreview?.updateCount || 0)}
        canApply={Boolean(importPreview?.canApply)}
        onClose={() => { setImportPreview(undefined); setImportFileName(''); }}
        onApply={applyImportPreview}
      />
      <Modal open={atalhosAberto} title="Atalhos do teclado" size="sm" onClose={() => setAtalhosAberto(false)}>
        <dl className="divide-y divide-slate-100">
          {ATALHOS.map(atalho => (
            <div key={atalho.teclas} className="flex items-center justify-between gap-4 py-2.5">
              <dt className="text-sm text-slate-700">{atalho.oQueFaz}</dt>
              <dd><kbd className="whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-sm font-bold text-slate-700">{atalho.teclas}</kbd></dd>
            </div>
          ))}
        </dl>
      </Modal>
    </TelaCheia>
  );
}
