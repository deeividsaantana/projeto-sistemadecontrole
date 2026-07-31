import React, { useMemo, useRef, useState } from 'react';
import ExcelJS from 'exceljs';
import {
  Activity,
  AlertTriangle,
  Archive,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleGauge,
  ClipboardCheck,
  CopyPlus,
  Edit3,
  Eye,
  FileDown,
  FileSpreadsheet,
  FilterX,
  Gauge,
  HardHat,
  LayoutDashboard,
  ListFilter,
  Plus,
  Save,
  Search,
  ShieldAlert,
  Trash2,
  Truck,
  Upload,
  Wrench,
  X,
} from 'lucide-react';
import type {
  Equipamento,
  Funcionario,
  ObraLocal,
  ParteDiariaAtividade,
  ParteDiariaChecklistItem,
  ParteDiariaEquipamento,
  ParteDiariaTransporte,
  RespostaChecklistEquipamento,
  StatusParteDiariaEquipamento,
  TipoMarcacaoParteDiaria,
} from '../types';
import reneaLogoFull from '../assets/images/renea_logo_new.png';
import {
  CHECKLIST_PADRAO_PARTE_DIARIA,
  CODIGOS_PERDA_PARTE_DIARIA,
  downloadParteDiariaPdf,
} from '../utils/parteDiariaPdf';
import { configureCorporateWorkbook, downloadCorporateWorkbook, loadValidatedWorkbook, styleCorporateWorksheet } from '../utils/excelCorporate';
import { cleanImportValue, getImportValue, normalizeImportText, parseDelimitedText, parseImportNumber, tableRowsToObjects, toImportIsoDate } from '../utils/importHelpers';
import { buildParteDiariaOperationalAnalysis, type OperationalAnalysis } from '../utils/operationalAnalysis';
import LegadoSgePanel from './LegadoSgePanel';
import SgeIndicadoresPanel from './SgeIndicadoresPanel';
import SpreadsheetImportReview from './SpreadsheetImportReview';

interface ParteDiariaEquipamentosTabProps {
  registros: ParteDiariaEquipamento[];
  equipamentos: Equipamento[];
  funcionarios: Funcionario[];
  obras: ObraLocal[];
  onSave: (registro: ParteDiariaEquipamento, isNew: boolean) => void;
  onDelete: (id: string) => void;
  onImport: (registros: ParteDiariaEquipamento[]) => void;
}

type ViewMode = 'dashboard' | 'lancamento' | 'registros' | 'deficiencias' | 'indicadores-sge' | 'legado';
const PARTE_DIARIA_IMPORT_COLUMNS = [
  'Numero',
  'Data',
  'Obra',
  'Prefixo',
  'Operador',
  'Matricula',
  'Jornada',
  'Horimetro inicial',
  'Horimetro final',
  'Servico',
  'Centro de custo',
  'Codigo perda',
  'Horas',
  'Destino',
  'Material transportado',
  'Viagens',
  'Equipamento carga',
  'Apontador',
  'Encarregado',
  'Observacao'
];

const today = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};
const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const formatNumber = (value: number, digits = 1) => Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const formatDate = (value: string) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '-';

const nextDocumentNumber = (registros: ParteDiariaEquipamento[]) => {
  const max = registros.reduce((current, item) => Math.max(current, Number(String(item.numero).replace(/\D/g, '')) || 0), 0);
  return String(max + 1).padStart(6, '0');
};

const createActivity = (): ParteDiariaAtividade => ({
  id: uid('atividade'),
  descricao: '',
  centroCusto: '',
  codigoPerda: '',
  tipoMarcacao: 'Horímetro',
  inicial: '',
  final: '',
  totalHoras: 0,
});

const createTransport = (): ParteDiariaTransporte => ({
  id: uid('transporte'),
  descricao: '',
  centroCusto: '',
  destino: '',
  materialTransportado: '',
  quantidadeViagens: 0,
  equipamentoCarga: '',
});

const createChecklist = (): ParteDiariaChecklistItem[] => CHECKLIST_PADRAO_PARTE_DIARIA.map(([codigo, descricao]) => ({
  codigo,
  descricao,
  resposta: 'N/A',
  observacao: '',
}));

const createEmptyRecord = (registros: ParteDiariaEquipamento[]): ParteDiariaEquipamento => {
  const now = new Date().toISOString();
  return {
    id: uid('parte-diaria'),
    numero: nextDocumentNumber(registros),
    data: today(),
    obraId: '',
    obraNome: '',
    equipamentoId: '',
    prefixo: '',
    tipoEquipamento: '',
    jornada: 10,
    operadorId: '',
    operadorNome: '',
    matricula: '',
    apontador: '',
    encarregado: '',
    horimetroInicial: 0,
    horimetroFinal: 0,
    totalHorasTrabalhadas: 0,
    atividades: [createActivity()],
    transportes: [createTransport()],
    checklist: createChecklist(),
    outrosProblemas: '',
    status: 'Pendente',
    observacao: '',
    criadoEm: now,
    atualizadoEm: now,
  };
};

const calculateActivityHours = (item: ParteDiariaAtividade) => {
  if (!item.inicial || !item.final) return 0;
  if (item.tipoMarcacao === 'Relógio') {
    const toMinutes = (value: string) => {
      const [hour, minute] = value.split(':').map(Number);
      return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : NaN;
    };
    const start = toMinutes(item.inicial);
    let end = toMinutes(item.final);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
    if (end < start) end += 24 * 60;
    return Math.max(0, (end - start) / 60);
  }
  const start = Number(String(item.inicial).replace(',', '.'));
  const end = Number(String(item.final).replace(',', '.'));
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : 0;
};

const getStoppedHours = (record: ParteDiariaEquipamento) => record.atividades
  .filter(item => item.codigoPerda)
  .reduce((sum, item) => sum + Number(item.totalHoras || 0), 0);

const getWorkedHours = (record: ParteDiariaEquipamento) => {
  const activities = record.atividades
    .filter(item => !item.codigoPerda)
    .reduce((sum, item) => sum + Number(item.totalHoras || 0), 0);
  if (activities > 0) return activities;
  return Math.max(0, Number(record.horimetroFinal || 0) - Number(record.horimetroInicial || 0));
};

const deriveStatus = (record: ParteDiariaEquipamento): StatusParteDiariaEquipamento => {
  const missingCore = !record.data || !record.obraId || !record.equipamentoId || !record.operadorNome;
  const activityTotal = record.atividades.reduce((sum, item) => sum + Number(item.totalHoras || 0), 0);
  const invalidMeter = record.horimetroFinal > 0 && record.horimetroFinal < record.horimetroInicial;
  const invalidJourney = record.jornada > 0 && activityTotal > record.jornada + 0.25;
  if (invalidMeter || invalidJourney) return 'Inconsistente';
  const hasDeficiency = record.checklist.some(item => item.resposta === 'Não') || Boolean(record.outrosProblemas.trim());
  if (hasDeficiency) return 'Com deficiência';
  const checklistAnswered = record.checklist.some(item => item.resposta !== 'N/A');
  if (missingCore || !checklistAnswered) return 'Pendente';
  return 'Conferido';
};

const statusTone: Record<StatusParteDiariaEquipamento, string> = {
  Conferido: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  Pendente: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  'Com deficiência': 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  Inconsistente: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
};

