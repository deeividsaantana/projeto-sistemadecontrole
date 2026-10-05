import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import {
  AlertTriangle,
  CalendarDays,
  Database,
  CheckCircle2,
  ChevronDown,
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
  X,
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
import FleetKpiStrip from './fleet/FleetKpiStrip';
import FleetFilterBar from './fleet/FleetFilterBar';
import FleetDataTable from './fleet/FleetDataTable';
import FleetBulkActions from './fleet/FleetBulkActions';
import FleetDetailDrawer from './fleet/FleetDetailDrawer';
import DailyRecordForm from './fleet/DailyRecordForm';
import FleetReportLayout from './fleet/FleetReportLayout';
import FleetImportPreviewModal, { type FleetImportPreviewRow } from './fleet/FleetImportPreviewModal';
import ImportacaoSge from './fleet/ImportacaoSge';
import { ConfirmDialog, CountUp, Modal, PageHeader } from '../shared/ui';
import FleetDailyReference from './fleet/FleetDailyReference';
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
  onDeleteMany: (ids: string[]) => void;
  onOpenMaintenance?: () => void;
  onOpenEmployeeRegistration: () => void;
  onOpenEquipmentRegistration?: () => void;
  onSaveOperationalDriver?: (driver: Funcionario, isNew: boolean) => void;
  onDeleteOperationalDriver?: (id: string) => void;
  canApproveFleet?: boolean;
  /** Nome de quem está usando o sistema; grava a autoria do lançamento. */
  registeredBy?: string;
  onApproveFleetRecord?: (id: string, status: 'APROVADO' | 'REJEITADO') => void;
  /** Abre outra aba do sistema (Quadro da Frota). */
  onNavigate?: (aba: string) => void;
}

type ConfirmationState =
  | { kind: 'delete'; ids: string[] }
  | { kind: 'status'; ids: string[]; status: FleetOperationalStatus };

type FleetView = 'today' | 'history' | 'registry';

