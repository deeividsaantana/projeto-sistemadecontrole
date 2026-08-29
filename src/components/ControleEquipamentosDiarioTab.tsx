import React, { useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Database,
  FileDown,
  FileSpreadsheet,
  History,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Upload,
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
import ConfirmDialog from './fleet/ConfirmDialog';

interface Props {
  registros: ControleEquipamentoDiario[];
  equipamentos: Equipamento[];
  empresas: Empresa[];
  funcionarios: Funcionario[];
  gruposEquipe: GrupoEquipe[];
  ordensServico: OrdemServico[];
  onSave: (registro: ControleEquipamentoDiario, isNew: boolean) => void | Promise<void>;
  onImport: (registros: ControleEquipamentoDiario[]) => void;
  onDeleteMany: (ids: string[]) => void;
  onOpenMaintenance: () => void;
  onOpenEmployeeRegistration: () => void;
}

type ConfirmationState =
  | { kind: 'delete'; ids: string[] }
  | { kind: 'status'; ids: string[]; status: FleetOperationalStatus };

type FleetView = 'today' | 'history' | 'registry';

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
  onDeleteMany,
  onOpenMaintenance,
  onOpenEmployeeRegistration,
}: Props) {
  const operationalDrivers = useMemo(() => [...OPERATIONAL_DRIVERS], []);
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
  const [activeView, setActiveView] = useState<FleetView>('today');
  const [driverSearch, setDriverSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
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
  const openNewRecord = () => {
    setEditingRecord(undefined);
    setFormOpen(true);
  };
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
    setMessage(isNew ? 'Lançamento criado com histórico.' : 'Lançamento atualizado com histórico.');
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
  return (
    <main className="mx-auto max-w-[1760px] space-y-4 text-slate-800">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Complexo do Alto Tietê</p>
          <h1 className="mt-1 text-2xl font-black leading-tight text-slate-950 sm:text-3xl">Controle Operacional de Frotas</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">Situação diária, motoristas, saídas, pendências e relatórios em uma única visão operacional.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button type="button" onClick={openNewRecord} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 text-xs font-black text-white hover:bg-emerald-700"><Plus size={15}/>Novo lançamento</button>
          <button type="button" onClick={handleRefresh} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"><RefreshCw size={15}/>Atualizar</button>
          <button type="button" disabled={Boolean(exporting)} onClick={() => void handlePdf()} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 disabled:opacity-50"><Printer size={15}/>{exporting==='pdf'?'Gerando...':'Relatório PDF'}</button>
          <button type="button" disabled={Boolean(exporting)} onClick={() => void handleExcel()} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 disabled:opacity-50"><FileSpreadsheet size={15}/>{exporting==='excel'?'Gerando...':'Exportar Excel'}</button>
          <input ref={inputRef} type="file" accept=".xlsx,.xlsm,.xls" className="hidden" onChange={readImport}/>
          <button type="button" onClick={() => inputRef.current?.click()} className="col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 sm:col-span-1"><Upload size={15}/>Importar</button>
        </div>
      </header>
      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200" aria-label="Visões do controle de frotas">
        {([
          ['today', 'Situação do dia', CalendarDays],
          ['history', 'Histórico semanal', History],
          ['registry', 'Cadastros vinculados', Database],
        ] as const).map(([id, label, Icon]) => (
          <button key={String(id)} type="button" onClick={() => setActiveView(id as FleetView)} className={`inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-black transition-colors ${activeView === id ? 'border-emerald-700 text-emerald-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            <Icon size={16}/>{label}
          </button>
        ))}
      </nav>
      {message && <div role={messageTone==='error'?'alert':'status'} className={`rounded-md border px-3 py-2 text-xs font-bold ${messageTone==='success'?'border-emerald-200 bg-emerald-50 text-emerald-800':messageTone==='error'?'border-rose-200 bg-rose-50 text-rose-800':'border-sky-200 bg-sky-50 text-sky-800'}`}>{message}</div>}
      {activeView === 'today' && <>
      <FleetKpiStrip metrics={viewModel.metrics}/>
      {viewModel.integrityWarnings.length>0 && <details className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2"><summary className="cursor-pointer text-xs font-black text-amber-900">Conferência pendente: {viewModel.integrityWarnings.length} aviso(s) nos dados filtrados</summary><ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-xs text-amber-900">{viewModel.integrityWarnings.map(warning=><li key={warning}>{warning}</li>)}</ul></details>}
      <FleetFilterBar filters={filters} companies={empresas} groups={groups} equipmentTypes={equipmentTypes} activeFilterCount={activeFilterCount} onChange={updateFilter} onClear={clearFilters}/>
      <FleetDataTable rows={viewModel.allRows} selectedIds={selectedIds} onSelectionChange={setSelectedIds} onEdit={openEdit} onDetails={setDetailState} onDelete={state=>setConfirmation({kind:'delete',ids:[state.recordId]})}/>
      </>}
      {activeView === 'history' && <section className="overflow-hidden rounded-lg border border-slate-200 bg-white"><header className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-black text-slate-950">Fechamentos por data</h2><p className="text-xs text-slate-500">Comparativo dos registros operacionais e exportação dos últimos sete dias.</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={Boolean(exporting) || !weeklyReport.records.length} onClick={() => void handleWeeklyPdf()} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 disabled:opacity-40"><Printer size={15}/>{exporting==='weekly-pdf'?'Gerando...':'Semanal PDF'}</button><button type="button" disabled={Boolean(exporting) || !weeklyReport.records.length} onClick={() => void handleWeeklyExcel()} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 disabled:opacity-40"><FileSpreadsheet size={15}/>{exporting==='weekly-excel'?'Gerando...':'Semanal Excel'}</button></div></header><div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr>{['Data','Total de frotas','Em operação','Em manutenção','À disposição','A confirmar','Disponibilidade'].map(label=><th key={label} className="border-b border-slate-200 px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{historyByDate.map(item=><tr key={item.date}><td className="px-4 py-3 font-black">{new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-BR')}</td><td className="px-4 py-3">{item.total}</td><td className="px-4 py-3 font-bold text-emerald-700">{item.operating}</td><td className="px-4 py-3 font-bold text-rose-700">{item.maintenance}</td><td className="px-4 py-3 font-bold text-sky-700">{item.available}</td><td className="px-4 py-3 font-bold text-amber-700">{item.pending}</td><td className="px-4 py-3 font-black">{item.total ? `${(((item.operating + item.available) / item.total) * 100).toFixed(1).replace('.', ',')}%` : '—'}</td></tr>)}</tbody></table></div>{!historyByDate.length&&<p className="p-10 text-center text-sm text-slate-500">Nenhum fechamento disponível.</p>}</section>}
      {activeView === 'registry' && <section className="grid gap-3 xl:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)]">
        <article className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Frotas cadastradas</p>
          <strong className="mt-2 block text-3xl text-slate-950">{equipamentos.length}</strong>
          <p className="mt-1 text-xs text-slate-500">Equipamentos disponíveis para vínculo nos lançamentos.</p>
          <div className="mt-4 flex flex-wrap gap-2">{equipmentTypes.slice(0,8).map(type=><span key={type} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">{type}</span>)}</div>
        </article>
        <article className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <header className="border-b border-slate-200 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Mini lista independente</p>
                <h2 className="mt-1 text-lg font-black text-slate-950">Motoristas e operadores <span className="text-emerald-700">{operationalDrivers.length}</span></h2>
                <p className="mt-1 text-xs text-slate-500">Cadastro exclusivo das frotas, separado dos colaboradores gerais.</p>
              </div>
              <label className="relative block sm:w-72">
                <span className="sr-only">Buscar motorista</span>
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                <input value={driverSearch} onChange={event=>setDriverSearch(event.target.value)} placeholder="Matrícula, nome ou função" className="h-10 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"/>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">{Object.entries(driverRoleCounts).sort((a,b)=>b[1]-a[1]).map(([role,count])=><span key={role} className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-800">{count} · {role}</span>)}</div>
          </header>
          <div className="max-h-[430px] overflow-auto">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="sticky top-0 z-[1] bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="border-b border-slate-200 px-4 py-3">Matrícula</th><th className="border-b border-slate-200 px-4 py-3">Motorista / operador</th><th className="border-b border-slate-200 px-4 py-3">Função</th><th className="border-b border-slate-200 px-4 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{filteredOperationalDrivers.map(driver=><tr key={driver.id} className="hover:bg-emerald-50/50"><td className="px-4 py-3 font-mono font-black text-slate-800">{driver.matricula}</td><td className="px-4 py-3 font-bold text-slate-950">{driver.nome}</td><td className="px-4 py-3 text-slate-600">{driver.cargo}</td><td className="px-4 py-3"><span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-800">Ativo</span></td></tr>)}</tbody>
            </table>
            {!filteredOperationalDrivers.length&&<p className="p-8 text-center text-sm text-slate-500">Nenhum motorista encontrado para “{driverSearch}”.</p>}
          </div>
        </article>
      </section>}
      <FleetBulkActions count={selectedIds.length} onClear={()=>setSelectedIds([])} onDelete={()=>setConfirmation({kind:'delete',ids:selectedIds})} onExport={()=>void handleExcel(true)} onChangeStatus={status=>setConfirmation({kind:'status',ids:selectedIds,status})}/>
      <FleetReportLayout viewModel={viewModel}/>
      {formOpen && <DailyRecordForm record={editingRecord} records={registros} equipment={equipamentos} employees={operationalDrivers} companies={empresas} teams={gruposEquipe} maintenanceOrders={ordensServico} onSave={handleSaved} onClose={()=>{setFormOpen(false);setEditingRecord(undefined)}} onOpenEmployeeRegistration={onOpenEmployeeRegistration} onOpenDriverRegistry={()=>{setFormOpen(false);setEditingRecord(undefined);setActiveView('registry')}} onOpenMaintenance={onOpenMaintenance}/>}
      <FleetDetailDrawer state={detailState} onClose={()=>setDetailState(undefined)} onEdit={openEdit}/>
      <ConfirmDialog open={Boolean(confirmation)} title={confirmation?.kind==='delete'?`Excluir ${confirmation.ids.length} registro(s)?`:`Alterar ${confirmation?.ids.length||0} registro(s)?`} description={confirmation?.kind==='delete'?'Os registros serão removidos da visão operacional. O histórico de alteração permanecerá registrado pelo sistema.':`O status será alterado para "${confirmation?.status}" e um evento será incluído em cada histórico.`} confirmLabel={confirmation?.kind==='delete'?'Excluir registros':'Alterar status'} tone={confirmation?.kind==='delete'?'danger':'warning'} busy={confirmationBusy} onCancel={()=>setConfirmation(undefined)} onConfirm={executeConfirmation}/>
      {importPreview && <div className="fixed inset-0 z-[105] flex items-end justify-center bg-slate-950/45 sm:items-center sm:p-4"><section role="dialog" aria-modal="true" aria-labelledby="import-preview-title" className="max-h-[95dvh] w-full overflow-hidden bg-white sm:max-w-4xl sm:rounded-xl"><header className="border-b border-slate-200 p-4"><p className="text-[9px] font-black uppercase tracking-wider text-emerald-700">Pré-visualização da importação</p><h2 id="import-preview-title" className="text-lg font-black text-slate-950">{importFileName}</h2></header><div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-5">{[['Novos',importPreview.newCount,'bg-emerald-50 text-emerald-800'],['Atualizações',importPreview.updateCount,'bg-sky-50 text-sky-800'],['Duplicados',importPreview.duplicateCount,'bg-slate-100 text-slate-800'],['Ignorados',importPreview.ignoredCount,'bg-amber-50 text-amber-800'],['Com erro',importPreview.errorCount,'bg-rose-50 text-rose-800']].map(([label,value,tone])=><article key={String(label)} className={`rounded-md border border-slate-200 p-3 ${tone}`}><span className="text-[9px] font-black uppercase">{label}</span><strong className="block text-2xl">{value}</strong></article>)}</div><div className="max-h-[50vh] overflow-auto border-y border-slate-200"><table className="w-full min-w-[800px] text-left text-xs"><thead className="sticky top-0 bg-slate-200"><tr><th className="p-2">Linha</th><th>Resultado</th><th>Prefixo</th><th>Motorista</th><th>Data</th><th>Mensagens</th></tr></thead><tbody className="divide-y divide-slate-100">{importPreview.rows.slice(0,500).map(row=><tr key={`${row.rowNumber}-${row.key}`}><td className="p-2 font-mono">{row.rowNumber}</td><td className="font-black">{row.disposition}</td><td>{row.record?.prefixo||'—'}</td><td>{row.record?.nomeMotorista||'—'}</td><td>{row.record?.data||'—'}</td><td className="max-w-md py-2 pr-2 text-slate-600">{row.messages.join(' ')||'Sem divergências.'}</td></tr>)}</tbody></table></div><footer className="flex flex-col-reverse gap-2 p-4 sm:flex-row sm:justify-end"><button type="button" onClick={()=>{setImportPreview(undefined);setImportFileName('')}} className="min-h-11 rounded-md border border-slate-300 bg-white px-5 text-sm font-black text-slate-700">Cancelar</button><button type="button" disabled={!importPreview.canApply} onClick={applyImportPreview} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 text-sm font-black text-white disabled:opacity-40"><FileDown size={16}/>Aplicar importação em uma etapa</button></footer></section></div>}
    </main>
  );
}