const DocumentPreview = ({ record }: { record: ParteDiariaEquipamento }) => {
  const checklistMap = new Map(record.checklist.map(item => [item.codigo, item]));
  const workRows = [...record.atividades.slice(0, 8), ...Array(Math.max(0, 8 - record.atividades.length)).fill(null)];
  const transportRows = [...record.transportes.slice(0, 4), ...Array(Math.max(0, 4 - record.transportes.length)).fill(null)];
  const checkMark = (answer: RespostaChecklistEquipamento | undefined, expected: RespostaChecklistEquipamento) => answer === expected ? 'X' : '';
  return (
    <div className="mx-auto aspect-[210/297] min-w-[780px] max-w-[920px] overflow-hidden bg-white p-4 text-slate-950 shadow-2xl">
      <div className="grid h-full grid-rows-[auto_auto_auto_auto_auto_1fr_auto] border border-slate-500 text-[8px]">
        <div className="grid grid-cols-[170px_1fr_145px] border-b border-slate-500">
          <div className="flex h-20 items-center justify-center border-r border-slate-500 p-3"><img src={reneaLogoFull} alt="RENEA" className="h-12 w-36 object-contain" /></div>
          <div className="flex flex-col items-center justify-center border-r border-slate-500 text-center"><strong className="text-[13px]">PARTE DIÁRIA DE EQUIPAMENTOS / VEÍCULOS</strong><span className="mt-1 text-slate-500">Controle operacional de frota</span></div>
          <div className="p-3"><span className="font-bold">Nº</span><div className="mt-2 border-b border-slate-500 text-center text-xl font-bold">{record.numero}</div></div>
        </div>
        <div>
          <div className="grid grid-cols-[2fr_1fr_1fr] border-b border-slate-500">{[['OBRA', record.obraNome], ['JORNADA', `${formatNumber(record.jornada)} h`], ['DATA', formatDate(record.data)]].map(([label, value]) => <div key={label} className="min-h-11 border-r border-slate-500 p-2 last:border-r-0"><strong>{label}</strong><div className="mt-1 text-[10px]">{value}</div></div>)}</div>
          <div className="grid grid-cols-[.7fr_1.5fr_1.3fr_.7fr] border-b border-slate-500">{[['Nº FROTA', record.prefixo], ['TIPO DE EQUIPAMENTO / VEÍCULO', record.tipoEquipamento], ['OPERADOR / MOTORISTA', record.operadorNome], ['MATRÍCULA', record.matricula]].map(([label, value]) => <div key={label} className="min-h-11 border-r border-slate-500 p-2 last:border-r-0"><strong>{label}</strong><div className="mt-1 text-[10px]">{value}</div></div>)}</div>
          <div className="grid grid-cols-4 border-b border-slate-500">{[['HORÍMETRO INICIAL', formatNumber(record.horimetroInicial)], ['HORÍMETRO FINAL', formatNumber(record.horimetroFinal)], ['TOTAL TRABALHADO', `${formatNumber(record.totalHorasTrabalhadas)} h`], ['ENCARREGADO', record.encarregado]].map(([label, value]) => <div key={label} className="min-h-10 border-r border-slate-500 p-2 last:border-r-0"><strong>{label}</strong><div className="mt-1 text-[10px]">{value}</div></div>)}</div>
        </div>
        <table className="w-full table-fixed border-collapse text-[7px]"><thead className="bg-slate-200"><tr>{['Nº', 'DESCRIÇÃO DO SERVIÇO / CENTRO DE CUSTO', 'CÓD. PERDA', 'R / H', 'INICIAL', 'FINAL', 'TOTAL HORAS'].map((label, index) => <th key={label} className={`border-b border-r border-slate-500 p-1 ${index === 1 ? 'w-[34%]' : ''}`}>{label}</th>)}</tr></thead><tbody>{workRows.map((item: ParteDiariaAtividade | null, index) => <tr key={item?.id || `blank-${index}`} className="h-[24px]">{[index + 1, item ? [item.descricao, item.centroCusto].filter(Boolean).join(' / ') : '', item?.codigoPerda || '', item ? item.tipoMarcacao === 'Relógio' ? 'R' : 'H' : '', item?.inicial || '', item?.final || '', item ? formatNumber(item.totalHoras) : ''].map((value, cell) => <td key={cell} className="truncate border-b border-r border-slate-500 px-1 text-center last:border-r-0">{value}</td>)}</tr>)}</tbody></table>
        <table className="w-full table-fixed border-collapse text-[7px]"><thead className="bg-slate-200"><tr>{['Nº', 'DESCRIÇÃO DO SERVIÇO / CENTRO DE CUSTO', 'DESTINO', 'MATERIAL TRANSPORTADO', 'VIAGENS', 'EQUIPAMENTO DE CARGA'].map((label, index) => <th key={label} className={`border-b border-r border-slate-500 p-1 ${index === 1 ? 'w-[31%]' : ''}`}>{label}</th>)}</tr></thead><tbody>{transportRows.map((item: ParteDiariaTransporte | null, index) => <tr key={item?.id || `transport-blank-${index}`} className="h-[23px]">{[index + 1, item ? [item.descricao, item.centroCusto].filter(Boolean).join(' / ') : '', item?.destino || '', item?.materialTransportado || '', item?.quantidadeViagens || '', item?.equipamentoCarga || ''].map((value, cell) => <td key={cell} className="truncate border-b border-r border-slate-500 px-1 text-center last:border-r-0">{value}</td>)}</tr>)}</tbody></table>
        <div className="grid grid-cols-2 border-b border-slate-500 text-center"><div className="border-r border-slate-500 px-8 pb-2 pt-5"><div className="border-b border-slate-500">{record.apontador || ' '}</div><span>Assinatura do apontador</span></div><div className="px-8 pb-2 pt-5"><div className="border-b border-slate-500">{record.encarregado || ' '}</div><span>Assinatura do encarregado</span></div></div>
        <div className="border-b border-slate-500"><div className="bg-slate-200 py-1 text-center font-bold">CÓDIGO DE PERDAS (HORAS PARADAS)</div><div className="grid grid-cols-2">{[CODIGOS_PERDA_PARTE_DIARIA.slice(0, 8), CODIGOS_PERDA_PARTE_DIARIA.slice(8)].map((column, index) => <div key={index} className="border-r border-t border-slate-500 p-1 last:border-r-0">{column.map(([code, label]) => <div key={code} className="leading-[11px]"><strong>{code} -</strong> {label}</div>)}</div>)}</div></div>
        <div><div className="bg-slate-200 py-1 text-center font-bold">CHECKLIST DIÁRIO DO EQUIPAMENTO / VEÍCULO</div><div className="grid grid-cols-2">{[CHECKLIST_PADRAO_PARTE_DIARIA.slice(0, 11), CHECKLIST_PADRAO_PARTE_DIARIA.slice(11)].map((column, index) => <div key={index} className="border-r border-t border-slate-500 last:border-r-0">{column.map(([code, label]) => { const answer = checklistMap.get(code)?.resposta; return <div key={code} className="grid grid-cols-[22px_1fr_82px] items-center border-b border-slate-400 px-1 py-[2px]"><strong>{code}</strong><span className="truncate">{label}</span><span className="flex justify-end gap-1"><i className="not-italic">[{checkMark(answer, 'Sim')}] S</i><i className="not-italic">[{checkMark(answer, 'Não')}] N</i><i className="not-italic">[{checkMark(answer, 'N/A')}] -</i></span></div>; })}</div>)}</div><div className="min-h-10 p-2"><strong>OUTROS PROBLEMAS / OBSERVAÇÕES:</strong> {[record.outrosProblemas, record.observacao].filter(Boolean).join(' | ') || 'Sem outros problemas informados.'}</div></div>
        <div className="border-t border-slate-500 py-1 text-center text-[7px] text-slate-500">Documento digital RENEA | Status: {record.status}</div>
      </div>
    </div>
  );
};