const CHAVE_VISTA = 'renea_frota_vista';
const vistaGuardada = (): FleetView => {
  try {
    const salva = window.localStorage.getItem(CHAVE_VISTA);
    return salva === 'history' || salva === 'registry' ? salva : 'today';
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
  onOpenEmployeeRegistration,
  onOpenEquipmentRegistration,
  operationalDrivers: operationalDriversProp,
  onSaveOperationalDriver,
  onDeleteOperationalDriver,
  canApproveFleet = false,
  registeredBy = 'Operação',
  onApproveFleetRecord,
  onNavigate,
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingRecord, setEditingRecord] = useState<FleetPersistedRecord>();
  const [formOpen, setFormOpen] = useState(false);
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
  // A troca de vista (Situação do dia / Histórico / Motoristas) recriava o
  // conteúdo sem nenhuma transição — a tela "piscava" de uma vista pra outra.
  useGSAP(() => {
    const view = pageRef.current?.querySelector('[data-fleet-view]');
    if (!view || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(
      view,
      { autoAlpha: 0, y: 10 },
      { autoAlpha: 1, y: 0, duration: 0.32, ease: 'power2.out', clearProps: 'transform,visibility,opacity' },
    );
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
  const canteirosDoDia = useMemo(() => {
    const contagem = new Map<string, number>();
    registros.forEach(record => {
      if (record.data !== filters.date) return;
      const local = (record as FleetPersistedRecord).local?.trim();
      if (local) contagem.set(local, (contagem.get(local) || 0) + 1);
    });
    return [...contagem.entries()]
      .map(([nome, total]) => ({ nome, total }))
      .sort((left, right) => right.total - left.total || left.nome.localeCompare(right.nome, 'pt-BR'));
  }, [registros, filters.date]);
  const historyByDate = useMemo(() => {
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
  const openNewRecord = () => {
    setEditingRecord(undefined);
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
      } else if (event.key === '?') {
        event.preventDefault();
        setAtalhosAberto(true);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [atalhosAberto]);
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
      const result = await generateFleetPdf(viewModel);
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
      const result = await exportFleetExcel(report);
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
        onDeleteMany(confirmation.ids);
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
  const vistas = [
    ['today', 'Situação do dia', CalendarDays],
    ['history', 'Histórico', History],
    ['registry', 'Motoristas', Database],
  ] as const;
  const ITEM_MENU = `flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-emerald-50 hover:text-[#176b4d] disabled:opacity-50 ${FOCO}`;
  const ROTULO_GRUPO_MENU = 'px-3 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400';
  const aviso = message && (
    <p role={messageTone === 'error' ? 'alert' : 'status'} data-testid="frota-aviso" className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ring-1 ring-inset ${messageTone === 'success' ? 'bg-emerald-50 text-emerald-900 ring-emerald-200' : messageTone === 'error' ? 'bg-rose-50 text-rose-800 ring-rose-200' : 'bg-[#f7f8f6] text-slate-700 ring-slate-200'}`}>
      {messageTone === 'success' ? <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" /> : messageTone === 'error' ? <AlertTriangle className="size-4 shrink-0" aria-hidden="true" /> : <RefreshCw className="size-4 shrink-0" aria-hidden="true" />}
      {message}
      <button type="button" onClick={() => setMessage('')} aria-label="Fechar aviso" className={`ml-auto grid size-8 shrink-0 place-items-center rounded-lg text-current/70 hover:bg-white/60 ${FOCO}`}><X className="size-4" aria-hidden="true" /></button>
    </p>
  );
  return (
    <main id="controle-equipamentos-tab" ref={pageRef} className="mx-auto max-w-[1760px] space-y-4 pb-24 text-slate-800">
      <div data-fleet-enter>
        <PageHeader
          eyebrow="Frota"
          title="Controle de Frotas"
          description="Lançamento do dia de cada frota: quem saiu, quem está em manutenção e o que falta informar."
          actions={<div className="flex w-full min-w-0 flex-col gap-2.5">
            {/* Linha principal: escolher a vista e lançar. É o que se usa toda hora. */}
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-between">
              <nav className="grid w-full grid-cols-[1.3fr_1fr_1fr] gap-1 rounded-2xl bg-[#f7f8f6] p-1 ring-1 ring-inset ring-slate-200 sm:inline-grid sm:w-auto" aria-label="Visões do controle de frotas">
                {vistas.map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={activeView === id}
                    onClick={() => setActiveView(id)}
                    className={`inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-2 text-sm font-bold transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] sm:px-3 ${activeView === id ? 'bg-white text-[#176b4d] shadow-[0_6px_16px_-10px_rgba(15,40,31,0.45)] ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'} ${FOCO}`}
                  >
                    <Icon className="size-4 max-sm:hidden" aria-hidden="true"/>{label}
                  </button>
                ))}
              </nav>
              <button type="button" onClick={openNewRecord} className={`${BOTAO_PRIMARIO} w-full px-5 sm:w-auto`} data-testid="frota-novo">
                <Plus className="size-5" aria-hidden="true" />
                Novo lançamento
                <kbd className="hidden rounded-md bg-white/15 px-1.5 font-mono text-xs xl:inline">N</kbd>
              </button>
            </div>
            {/* Linha secundária: dia consultado e utilitários (relatório, importar, cadastro). */}
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:justify-end">
              <label className="relative flex w-full min-w-0 items-center sm:inline-flex sm:w-auto">
                <span className="sr-only">Dia dos lançamentos</span>
                <CalendarDays className="pointer-events-none absolute left-3 size-4 text-slate-400" aria-hidden="true" />
                <input type="date" value={filters.date} onChange={event => event.target.value && updateFilter('date', event.target.value)} className={`${CAMPO} min-w-0 pl-9 font-semibold sm:w-auto`} data-testid="frota-dia" />
              </label>
              <div className="grid grid-cols-2 gap-2 sm:contents">
              {onNavigate && (
                <button type="button" onClick={() => onNavigate('quadro-frota')} className={`${BOTAO_SECUNDARIO} w-full px-3 sm:w-auto`} data-testid="frota-abrir-quadro">
                  <LayoutGrid className="size-4" aria-hidden="true" />
                  Quadro
                </button>
              )}
              <input ref={inputRef} type="file" accept=".xlsx,.xlsm,.xls" className="hidden" onChange={readImport}/>
              <button type="button" onClick={() => setAtalhosAberto(true)} className={`${BOTAO_SECUNDARIO} max-lg:hidden`} aria-label="Atalhos do teclado" data-testid="frota-atalhos">
                <Keyboard className="size-4" aria-hidden="true" />
                <kbd className="text-xs">?</kbd>
              </button>
              <details className="erp-fleet-menu group relative w-full sm:w-auto" data-testid="frota-relatorios">
                <summary className={`${BOTAO_SECUNDARIO} w-full cursor-pointer px-3 list-none sm:w-auto [&::-webkit-details-marker]:hidden`}>
                  <FileSpreadsheet className="size-4" aria-hidden="true" />
                  Mais ações
                  <ChevronDown className="size-4 transition duration-300 group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="absolute right-0 z-30 mt-2 w-full min-w-60 space-y-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_40px_-16px_rgba(15,40,31,0.35)] sm:w-64">
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
              </div>
            </div>
          </div>}
        />
        <p className="-mt-1 text-sm font-semibold text-slate-500 first-letter:uppercase">{dataLonga(filters.date)}</p>
      </div>
      {aviso}
      {activeView === 'today' && <div data-fleet-view className="space-y-4">
        <FleetKpiStrip metrics={viewModel.metrics} status={filters.status} onPick={status => updateFilter('status', status)}/>
        <FleetDailyReference records={registros} date={filters.date}/>
        {viewModel.integrityWarnings.length > 0 && (
          <details open={viewModel.integrityWarnings.length <= 3} className={`group overflow-hidden rounded-2xl border-2 border-amber-300 bg-amber-50 ${FOCO}`} data-testid="frota-conferencia">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-300"><AlertTriangle className="size-5" aria-hidden="true" /></span>
              <span className="min-w-0">
                <span className="block text-base font-bold text-amber-900">{viewModel.integrityWarnings.length} ponto(s) para conferir nos lançamentos</span>
                <span className="block text-xs font-semibold text-amber-700">Toque para {viewModel.integrityWarnings.length <= 3 ? 'esconder' : 'ver'} a lista</span>
              </span>
              <ChevronDown className="ml-auto size-5 shrink-0 text-amber-700 transition duration-300 group-open:rotate-180" aria-hidden="true" />
            </summary>
            <ul className="max-h-48 space-y-1 overflow-y-auto border-t border-amber-200 bg-white/60 px-4 py-3 text-sm text-amber-900">
              {viewModel.integrityWarnings.map(warning => (
                <li key={warning} className="flex items-start gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                  {warning}
                </li>
              ))}
            </ul>
          </details>
        )}
        <FleetFilterBar filters={filters} companies={empresas} groups={groups} equipmentTypes={equipmentTypes} locations={canteirosDoDia} activeFilterCount={activeFilterCount} onChange={updateFilter} onClear={clearFilters}/>
        <FleetDataTable rows={viewModel.allRows} selectedIds={selectedIds} onSelectionChange={setSelectedIds} onEdit={openEdit} onDetails={setDetailState} onDelete={state => setConfirmation({ kind: 'delete', ids: [state.recordId] })} canApprove={canApproveFleet} onApprove={(state, status) => onApproveFleetRecord?.(state.recordId, status)}/>
      </div>}
      {activeView === 'history' && (
        <section data-fleet-view className={`${CARTAO} overflow-hidden`} aria-labelledby="frota-historico-titulo">
          <header className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="frota-historico-titulo" className="text-lg font-bold text-slate-950">Fechamento por dia</h2>
              <p className="text-sm text-slate-500">Quantas frotas trabalharam, pararam ou ficaram sem informar em cada dia. Toque no dia para abrir.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button type="button" disabled={Boolean(exporting) || !weeklyReport.records.length} onClick={() => void handleWeeklyPdf()} className={BOTAO_SECUNDARIO}><Printer className="size-4" aria-hidden="true"/>{exporting === 'weekly-pdf' ? 'Gerando…' : 'Semana em PDF'}</button>
              <button type="button" disabled={Boolean(exporting) || !weeklyReport.records.length} onClick={() => void handleWeeklyExcel()} className={BOTAO_SECUNDARIO}><FileSpreadsheet className="size-4" aria-hidden="true"/>{exporting === 'weekly-excel' ? 'Gerando…' : 'Semana em Excel'}</button>
            </div>
          </header>
          <ul className="divide-y divide-slate-100">
            {historyByDate.map(item => {
              const disponibilidade = item.total ? Math.round(((item.operating + item.available) / item.total) * 100) : 0;
              return (
                <li key={item.date}>
                  <button type="button" onClick={() => { updateFilter('date', item.date); setActiveView('today'); }} className={`grid w-full gap-2 px-4 py-3 text-left transition hover:bg-emerald-50/40 sm:grid-cols-[11rem_minmax(0,1fr)_7rem] sm:items-center ${FOCO}`}>
                    <span>
                      <span className="block font-bold text-slate-900 first-letter:uppercase">{new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                      <span className="text-xs text-slate-500">{item.total} frota(s) lançada(s)</span>
                    </span>
                    <span className="flex flex-wrap gap-1.5 text-xs font-bold">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[#176b4d] ring-1 ring-inset ring-emerald-200">{item.operating} operando</span>
                      {item.maintenance > 0 && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700 ring-1 ring-inset ring-rose-200">{item.maintenance} manutenção</span>}
                      {item.available > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800 ring-1 ring-inset ring-amber-200">{item.available} à disposição</span>}
                      {item.pending > 0 && <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[#f26a2e] ring-1 ring-inset ring-orange-200">{item.pending} a confirmar</span>}
                    </span>
                    <span className="sm:text-right">
                      <span className="block text-lg font-bold tabular-nums text-slate-900">{item.total ? `${disponibilidade}%` : '—'}</span>
                      <span className="block h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-[#176b4d]" style={{ width: `${disponibilidade}%` }} /></span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {!historyByDate.length && <p className="p-10 text-center text-sm text-slate-500">Nenhum dia lançado ainda.</p>}
        </section>
      )}
      {activeView === 'registry' && <section data-fleet-view className="grid gap-3 xl:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)]">
        <article data-fleet-lift className={`${CARTAO} p-4`}>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#176b4d]">Frotas cadastradas</p>
          <CountUp value={equipamentos.length} className="mt-1 block text-3xl font-bold tabular-nums text-slate-950" />
          <p className="mt-1 text-sm text-slate-500">Equipamentos que podem ser escolhidos no lançamento.</p>
          <div className="mt-4 flex flex-wrap gap-1.5">{equipmentTypes.slice(0, 8).map(type => <span key={type} className="rounded-full bg-[#f7f8f6] px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">{type}</span>)}</div>
          {onOpenEquipmentRegistration && <button type="button" onClick={onOpenEquipmentRegistration} className={`${BOTAO_SECUNDARIO} mt-4 w-full`}><Plus className="size-4" aria-hidden="true"/>Novo equipamento</button>}
        </article>
        <article data-fleet-enter className={`${CARTAO} overflow-hidden`}>
          <header className="border-b border-slate-100 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Motoristas e operadores <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 font-mono text-sm text-slate-700">{operationalDrivers.length}</span></h2>
                <p className="mt-1 text-sm text-slate-500">Lista usada no lançamento da frota.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="relative block sm:w-72">
                  <span className="sr-only">Buscar motorista</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true"/>
                  <input value={driverSearch} onChange={event => setDriverSearch(event.target.value)} placeholder="Matrícula, nome ou função" className={`${CAMPO} pl-9`}/>
                </label>
                <button type="button" onClick={() => setDriverEditor({ id: `motorista-operacional-${Date.now()}`, nome: '', matricula: '', cargo: 'OPERADOR DE CAMINHAO BASCULANTE', empresaId: empresas[0]?.id || '', telefone: '', ativo: true, status: 'ATIVO', area: 'FROTAS OPERACIONAIS', divisao: 'OPERAÇÃO' })} className={BOTAO_PRIMARIO}><Plus className="size-4" aria-hidden="true"/>Novo motorista</button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">{Object.entries(driverRoleCounts).sort((a, b) => b[1] - a[1]).map(([role, count]) => <span key={role} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-inset ring-emerald-200">{count} · {role}</span>)}</div>
          </header>
          <ul className="max-h-[430px] divide-y divide-slate-100 overflow-auto">
            {filteredOperationalDrivers.map(driver => (
              <li key={driver.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 hover:bg-emerald-50/40">
                <span className="w-16 shrink-0 font-mono text-sm font-bold text-slate-700">{driver.matricula}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-950">{driver.nome}</span>
                  <span className="block truncate text-xs text-slate-500">{driver.cargo}</span>
                </span>
                <span className="flex gap-1">
                  <button type="button" onClick={() => setDriverEditor(driver)} aria-label={`Editar ${driver.nome}`} className={`grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-[#176b4d] ${FOCO}`}><Pencil className="size-4" aria-hidden="true"/></button>
                  {onDeleteOperationalDriver && <button type="button" onClick={() => setDriverExclusao(driver)} aria-label={`Excluir ${driver.nome}`} className={`grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:border-rose-300 hover:text-rose-700 ${FOCO}`}><Trash2 className="size-4" aria-hidden="true"/></button>}
                </span>
              </li>
            ))}
          </ul>
          {!filteredOperationalDrivers.length && <p className="p-8 text-center text-sm text-slate-500">Nenhum motorista encontrado para “{driverSearch}”.</p>}
        </article>
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
      <FleetBulkActions count={selectedIds.length} onClear={() => setSelectedIds([])} onDelete={() => setConfirmation({ kind: 'delete', ids: selectedIds })} onExport={() => void handleExcel(true)} onChangeStatus={status => setConfirmation({ kind: 'status', ids: selectedIds, status })}/>
      <FleetReportLayout viewModel={viewModel}/>
      {formOpen && <DailyRecordForm record={editingRecord} records={registros} equipment={equipamentos} employees={operationalDrivers} companies={empresas} teams={gruposEquipe} maintenanceOrders={ordensServico} registeredBy={registeredBy} onSave={handleSaved} onClose={() => { setFormOpen(false); setEditingRecord(undefined); }} onOpenEmployeeRegistration={onOpenEmployeeRegistration} onOpenDriverRegistry={() => { setFormOpen(false); setEditingRecord(undefined); setActiveView('registry'); }} onOpenEquipmentRegistry={() => { setFormOpen(false); setEditingRecord(undefined); onOpenEquipmentRegistration?.(); }} onOpenMaintenance={onOpenMaintenance}/>}
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
    </main>
  );
}