const ParteDiariaEquipamentosTab: React.FC<ParteDiariaEquipamentosTabProps> = ({ registros, equipamentos, funcionarios, obras, onSave, onDelete, onImport }) => {
  const [view, setView] = useState<ViewMode>('dashboard');
  const [form, setForm] = useState<ParteDiariaEquipamento>(() => createEmptyRecord(registros));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewRecord, setPreviewRecord] = useState<ParteDiariaEquipamento | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Todos' | StatusParteDiariaEquipamento>('Todos');
  const [obraFilter, setObraFilter] = useState('');
  const [equipmentFilter, setEquipmentFilter] = useState('');
  const [onlyDeficient, setOnlyDeficient] = useState(false);
  const [customChecklist, setCustomChecklist] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ fileName: string; registros: ParteDiariaEquipamento[]; analysis: OperationalAnalysis } | null>(null);
  const [isConfirmingImport, setIsConfirmingImport] = useState(false);

  const activeOperators = useMemo(() => funcionarios.filter(item => item.ativo && /operador|motorista|tratorista|motoniveladora|escavadeira/i.test(`${item.cargo} ${item.area || ''}`)).sort((a, b) => a.nome.localeCompare(b.nome)), [funcionarios]);
  const sortedEquipment = useMemo(() => [...equipamentos].sort((a, b) => a.prefixo.localeCompare(b.prefixo, 'pt-BR', { numeric: true })), [equipamentos]);

  const filtered = useMemo(() => registros
    .filter(item => !startDate || item.data >= startDate)
    .filter(item => !endDate || item.data <= endDate)
    .filter(item => statusFilter === 'Todos' || item.status === statusFilter)
    .filter(item => !obraFilter || item.obraId === obraFilter)
    .filter(item => !equipmentFilter || item.equipamentoId === equipmentFilter)
    .filter(item => !onlyDeficient || item.status === 'Com deficiência' || item.status === 'Inconsistente')
    .filter(item => {
      const term = search.trim().toLocaleLowerCase('pt-BR');
      if (!term) return true;
      return [item.numero, item.prefixo, item.tipoEquipamento, item.operadorNome, item.obraNome, item.encarregado, item.outrosProblemas].join(' ').toLocaleLowerCase('pt-BR').includes(term);
    })
    .sort((a, b) => `${b.data}${b.atualizadoEm}`.localeCompare(`${a.data}${a.atualizadoEm}`)), [registros, startDate, endDate, statusFilter, obraFilter, equipmentFilter, onlyDeficient, search]);

  const stats = useMemo(() => {
    const worked = filtered.reduce((sum, item) => sum + getWorkedHours(item), 0);
    const stopped = filtered.reduce((sum, item) => sum + getStoppedHours(item), 0);
    const deficiencies = filtered.reduce((sum, item) => sum + item.checklist.filter(check => check.resposta === 'Não').length + (item.outrosProblemas ? 1 : 0), 0);
    const pending = filtered.filter(item => item.status === 'Pendente' || item.status === 'Inconsistente').length;
    const denominator = worked + stopped || filtered.reduce((sum, item) => sum + Number(item.jornada || 0), 0);
    return { worked, stopped, deficiencies, pending, utilization: denominator ? Math.min(100, worked / denominator * 100) : 0 };
  }, [filtered]);

  const deficiencyRanking = useMemo(() => {
    const map = new Map<string, { label: string; count: number; equipment: Set<string> }>();
    filtered.forEach(record => {
      record.checklist.filter(item => item.resposta === 'Não').forEach(item => {
        const current = map.get(item.codigo) || { label: item.descricao, count: 0, equipment: new Set<string>() };
        current.count += 1;
        current.equipment.add(record.prefixo);
        map.set(item.codigo, current);
      });
      if (record.outrosProblemas) {
        const current = map.get('OUT') || { label: 'Outros problemas informados', count: 0, equipment: new Set<string>() };
        current.count += 1;
        current.equipment.add(record.prefixo);
        map.set('OUT', current);
      }
    });
    return [...map.entries()].map(([code, value]) => ({ code, ...value, equipment: [...value.equipment] })).sort((a, b) => b.count - a.count);
  }, [filtered]);

  const lossRanking = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach(record => record.atividades.filter(item => item.codigoPerda).forEach(item => map.set(item.codigoPerda, (map.get(item.codigoPerda) || 0) + Number(item.totalHoras || 0))));
    return [...map.entries()].map(([code, hours]) => ({ code, hours, label: CODIGOS_PERDA_PARTE_DIARIA.find(item => item[0] === code)?.[1] || 'Código personalizado' })).sort((a, b) => b.hours - a.hours);
  }, [filtered]);

  const equipmentHealth = useMemo(() => {
    const map = new Map<string, { prefixo: string; type: string; parts: number; worked: number; stopped: number; deficiencies: number; lastDate: string }>();
    filtered.forEach(record => {
      const current = map.get(record.equipamentoId) || { prefixo: record.prefixo, type: record.tipoEquipamento, parts: 0, worked: 0, stopped: 0, deficiencies: 0, lastDate: '' };
      current.parts += 1;
      current.worked += getWorkedHours(record);
      current.stopped += getStoppedHours(record);
      current.deficiencies += record.checklist.filter(item => item.resposta === 'Não').length + (record.outrosProblemas ? 1 : 0);
      current.lastDate = current.lastDate > record.data ? current.lastDate : record.data;
      map.set(record.equipamentoId, current);
    });
    return [...map.values()].sort((a, b) => b.deficiencies - a.deficiencies || b.stopped - a.stopped);
  }, [filtered]);

  const matchWork = (value: string) => {
    const target = normalizeImportText(value);
    if (!target) return undefined;
    return obras.find(item => {
      const name = normalizeImportText(item.nome);
      return name === target || name.includes(target) || target.includes(name);
    });
  };
  const matchEquipment = (value: string) => {
    const target = normalizeImportText(value);
    if (!target) return undefined;
    return equipamentos.find(item => [item.prefixo, item.nome, item.tipo, item.seriePlaca, item.placa || ''].some(field => {
      const normalized = normalizeImportText(field);
      return normalized && (normalized === target || normalized.includes(target) || target.includes(normalized));
    }));
  };
  const matchOperator = (name: string, registration = '') => {
    const targetName = normalizeImportText(name);
    const targetRegistration = normalizeImportText(registration);
    if (!targetName && !targetRegistration) return undefined;
    return funcionarios.find(item => {
      const employeeName = normalizeImportText(item.nome);
      const employeeRegistration = normalizeImportText(item.matricula || item.id);
      return (targetRegistration && employeeRegistration === targetRegistration)
        || (targetName && (employeeName === targetName || employeeName.includes(targetName) || targetName.includes(employeeName)));
    });
  };

  const buildRecordFromImportRow = (
    row: Record<string, unknown>,
    sourceName: string,
    index: number
  ): ParteDiariaEquipamento | null => {
    const data = toImportIsoDate(getImportValue(row, ['data', 'dia', 'dt']));
    const prefixoRaw = getImportValue(row, ['prefixo', 'frota', 'equipamento', 'veiculo', 'veículo', 'maquina', 'máquina']);
    const equipment = matchEquipment(prefixoRaw);
    const obra = matchWork(getImportValue(row, ['obra', 'local', 'frente', 'contrato']));
    const operadorNomeRaw = getImportValue(row, ['operador', 'motorista', 'funcionario', 'funcionário', 'colaborador']);
    const matriculaRaw = getImportValue(row, ['matricula', 'matrícula', 'registro']);
    const operator = matchOperator(operadorNomeRaw, matriculaRaw);
    if (!data && !prefixoRaw && !operadorNomeRaw) return null;

    const horimetroInicial = parseImportNumber(getImportValue(row, ['horimetro inicial', 'horímetro inicial', 'h inicial', 'hm inicial']));
    const horimetroFinal = parseImportNumber(getImportValue(row, ['horimetro final', 'horímetro final', 'h final', 'hm final']));
    const importedHours = parseImportNumber(getImportValue(row, ['horas', 'total horas', 'horas trabalhadas', 'total trabalhado']));
    const service = getImportValue(row, ['servico', 'serviço', 'atividade', 'descricao', 'descrição']);
    const lossCode = getImportValue(row, ['codigo perda', 'código perda', 'cod perda', 'perda']).toUpperCase();
    const now = new Date().toISOString();
    const documentBase = Number(nextDocumentNumber(registros)) + index;

    const atividade: ParteDiariaAtividade = {
      id: uid('atividade-import'),
      descricao: service || (lossCode ? 'Horas paradas importadas' : 'Serviço importado'),
      centroCusto: getImportValue(row, ['centro custo', 'centro de custo', 'cc']),
      codigoPerda: lossCode,
      tipoMarcacao: 'Horímetro',
      inicial: horimetroInicial ? String(horimetroInicial) : '',
      final: horimetroFinal ? String(horimetroFinal) : '',
      totalHoras: importedHours || (horimetroFinal > horimetroInicial ? Number((horimetroFinal - horimetroInicial).toFixed(2)) : 0),
    };
    const transporte: ParteDiariaTransporte = {
      id: uid('transporte-import'),
      descricao: getImportValue(row, ['transporte', 'servico transporte', 'serviço transporte']),
      centroCusto: getImportValue(row, ['centro custo transporte', 'cc transporte']),
      destino: getImportValue(row, ['destino', 'descarga', 'local destino']),
      materialTransportado: getImportValue(row, ['material transportado', 'material', 'produto']),
      quantidadeViagens: parseImportNumber(getImportValue(row, ['viagens', 'qtd viagens', 'quantidade viagens'])),
      equipamentoCarga: getImportValue(row, ['equipamento carga', 'carga', 'carregadeira']),
    };
    const base: ParteDiariaEquipamento = {
      id: uid('parte-import'),
      numero: getImportValue(row, ['numero', 'número', 'num', 'n']) || String(documentBase).padStart(6, '0'),
      data: data || today(),
      obraId: obra?.id || '',
      obraNome: obra?.nome || getImportValue(row, ['obra', 'local', 'frente', 'contrato']),
      equipamentoId: equipment?.id || '',
      prefixo: equipment?.prefixo || prefixoRaw.toUpperCase(),
      tipoEquipamento: equipment?.tipo || equipment?.nome || getImportValue(row, ['tipo equipamento', 'tipo', 'modelo']),
      jornada: parseImportNumber(getImportValue(row, ['jornada', 'turno', 'horas jornada'])) || 10,
      operadorId: operator?.id || '',
      operadorNome: operator?.nome || operadorNomeRaw,
      matricula: operator?.matricula || matriculaRaw,
      apontador: getImportValue(row, ['apontador', 'apropriador']),
      encarregado: getImportValue(row, ['encarregado', 'lider', 'líder']),
      horimetroInicial,
      horimetroFinal,
      totalHorasTrabalhadas: 0,
      atividades: [atividade],
      transportes: transporte.destino || transporte.materialTransportado || transporte.quantidadeViagens ? [transporte] : [createTransport()],
      checklist: createChecklist(),
      outrosProblemas: getImportValue(row, ['problemas', 'deficiencias', 'deficiências', 'outros problemas']),
      status: 'Pendente',
      observacao: [getImportValue(row, ['observacao', 'observação', 'obs']), `Importado de ${sourceName}`].filter(Boolean).join(' | '),
      criadoEm: now,
      atualizadoEm: now,
    };
    const withTotals = { ...base, totalHorasTrabalhadas: getWorkedHours(base) };
    return { ...withTotals, status: deriveStatus(withTotals) };
  };

  const parseGenericWorksheetRows = (worksheet: ExcelJS.Worksheet): ParteDiariaEquipamento[] => {
    let headerRowNumber = 0;
    let headers: string[] = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (headerRowNumber) return;
      const cells = Array.from({ length: Math.max(row.cellCount, 1) }, (_, index) => cleanImportValue(row.getCell(index + 1).value));
      const normalized = cells.map(normalizeImportText);
      const score = [
        normalized.some(value => value.includes('data')),
        normalized.some(value => value.includes('prefixo') || value.includes('frota') || value.includes('equipamento')),
        normalized.some(value => value.includes('operador') || value.includes('motorista')),
      ].filter(Boolean).length;
      if (score >= 2) {
        headerRowNumber = rowNumber;
        headers = cells.map((cell, index) => cell || `Coluna ${index + 1}`);
      }
    });
    if (!headerRowNumber) return [];
    const imported: ParteDiariaEquipamento[] = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber <= headerRowNumber) return;
      const objectRow = headers.reduce<Record<string, string>>((acc, header, index) => {
        acc[header] = cleanImportValue(row.getCell(index + 1).value);
        return acc;
      }, {});
      const record = buildRecordFromImportRow(objectRow, worksheet.name, imported.length);
      if (record) imported.push(record);
    });
    return imported;
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setIsImporting(true);
    setError('');
    try {
      const extension = file.name.toLowerCase().split('.').pop();
      const imported = extension === 'csv' || extension === 'txt'
        ? tableRowsToObjects(parseDelimitedText(await file.text()))
          .map((row, index) => buildRecordFromImportRow(row, file.name, index))
          .filter((item): item is ParteDiariaEquipamento => Boolean(item))
        : (await loadValidatedWorkbook(file)).worksheets.flatMap(sheet => parseGenericWorksheetRows(sheet));
      if (!imported.length) {
        setError('Nenhuma parte diária válida foi encontrada. Confira se há cabeçalhos como Data, Prefixo/Frota e Operador.');
        return;
      }
      setPendingImport({
        fileName: file.name,
        registros: imported,
        analysis: buildParteDiariaOperationalAnalysis(imported),
      });
    } catch (error: any) {
      setError(`Falha ao importar parte diária: ${error.message || error}`);
    } finally {
      setIsImporting(false);
    }
  };

  const confirmImport = () => {
    if (!pendingImport || isConfirmingImport) return;
    setIsConfirmingImport(true);
    onImport(pendingImport.registros);
    setPendingImport(null);
    setIsConfirmingImport(false);
    setView('registros');
  };

  const downloadImportTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    configureCorporateWorkbook(workbook, 'Modelo de Importação de Parte Diária');
    const sheet = workbook.addWorksheet('IMPORTAR_PARTES');
    sheet.addRow(PARTE_DIARIA_IMPORT_COLUMNS);
    sheet.addRow([
      nextDocumentNumber(registros),
      today(),
      obras[0]?.nome || 'Obra exemplo',
      equipamentos[0]?.prefixo || 'EQ-01',
      funcionarios[0]?.nome || 'Operador exemplo',
      funcionarios[0]?.matricula || '',
      10,
      1200,
      1208,
      'Escavação / carga',
      'CC-001',
      '',
      8,
      'Frente A',
      'Solo',
      12,
      '',
      '',
      '',
      'Linha de exemplo'
    ]);
    styleCorporateWorksheet(sheet, { title: 'Modelo de Importação de Parte Diária', headerRow: 1, lastColumn: PARTE_DIARIA_IMPORT_COLUMNS.length, dataStartRow: 2, freezeRows: 1 });
    await downloadCorporateWorkbook(workbook, 'modelo_importacao_parte_diaria.xlsx');
  };

  const clearFilters = () => { setSearch(''); setStartDate(''); setEndDate(''); setStatusFilter('Todos'); setObraFilter(''); setEquipmentFilter(''); setOnlyDeficient(false); };
  const newRecord = () => { setForm(createEmptyRecord(registros)); setEditingId(null); setError(''); setView('lancamento'); };
  const editRecord = (record: ParteDiariaEquipamento) => { setForm(JSON.parse(JSON.stringify(record))); setEditingId(record.id); setError(''); setView('lancamento'); };
  const duplicateRecord = (source?: ParteDiariaEquipamento) => {
    const base = source || registros.find(item => item.equipamentoId === form.equipamentoId) || registros[0];
    if (!base) { setError('Ainda não existe uma parte diária para duplicar.'); return; }
    const now = new Date().toISOString();
    setForm({ ...JSON.parse(JSON.stringify(base)), id: uid('parte-diaria'), numero: nextDocumentNumber(registros), data: today(), horimetroInicial: base.horimetroFinal, horimetroFinal: base.horimetroFinal, atividades: base.atividades.map(item => ({ ...item, id: uid('atividade'), inicial: '', final: '', totalHoras: 0 })), transportes: base.transportes.map(item => ({ ...item, id: uid('transporte'), quantidadeViagens: 0 })), status: 'Pendente', criadoEm: now, atualizadoEm: now });
    setEditingId(null); setError(''); setView('lancamento');
  };

  const updateEquipment = (id: string) => {
    const item = equipamentos.find(equipment => equipment.id === id);
    const responsibleOperator = funcionarios.find(employee => employee.id === item?.operadorResponsavelId);
    setForm(current => ({
      ...current,
      equipamentoId: id,
      prefixo: item?.prefixo || '',
      tipoEquipamento: item?.tipo || item?.nome || '',
      obraId: current.obraId || item?.localAtualId || '',
      obraNome: current.obraNome || obras.find(work => work.id === item?.localAtualId)?.nome || '',
      operadorId: current.operadorId || responsibleOperator?.id || '',
      operadorNome: current.operadorNome || responsibleOperator?.nome || item?.operadorResponsavelNome || '',
      matricula: current.matricula || responsibleOperator?.matricula || '',
    }));
  };
  const updateOperator = (id: string) => {
    const item = funcionarios.find(employee => employee.id === id);
    setForm(current => ({ ...current, operadorId: id, operadorNome: item?.nome || '', matricula: item?.matricula || '' }));
  };
  const updateWork = (id: string) => { const item = obras.find(work => work.id === id); setForm(current => ({ ...current, obraId: id, obraNome: item?.nome || '' })); };

  const updateActivity = (id: string, field: keyof ParteDiariaAtividade, value: string) => {
    setForm(current => ({ ...current, atividades: current.atividades.map(item => {
      if (item.id !== id) return item;
      const next = { ...item, [field]: value } as ParteDiariaAtividade;
      return { ...next, totalHoras: calculateActivityHours(next) };
    }) }));
  };
  const updateTransport = (id: string, field: keyof ParteDiariaTransporte, value: string | number) => setForm(current => ({ ...current, transportes: current.transportes.map(item => item.id === id ? { ...item, [field]: value } : item) }));
  const updateChecklist = (code: string, answer: RespostaChecklistEquipamento) => setForm(current => ({ ...current, checklist: current.checklist.map(item => item.codigo === code ? { ...item, resposta: answer } : item) }));
  const addCustomChecklist = () => {
    const description = customChecklist.trim();
    if (!description) return;
    setForm(current => ({ ...current, checklist: [...current.checklist, { codigo: `P${String(current.checklist.length - 21).padStart(2, '0')}`, descricao: description, resposta: 'N/A', observacao: '' }] }));
    setCustomChecklist('');
  };

  const buildFinalRecord = () => {
    const totalHours = getWorkedHours(form);
    const next = { ...form, totalHorasTrabalhadas: totalHours, atualizadoEm: new Date().toISOString() };
    return { ...next, status: deriveStatus(next) };
  };
  const saveRecord = () => {
    setError('');
    if (!form.data || !form.obraId || !form.equipamentoId || !form.operadorNome.trim()) { setError('Preencha data, obra, equipamento e operador/motorista.'); return; }
    if (form.horimetroFinal > 0 && form.horimetroFinal < form.horimetroInicial) { setError('O horímetro final não pode ser menor que o inicial.'); return; }
    const duplicate = registros.find(item => item.id !== editingId && item.data === form.data && item.equipamentoId === form.equipamentoId);
    if (duplicate) { setError(`Já existe a parte nº ${duplicate.numero} para este equipamento na mesma data. Edite o registro existente ou altere a data.`); return; }
    const finalRecord = buildFinalRecord();
    onSave(finalRecord, !editingId);
    setForm(createEmptyRecord([...registros.filter(item => item.id !== finalRecord.id), finalRecord]));
    setEditingId(null);
    setView('registros');
  };

  const navItems: Array<{ id: ViewMode; label: string; icon: React.ElementType }> = [
    { id: 'dashboard', label: 'Painel operacional', icon: LayoutDashboard },
    { id: 'lancamento', label: editingId ? 'Editar parte' : 'Novo lançamento', icon: Plus },
    { id: 'registros', label: 'Partes diárias', icon: ClipboardCheck },
    { id: 'deficiencias', label: 'Deficiências', icon: ShieldAlert },
    { id: 'indicadores-sge', label: 'Indicadores SGE', icon: BarChart3 },
    { id: 'legado', label: 'Legado SGE', icon: Archive },
  ];

  return (
    <div className="space-y-5 text-slate-100">
      <SpreadsheetImportReview
        open={Boolean(pendingImport)}
        title="Importar partes diárias"
        fileName={pendingImport?.fileName || ''}
        validCount={pendingImport?.registros.length || 0}
        columns={['Número', 'Data', 'Prefixo', 'Operador', 'Obra', 'Horas']}
        rows={(pendingImport?.registros || []).map(item => ({
          Número: item.numero,
          Data: formatDate(item.data),
          Prefixo: item.prefixo,
          Operador: item.operadorNome,
          Obra: item.obraNome,
          Horas: getWorkedHours(item)
        }))}
        note="As fichas importadas entram para conferência; cadastros não encontrados ficam pendentes para ajuste manual."
        analysis={pendingImport?.analysis}
        confirming={isConfirmingImport}
        onCancel={() => setPendingImport(null)}
        onConfirm={confirmImport}
      />
      <header className="flex flex-col gap-4 border-b border-slate-800 pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div><div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-emerald-400"><CircleGauge size={16} /> Controle de frota</div><h1 className="text-2xl font-bold text-white md:text-3xl">Parte Diária de Equipamentos</h1><p className="mt-1 text-sm text-slate-400">{registros.length} ficha(s) cadastrada(s) | {stats.deficiencies} deficiência(s) no período filtrado</p></div>
        <div className="flex flex-wrap gap-2"><input ref={importInputRef} type="file" accept=".xlsx,.xlsm,.csv,.txt" onChange={handleImportFile} className="hidden" /><button onClick={() => importInputRef.current?.click()} disabled={isImporting} className="inline-flex h-10 items-center gap-2 border border-slate-700 bg-slate-900 px-3 text-sm font-semibold hover:border-emerald-500 disabled:opacity-50"><Upload size={17} /> {isImporting ? 'Importando...' : 'Importar'}</button><button onClick={downloadImportTemplate} className="inline-flex h-10 items-center gap-2 border border-slate-700 bg-slate-900 px-3 text-sm font-semibold hover:border-sky-500"><FileSpreadsheet size={17} /> Modelo</button><button onClick={() => duplicateRecord()} className="inline-flex h-10 items-center gap-2 border border-slate-700 bg-slate-900 px-3 text-sm font-semibold hover:border-slate-500"><CopyPlus size={17} /> Duplicar última</button><button onClick={newRecord} className="inline-flex h-10 items-center gap-2 bg-emerald-500 px-4 text-sm font-bold text-slate-950 hover:bg-emerald-400"><Plus size={18} /> Nova parte diária</button></div>
      </header>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-800 pb-px">{navItems.map(item => { const Icon = item.icon; return <button key={item.id} onClick={() => item.id === 'lancamento' && !editingId ? newRecord() : setView(item.id)} className={`inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold ${view === item.id ? 'border-emerald-400 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}><Icon size={17} />{item.label}</button>; })}</div>

      {!['lancamento', 'indicadores-sge', 'legado'].includes(view) && <section className="grid gap-3 border-b border-slate-800 pb-5 md:grid-cols-2 xl:grid-cols-[1.4fr_repeat(5,1fr)_auto]">
        <label className="relative"><span className="sr-only">Pesquisar</span><Search className="absolute left-3 top-3 text-slate-500" size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar nº, frota, operador..." className="h-11 w-full border border-slate-700 bg-slate-950 pl-10 pr-3 text-sm outline-none focus:border-emerald-500" /></label>
        <label className="relative"><span className="sr-only">Data inicial</span><CalendarDays className="absolute left-3 top-3 text-slate-500" size={17} /><input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="h-11 w-full border border-slate-700 bg-slate-950 pl-10 pr-2 text-sm outline-none focus:border-emerald-500" /></label>
        <label className="relative"><span className="sr-only">Data final</span><CalendarDays className="absolute left-3 top-3 text-slate-500" size={17} /><input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className="h-11 w-full border border-slate-700 bg-slate-950 pl-10 pr-2 text-sm outline-none focus:border-emerald-500" /></label>
        <label className="relative"><span className="sr-only">Status</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="h-11 w-full appearance-none border border-slate-700 bg-slate-950 px-3 pr-8 text-sm outline-none focus:border-emerald-500"><option>Todos</option>{Object.keys(statusTone).map(status => <option key={status}>{status}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3 text-slate-500" size={17} /></label>
        <label className="relative"><span className="sr-only">Obra</span><select value={obraFilter} onChange={event => setObraFilter(event.target.value)} className="h-11 w-full appearance-none border border-slate-700 bg-slate-950 px-3 pr-8 text-sm outline-none focus:border-emerald-500"><option value="">Todas as obras</option>{obras.map(item => <option value={item.id} key={item.id}>{item.nome}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3 text-slate-500" size={17} /></label>
        <label className="relative"><span className="sr-only">Equipamento</span><select value={equipmentFilter} onChange={event => setEquipmentFilter(event.target.value)} className="h-11 w-full appearance-none border border-slate-700 bg-slate-950 px-3 pr-8 text-sm outline-none focus:border-emerald-500"><option value="">Toda a frota</option>{sortedEquipment.map(item => <option value={item.id} key={item.id}>{item.prefixo} - {item.tipo || item.nome}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3 text-slate-500" size={17} /></label>
        <button onClick={clearFilters} title="Limpar filtros" className="grid h-11 w-11 place-items-center border border-slate-700 bg-slate-900 text-slate-300 hover:text-white"><FilterX size={18} /></button>
        <label className="flex h-10 items-center gap-2 text-sm text-slate-300 md:col-span-2 xl:col-span-7"><input type="checkbox" checked={onlyDeficient} onChange={event => setOnlyDeficient(event.target.checked)} className="h-4 w-4 accent-rose-500" /> Somente registros com alerta</label>
      </section>}

      {view === 'dashboard' && <div className="space-y-5">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
          { label: 'Partes no período', value: filtered.length, detail: `${registros.length} no banco`, icon: ClipboardCheck, tone: 'text-sky-300' },
          { label: 'Horas trabalhadas', value: `${formatNumber(stats.worked)} h`, detail: 'Produção informada', icon: Activity, tone: 'text-emerald-300' },
          { label: 'Horas paradas', value: `${formatNumber(stats.stopped)} h`, detail: 'Códigos de perda', icon: Wrench, tone: 'text-amber-300' },
          { label: 'Aproveitamento', value: `${formatNumber(stats.utilization, 0)}%`, detail: 'Trabalho x paradas', icon: Gauge, tone: 'text-cyan-300' },
          { label: 'Alertas', value: stats.deficiencies + stats.pending, detail: `${stats.deficiencies} deficiências`, icon: AlertTriangle, tone: 'text-rose-300' },
        ].map(item => { const Icon = item.icon; return <article key={item.label} className="border border-slate-800 bg-slate-950 p-4"><div className="flex items-start justify-between"><span className="text-xs font-bold uppercase text-slate-500">{item.label}</span><Icon className={item.tone} size={19} /></div><strong className="mt-3 block text-2xl text-white">{item.value}</strong><span className="mt-1 block text-xs text-slate-500">{item.detail}</span></article>; })}</section>
        <section className="grid gap-5 xl:grid-cols-2">
          <div className="border border-slate-800 bg-slate-950"><div className="flex items-center justify-between border-b border-slate-800 p-4"><div><h2 className="font-bold text-white">Principais deficiências</h2><span className="text-xs text-slate-500">Ocorrências por item de checklist</span></div><ShieldAlert className="text-rose-300" size={20} /></div><div className="space-y-4 p-4">{deficiencyRanking.length ? deficiencyRanking.slice(0, 7).map((item, index) => <div key={item.code}><div className="mb-1 flex items-center justify-between gap-3 text-sm"><span className="truncate"><strong className="text-slate-500">{item.code}</strong> {item.label}</span><strong className="text-rose-300">{item.count}</strong></div><div className="h-1.5 bg-slate-800"><div className="h-full bg-rose-500" style={{ width: `${Math.max(8, item.count / (deficiencyRanking[0]?.count || 1) * 100)}%` }} /></div><div className="mt-1 truncate text-[11px] text-slate-600">{item.equipment.join(', ')}</div></div>) : <div className="grid min-h-52 place-items-center text-center text-sm text-slate-500"><div><CheckCircle2 className="mx-auto mb-2 text-emerald-400" size={28} />Nenhuma deficiência no período</div></div>}</div></div>
          <div className="border border-slate-800 bg-slate-950"><div className="flex items-center justify-between border-b border-slate-800 p-4"><div><h2 className="font-bold text-white">Horas paradas por motivo</h2><span className="text-xs text-slate-500">Concentração dos códigos de perda</span></div><BarChart3 className="text-amber-300" size={20} /></div><div className="space-y-4 p-4">{lossRanking.length ? lossRanking.slice(0, 7).map(item => <div key={item.code}><div className="mb-1 flex items-center justify-between gap-3 text-sm"><span className="truncate"><strong className="text-amber-300">{item.code}</strong> {item.label}</span><strong>{formatNumber(item.hours)} h</strong></div><div className="h-1.5 bg-slate-800"><div className="h-full bg-amber-400" style={{ width: `${Math.max(8, item.hours / (lossRanking[0]?.hours || 1) * 100)}%` }} /></div></div>) : <div className="grid min-h-52 place-items-center text-center text-sm text-slate-500"><div><Activity className="mx-auto mb-2 text-slate-600" size={28} />Nenhuma parada registrada</div></div>}</div></div>
        </section>
        <section className="overflow-hidden border border-slate-800 bg-slate-950"><div className="flex items-center justify-between border-b border-slate-800 p-4"><div><h2 className="font-bold text-white">Saúde operacional da frota</h2><span className="text-xs text-slate-500">Resumo por equipamento no período</span></div><Truck className="text-sky-300" size={20} /></div><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-slate-900 text-xs uppercase text-slate-500"><tr>{['Equipamento', 'Partes', 'Horas trabalhadas', 'Horas paradas', 'Deficiências', 'Aproveitamento', 'Última ficha'].map(label => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{equipmentHealth.slice(0, 12).map(item => { const utilization = item.worked + item.stopped ? item.worked / (item.worked + item.stopped) * 100 : 0; return <tr key={item.prefixo} className="hover:bg-slate-900/60"><td className="px-4 py-3"><strong className="text-white">{item.prefixo}</strong><span className="block text-xs text-slate-500">{item.type}</span></td><td className="px-4 py-3">{item.parts}</td><td className="px-4 py-3 text-emerald-300">{formatNumber(item.worked)} h</td><td className="px-4 py-3 text-amber-300">{formatNumber(item.stopped)} h</td><td className="px-4 py-3 text-rose-300">{item.deficiencies}</td><td className="px-4 py-3"><div className="flex items-center gap-2"><div className="h-1.5 w-20 bg-slate-800"><div className="h-full bg-emerald-500" style={{ width: `${utilization}%` }} /></div>{formatNumber(utilization, 0)}%</div></td><td className="px-4 py-3 text-slate-400">{formatDate(item.lastDate)}</td></tr>; })}{!equipmentHealth.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-500">Nenhuma parte diária no período selecionado.</td></tr>}</tbody></table></div></section>
      </div>}

      {view === 'lancamento' && <div className="space-y-5">
        <section className="flex flex-col gap-3 border-b border-slate-800 pb-4 md:flex-row md:items-center md:justify-between"><div><h2 className="text-xl font-bold text-white">{editingId ? `Editar parte nº ${form.numero}` : `Nova parte nº ${form.numero}`}</h2><span className={`mt-2 inline-flex border px-2 py-1 text-xs font-bold ${statusTone[deriveStatus(buildFinalRecord())]}`}>{deriveStatus(buildFinalRecord())}</span></div><div className="flex flex-wrap gap-2"><button onClick={() => duplicateRecord()} className="inline-flex h-10 items-center gap-2 border border-slate-700 bg-slate-900 px-3 text-sm font-semibold"><CopyPlus size={17} /> Usar modelo anterior</button><button onClick={() => setPreviewRecord(buildFinalRecord())} className="inline-flex h-10 items-center gap-2 border border-slate-700 bg-slate-900 px-3 text-sm font-semibold"><Eye size={17} /> Visualizar ficha</button><button onClick={saveRecord} className="inline-flex h-10 items-center gap-2 bg-emerald-500 px-4 text-sm font-bold text-slate-950"><Save size={17} /> Salvar parte</button></div></section>
        {error && <div className="flex items-start gap-3 border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200"><AlertTriangle className="mt-0.5 shrink-0" size={18} /><span>{error}</span></div>}
        <section className="border border-slate-800 bg-slate-950"><div className="flex items-center gap-2 border-b border-slate-800 p-4"><ClipboardCheck size={18} className="text-emerald-300" /><h3 className="font-bold text-white">Identificação da ficha</h3></div><div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-bold uppercase text-slate-400">Número<input value={form.numero} onChange={event => setForm(current => ({ ...current, numero: event.target.value }))} className="mt-2 h-11 w-full border border-slate-700 bg-slate-900 px-3 text-base text-white outline-none focus:border-emerald-500" /></label>
          <label className="text-xs font-bold uppercase text-slate-400">Data<input type="date" value={form.data} onChange={event => setForm(current => ({ ...current, data: event.target.value }))} className="mt-2 h-11 w-full border border-slate-700 bg-slate-900 px-3 text-base text-white outline-none focus:border-emerald-500" /></label>
          <label className="text-xs font-bold uppercase text-slate-400 md:col-span-2">Obra<select value={form.obraId} onChange={event => updateWork(event.target.value)} className="mt-2 h-11 w-full border border-slate-700 bg-slate-900 px-3 text-base text-white outline-none focus:border-emerald-500"><option value="">Selecione a obra</option>{obras.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
          <label className="text-xs font-bold uppercase text-slate-400 md:col-span-2">Equipamento / frota<select value={form.equipamentoId} onChange={event => updateEquipment(event.target.value)} className="mt-2 h-11 w-full border border-slate-700 bg-slate-900 px-3 text-base text-white outline-none focus:border-emerald-500"><option value="">Selecione por prefixo</option>{sortedEquipment.map(item => <option key={item.id} value={item.id}>{item.prefixo} - {item.tipo || item.nome}</option>)}</select></label>
          <label className="text-xs font-bold uppercase text-slate-400">Prefixo<input value={form.prefixo} onChange={event => setForm(current => ({ ...current, prefixo: event.target.value.toUpperCase() }))} className="mt-2 h-11 w-full border border-slate-700 bg-slate-900 px-3 text-base text-white outline-none focus:border-emerald-500" /></label>
          <label className="text-xs font-bold uppercase text-slate-400">Tipo de equipamento<input value={form.tipoEquipamento} onChange={event => setForm(current => ({ ...current, tipoEquipamento: event.target.value }))} className="mt-2 h-11 w-full border border-slate-700 bg-slate-900 px-3 text-base text-white outline-none focus:border-emerald-500" /></label>
          <label className="text-xs font-bold uppercase text-slate-400 md:col-span-2">Operador / motorista<select value={form.operadorId} onChange={event => updateOperator(event.target.value)} className="mt-2 h-11 w-full border border-slate-700 bg-slate-900 px-3 text-base text-white outline-none focus:border-emerald-500"><option value="">Selecionar do cadastro ou digitar abaixo</option>{activeOperators.map(item => <option key={item.id} value={item.id}>{item.nome} {item.matricula ? `- ${item.matricula}` : ''}</option>)}</select><input value={form.operadorNome} onChange={event => setForm(current => ({ ...current, operadorNome: event.target.value }))} placeholder="Nome do operador/motorista" className="mt-2 h-11 w-full border border-slate-700 bg-slate-900 px-3 text-base text-white outline-none focus:border-emerald-500" /></label>
          <label className="text-xs font-bold uppercase text-slate-400">Matrícula<input value={form.matricula} onChange={event => setForm(current => ({ ...current, matricula: event.target.value }))} className="mt-2 h-11 w-full border border-slate-700 bg-slate-900 px-3 text-base text-white outline-none focus:border-emerald-500" /></label>
          <label className="text-xs font-bold uppercase text-slate-400">Jornada (h)<input type="number" min="0" step="0.5" value={form.jornada} onChange={event => setForm(current => ({ ...current, jornada: Number(event.target.value) }))} className="mt-2 h-11 w-full border border-slate-700 bg-slate-900 px-3 text-base text-white outline-none focus:border-emerald-500" /></label>
          <label className="text-xs font-bold uppercase text-slate-400">Horímetro inicial<input type="number" min="0" step="0.01" value={form.horimetroInicial || ''} onChange={event => setForm(current => ({ ...current, horimetroInicial: Number(event.target.value) }))} className="mt-2 h-11 w-full border border-slate-700 bg-slate-900 px-3 text-base text-white outline-none focus:border-emerald-500" /></label>
          <label className="text-xs font-bold uppercase text-slate-400">Horímetro final<input type="number" min="0" step="0.01" value={form.horimetroFinal || ''} onChange={event => setForm(current => ({ ...current, horimetroFinal: Number(event.target.value) }))} className="mt-2 h-11 w-full border border-slate-700 bg-slate-900 px-3 text-base text-white outline-none focus:border-emerald-500" /></label>
          <label className="text-xs font-bold uppercase text-slate-400">Apontador<input value={form.apontador} onChange={event => setForm(current => ({ ...current, apontador: event.target.value }))} className="mt-2 h-11 w-full border border-slate-700 bg-slate-900 px-3 text-base text-white outline-none focus:border-emerald-500" /></label>
          <label className="text-xs font-bold uppercase text-slate-400">Encarregado<input value={form.encarregado} onChange={event => setForm(current => ({ ...current, encarregado: event.target.value }))} className="mt-2 h-11 w-full border border-slate-700 bg-slate-900 px-3 text-base text-white outline-none focus:border-emerald-500" /></label>
        </div></section>

        <section className="border border-slate-800 bg-slate-950"><div className="flex items-center justify-between border-b border-slate-800 p-4"><div className="flex items-center gap-2"><Activity size={18} className="text-sky-300" /><div><h3 className="font-bold text-white">Serviços e horas</h3><span className="text-xs text-slate-500">Total calculado: {formatNumber(form.atividades.reduce((sum, item) => sum + item.totalHoras, 0))} h</span></div></div><button onClick={() => setForm(current => ({ ...current, atividades: [...current.atividades, createActivity()] }))} className="inline-flex h-9 items-center gap-2 border border-slate-700 bg-slate-900 px-3 text-xs font-bold"><Plus size={16} /> Linha</button></div><div className="overflow-x-auto"><div className="min-w-[1000px]"><div className="grid grid-cols-[42px_2fr_1fr_120px_130px_130px_100px_42px] gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2 text-[10px] font-bold uppercase text-slate-500"><span>Nº</span><span>Serviço / centro de custo</span><span>Código de perda</span><span>Medidor</span><span>Inicial</span><span>Final</span><span>Total</span><span /></div>{form.atividades.map((item, index) => <div key={item.id} className="grid grid-cols-[42px_2fr_1fr_120px_130px_130px_100px_42px] gap-2 border-b border-slate-800 px-3 py-2"><span className="grid place-items-center text-sm text-slate-500">{index + 1}</span><div className="grid grid-cols-2 gap-2"><input value={item.descricao} onChange={event => updateActivity(item.id, 'descricao', event.target.value)} placeholder="Descrição do serviço" className="h-10 border border-slate-700 bg-slate-900 px-2 text-sm outline-none focus:border-emerald-500" /><input value={item.centroCusto} onChange={event => updateActivity(item.id, 'centroCusto', event.target.value)} placeholder="Centro de custo" className="h-10 border border-slate-700 bg-slate-900 px-2 text-sm outline-none focus:border-emerald-500" /></div><select value={item.codigoPerda} onChange={event => updateActivity(item.id, 'codigoPerda', event.target.value)} className="h-10 border border-slate-700 bg-slate-900 px-2 text-sm outline-none focus:border-emerald-500"><option value="">Produtivo</option>{CODIGOS_PERDA_PARTE_DIARIA.map(([code, label]) => <option value={code} key={code}>{code} - {label}</option>)}</select><select value={item.tipoMarcacao} onChange={event => updateActivity(item.id, 'tipoMarcacao', event.target.value as TipoMarcacaoParteDiaria)} className="h-10 border border-slate-700 bg-slate-900 px-2 text-sm outline-none focus:border-emerald-500"><option>Horímetro</option><option>Relógio</option></select><input type={item.tipoMarcacao === 'Relógio' ? 'time' : 'number'} step={item.tipoMarcacao === 'Relógio' ? 60 : 0.01} value={item.inicial} onChange={event => updateActivity(item.id, 'inicial', event.target.value)} className="h-10 border border-slate-700 bg-slate-900 px-2 text-sm outline-none focus:border-emerald-500" /><input type={item.tipoMarcacao === 'Relógio' ? 'time' : 'number'} step={item.tipoMarcacao === 'Relógio' ? 60 : 0.01} value={item.final} onChange={event => updateActivity(item.id, 'final', event.target.value)} className="h-10 border border-slate-700 bg-slate-900 px-2 text-sm outline-none focus:border-emerald-500" /><span className={`grid h-10 place-items-center border text-sm font-bold ${item.codigoPerda ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>{formatNumber(item.totalHoras)} h</span><button title="Excluir linha" onClick={() => setForm(current => ({ ...current, atividades: current.atividades.length > 1 ? current.atividades.filter(row => row.id !== item.id) : current.atividades }))} className="grid h-10 place-items-center text-slate-500 hover:text-rose-300"><Trash2 size={16} /></button></div>)}</div></div></section>

        <section className="border border-slate-800 bg-slate-950"><div className="flex items-center justify-between border-b border-slate-800 p-4"><div className="flex items-center gap-2"><Truck size={18} className="text-amber-300" /><h3 className="font-bold text-white">Transporte e viagens</h3></div><button onClick={() => setForm(current => ({ ...current, transportes: [...current.transportes, createTransport()] }))} className="inline-flex h-9 items-center gap-2 border border-slate-700 bg-slate-900 px-3 text-xs font-bold"><Plus size={16} /> Linha</button></div><div className="overflow-x-auto"><div className="min-w-[1050px]"><div className="grid grid-cols-[42px_1.5fr_1fr_1fr_105px_1fr_42px] gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2 text-[10px] font-bold uppercase text-slate-500"><span>Nº</span><span>Serviço / centro de custo</span><span>Destino</span><span>Material</span><span>Viagens</span><span>Equip. carga</span><span /></div>{form.transportes.map((item, index) => <div key={item.id} className="grid grid-cols-[42px_1.5fr_1fr_1fr_105px_1fr_42px] gap-2 border-b border-slate-800 px-3 py-2"><span className="grid place-items-center text-sm text-slate-500">{index + 1}</span><div className="grid grid-cols-2 gap-2"><input value={item.descricao} onChange={event => updateTransport(item.id, 'descricao', event.target.value)} placeholder="Serviço" className="h-10 border border-slate-700 bg-slate-900 px-2 text-sm outline-none focus:border-emerald-500" /><input value={item.centroCusto} onChange={event => updateTransport(item.id, 'centroCusto', event.target.value)} placeholder="Centro de custo" className="h-10 border border-slate-700 bg-slate-900 px-2 text-sm outline-none focus:border-emerald-500" /></div><input value={item.destino} onChange={event => updateTransport(item.id, 'destino', event.target.value)} className="h-10 border border-slate-700 bg-slate-900 px-2 text-sm outline-none focus:border-emerald-500" /><input value={item.materialTransportado} onChange={event => updateTransport(item.id, 'materialTransportado', event.target.value)} className="h-10 border border-slate-700 bg-slate-900 px-2 text-sm outline-none focus:border-emerald-500" /><input type="number" min="0" value={item.quantidadeViagens || ''} onChange={event => updateTransport(item.id, 'quantidadeViagens', Number(event.target.value))} className="h-10 border border-slate-700 bg-slate-900 px-2 text-sm outline-none focus:border-emerald-500" /><input value={item.equipamentoCarga} onChange={event => updateTransport(item.id, 'equipamentoCarga', event.target.value)} className="h-10 border border-slate-700 bg-slate-900 px-2 text-sm outline-none focus:border-emerald-500" /><button title="Excluir linha" onClick={() => setForm(current => ({ ...current, transportes: current.transportes.length > 1 ? current.transportes.filter(row => row.id !== item.id) : current.transportes }))} className="grid h-10 place-items-center text-slate-500 hover:text-rose-300"><Trash2 size={16} /></button></div>)}</div></div></section>

        <section className="border border-slate-800 bg-slate-950"><div className="flex flex-col gap-3 border-b border-slate-800 p-4 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-2"><HardHat size={18} className="text-rose-300" /><div><h3 className="font-bold text-white">Checklist do equipamento</h3><span className="text-xs text-slate-500">{form.checklist.filter(item => item.resposta === 'Não').length} item(ns) com deficiência</span></div></div><div className="flex gap-2"><button onClick={() => setForm(current => ({ ...current, checklist: current.checklist.map(item => ({ ...item, resposta: 'Sim' })) }))} className="h-9 border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-bold text-emerald-300">Marcar todos Sim</button><button onClick={() => setForm(current => ({ ...current, checklist: current.checklist.map(item => ({ ...item, resposta: 'N/A' })) }))} className="h-9 border border-slate-700 bg-slate-900 px-3 text-xs font-bold text-slate-300">Limpar</button></div></div><div className="grid xl:grid-cols-2">{form.checklist.map(item => <div key={item.codigo} className={`grid grid-cols-[42px_1fr_auto] items-center gap-3 border-b border-slate-800 p-3 xl:odd:border-r ${item.resposta === 'Não' ? 'bg-rose-500/5' : ''}`}><strong className="text-xs text-slate-500">{item.codigo}</strong><span className="text-sm text-slate-200">{item.descricao}</span><div className="flex border border-slate-700">{(['Sim', 'Não', 'N/A'] as RespostaChecklistEquipamento[]).map(answer => <button key={answer} onClick={() => updateChecklist(item.codigo, answer)} className={`h-8 min-w-12 border-r border-slate-700 px-2 text-xs font-bold last:border-r-0 ${item.resposta === answer ? answer === 'Sim' ? 'bg-emerald-500 text-slate-950' : answer === 'Não' ? 'bg-rose-500 text-white' : 'bg-slate-600 text-white' : 'bg-slate-900 text-slate-400'}`}>{answer}</button>)}</div></div>)}</div><div className="grid gap-3 border-t border-slate-800 p-4 md:grid-cols-[1fr_auto]"><input value={customChecklist} onChange={event => setCustomChecklist(event.target.value)} placeholder="Novo item personalizado de checklist" className="h-10 border border-slate-700 bg-slate-900 px-3 text-sm outline-none focus:border-emerald-500" /><button onClick={addCustomChecklist} className="inline-flex h-10 items-center justify-center gap-2 border border-slate-700 bg-slate-900 px-4 text-sm font-bold"><Plus size={16} /> Adicionar item</button></div></section>

        <section className="grid gap-4 border border-slate-800 bg-slate-950 p-4 md:grid-cols-2"><label className="text-xs font-bold uppercase text-slate-400">Outros problemas<textarea value={form.outrosProblemas} onChange={event => setForm(current => ({ ...current, outrosProblemas: event.target.value }))} rows={4} className="mt-2 w-full resize-y border border-slate-700 bg-slate-900 p-3 text-sm text-white outline-none focus:border-emerald-500" /></label><label className="text-xs font-bold uppercase text-slate-400">Observações gerais<textarea value={form.observacao} onChange={event => setForm(current => ({ ...current, observacao: event.target.value }))} rows={4} className="mt-2 w-full resize-y border border-slate-700 bg-slate-900 p-3 text-sm text-white outline-none focus:border-emerald-500" /></label></section>
        <div className="sticky bottom-3 z-10 flex flex-col gap-2 border border-slate-700 bg-slate-950/95 p-3 shadow-2xl backdrop-blur md:flex-row md:items-center md:justify-between"><div className="flex flex-wrap gap-4 text-sm"><span>Trabalhado: <strong className="text-emerald-300">{formatNumber(getWorkedHours(form))} h</strong></span><span>Parado: <strong className="text-amber-300">{formatNumber(getStoppedHours(form))} h</strong></span><span>Status: <strong>{deriveStatus(buildFinalRecord())}</strong></span></div><div className="flex gap-2"><button onClick={() => setView('registros')} className="h-11 border border-slate-700 bg-slate-900 px-4 text-sm font-bold">Cancelar</button><button onClick={saveRecord} className="inline-flex h-11 items-center gap-2 bg-emerald-500 px-5 text-sm font-bold text-slate-950"><Save size={18} /> Salvar parte diária</button></div></div>
      </div>}

      {view === 'registros' && <section className="overflow-hidden border border-slate-800 bg-slate-950"><div className="flex items-center justify-between border-b border-slate-800 p-4"><div><h2 className="font-bold text-white">Partes diárias cadastradas</h2><span className="text-xs text-slate-500">{filtered.length} resultado(s)</span></div><ListFilter className="text-slate-400" size={20} /></div><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-slate-900 text-xs uppercase text-slate-500"><tr>{['Nº / data', 'Equipamento', 'Operador', 'Obra', 'Trabalhado', 'Parado', 'Checklist', 'Status', 'Ações'].map(label => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{filtered.map(item => { const deficiencies = item.checklist.filter(check => check.resposta === 'Não').length + (item.outrosProblemas ? 1 : 0); return <tr key={item.id} className="hover:bg-slate-900/60"><td className="px-4 py-3"><strong className="text-white">#{item.numero}</strong><span className="block text-xs text-slate-500">{formatDate(item.data)}</span></td><td className="px-4 py-3"><strong>{item.prefixo}</strong><span className="block max-w-44 truncate text-xs text-slate-500">{item.tipoEquipamento}</span></td><td className="px-4 py-3"><span className="block max-w-44 truncate">{item.operadorNome}</span><span className="text-xs text-slate-500">{item.matricula}</span></td><td className="px-4 py-3"><span className="block max-w-52 truncate">{item.obraNome}</span></td><td className="px-4 py-3 text-emerald-300">{formatNumber(getWorkedHours(item))} h</td><td className="px-4 py-3 text-amber-300">{formatNumber(getStoppedHours(item))} h</td><td className="px-4 py-3"><span className={deficiencies ? 'text-rose-300' : 'text-emerald-300'}>{deficiencies ? `${deficiencies} alerta(s)` : 'Sem alerta'}</span></td><td className="px-4 py-3"><span className={`inline-flex border px-2 py-1 text-xs font-bold ${statusTone[item.status]}`}>{item.status}</span></td><td className="px-4 py-3"><div className="flex gap-1"><button title="Visualizar" onClick={() => setPreviewRecord(item)} className="grid h-9 w-9 place-items-center text-slate-400 hover:bg-slate-800 hover:text-white"><Eye size={17} /></button><button title="Baixar PDF" onClick={() => downloadParteDiariaPdf(item, reneaLogoFull)} className="grid h-9 w-9 place-items-center text-slate-400 hover:bg-slate-800 hover:text-emerald-300"><FileDown size={17} /></button><button title="Editar" onClick={() => editRecord(item)} className="grid h-9 w-9 place-items-center text-slate-400 hover:bg-slate-800 hover:text-sky-300"><Edit3 size={17} /></button><button title="Duplicar" onClick={() => duplicateRecord(item)} className="grid h-9 w-9 place-items-center text-slate-400 hover:bg-slate-800 hover:text-amber-300"><CopyPlus size={17} /></button><button title="Excluir" onClick={() => onDelete(item.id)} className="grid h-9 w-9 place-items-center text-slate-400 hover:bg-slate-800 hover:text-rose-300"><Trash2 size={17} /></button></div></td></tr>; })}{!filtered.length && <tr><td colSpan={9} className="px-4 py-14 text-center text-slate-500">Nenhuma parte diária encontrada.</td></tr>}</tbody></table></div></section>}

      {view === 'deficiencias' && <div className="grid gap-5 xl:grid-cols-[1fr_1.3fr]"><section className="border border-slate-800 bg-slate-950"><div className="border-b border-slate-800 p-4"><h2 className="font-bold text-white">Mapa de deficiências</h2><span className="text-xs text-slate-500">Itens reprovados no checklist</span></div><div className="divide-y divide-slate-800">{deficiencyRanking.map(item => <div key={item.code} className="p-4"><div className="flex items-start justify-between gap-4"><div><strong className="text-rose-300">{item.code}</strong><span className="ml-2 text-sm text-white">{item.label}</span><span className="mt-1 block text-xs text-slate-500">Frota: {item.equipment.join(', ')}</span></div><span className="grid h-8 min-w-8 place-items-center bg-rose-500/15 px-2 text-sm font-bold text-rose-300">{item.count}</span></div></div>)}{!deficiencyRanking.length && <div className="grid min-h-64 place-items-center text-center text-sm text-slate-500"><div><CheckCircle2 className="mx-auto mb-2 text-emerald-400" size={32} />Nenhuma deficiência encontrada.</div></div>}</div></section><section className="border border-slate-800 bg-slate-950"><div className="border-b border-slate-800 p-4"><h2 className="font-bold text-white">Fichas que exigem atenção</h2><span className="text-xs text-slate-500">Deficiência, pendência ou inconsistência</span></div><div className="divide-y divide-slate-800">{filtered.filter(item => item.status !== 'Conferido').map(item => <div key={item.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><strong className="text-white">#{item.numero} - {item.prefixo}</strong><span className={`border px-2 py-0.5 text-[11px] font-bold ${statusTone[item.status]}`}>{item.status}</span></div><span className="mt-1 block text-xs text-slate-500">{formatDate(item.data)} | {item.operadorNome} | {item.obraNome}</span><p className="mt-2 text-sm text-slate-300">{item.checklist.filter(check => check.resposta === 'Não').map(check => check.descricao).join('; ') || item.outrosProblemas || 'Cadastro pendente de conferência.'}</p></div><div className="flex shrink-0 gap-1"><button title="Visualizar" onClick={() => setPreviewRecord(item)} className="grid h-9 w-9 place-items-center border border-slate-700 text-slate-400 hover:text-white"><Eye size={16} /></button><button title="Editar" onClick={() => editRecord(item)} className="grid h-9 w-9 place-items-center border border-slate-700 text-slate-400 hover:text-sky-300"><Edit3 size={16} /></button></div></div>)}{!filtered.some(item => item.status !== 'Conferido') && <div className="grid min-h-64 place-items-center text-center text-sm text-slate-500">Nenhuma ficha exige atenção.</div>}</div></section></div>}

      {view === 'legado' && <LegadoSgePanel registros={registros} equipamentos={equipamentos} obras={obras} onImport={onImport} />}
      {view === 'indicadores-sge' && <SgeIndicadoresPanel />}

      {previewRecord && <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950/95"><div className="flex items-center justify-between border-b border-slate-700 bg-slate-950 px-4 py-3"><div><strong className="text-white">Parte diária nº {previewRecord.numero}</strong><span className="ml-3 text-sm text-slate-500">{previewRecord.prefixo} | {formatDate(previewRecord.data)}</span></div><div className="flex gap-2"><button onClick={() => downloadParteDiariaPdf(previewRecord, reneaLogoFull)} className="inline-flex h-10 items-center gap-2 bg-emerald-500 px-4 text-sm font-bold text-slate-950"><FileDown size={17} /> Baixar PDF</button><button title="Fechar" onClick={() => setPreviewRecord(null)} className="grid h-10 w-10 place-items-center border border-slate-700 bg-slate-900"><X size={19} /></button></div></div><div className="flex-1 overflow-auto p-4"><DocumentPreview record={previewRecord} /></div></div>}
    </div>
  );
};

export default ParteDiariaEquipamentosTab;
