import React, { useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Cloud,
  CloudUpload,
  CopyPlus,
  CircleDollarSign,
  Database,
  Download,
  Droplets,
  Eye,
  FileSearch,
  FileSpreadsheet,
  Fuel,
  Gauge,
  Keyboard,
  LayoutDashboard,
  ListChecks,
  LoaderCircle,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  ScanLine,
  Search,
  Trash2,
  Truck,
  Upload,
  X,
} from 'lucide-react';
import ExcelJS from 'exceljs';
import type { Abastecimento, AlertaCombustivel, Comboio, Empresa, Equipamento, TipoCombustivel } from '../types';
import {
  auditFuelDataset,
  findEquipmentByPrefix,
  getFuelQualityScore,
  normalizeQuickTime,
  normalizeFuelRecord,
} from '../utils/combustivelValidation';
import { findLastRecordedPumpForConvoy } from '../utils/fuelPumpSequence';
import { analyzeFuelDocumentLocally, buildFuelOperationalAnalysis } from '../utils/fuelDocumentParsing';
import type { OperationalAnalysis } from '../utils/operationalAnalysis';
import {
  enrichFuelDataset,
  enrichFuelRecord,
  getFuelCompetence,
  getFuelCostTotal,
  getFuelTankCapacity,
} from '../utils/fuelOperations';
import {
  addCorporateSummarySheet,
  configureCorporateWorkbook,
  downloadCorporateWorkbook,
  styleCorporateWorksheet,
} from '../utils/excelCorporate';
import { auth } from '../firebase';
import type { OneDriveFuelSyncStatus } from '../oneDriveFuelSync';
import OperationalAnalysisPanel from './OperationalAnalysisPanel';
import { stageFuelDataset } from '../services/masterDataApi';

interface CombustivelInteligenteTabProps {
  empresas: Empresa[];
  equipamentos: Equipamento[];
  comboios: Comboio[];
  combustiveis: TipoCombustivel[];
  abastecimentos: Abastecimento[];
  onSaveAbastecimento: (item: Abastecimento, isNew: boolean) => void;
  onDeleteAbastecimento: (id: string) => void;
  onImportAbastecimentos: (items: Abastecimento[], combustiveisImportados?: TipoCombustivel[]) => void;
  onOpenLubrificacao: () => void;
  onOpenCadastros?: () => void;
  onOpenSpreadsheetImport: () => void;
  isParsingSpreadsheet: boolean;
  oneDriveFuelSyncStatus?: OneDriveFuelSyncStatus | null;
}

type WorkspaceView = 'painel' | 'digitacao' | 'documento' | 'registros' | 'conferencia';

interface QuickFuelRow {
  id: string;
  prefixo: string;
  equipamentoId: string;
  hora: string;
  horimetroInicial: number;
  kmInicial: number;
  bombaInicial: number;
  bombaFinal: number;
  quantidadeLitros: number;
  observacao: string;
}

interface AiExtractionRow {
  id: string;
  selected: boolean;
  revisado: boolean;
  pagina: number;
  linha: number;
  prefixo: string;
  equipamentoId: string;
  data: string;
  hora: string;
  horimetroInicial: number;
  kmInicial: number;
  bombaInicial: number;
  bombaFinal: number;
  quantidadeLitros: number;
  tipoCombustivelId: string;
  comboioId: string;
  responsavel: string;
  observacao: string;
  confiancaGeral: number;
  camposIncertos: string[];
  transcricaoOriginal: string;
}

interface AiAnalysisResponse {
  tipoDocumento: string;
  dataDocumento?: string | null;
  paginas: number;
  avisosDocumento: string[];
  registros: Array<Record<string, any>>;
  analiseOperacional?: OperationalAnalysis;
}

const today = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};
const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const normalizeFuelNumber = (value: number, decimalPlaces = 2) => {
  const numericValue = Number(value || 0);
  if (!Number.isFinite(numericValue)) return 0;
  const factor = 10 ** decimalPlaces;
  return Math.round((numericValue + Number.EPSILON) * factor) / factor;
};

const formatNumber = (value: number, maximumFractionDigits = 2) =>
  normalizeFuelNumber(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
const formatDate = (value: string) => (value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : '-');
const normalize = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();

const getFuelRecordPrefix = (record: Abastecimento, equipamentos: Equipamento[]) =>
  equipamentos.find((item) => item.id === record.equipamentoId)?.prefixo
  || record.prefixoInformado
  || 'Sem prefixo';

const statusTone: Record<string, string> = {
  OK: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  Pendente: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  Duplicado: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  'Verificar quantidade': 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  'Verificar bomba': 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  'Verificar horímetro': 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  'Verificar KM': 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  'Verificar sequência': 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  'Consumo fora do padrão': 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  'Conferência necessária': 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  'Erro de importação': 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

const sourceTone: Record<string, string> = {
  Manual: 'bg-sky-500/10 text-sky-300',
  Planilha: 'bg-violet-500/10 text-violet-300',
  OneDrive: 'bg-emerald-500/10 text-emerald-300',
  'PDF/Foto IA': 'bg-cyan-500/10 text-cyan-300',
  'Legado Access': 'bg-slate-700 text-slate-300',
};

const readFileAsDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível ler o documento.'));
    reader.readAsDataURL(file);
  });

const compressImageForAnalysis = async (file: File) => {
  const original = await readFileAsDataUrl(file);
  if (!file.type.startsWith('image/')) return { mimeType: file.type, dataUrl: original };
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('A imagem não pôde ser aberta.'));
    element.src = original;
  });
  const maxSide = 2200;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) return { mimeType: file.type, dataUrl: original };
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { mimeType: 'image/jpeg', dataUrl: canvas.toDataURL('image/jpeg', 0.86) };
};

const hashFile = async (file: File) => {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const CombustivelInteligenteTab: React.FC<CombustivelInteligenteTabProps> = ({
  empresas,
  equipamentos,
  comboios,
  combustiveis,
  abastecimentos,
  onSaveAbastecimento,
  onDeleteAbastecimento,
  onImportAbastecimentos,
  onOpenLubrificacao,
  onOpenCadastros,
  onOpenSpreadsheetImport,
  isParsingSpreadsheet,
  oneDriveFuelSyncStatus,
}) => {
  const [view, setView] = useState<WorkspaceView>('painel');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [filterEquipment, setFilterEquipment] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [search, setSearch] = useState('');
  const [globalError, setGlobalError] = useState('');
  const [supabaseSyncing, setSupabaseSyncing] = useState(false);
  const [supabaseMessage, setSupabaseMessage] = useState('');

  const sortedEquipment = useMemo(
    () => [...equipamentos].sort((a, b) => a.prefixo.localeCompare(b.prefixo, 'pt-BR', { numeric: true })),
    [equipamentos],
  );
  const enrichedRecords = useMemo(
    () => enrichFuelDataset(abastecimentos, equipamentos),
    [abastecimentos, equipamentos],
  );
  const auditedRecords = useMemo(
    () => auditFuelDataset(enrichedRecords, equipamentos),
    [enrichedRecords, equipamentos],
  );
  const filteredRecords = useMemo(
    () =>
      auditedRecords
        .filter((record) => {
          if (filterStart && record.data < filterStart) return false;
          if (filterEnd && record.data > filterEnd) return false;
          if (filterEquipment && record.equipamentoId !== filterEquipment) return false;
          if (filterStatus && (record.status || 'OK') !== filterStatus) return false;
          if (filterSource && (record.origem || 'Manual') !== filterSource) return false;
          const equipment = equipamentos.find((item) => item.id === record.equipamentoId);
          const term = search.trim().toLowerCase();
          return (
            !term ||
            [
              getFuelRecordPrefix(record, equipamentos),
              equipment?.nome,
              record.responsavel,
              record.observacao,
              record.data,
              record.documentoOrigemNome,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()
              .includes(term)
          );
        })
        .sort((a, b) => `${b.data}T${b.hora}`.localeCompare(`${a.data}T${a.hora}`)),
    [auditedRecords, filterStart, filterEnd, filterEquipment, filterStatus, filterSource, search, equipamentos],
  );

  const dashboard = useMemo(() => {
    const totalLiters = filteredRecords.reduce((sum, item) => sum + Number(item.quantidadeLitros || 0), 0);
    const totalCost = filteredRecords.reduce((sum, item) => sum + Number(item.custoTotal || 0), 0);
    const pendingReview = filteredRecords.filter(item =>
      item.revisaoStatus !== 'Aprovado'
      && item.alertas?.some(alert => alert.severidade !== 'info')
    ).length;
    return {
      totalLiters,
      totalCost,
      alerts: filteredRecords.reduce((sum, item) => sum + (item.alertas?.filter(alert => alert.severidade !== 'info').length || 0), 0),
      critical: filteredRecords.reduce((sum, item) => sum + (item.alertas?.filter(alert => alert.severidade === 'critico').length || 0), 0),
      pendingReview,
      uniqueEquipment: new Set(filteredRecords.map((item) => item.equipamentoId || item.prefixoInformado || item.id)).size,
    };
  }, [filteredRecords]);

  const dailyTrend = useMemo(() => {
    const map = new Map<string, number>();
    filteredRecords.forEach((item) =>
      map.set(item.data, (map.get(item.data) || 0) + Number(item.quantidadeLitros || 0)),
    );
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, liters]) => ({ date, liters }));
  }, [filteredRecords]);
  const maxDaily = Math.max(1, ...dailyTrend.map((item) => item.liters));

  const equipmentRanking = useMemo(() => {
    const map = new Map<
        string,
        { equipmentId: string; liters: number; records: number; alerts: number; lastDate: string; rates: number[] }
      >();
    const chronological = [...filteredRecords].sort((a, b) =>
      `${a.data}T${a.hora}`.localeCompare(`${b.data}T${b.hora}`),
    );
    const previous = new Map<string, Abastecimento>();
    chronological.forEach((item) => {
      const equipmentKey = item.equipamentoId || item.prefixoInformado || item.id;
      const current = map.get(equipmentKey) || {
        equipmentId: equipmentKey,
        liters: 0,
        records: 0,
        alerts: 0,
        lastDate: '',
        rates: [] as number[],
      };
      current.liters += Number(item.quantidadeLitros || 0);
      current.records += 1;
      current.alerts = 0;
      current.lastDate = current.lastDate > item.data ? current.lastDate : item.data;
      const prior = previous.get(equipmentKey);
      if (prior && item.horimetroInicial > prior.horimetroInicial && item.quantidadeLitros > 0)
        current.rates.push(item.quantidadeLitros / (item.horimetroInicial - prior.horimetroInicial));
      previous.set(equipmentKey, item);
      map.set(equipmentKey, current);
    });
    return [...map.values()]
      .map((item) => ({
        ...item,
        averageRate: item.rates.length ? item.rates.reduce((a, b) => a + b, 0) / item.rates.length : 0,
      }))
      .sort((a, b) => b.liters - a.liters);
  }, [filteredRecords]);

  const issueRanking = useMemo(() => {
    const issues = new Map<string, { code: string; label: string; count: number; severity: AlertaCombustivel['severidade'] }>();
    filteredRecords.forEach(record => record.alertas?.forEach(alert => {
      if (alert.severidade === 'info') return;
      const current = issues.get(alert.codigo);
      issues.set(alert.codigo, {
        code: alert.codigo,
        label: alert.mensagem,
        count: (current?.count || 0) + 1,
        severity: current?.severity === 'critico' || alert.severidade === 'critico' ? 'critico' : 'aviso',
      });
    }));
    return [...issues.values()].sort((left, right) => right.count - left.count || left.code.localeCompare(right.code));
  }, [filteredRecords]);

  const reviewQueue = useMemo(
    () => filteredRecords
      .filter(record =>
        record.revisaoStatus !== 'Aprovado'
        && record.alertas?.some(alert => alert.severidade !== 'info')
      )
      .sort((left, right) => {
        const scoreDifference = getFuelQualityScore(left.alertas || []) - getFuelQualityScore(right.alertas || []);
        return scoreDifference || `${left.data}T${left.hora}`.localeCompare(`${right.data}T${right.hora}`);
      }),
    [filteredRecords],
  );

  const sourceDistribution = useMemo(() => {
    const map = new Map<string, number>();
    filteredRecords.forEach((item) => {
      const source = item.origem || 'Manual';
      map.set(source, (map.get(source) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [filteredRecords]);

  const pendingCadastroPrefixes = useMemo(
    () => Array.from(new Set<string>(
      auditedRecords
        .filter((record) => !record.equipamentoId && record.prefixoInformado)
        .map((record) => String(record.prefixoInformado || '').trim().toUpperCase())
        .filter(Boolean),
    )).sort((a: string, b: string) => a.localeCompare(b, 'pt-BR', { numeric: true })),
    [auditedRecords],
  );

  const clearFilters = () => {
    setFilterStart('');
    setFilterEnd('');
    setFilterEquipment('');
    setFilterStatus('');
    setFilterSource('');
    setSearch('');
  };

  const getLastPump = (
    comboioId: string,
    _referenceDate = today(),
    _referenceTime = '',
    excludeId = editingId || '',
  ) => findLastRecordedPumpForConvoy(
    auditedRecords,
    comboioId,
    excludeId,
  )?.bombaFinal || 0;

  const [entryDate, setEntryDate] = useState(today());
  const [entryFuel, setEntryFuel] = useState(combustiveis[0]?.id || '');
  const [entryComboio, setEntryComboio] = useState(comboios[0]?.id || '');
  const [entryResponsible, setEntryResponsible] = useState('');
  const [entryCostPerLiter, setEntryCostPerLiter] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const createQuickRow = (pumpStart = getLastPump(entryComboio, entryDate)): QuickFuelRow => ({
    id: uid('fuel-row'),
    prefixo: '',
    equipamentoId: '',
    hora: '',
    horimetroInicial: 0,
    kmInicial: 0,
    bombaInicial: normalizeFuelNumber(pumpStart),
    bombaFinal: normalizeFuelNumber(pumpStart),
    quantidadeLitros: 0,
    observacao: '',
  });
  const [quickRows, setQuickRows] = useState<QuickFuelRow[]>(() => [createQuickRow(0)]);

  const resetQuickEntry = () => {
    const defaultComboio = comboios[0]?.id || '';
    setEntryDate(today());
    setEntryFuel(combustiveis[0]?.id || '');
    setEntryComboio(defaultComboio);
    setEntryResponsible('');
    setEntryCostPerLiter(0);
    setEditingId(null);
    setReviewOpen(false);
    setQuickRows([createQuickRow(getLastPump(defaultComboio, today()))]);
    setGlobalError('');
  };

  const handleComboioEntryChange = (comboioId: string) => {
    setEntryComboio(comboioId);
    const start = getLastPump(comboioId, entryDate);
    setQuickRows((rows) =>
      rows.map((row, index) =>
        index === 0
          ? { ...row, bombaInicial: normalizeFuelNumber(start), bombaFinal: normalizeFuelNumber(start + row.quantidadeLitros) }
          : row,
      ),
    );
  };

  const handleEntryDateChange = (date: string) => {
    setEntryDate(date);
  };

  const updateQuickRow = (id: string, field: keyof QuickFuelRow, value: string | number) => {
    setQuickRows((current) => {
      const originalIndex = current.findIndex((row) => row.id === id);
      const originalFinal = originalIndex >= 0 ? current[originalIndex].bombaFinal : 0;
      const rows = current.map((row) => {
        if (row.id !== id) return row;
        let next = { ...row, [field]: value } as QuickFuelRow;
        if (field === 'prefixo') {
          const equipment = findEquipmentByPrefix(String(value), equipamentos);
          next = { ...next, equipamentoId: equipment?.id || '', prefixo: String(value).toUpperCase() };
        }
        if (field === 'quantidadeLitros') next.bombaFinal = normalizeFuelNumber(Number(next.bombaInicial || 0) + Number(value || 0));
        if (field === 'bombaInicial') next.bombaFinal = normalizeFuelNumber(Number(value || 0) + Number(next.quantidadeLitros || 0));
        if (field === 'bombaFinal')
          next.quantidadeLitros = normalizeFuelNumber(Math.max(0, Number(value || 0) - Number(next.bombaInicial || 0)));
        if (field === 'hora' && originalIndex === 0 && !editingId) {
          const normalizedTime = normalizeQuickTime(String(value));
          if (normalizedTime.valid) {
            const previousSuggestion = getLastPump(entryComboio, entryDate, current[0].hora);
            const nextSuggestion = getLastPump(entryComboio, entryDate, normalizedTime.value);
            if (next.bombaInicial === 0 || next.bombaInicial === previousSuggestion) {
              next.bombaInicial = normalizeFuelNumber(nextSuggestion);
              next.bombaFinal = normalizeFuelNumber(nextSuggestion + next.quantidadeLitros);
            }
          }
        }
        return next;
      });
      const index = rows.findIndex((row) => row.id === id);
      if (
        index >= 0 &&
        index < rows.length - 1 &&
        (rows[index + 1].bombaInicial === 0 || rows[index + 1].bombaInicial === originalFinal)
      ) {
        rows[index + 1] = {
          ...rows[index + 1],
          bombaInicial: rows[index].bombaFinal,
          bombaFinal: normalizeFuelNumber(rows[index].bombaFinal + rows[index + 1].quantidadeLitros),
        };
      }
      return rows;
    });
  };

  const blurQuickTime = (id: string, raw: string) => {
    const normalized = normalizeQuickTime(raw);
    updateQuickRow(id, 'hora', normalized.valid ? normalized.value : raw);
  };

  const quickEvaluated = useMemo(() => {
    const staged: Abastecimento[] = [];
    return quickRows.map((row) => {
      const record: Abastecimento = {
        id: editingId || row.id,
        data: entryDate,
        hora: normalizeQuickTime(row.hora).value || row.hora,
        equipamentoId: row.equipamentoId,
        prefixoInformado: row.prefixo.trim().toUpperCase(),
        horimetroInicial: normalizeFuelNumber(row.horimetroInicial),
        kmInicial: normalizeFuelNumber(row.kmInicial),
        bombaInicial: normalizeFuelNumber(row.bombaInicial),
        quantidadeLitros: normalizeFuelNumber(row.quantidadeLitros),
        bombaFinal: normalizeFuelNumber(row.bombaFinal),
        tipoCombustivelId: entryFuel,
        comboioId: entryComboio,
        responsavel: entryResponsible.trim(),
        observacao: row.observacao.trim(),
        custoLitro: normalizeFuelNumber(entryCostPerLiter, 4),
        origem: 'Manual',
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      };
      const equipment = equipamentos.find(item => item.id === record.equipamentoId);
      const finalized = normalizeFuelRecord(
        enrichFuelRecord(record, equipment),
        [...auditedRecords, ...staged],
        equipamentos,
      );
      staged.push(finalized);
      return {
        row,
        record: finalized,
        alertCount: finalized.alertas?.filter(alert => alert.severidade !== 'info').length || 0,
        blocking: false,
      };
    });
  }, [quickRows, editingId, entryDate, entryFuel, entryComboio, entryResponsible, entryCostPerLiter, equipamentos, auditedRecords]);
  const quickReady = quickEvaluated.filter(
    (item) => item.row.prefixo || item.row.quantidadeLitros || item.row.hora,
  );

  const openQuickReview = () => {
    setGlobalError('');
    if (!quickReady.length) {
      setGlobalError('Adicione ao menos um prefixo e os dados do abastecimento.');
      return;
    }
    setReviewOpen(true);
  };

  const confirmQuickEntry = () => {
    const records = quickReady
      .filter((item) => item.row.prefixo || item.row.quantidadeLitros)
      .map((item) => ({
        ...item.record,
        camposRevisados: [
          'prefixo',
          'data',
          'hora',
          'leitura',
          'bomba',
          'quantidade',
          'produto',
          'comboio',
          'responsavel',
        ],
        revisaoStatus: item.record.alertas?.some(alert => alert.severidade !== 'info') ? 'Pendente' as const : 'Aprovado' as const,
        revisadoPor: item.record.alertas?.some(alert => alert.severidade !== 'info')
          ? undefined
          : auth.currentUser?.displayName || auth.currentUser?.email || 'Usuário autenticado',
        revisadoEm: item.record.alertas?.some(alert => alert.severidade !== 'info')
          ? undefined
          : new Date().toISOString(),
      }));
    if (editingId && records.length === 1) onSaveAbastecimento(records[0], false);
    else onImportAbastecimentos(records);
    resetQuickEntry();
    setView('registros');
  };

  const editRecord = (record: Abastecimento) => {
    const equipment = equipamentos.find((item) => item.id === record.equipamentoId);
    setEntryDate(record.data);
    setEntryFuel(record.tipoCombustivelId);
    setEntryComboio(record.comboioId);
    setEntryResponsible(record.responsavel);
    setEntryCostPerLiter(Number(record.custoLitro || 0));
    setEditingId(record.id);
    setQuickRows([
      {
        id: record.id,
        prefixo: equipment?.prefixo || record.prefixoInformado || '',
        equipamentoId: record.equipamentoId,
        hora: record.hora,
        horimetroInicial: record.horimetroInicial,
        kmInicial: record.kmInicial,
        bombaInicial: record.bombaInicial,
        bombaFinal: record.bombaFinal,
        quantidadeLitros: record.quantidadeLitros,
        observacao: record.observacao,
      },
    ]);
    setGlobalError('');
    setView('digitacao');
  };

  const approveReview = (record: Abastecimento) => {
    const reviewer = auth.currentUser?.displayName || auth.currentUser?.email || 'Usuário autenticado';
    onSaveAbastecimento({
      ...record,
      revisaoStatus: 'Aprovado',
      revisadoPor: reviewer,
      revisadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    }, false);
    setSupabaseMessage(`Registro ${getFuelRecordPrefix(record, equipamentos)} marcado como conferido por ${reviewer}.`);
  };

  const stageCurrentFuelDataset = async () => {
    if (!filteredRecords.length) {
      setSupabaseMessage('Não há registros no filtro atual para enviar à persistência gradual.');
      return;
    }
    setSupabaseSyncing(true);
    setSupabaseMessage('');
    try {
      const batches = await stageFuelDataset(
        `Combustível RENEA ${today()}`,
        filteredRecords.map(record => ({
          ...record,
          sourceRowId: record.integracaoOrigemId || record.id,
        })),
        {
          filteredStart: filterStart || null,
          filteredEnd: filterEnd || null,
          source: 'combustivel-v2.4',
        },
      );
      const preserved = batches.reduce((sum, batch) => sum + batch.preservedRows, 0);
      setSupabaseMessage(`${preserved} registro(s) preservado(s) no Supabase em ${batches.length} lote(s), sem promoção automática.`);
    } catch (error) {
      setSupabaseMessage(error instanceof Error ? error.message : 'Não foi possível preservar a base no Supabase.');
    } finally {
      setSupabaseSyncing(false);
    }
  };

  const documentInputRef = useRef<HTMLInputElement>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentUrl, setDocumentUrl] = useState('');
  const [documentHash, setDocumentHash] = useState('');
  const [manualDocumentText, setManualDocumentText] = useState('');
  const [documentAnalysis, setDocumentAnalysis] = useState<AiAnalysisResponse | null>(null);
  const [aiRows, setAiRows] = useState<AiExtractionRow[]>([]);
  const [selectedAiRow, setSelectedAiRow] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState('');

  const findCatalogItem = <T extends { id: string }>(value: string, list: T[], getLabel: (item: T) => string) => {
    const target = normalize(value);
    if (!target) return undefined;
    const exact = list.find((item) => normalize(getLabel(item)) === target);
    if (exact) return exact;
    const partial = list.filter((item) => {
      const label = normalize(getLabel(item));
      return label.includes(target) || target.includes(label);
    });
    return partial.length === 1 ? partial[0] : undefined;
  };

  const selectDocument = (file?: File) => {
    if (!file) return;
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setAiError('Use um arquivo PDF, JPG, PNG ou WEBP.');
      return;
    }
    if (documentUrl) URL.revokeObjectURL(documentUrl);
    setDocumentFile(file);
    setDocumentUrl(URL.createObjectURL(file));
    setManualDocumentText('');
    setDocumentAnalysis(null);
    setAiRows([]);
    setSelectedAiRow('');
    setAiError('');
  };

  const mapAnalysisRows = (analysis: AiAnalysisResponse): AiExtractionRow[] =>
    (analysis.registros || []).map((raw, index): AiExtractionRow => {
      const equipment = findEquipmentByPrefix(String(raw.prefixo || ''), equipamentos);
      const fuel = findCatalogItem<TipoCombustivel>(String(raw.tipoCombustivel || ''), combustiveis, (item) => item.nome);
      const comboio = findCatalogItem<Comboio>(String(raw.comboio || ''), comboios, (item) => item.nome);
      const normalizedTime = normalizeQuickTime(String(raw.hora || ''));
      const pumpStart = normalizeFuelNumber(Number(raw.bombaInicial || 0));
      const pumpEnd = normalizeFuelNumber(Number(raw.bombaFinal || 0));
      const liters = normalizeFuelNumber(Number(raw.quantidadeLitros ?? (pumpEnd > pumpStart ? pumpEnd - pumpStart : 0)));
      return {
        id: uid(`ai-${index}`),
        selected: true,
        revisado: false,
        pagina: Number(raw.pagina || 1),
        linha: Number(raw.linha || index + 1),
        prefixo: equipment?.prefixo || String(raw.prefixo || '').toUpperCase(),
        equipamentoId: equipment?.id || '',
        data: String(raw.data || analysis.dataDocumento || ''),
        hora: normalizedTime.valid ? normalizedTime.value : String(raw.hora || ''),
        horimetroInicial: normalizeFuelNumber(Number(raw.horimetroInicial || 0)),
        kmInicial: normalizeFuelNumber(Number(raw.kmInicial || 0)),
        bombaInicial: pumpStart,
        bombaFinal: pumpEnd || normalizeFuelNumber(pumpStart + liters),
        quantidadeLitros: liters,
        tipoCombustivelId: fuel?.id || '',
        comboioId: comboio?.id || '',
        responsavel: String(raw.responsavel || ''),
        observacao: [raw.observacao, `Transcrição: ${raw.transcricaoOriginal || ''}`].filter(Boolean).join(' | '),
        confiancaGeral: Math.max(0, Math.min(1, Number(raw.confiancaGeral || 0))),
        camposIncertos: Array.isArray(raw.camposIncertos) ? raw.camposIncertos.map(String) : [],
        transcricaoOriginal: String(raw.transcricaoOriginal || ''),
      };
    });

  const analyzeDocumentWithServer = async () => {
    if (!documentFile) throw new Error('Selecione um PDF ou uma foto.');
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Sessão Firebase não ativa para a análise inteligente.');

    const prepared = await compressImageForAnalysis(documentFile);
    const dataBase64 = prepared.dataUrl.split(',')[1] || '';
    if (dataBase64.length > 7_000_000) {
      throw new Error('O documento ficou grande demais. Divida o PDF ou envie uma foto por página.');
    }
    const idToken = await currentUser.getIdToken();
    const response = await fetch('/.netlify/functions/analisar-combustivel-documento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({
        fileName: documentFile.name,
        mimeType: prepared.mimeType,
        dataBase64,
        equipamentos: equipamentos.map((item) => item.prefixo),
        combustiveis: combustiveis.map((item) => item.nome),
        comboios: comboios.map((item) => item.nome),
      }),
    });
    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      throw new Error(
        response.status === 404
          ? 'Function Netlify não encontrada neste ambiente.'
          : `Resposta inválida da análise inteligente (HTTP ${response.status}).`,
      );
    }
    if (!response.ok || !payload.success) throw new Error(payload.message || 'A análise do documento falhou.');
    return payload.analysis as AiAnalysisResponse;
  };

  const runDocumentAnalysis = async () => {
    if (!documentFile) {
      setAiError('Selecione um PDF ou uma foto.');
      return;
    }
    setAnalyzing(true);
    setAiError('');
    try {
      const hash = await hashFile(documentFile);
      if (abastecimentos.some((item) => item.documentoOrigemHash === hash)) {
        throw new Error(
          'Este mesmo documento já foi gravado no banco. Abra os registros e confira antes de importá-lo novamente.',
        );
      }

      let analysis: AiAnalysisResponse | null = null;
      let serverError = '';
      try {
        analysis = await analyzeDocumentWithServer();
      } catch (error) {
        serverError = error instanceof Error ? error.message : 'IA indisponível.';
      }

      if (!analysis) {
        const localAnalysis = await analyzeFuelDocumentLocally(
          documentFile,
          {
            equipamentos: equipamentos.map((item) => item.prefixo),
            combustiveis: combustiveis.map((item) => item.nome),
            comboios: comboios.map((item) => item.nome),
          },
          { manualText: manualDocumentText, defaultDate: entryDate || today() },
        );
        const aiSetupWarning = /AI_NOT_CONFIGURED|sem chave|não foi configurada|nao foi configurada/i.test(serverError)
          ? 'IA online ainda não configurada no Netlify. A leitura local foi usada quando possível; para fotos e PDFs escaneados, cadastre GEMINI_API_KEY no Netlify.'
          : `IA online indisponível: ${serverError}`;
        analysis = {
          ...localAnalysis,
          avisosDocumento: [
            aiSetupWarning,
            ...localAnalysis.avisosDocumento,
          ],
        };
      }

      analysis = {
        ...analysis,
        analiseOperacional: analysis.analiseOperacional
          || buildFuelOperationalAnalysis(analysis.registros || [], analysis.avisosDocumento || []),
      };

      const mappedRows = mapAnalysisRows(analysis);
      setDocumentHash(hash);
      setDocumentAnalysis(analysis);
      setAiRows(mappedRows);
      setSelectedAiRow(mappedRows[0]?.id || '');
      if (!mappedRows.length) {
        setAiError(
          'Nenhum abastecimento foi identificado. Para foto ou PDF escaneado, configure a análise inteligente no Netlify ou cole a transcrição/OCR no campo de texto e analise novamente.',
        );
      }
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'Não foi possível analisar o documento.');
    } finally {
      setAnalyzing(false);
    }
  };

  const updateAiRow = (id: string, field: keyof AiExtractionRow, value: string | number | boolean) => {
    setAiRows((rows) =>
      rows.map((row) => {
      if (row.id !== id) return row;
      let next = { ...row, [field]: value } as AiExtractionRow;
      if (field !== 'selected' && field !== 'revisado') next.revisado = false;
      if (field === 'prefixo') {
          const equipment = findEquipmentByPrefix(String(value), equipamentos);
          next = { ...next, prefixo: String(value).toUpperCase(), equipamentoId: equipment?.id || '' };
        }
        if (field === 'equipamentoId') {
          const equipment = equipamentos.find((item) => item.id === value);
          next.prefixo = equipment?.prefixo || next.prefixo;
        }
        if (field === 'quantidadeLitros') next.bombaFinal = normalizeFuelNumber(Number(next.bombaInicial || 0) + Number(value || 0));
        if (field === 'bombaFinal')
          next.quantidadeLitros = normalizeFuelNumber(Math.max(0, Number(value || 0) - Number(next.bombaInicial || 0)));
        if (field === 'bombaInicial') next.bombaFinal = normalizeFuelNumber(Number(value || 0) + Number(next.quantidadeLitros || 0));
        return next;
      }),
    );
  };

  const aiEvaluated = useMemo(
    () =>
      aiRows.map((row) => {
        const record: Abastecimento = {
          id: row.id,
          data: row.data,
          hora: normalizeQuickTime(row.hora).value || row.hora,
          equipamentoId: row.equipamentoId,
          horimetroInicial: normalizeFuelNumber(row.horimetroInicial),
          kmInicial: normalizeFuelNumber(row.kmInicial),
          bombaInicial: normalizeFuelNumber(row.bombaInicial),
          bombaFinal: normalizeFuelNumber(row.bombaFinal),
          quantidadeLitros: normalizeFuelNumber(row.quantidadeLitros),
          tipoCombustivelId: row.tipoCombustivelId,
          comboioId: row.comboioId,
          responsavel: row.responsavel,
          observacao: row.observacao,
          origem: 'PDF/Foto IA',
          confiancaExtracao: row.confiancaGeral,
          documentoOrigemNome: documentFile?.name || '',
          documentoOrigemHash: documentHash,
          camposRevisados: row.revisado
            ? ['prefixo', 'data', 'hora', 'leitura', 'bomba', 'quantidade', 'produto', 'comboio', 'responsavel']
            : [],
          criadoEm: new Date().toISOString(),
          atualizadoEm: new Date().toISOString(),
        };
        return {
          row,
          record: { ...record, alertas: [], status: 'OK' as const },
          score: 100,
          blocking: false,
        };
      }),
    [aiRows, documentFile, documentHash],
  );

  const saveAiRows = () => {
    setAiError('');
    const selected = aiEvaluated.filter((item) => item.row.selected);
    if (!selected.length) {
      setAiError('Selecione ao menos uma linha.');
      return;
    }
    onImportAbastecimentos(selected.map((item) => item.record));
    setAiRows([]);
    setDocumentAnalysis(null);
    setDocumentFile(null);
    setManualDocumentText('');
    if (documentUrl) URL.revokeObjectURL(documentUrl);
    setDocumentUrl('');
    setView('registros');
  };

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    configureCorporateWorkbook(workbook, 'Controle de Combustível');
    const sheet = workbook.addWorksheet('ABASTECIMENTOS');
    const headers = [
      'Data',
      'Competência',
      'Hora',
      'Prefixo',
      'Equipamento',
      'Empresa',
      'Combustível',
      'Litros',
      'Custo por Litro',
      'Custo Total',
      'Capacidade do Tanque',
      '% do Tanque',
      'Bomba Inicial',
      'Bomba Final',
      'Horímetro',
      'KM',
      'Comboio',
      'Responsável',
      'Origem',
      'Status',
      'Revisão',
      'Revisado por',
      'Documento',
      'Observação',
    ];
    sheet.addRow([]);
    sheet.addRow([]);
    sheet.addRow(headers);
    filteredRecords.forEach((record) => {
      const equipment = equipamentos.find((item) => item.id === record.equipamentoId);
      const company = empresas.find((item) => item.id === equipment?.empresaId);
      sheet.addRow([
        record.data,
        record.competencia || getFuelCompetence(record.data),
        record.hora,
        getFuelRecordPrefix(record, equipamentos),
        equipment?.nome || '',
        company?.nome || '',
        combustiveis.find((item) => item.id === record.tipoCombustivelId)?.nome || '',
        record.quantidadeLitros,
        record.custoLitro || 0,
        record.custoTotal || getFuelCostTotal(record.quantidadeLitros, record.custoLitro),
        record.capacidadeTanqueLitros || equipment?.capacidadeTanqueLitros || 0,
        record.percentualTanque || 0,
        record.bombaInicial,
        record.bombaFinal,
        record.horimetroInicial,
        record.kmInicial,
        comboios.find((item) => item.id === record.comboioId)?.nome || '',
        record.responsavel,
        record.origem || 'Manual',
        record.status || 'OK',
        record.revisaoStatus || 'Pendente',
        record.revisadoPor || '',
        record.documentoOrigemNome || '',
        record.observacao,
      ]);
    });
    styleCorporateWorksheet(sheet, {
      title: 'Controle de Combustível',
      headerRow: 3,
      lastColumn: headers.length,
      dataStartRow: 4,
      recordCount: filteredRecords.length,
      filters: [filterStart && `Início ${filterStart}`, filterEnd && `Fim ${filterEnd}`],
    });
    addCorporateSummarySheet(
      workbook,
      'Painel de Combustível',
      [
        ['Registros', filteredRecords.length],
        ['Litros', dashboard.totalLiters],
        ['Custo informado', dashboard.totalCost],
        ['Pendentes de conferência', dashboard.pendingReview],
        ['Frotas', dashboard.uniqueEquipment],
      ],
      [],
    );
    await downloadCorporateWorkbook(workbook, `combustivel_${today()}.xlsx`);
  };

  const navItems: Array<{ id: WorkspaceView; label: string; icon: React.ElementType }> = [
    { id: 'painel', label: 'Painel', icon: LayoutDashboard },
    { id: 'digitacao', label: 'Digitação rápida', icon: Keyboard },
    { id: 'registros', label: 'Registros', icon: ListChecks },
    { id: 'conferencia', label: `Conferência (${reviewQueue.length})`, icon: ClipboardCheck },
  ];

  const selectedAiEvaluation = aiEvaluated.find((item) => item.row.id === selectedAiRow);

  return (
    <div className="space-y-5 text-slate-100">
      <header className="flex flex-col gap-4 border-b border-slate-800 pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-emerald-400">
            <Fuel size={16} /> Controle inteligente
          </div>
          <h1 className="text-2xl font-bold text-white md:text-3xl">Combustível</h1>
          <p className="mt-1 text-sm text-slate-400">
            {abastecimentos.length.toLocaleString('pt-BR')} registro(s) | lançamento livre manual, planilha ou documento
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onOpenSpreadsheetImport}
            disabled={isParsingSpreadsheet}
            className="inline-flex h-10 items-center gap-2 border border-slate-700 bg-slate-900 px-3 text-sm font-semibold disabled:opacity-50"
          >
            <FileSpreadsheet size={17} /> {isParsingSpreadsheet ? 'Lendo...' : 'Importar Excel'}
          </button>
          {onOpenCadastros && (
            <button
              onClick={onOpenCadastros}
              className="inline-flex h-10 items-center gap-2 border border-slate-700 bg-slate-900 px-3 text-sm font-semibold"
            >
              <Database size={17} /> Cadastros
            </button>
          )}
          <button
            onClick={exportExcel}
            className="inline-flex h-10 items-center gap-2 border border-slate-700 bg-slate-900 px-3 text-sm font-semibold"
          >
            <Download size={17} /> Exportar Excel
          </button>
          <button
            onClick={onOpenLubrificacao}
            className="inline-flex h-10 items-center gap-2 border border-slate-700 bg-slate-900 px-3 text-sm font-semibold"
          >
            <Droplets size={17} /> Lubrificação
          </button>
          <button
            onClick={() => {
              resetQuickEntry();
              setView('digitacao');
            }}
            className="inline-flex h-10 items-center gap-2 bg-emerald-500 px-4 text-sm font-bold text-slate-950"
          >
            <Plus size={18} /> Lançar combustível
          </button>
        </div>
      </header>

      <section className={`flex flex-col gap-3 border p-4 md:flex-row md:items-center md:justify-between ${oneDriveFuelSyncStatus?.state === 'error' ? 'border-rose-500/30 bg-rose-500/10' : oneDriveFuelSyncStatus?.state === 'ready' ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-slate-800 bg-slate-950'}`}>
        <div className="flex items-start gap-3">
          <Cloud className={oneDriveFuelSyncStatus?.state === 'ready' ? 'text-emerald-300' : oneDriveFuelSyncStatus?.state === 'error' ? 'text-rose-300' : 'text-slate-500'} size={20} />
          <div>
            <h2 className="text-sm font-bold text-white">OneDrive automático • somente Agosto/2026 • a cada 10 minutos</h2>
            <p className="mt-1 text-xs text-slate-400">
              {oneDriveFuelSyncStatus?.state === 'ready'
                ? `${oneDriveFuelSyncStatus.fileName || 'Planilha localizada'} • ${oneDriveFuelSyncStatus.rowCount || 0} linha(s) • ${oneDriveFuelSyncStatus.warningCount || 0} para conferir`
                : oneDriveFuelSyncStatus?.message || 'Aguardando a primeira leitura do computador sincronizador.'}
            </p>
          </div>
        </div>
        <span className="text-xs font-mono text-slate-400">
          {oneDriveFuelSyncStatus?.syncedAt
            ? `Última leitura: ${new Date(oneDriveFuelSyncStatus.syncedAt).toLocaleString('pt-BR')}`
            : 'Ainda não sincronizado'}
        </span>
      </section>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-800 pb-px">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold ${view === item.id ? 'border-emerald-400 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
            >
              <Icon size={17} />
              {item.label}
            </button>
          );
        })}
      </div>

      {view !== 'digitacao' && (
        <section className="grid gap-3 border-b border-slate-800 pb-5 md:grid-cols-2 xl:grid-cols-[1.5fr_repeat(5,1fr)_auto]">
          <label className="relative">
            <span className="sr-only">Buscar</span>
            <Search className="absolute left-3 top-3 text-slate-500" size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Prefixo, responsável, documento..."
              className="h-11 w-full border border-slate-700 bg-slate-950 pl-10 pr-3 text-sm outline-none focus:border-emerald-500"
            />
          </label>
          <label className="relative">
            <span className="sr-only">Data inicial</span>
            <CalendarDays className="absolute left-3 top-3 text-slate-500" size={17} />
            <input
              type="date"
              value={filterStart}
              onChange={(event) => setFilterStart(event.target.value)}
              className="h-11 w-full border border-slate-700 bg-slate-950 pl-10 pr-2 text-sm outline-none focus:border-emerald-500"
            />
          </label>
          <label className="relative">
            <span className="sr-only">Data final</span>
            <CalendarDays className="absolute left-3 top-3 text-slate-500" size={17} />
            <input
              type="date"
              value={filterEnd}
              onChange={(event) => setFilterEnd(event.target.value)}
              className="h-11 w-full border border-slate-700 bg-slate-950 pl-10 pr-2 text-sm outline-none focus:border-emerald-500"
            />
          </label>
          <label className="relative">
            <span className="sr-only">Frota</span>
            <select
              value={filterEquipment}
              onChange={(event) => setFilterEquipment(event.target.value)}
              className="h-11 w-full appearance-none border border-slate-700 bg-slate-950 px-3 pr-8 text-sm outline-none focus:border-emerald-500"
            >
              <option value="">Toda a frota</option>
              {sortedEquipment.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.prefixo}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-3 text-slate-500" size={17} />
          </label>
          <label className="relative">
            <span className="sr-only">Status</span>
            <select
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value)}
              className="h-11 w-full appearance-none border border-slate-700 bg-slate-950 px-3 pr-8 text-sm outline-none focus:border-emerald-500"
            >
              <option value="">Todos os status</option>
              {Object.keys(statusTone).map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-3 text-slate-500" size={17} />
          </label>
          <label className="relative">
            <span className="sr-only">Origem</span>
            <select
              value={filterSource}
              onChange={(event) => setFilterSource(event.target.value)}
              className="h-11 w-full appearance-none border border-slate-700 bg-slate-950 px-3 pr-8 text-sm outline-none focus:border-emerald-500"
            >
              <option value="">Todas as origens</option>
              {Object.keys(sourceTone).map((source) => (
                <option key={source}>{source}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-3 text-slate-500" size={17} />
          </label>
          <button
            onClick={clearFilters}
            title="Limpar filtros"
            className="grid h-11 w-11 place-items-center border border-slate-700 bg-slate-900 text-slate-300 hover:text-white"
          >
            <RotateCcw size={18} />
          </button>
        </section>
      )}

      {globalError && (
        <div className="flex items-start gap-3 border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          <AlertTriangle className="mt-0.5 shrink-0" size={18} />
          {globalError}
        </div>
      )}

      {pendingCadastroPrefixes.length > 0 && (
        <section className="flex flex-col gap-3 border border-amber-500/30 bg-amber-500/10 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-bold text-amber-100">Prefixos aguardando cadastro auxiliar</h2>
            <p className="mt-1 text-xs text-amber-200/80">
              {pendingCadastroPrefixes.slice(0, 8).join(', ')}
              {pendingCadastroPrefixes.length > 8 ? ` +${pendingCadastroPrefixes.length - 8}` : ''}
            </p>
          </div>
          {onOpenCadastros && (
            <button
              onClick={onOpenCadastros}
              className="inline-flex h-10 shrink-0 items-center gap-2 border border-amber-400/40 bg-slate-950 px-4 text-sm font-bold text-amber-100"
            >
              <Database size={17} /> Completar cadastros
            </button>
          )}
        </section>
      )}

      {view === 'painel' && (
        <div className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {[
              {
                label: 'Volume',
                value: `${formatNumber(dashboard.totalLiters, 0)} L`,
                detail: `${filteredRecords.length} abastecimento(s)`,
                icon: Fuel,
                tone: 'text-emerald-300',
              },
              {
                label: 'Frota atendida',
                value: dashboard.uniqueEquipment,
                detail: 'Equipamentos distintos',
                icon: Truck,
                tone: 'text-sky-300',
              },
              {
                label: 'Média por registro',
                value: filteredRecords.length ? formatNumber(dashboard.totalLiters / filteredRecords.length, 1) : '0',
                detail: 'Litros por lançamento',
                icon: Gauge,
                tone: 'text-cyan-300',
              },
              {
                label: 'Importados',
                value: filteredRecords.filter(item => (item.origem || 'Manual') !== 'Manual').length,
                detail: 'Planilha, PDF ou foto',
                icon: FileSpreadsheet,
                tone: 'text-amber-300',
              },
              {
                label: 'Custo informado',
                value: dashboard.totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                detail: 'Somente registros com R$/L',
                icon: CircleDollarSign,
                tone: 'text-lime-300',
              },
              {
                label: 'Conferência',
                value: dashboard.pendingReview,
                detail: `${dashboard.alerts} alerta(s), ${dashboard.critical} crítico(s)`,
                icon: ClipboardCheck,
                tone: dashboard.pendingReview ? 'text-amber-300' : 'text-emerald-300',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className="border border-slate-800 bg-slate-950 p-4">
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-bold uppercase text-slate-500">{item.label}</span>
                    <Icon className={item.tone} size={19} />
                  </div>
                  <strong className="mt-3 block text-2xl text-white">{item.value}</strong>
                  <span className="mt-1 block text-xs text-slate-500">{item.detail}</span>
                </article>
              );
            })}
          </section>
          <section className="grid gap-5 xl:grid-cols-[1.35fr_.85fr]">
            <div className="border border-slate-800 bg-slate-950">
              <div className="flex items-center justify-between border-b border-slate-800 p-4">
                <div>
                  <h2 className="font-bold text-white">Volume diário</h2>
                  <span className="text-xs text-slate-500">Últimos {dailyTrend.length} dias com movimento</span>
                </div>
                <Activity className="text-emerald-300" size={20} />
              </div>
              <div className="flex h-64 items-end gap-2 overflow-x-auto p-5">
                {dailyTrend.map((item) => (
                  <div key={item.date} className="flex h-full min-w-10 flex-1 flex-col justify-end">
                    <span className="mb-2 text-center text-[10px] font-bold text-slate-400">
                      {formatNumber(item.liters, 0)}
                    </span>
                    <div
                      className="mx-auto w-full max-w-12 bg-emerald-500 transition-all"
                      style={{ height: `${Math.max(4, (item.liters / maxDaily) * 100)}%` }}
                    />
                    <span className="mt-2 text-center text-[9px] text-slate-600">
                      {item.date.slice(5).split('-').reverse().join('/')}
                    </span>
                  </div>
                ))}
                {!dailyTrend.length && (
                  <div className="grid h-full w-full place-items-center text-sm text-slate-500">
                    Sem movimento no período.
                  </div>
                )}
              </div>
            </div>
            <div className="border border-slate-800 bg-slate-950">
              <div className="flex items-center justify-between border-b border-slate-800 p-4">
                <div>
                  <h2 className="font-bold text-white">Origem dos dados</h2>
                  <span className="text-xs text-slate-500">Rastreabilidade dos lançamentos</span>
                </div>
                <Database className="text-violet-300" size={20} />
              </div>
              <div className="space-y-4 p-5">
                {sourceDistribution.map(([source, count]) => (
                  <div key={source}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className={`px-2 py-1 text-xs font-bold ${sourceTone[source] || sourceTone.Manual}`}>
                        {source}
                      </span>
                      <strong>{count}</strong>
                    </div>
                    <div className="h-1.5 bg-slate-800">
                      <div
                        className="h-full bg-violet-500"
                        style={{ width: `${(count / Math.max(1, filteredRecords.length)) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                {!sourceDistribution.length && (
                  <div className="py-16 text-center text-sm text-slate-500">Sem registros.</div>
                )}
              </div>
            </div>
          </section>
          <section className="grid gap-5 xl:grid-cols-2">
            <div className="overflow-hidden border border-slate-800 bg-slate-950">
              <div className="border-b border-slate-800 p-4">
                <h2 className="font-bold text-white">Consumo por equipamento</h2>
                <span className="text-xs text-slate-500">Volume, média e último lançamento</span>
              </div>
              <div className="max-h-96 overflow-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="sticky top-0 bg-slate-900 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Frota</th>
                      <th className="px-4 py-3">Litros</th>
                      <th className="px-4 py-3">L/h</th>
                      <th className="px-4 py-3">Registros</th>
                      <th className="px-4 py-3">Último</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {equipmentRanking.slice(0, 15).map((item) => {
                      const equipment = equipamentos.find((eq) => eq.id === item.equipmentId);
                      return (
                        <tr key={item.equipmentId}>
                          <td className="px-4 py-3">
                            <strong className="text-white">{equipment?.prefixo || item.equipmentId || 'Frota'}</strong>
                            <span className="block max-w-48 truncate text-xs text-slate-500">
                              {equipment?.tipo || equipment?.nome || 'Pendente de cadastro'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-emerald-300">{formatNumber(item.liters, 0)} L</td>
                          <td className="px-4 py-3">{item.averageRate ? formatNumber(item.averageRate) : '-'}</td>
                          <td className="px-4 py-3 text-slate-300">
                            {item.records}
                          </td>
                          <td className="px-4 py-3 text-slate-400">{formatDate(item.lastDate)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="border border-slate-800 bg-slate-950">
              <div className="border-b border-slate-800 p-4">
                <h2 className="font-bold text-white">Resumo operacional</h2>
                <span className="text-xs text-slate-500">Base ativa no filtro atual</span>
              </div>
              <div className="grid gap-3 p-5 sm:grid-cols-2">
                {[
                  ['Manual', filteredRecords.filter(item => (item.origem || 'Manual') === 'Manual').length],
                  ['Importados', filteredRecords.filter(item => (item.origem || 'Manual') !== 'Manual').length],
                  ['Com documento', filteredRecords.filter(item => item.documentoOrigemNome).length],
                  ['Com observação', filteredRecords.filter(item => item.observacao).length],
                ].map(([label, value]) => (
                  <div key={label} className="border border-slate-800 bg-slate-900 p-3">
                    <span className="text-[10px] font-bold uppercase text-slate-500">{label}</span>
                    <strong className="mt-1 block text-lg text-white">{value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {view === 'digitacao' && (
        <div className="space-y-5">
          <section className="grid gap-4 border border-slate-800 bg-slate-950 p-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="text-xs font-bold uppercase text-slate-400">
              Data
              <input
                type="date"
                value={entryDate}
                onChange={(event) => handleEntryDateChange(event.target.value)}
                className="mt-2 h-11 w-full border border-slate-700 bg-slate-900 px-3 text-base text-white outline-none focus:border-emerald-500"
              />
              <span className="mt-1 block text-[10px] normal-case text-slate-500">
                Competência: {getFuelCompetence(entryDate) || 'data inválida'}
              </span>
            </label>
            <label className="text-xs font-bold uppercase text-slate-400">
              Comboio / posto
              <select
                value={entryComboio}
                onChange={(event) => handleComboioEntryChange(event.target.value)}
                className="mt-2 h-11 w-full border border-slate-700 bg-slate-900 px-3 text-base text-white outline-none focus:border-emerald-500"
              >
                <option value="">Selecione</option>
                {comboios.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold uppercase text-slate-400">
              Combustível
              <select
                value={entryFuel}
                onChange={(event) => setEntryFuel(event.target.value)}
                className="mt-2 h-11 w-full border border-slate-700 bg-slate-900 px-3 text-base text-white outline-none focus:border-emerald-500"
              >
                <option value="">Selecione</option>
                {combustiveis.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold uppercase text-slate-400">
              Custo por litro
              <input
                type="number"
                min="0"
                step="0.0001"
                value={entryCostPerLiter || ''}
                onChange={(event) => setEntryCostPerLiter(Number(event.target.value))}
                placeholder="R$ 0,0000"
                className="mt-2 h-11 w-full border border-slate-700 bg-slate-900 px-3 text-base text-white outline-none focus:border-emerald-500"
              />
            </label>
            <label className="text-xs font-bold uppercase text-slate-400">
              Responsável
              <input
                value={entryResponsible}
                onChange={(event) => setEntryResponsible(event.target.value)}
                className="mt-2 h-11 w-full border border-slate-700 bg-slate-900 px-3 text-base text-white outline-none focus:border-emerald-500"
              />
            </label>
          </section>
          <section className="overflow-hidden border border-slate-800 bg-slate-950">
            <div className="flex flex-col gap-3 border-b border-slate-800 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-bold text-white">
                  {editingId ? 'Editar abastecimento' : 'Lançamento por prefixo'}
                </h2>
                <span className="text-xs text-slate-500">
                  {quickRows.length} linha(s) | {quickEvaluated.reduce((sum, item) => sum + item.alertCount, 0)} alerta(s)
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setQuickRows((rows) => [
                      ...rows,
                      createQuickRow(rows.at(-1)?.bombaFinal || getLastPump(entryComboio)),
                    ])
                  }
                  className="inline-flex h-9 items-center gap-2 border border-slate-700 bg-slate-900 px-3 text-xs font-bold"
                >
                  <Plus size={16} /> Linha
                </button>
                <button
                  onClick={resetQuickEntry}
                  title="Limpar lançamento"
                  className="grid h-9 w-9 place-items-center border border-slate-700 bg-slate-900"
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>
            <datalist id="fuel-prefixes">
              {sortedEquipment.map((item) => (
                <option key={item.id} value={item.prefixo}>
                  {item.nome}
                </option>
              ))}
            </datalist>
            <div className="overflow-x-auto">
              <div className="min-w-[1240px]">
                <div className="grid grid-cols-[52px_140px_110px_125px_125px_135px_135px_120px_1fr_90px_42px] gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2 text-[10px] font-bold uppercase text-slate-500">
                  <span>Nº</span>
                  <span>Prefixo</span>
                  <span>Hora</span>
                  <span>Horímetro</span>
                  <span>KM</span>
                  <span>Bomba inicial</span>
                  <span>Bomba final</span>
                  <span>Litros</span>
                  <span>Observação</span>
                  <span>Status</span>
                  <span />
                </div>
                {quickRows.map((row, index) => {
                  const evaluation = quickEvaluated[index];
                  const rowEquipment = equipamentos.find(item => item.id === row.equipamentoId);
                  const tankCapacity = getFuelTankCapacity(evaluation.record, rowEquipment);
                  return (
                    <div
                      key={row.id}
                        className="grid grid-cols-[52px_140px_110px_125px_125px_135px_135px_120px_1fr_90px_42px] gap-2 border-b border-slate-800 px-3 py-2"
                    >
                      <span className="grid place-items-center text-sm text-slate-500">{index + 1}</span>
                      <div>
                        <input
                          autoFocus={index === 0 && !editingId}
                          list="fuel-prefixes"
                          value={row.prefixo}
                          onChange={(event) => updateQuickRow(row.id, 'prefixo', event.target.value)}
                          onBlur={(event) => updateQuickRow(row.id, 'prefixo', event.target.value)}
                          className={`h-10 w-full border bg-slate-900 px-2 font-mono text-sm font-bold outline-none ${row.equipamentoId ? 'border-emerald-500/40 text-emerald-300' : 'border-amber-500/40 text-amber-200'}`}
                        />
                        <span className="mt-1 block text-[9px] text-slate-500">
                          {tankCapacity > 0 ? `Tanque ${formatNumber(tankCapacity, 0)} L` : 'Tanque não cadastrado'}
                        </span>
                      </div>
                      <input
                        value={row.hora}
                        onChange={(event) => updateQuickRow(row.id, 'hora', event.target.value)}
                        onBlur={(event) => blurQuickTime(row.id, event.target.value)}
                        placeholder="400"
                        className="h-10 border border-slate-700 bg-slate-900 px-2 text-center font-mono text-sm outline-none focus:border-emerald-500"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={row.horimetroInicial || ''}
                        onChange={(event) => updateQuickRow(row.id, 'horimetroInicial', Number(event.target.value))}
                        className="h-10 border border-slate-700 bg-slate-900 px-2 text-sm outline-none focus:border-emerald-500"
                      />
                      <input
                        type="number"
                        step="1"
                        value={row.kmInicial || ''}
                        onChange={(event) => updateQuickRow(row.id, 'kmInicial', Number(event.target.value))}
                        className="h-10 border border-slate-700 bg-slate-900 px-2 text-sm outline-none focus:border-emerald-500"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={row.bombaInicial || ''}
                        onChange={(event) => updateQuickRow(row.id, 'bombaInicial', Number(event.target.value))}
                        className="h-10 border border-slate-700 bg-slate-900 px-2 text-sm outline-none focus:border-emerald-500"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={row.bombaFinal || ''}
                        onChange={(event) => updateQuickRow(row.id, 'bombaFinal', Number(event.target.value))}
                        className="h-10 border border-slate-700 bg-slate-900 px-2 text-sm outline-none focus:border-emerald-500"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={row.quantidadeLitros || ''}
                        onChange={(event) => updateQuickRow(row.id, 'quantidadeLitros', Number(event.target.value))}
                        className="h-10 border border-emerald-500/40 bg-slate-900 px-2 text-sm font-bold text-emerald-300 outline-none focus:border-emerald-400"
                      />
                      <input
                        value={row.observacao}
                        onChange={(event) => updateQuickRow(row.id, 'observacao', event.target.value)}
                        className="h-10 border border-slate-700 bg-slate-900 px-2 text-sm outline-none focus:border-emerald-500"
                      />
                      <button
                        onClick={() => setGlobalError(evaluation.alertCount ? `${evaluation.alertCount} alerta(s) irão para conferência, sem bloquear o lançamento.` : 'Registro pronto para lançamento.')}
                        className={`h-10 border text-xs font-bold ${evaluation.alertCount ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}
                      >
                        {evaluation.alertCount || 'OK'}
                      </button>
                      <button
                        title="Excluir linha"
                        onClick={() =>
                          setQuickRows((rows) => (rows.length > 1 ? rows.filter((item) => item.id !== row.id) : rows))
                        }
                        className="grid h-10 place-items-center text-slate-500 hover:text-rose-300"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-800 p-4 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-slate-400">
                Volume:{' '}
                <strong className="text-emerald-300">
                  {formatNumber(
                    quickRows.reduce((sum, row) => sum + row.quantidadeLitros, 0),
                    0,
                  )}{' '}
                  L
                </strong>
                {entryCostPerLiter > 0 && (
                  <span className="ml-3">
                    Custo: <strong className="text-lime-300">
                      {getFuelCostTotal(
                        quickRows.reduce((sum, row) => sum + row.quantidadeLitros, 0),
                        entryCostPerLiter,
                      ).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </strong>
                  </span>
                )}
              </div>
              <button
                onClick={openQuickReview}
                className="inline-flex h-11 items-center justify-center gap-2 bg-emerald-500 px-5 text-sm font-bold text-slate-950"
              >
                <ClipboardCheck size={18} /> Revisar e confirmar
              </button>
            </div>
          </section>
        </div>
      )}

      {view === 'documento' && (
        <div className="space-y-5">
          <datalist id="fuel-prefixes">
            {sortedEquipment.map((item) => (
              <option key={item.id} value={item.prefixo}>
                {item.nome}
              </option>
            ))}
          </datalist>
          <input
            ref={documentInputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(event) => selectDocument(event.target.files?.[0])}
            className="hidden"
          />
          {!documentFile && (
            <button
              onClick={() => documentInputRef.current?.click()}
              className="grid min-h-80 w-full place-items-center border border-dashed border-slate-600 bg-slate-950 text-center hover:border-emerald-500"
            >
              <div>
                <ScanLine className="mx-auto mb-4 text-emerald-300" size={44} />
                <strong className="block text-lg text-white">Selecionar PDF ou foto</strong>
                <span className="mt-2 block text-sm text-slate-500">PDF, JPG, PNG ou WEBP</span>
              </div>
            </button>
          )}
          {documentFile && (
            <>
              <section className="flex flex-col gap-3 border border-slate-800 bg-slate-950 p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <FileSearch className="text-cyan-300" size={24} />
                  <div>
                    <strong className="block text-white">{documentFile.name}</strong>
                    <span className="text-xs text-slate-500">
                      {(documentFile.size / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} MB
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => documentInputRef.current?.click()}
                    className="h-10 border border-slate-700 bg-slate-900 px-3 text-sm font-bold"
                  >
                    Trocar arquivo
                  </button>
                  <button
                    onClick={runDocumentAnalysis}
                    disabled={analyzing}
                    className="inline-flex h-10 items-center gap-2 bg-cyan-500 px-4 text-sm font-bold text-slate-950 disabled:opacity-60"
                  >
                    {analyzing ? <LoaderCircle className="animate-spin" size={18} /> : <ScanLine size={18} />}
                    {analyzing ? 'Analisando...' : 'Analisar documento'}
                  </button>
                </div>
              </section>
              {aiError && (
                <div className="flex items-start gap-3 border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
                  <AlertTriangle className="mt-0.5 shrink-0" size={18} />
                  {aiError}
                </div>
              )}
              <section className="border border-slate-800 bg-slate-950 p-4">
                <label className="text-xs font-bold uppercase text-slate-400">
                  Texto extraído / OCR
                  <textarea
                    value={manualDocumentText}
                    onChange={(event) => setManualDocumentText(event.target.value)}
                    placeholder="Cole aqui o texto do PDF ou da foto quando o documento for escaneado."
                    className="mt-2 min-h-28 w-full resize-y border border-slate-700 bg-slate-900 p-3 text-sm normal-case text-slate-200 outline-none focus:border-cyan-500"
                  />
                </label>
              </section>
              {documentAnalysis?.avisosDocumento?.length ? (
                <div className="border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                  {documentAnalysis.avisosDocumento.map((warning) => (
                    <div key={warning}>{warning}</div>
                  ))}
                </div>
              ) : null}
              <OperationalAnalysisPanel analysis={documentAnalysis?.analiseOperacional} />
              <section className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
                <div className="min-h-[620px] overflow-hidden border border-slate-800 bg-slate-950">
                  <div className="border-b border-slate-800 p-3 text-xs font-bold uppercase text-slate-500">
                    Documento original
                  </div>
                  {documentFile.type === 'application/pdf' ? (
                    <iframe
                      title="Documento de origem"
                      src={documentUrl}
                      className="h-[720px] w-full bg-white"
                    />
                  ) : (
                    <div className="grid min-h-[620px] place-items-center overflow-auto p-3">
                      <img
                        src={documentUrl}
                        alt="Documento de origem"
                        className="max-h-[900px] max-w-full object-contain"
                      />
                    </div>
                  )}
                </div>
                <div className="border border-slate-800 bg-slate-950">
                  <div className="flex items-center justify-between border-b border-slate-800 p-4">
                    <div>
                      <h2 className="font-bold text-white">Prévia da extração</h2>
                      <span className="text-xs text-slate-500">{aiRows.length} linha(s) encontrada(s)</span>
                    </div>
                    {documentAnalysis && (
                      <span className="text-xs text-slate-500">{documentAnalysis.tipoDocumento}</span>
                    )}
                  </div>
                  {selectedAiEvaluation ? (
                    <div className="space-y-4 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">
                          Página {selectedAiEvaluation.row.pagina} | Linha {selectedAiEvaluation.row.linha}
                        </span>
                        <span
                          className={`border px-2 py-1 text-xs font-bold ${selectedAiEvaluation.row.confiancaGeral >= 0.8 ? 'border-emerald-500/30 text-emerald-300' : selectedAiEvaluation.row.confiancaGeral >= 0.6 ? 'border-amber-500/30 text-amber-300' : 'border-rose-500/30 text-rose-300'}`}
                        >
                          {Math.round(selectedAiEvaluation.row.confiancaGeral * 100)}% confiança
                        </span>
                      </div>
                      <label
                        className={`flex cursor-pointer items-start gap-3 border p-3 ${selectedAiEvaluation.row.revisado ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-amber-500/40 bg-amber-500/10'}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedAiEvaluation.row.revisado}
                          onChange={(event) =>
                            updateAiRow(selectedAiEvaluation.row.id, 'revisado', event.target.checked)
                          }
                          className="mt-0.5 h-4 w-4 accent-emerald-500"
                        />
                        <span>
                          <strong className="block text-sm text-white">Conferi com o documento original</strong>
                          <span className="mt-1 block text-xs text-slate-400">
                            A linha só será liberada depois desta confirmação.
                          </span>
                        </span>
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-bold uppercase text-slate-400">
                          Prefixo
                          <input
                            list="fuel-prefixes"
                            value={selectedAiEvaluation.row.prefixo}
                            onChange={(event) =>
                              updateAiRow(selectedAiEvaluation.row.id, 'prefixo', event.target.value)
                            }
                            className="mt-1 h-10 w-full border border-slate-700 bg-slate-900 px-2 text-sm outline-none focus:border-cyan-500"
                          />
                        </label>
                        <label className="text-xs font-bold uppercase text-slate-400">
                          Data
                          <input
                            type="date"
                            value={selectedAiEvaluation.row.data}
                            onChange={(event) => updateAiRow(selectedAiEvaluation.row.id, 'data', event.target.value)}
                            className="mt-1 h-10 w-full border border-slate-700 bg-slate-900 px-2 text-sm outline-none focus:border-cyan-500"
                          />
                        </label>
                        <label className="text-xs font-bold uppercase text-slate-400">
                          Hora
                          <input
                            value={selectedAiEvaluation.row.hora}
                            onChange={(event) => updateAiRow(selectedAiEvaluation.row.id, 'hora', event.target.value)}
                            onBlur={(event) =>
                              updateAiRow(
                                selectedAiEvaluation.row.id,
                                'hora',
                                normalizeQuickTime(event.target.value).value || event.target.value,
                              )
                            }
                            className="mt-1 h-10 w-full border border-slate-700 bg-slate-900 px-2 text-sm outline-none focus:border-cyan-500"
                          />
                        </label>
                        <label className="text-xs font-bold uppercase text-slate-400">
                          Litros
                          <input
                            type="number"
                            value={selectedAiEvaluation.row.quantidadeLitros || ''}
                            onChange={(event) =>
                              updateAiRow(selectedAiEvaluation.row.id, 'quantidadeLitros', Number(event.target.value))
                            }
                            className="mt-1 h-10 w-full border border-cyan-500/40 bg-slate-900 px-2 text-sm font-bold text-cyan-300 outline-none"
                          />
                        </label>
                        <label className="text-xs font-bold uppercase text-slate-400">
                          Horímetro
                          <input
                            type="number"
                            value={selectedAiEvaluation.row.horimetroInicial || ''}
                            onChange={(event) =>
                              updateAiRow(selectedAiEvaluation.row.id, 'horimetroInicial', Number(event.target.value))
                            }
                            className="mt-1 h-10 w-full border border-slate-700 bg-slate-900 px-2 text-sm outline-none"
                          />
                        </label>
                        <label className="text-xs font-bold uppercase text-slate-400">
                          KM
                          <input
                            type="number"
                            value={selectedAiEvaluation.row.kmInicial || ''}
                            onChange={(event) =>
                              updateAiRow(selectedAiEvaluation.row.id, 'kmInicial', Number(event.target.value))
                            }
                            className="mt-1 h-10 w-full border border-slate-700 bg-slate-900 px-2 text-sm outline-none"
                          />
                        </label>
                        <label className="text-xs font-bold uppercase text-slate-400">
                          Bomba inicial
                          <input
                            type="number"
                            value={selectedAiEvaluation.row.bombaInicial || ''}
                            onChange={(event) =>
                              updateAiRow(selectedAiEvaluation.row.id, 'bombaInicial', Number(event.target.value))
                            }
                            className="mt-1 h-10 w-full border border-slate-700 bg-slate-900 px-2 text-sm outline-none"
                          />
                        </label>
                        <label className="text-xs font-bold uppercase text-slate-400">
                          Bomba final
                          <input
                            type="number"
                            value={selectedAiEvaluation.row.bombaFinal || ''}
                            onChange={(event) =>
                              updateAiRow(selectedAiEvaluation.row.id, 'bombaFinal', Number(event.target.value))
                            }
                            className="mt-1 h-10 w-full border border-slate-700 bg-slate-900 px-2 text-sm outline-none"
                          />
                        </label>
                        <label className="text-xs font-bold uppercase text-slate-400">
                          Combustível
                          <select
                            value={selectedAiEvaluation.row.tipoCombustivelId}
                            onChange={(event) =>
                              updateAiRow(selectedAiEvaluation.row.id, 'tipoCombustivelId', event.target.value)
                            }
                            className="mt-1 h-10 w-full border border-slate-700 bg-slate-900 px-2 text-sm outline-none"
                          >
                            <option value="">Selecione após conferir</option>
                            {combustiveis.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.nome}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs font-bold uppercase text-slate-400">
                          Comboio
                          <select
                            value={selectedAiEvaluation.row.comboioId}
                            onChange={(event) =>
                              updateAiRow(selectedAiEvaluation.row.id, 'comboioId', event.target.value)
                            }
                            className="mt-1 h-10 w-full border border-slate-700 bg-slate-900 px-2 text-sm outline-none"
                          >
                            <option value="">Selecione após conferir</option>
                            {comboios.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.nome}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs font-bold uppercase text-slate-400 sm:col-span-2">
                          Responsável
                          <input
                            value={selectedAiEvaluation.row.responsavel}
                            onChange={(event) =>
                              updateAiRow(selectedAiEvaluation.row.id, 'responsavel', event.target.value)
                            }
                            className="mt-1 h-10 w-full border border-slate-700 bg-slate-900 px-2 text-sm outline-none"
                          />
                        </label>
                      </div>
                      <div
                        className="border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200"
                      >
                        <strong>Pronto para lançar</strong>
                      </div>
                      <div className="border border-slate-800 bg-slate-900 p-3">
                        <span className="text-[10px] font-bold uppercase text-slate-500">Transcrição original</span>
                        <p className="mt-2 text-xs leading-relaxed text-slate-300">
                          {selectedAiEvaluation.row.transcricaoOriginal || '-'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid min-h-[500px] place-items-center text-sm text-slate-500">
                      Selecione uma linha para revisar os campos extraídos.
                    </div>
                  )}
                </div>
              </section>
              {aiRows.length > 0 && (
                <section className="overflow-hidden border border-slate-800 bg-slate-950">
                  <div className="flex flex-col gap-3 border-b border-slate-800 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="font-bold text-white">Linhas extraídas</h2>
                      <span className="text-xs text-slate-500">
                        {aiRows.filter((item) => item.selected).length} selecionada(s)
                      </span>
                    </div>
                    <button
                      onClick={saveAiRows}
                      className="inline-flex h-10 items-center gap-2 bg-emerald-500 px-4 text-sm font-bold text-slate-950"
                    >
                      <Save size={17} /> Gravar linhas conferidas
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[950px] text-left text-sm">
                      <thead className="bg-slate-900 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-3">Usar</th>
                          <th className="px-3 py-3">Página / linha</th>
                          <th className="px-3 py-3">Prefixo</th>
                          <th className="px-3 py-3">Data / hora</th>
                          <th className="px-3 py-3">Litros</th>
                          <th className="px-3 py-3">Leitura</th>
                          <th className="px-3 py-3">Confiança</th>
                          <th className="px-3 py-3">Validação</th>
                          <th className="px-3 py-3">Abrir</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {aiEvaluated.map((item) => (
                          <tr key={item.row.id} className={selectedAiRow === item.row.id ? 'bg-cyan-500/5' : ''}>
                            <td className="px-3 py-3">
                              <input
                                type="checkbox"
                                checked={item.row.selected}
                                onChange={(event) => updateAiRow(item.row.id, 'selected', event.target.checked)}
                                className="h-4 w-4 accent-cyan-500"
                              />
                            </td>
                            <td className="px-3 py-3">
                              {item.row.pagina} / {item.row.linha}
                            </td>
                            <td className="px-3 py-3 font-mono font-bold text-cyan-300">{item.row.prefixo || '-'}</td>
                            <td className="px-3 py-3">
                              {formatDate(item.row.data)}
                              <span className="block text-xs text-slate-500">{item.row.hora || '-'}</span>
                            </td>
                            <td className="px-3 py-3 font-bold text-emerald-300">
                              {formatNumber(item.row.quantidadeLitros)} L
                            </td>
                            <td className="px-3 py-3">
                              {item.row.horimetroInicial
                                ? `H ${formatNumber(item.row.horimetroInicial)}`
                                : item.row.kmInicial
                                  ? `KM ${formatNumber(item.row.kmInicial, 0)}`
                                  : '-'}
                            </td>
                            <td className="px-3 py-3">{Math.round(item.row.confiancaGeral * 100)}%</td>
                            <td className="px-3 py-3">
                              <span
                                className="border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-300"
                              >
                                Livre
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <button
                                title="Conferir linha"
                                onClick={() => setSelectedAiRow(item.row.id)}
                                className="grid h-9 w-9 place-items-center border border-slate-700 text-slate-400 hover:text-white"
                              >
                                <Eye size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {view === 'registros' && (
        <section className="overflow-hidden border border-slate-800 bg-slate-950">
          <div className="flex items-center justify-between border-b border-slate-800 p-4">
            <div>
              <h2 className="font-bold text-white">Abastecimentos</h2>
              <span className="text-xs text-slate-500">{filteredRecords.length} resultado(s)</span>
            </div>
            <Fuel className="text-emerald-300" size={20} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px] text-left text-sm">
              <thead className="bg-slate-900 text-xs uppercase text-slate-500">
                <tr>
                  {[
                    'Data / hora',
                    'Frota',
                    'Produto',
                    'Litros',
                    'Tanque',
                    'Bomba',
                    'Leitura',
                    'Origem',
                    'Status',
                    'Revisão',
                    'Ações',
                  ].map((label) => (
                    <th key={label} className="px-4 py-3">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredRecords.map((record) => {
                  const equipment = equipamentos.find((item) => item.id === record.equipamentoId);
                  return (
                    <tr key={record.id} className="hover:bg-slate-900/60">
                      <td className="px-4 py-3">
                        <strong className="text-white">{formatDate(record.data)}</strong>
                        <span className="block text-xs text-slate-500">{record.hora}</span>
                        <span className="block text-[10px] text-slate-600">{record.competencia || getFuelCompetence(record.data)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <strong className="font-mono text-emerald-300">{getFuelRecordPrefix(record, equipamentos)}</strong>
                        <span className="block max-w-48 truncate text-xs text-slate-500">{equipment?.nome || 'Pendente de cadastro'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {combustiveis.find((item) => item.id === record.tipoCombustivelId)?.nome || '-'}
                      </td>
                      <td className="px-4 py-3 font-bold text-emerald-300">
                        {formatNumber(record.quantidadeLitros)} L
                        {record.custoTotal ? (
                          <span className="block text-[10px] font-normal text-lime-300">
                            {record.custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        {record.capacidadeTanqueLitros
                          ? `${formatNumber(record.capacidadeTanqueLitros, 0)} L`
                          : '-'}
                        {record.percentualTanque ? (
                          <span className="block text-[10px] text-slate-500">{formatNumber(record.percentualTanque)}%</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-500">{formatNumber(record.bombaInicial)} →</span>
                        <strong className="ml-1">{formatNumber(record.bombaFinal)}</strong>
                      </td>
                      <td className="px-4 py-3">
                        {record.horimetroInicial
                          ? `H ${formatNumber(record.horimetroInicial)}`
                          : record.kmInicial
                            ? `KM ${formatNumber(record.kmInicial, 0)}`
                            : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 text-xs font-bold ${sourceTone[record.origem || 'Manual'] || sourceTone.Manual}`}
                        >
                          {record.origem || 'Manual'}
                        </span>
                        {record.documentoOrigemNome && (
                          <span className="mt-1 block max-w-40 truncate text-[10px] text-slate-600">
                            {record.documentoOrigemNome}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex border px-2 py-1 text-xs font-bold ${statusTone[record.status || 'OK'] || statusTone.Pendente}`}
                        >
                          {record.status || 'OK'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex border px-2 py-1 text-xs font-bold ${record.revisaoStatus === 'Aprovado' ? statusTone.OK : statusTone.Pendente}`}>
                          {record.revisaoStatus || 'Pendente'}
                        </span>
                        {record.revisadoPor && (
                          <span className="mt-1 block max-w-36 truncate text-[10px] text-slate-600">{record.revisadoPor}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            title="Editar"
                            onClick={() => editRecord(record)}
                            className="grid h-9 w-9 place-items-center text-slate-400 hover:bg-slate-800 hover:text-sky-300"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            title="Excluir"
                            onClick={() => {
                              if (
                                confirm(
                                  `Excluir o abastecimento de ${getFuelRecordPrefix(record, equipamentos)} em ${formatDate(record.data)}?`,
                                )
                              )
                                onDeleteAbastecimento(record.id);
                            }}
                            className="grid h-9 w-9 place-items-center text-slate-400 hover:bg-slate-800 hover:text-rose-300"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filteredRecords.length && (
                  <tr>
                    <td colSpan={11} className="px-4 py-14 text-center text-slate-500">
                      Nenhum abastecimento encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {view === 'conferencia' && (
        <div className="space-y-5">
          <section className="flex flex-col gap-4 border border-sky-500/30 bg-sky-500/10 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-bold text-white">Persistência gradual no Supabase</h2>
              <p className="mt-1 text-xs text-slate-300">
                Preserva todos os registros do filtro na fila PostgreSQL. Nenhuma linha é promovida automaticamente.
              </p>
              {supabaseMessage && <p className="mt-2 text-xs font-semibold text-sky-200">{supabaseMessage}</p>}
            </div>
            <button
              onClick={stageCurrentFuelDataset}
              disabled={supabaseSyncing || !filteredRecords.length}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 bg-sky-500 px-5 text-sm font-bold text-slate-950 disabled:opacity-50"
            >
              {supabaseSyncing ? <LoaderCircle className="animate-spin" size={18} /> : <CloudUpload size={18} />}
              {supabaseSyncing ? 'Preservando...' : `Preservar ${filteredRecords.length} registro(s)`}
            </button>
          </section>
          <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
          <section className="border border-slate-800 bg-slate-950">
            <div className="border-b border-slate-800 p-4">
              <h2 className="font-bold text-white">Mapa de validações</h2>
              <span className="text-xs text-slate-500">Deficiências agrupadas por regra</span>
            </div>
            <div className="divide-y divide-slate-800">
              {issueRanking.map((item) => (
                <div key={item.code} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <strong className={item.severity === 'critico' ? 'text-rose-300' : 'text-amber-300'}>
                        {item.code}
                      </strong>
                      <p className="mt-1 text-sm text-slate-300">{item.label}</p>
                    </div>
                    <span
                      className={`grid h-8 min-w-8 place-items-center px-2 text-sm font-bold ${item.severity === 'critico' ? 'bg-rose-500/15 text-rose-300' : 'bg-amber-500/15 text-amber-300'}`}
                    >
                      {item.count}
                    </span>
                  </div>
                </div>
              ))}
              {!issueRanking.length && (
                <div className="grid min-h-64 place-items-center text-center text-sm text-slate-500">
                  <div>
                    <CheckCircle2 className="mx-auto mb-2 text-emerald-400" size={32} />
                    Nenhuma deficiência no filtro atual.
                  </div>
                </div>
              )}
            </div>
          </section>
          <section className="border border-slate-800 bg-slate-950">
            <div className="border-b border-slate-800 p-4">
              <h2 className="font-bold text-white">Registros para conferência</h2>
              <span className="text-xs text-slate-500">Ordenados pela menor qualidade, sem bloquear o lançamento</span>
            </div>
            <div className="divide-y divide-slate-800">
              {reviewQueue
                .slice(0, 30)
                .map((record) => {
                  const alertCount = record.alertas?.filter((item) => item.severidade !== 'info').length || 0;
                  return (
                    <div
                      key={record.id}
                      className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <strong className="font-mono text-white">{getFuelRecordPrefix(record, equipamentos)}</strong>
                          <span
                            className={`border px-2 py-0.5 text-[11px] font-bold ${alertCount ? statusTone['Conferência necessária'] : statusTone.OK}`}
                          >
                            {alertCount} alerta(s)
                          </span>
                          <span className="text-xs text-slate-500">
                            {formatDate(record.data)} {record.hora}
                          </span>
                          <span className="text-xs font-bold text-sky-300">
                            Qualidade {getFuelQualityScore(record.alertas || [])}%
                          </span>
                        </div>
                        <div className="mt-2 space-y-1">
                          {record.alertas?.map((alert) => (
                            <p
                              key={alert.codigo}
                              className={`text-xs ${alert.severidade === 'critico' ? 'text-rose-300' : 'text-amber-300'}`}
                            >
                              {alert.mensagem}
                            </p>
                          ))}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => approveReview(record)}
                          className="inline-flex h-9 items-center gap-2 border border-emerald-500/40 bg-emerald-500/10 px-3 text-xs font-bold text-emerald-200"
                        >
                          <CheckCircle2 size={15} /> Conferido
                        </button>
                        <button
                          title="Editar registro"
                          onClick={() => editRecord(record)}
                          className="grid h-9 w-9 place-items-center border border-slate-700 text-slate-400 hover:text-sky-300"
                        >
                          <Pencil size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              {!reviewQueue.length && (
                <div className="grid min-h-64 place-items-center text-sm text-slate-500">
                  Nenhum registro exige conferência.
                </div>
              )}
            </div>
          </section>
          </div>
        </div>
      )}

      {reviewOpen && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/90 p-4">
          <div className="w-full max-w-4xl border border-slate-700 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 p-4">
              <div>
                <h2 className="font-bold text-white">Confirmar abastecimentos</h2>
                <span className="text-xs text-slate-500">
                  {quickReady.length} linha(s) |{' '}
                  {formatNumber(
                    quickReady.reduce((sum, item) => sum + item.record.quantidadeLitros, 0),
                    0,
                  )}{' '}
                  L
                </span>
              </div>
              <button
                title="Fechar"
                onClick={() => setReviewOpen(false)}
                className="grid h-9 w-9 place-items-center border border-slate-700"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full min-w-[940px] text-left text-sm">
                <thead className="sticky top-0 bg-slate-900 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Frota</th>
                    <th className="px-4 py-3">Data / hora</th>
                    <th className="px-4 py-3">Leitura</th>
                    <th className="px-4 py-3">Bomba</th>
                    <th className="px-4 py-3">Litros</th>
                    <th className="px-4 py-3">Custo</th>
                    <th className="px-4 py-3">Tanque</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {quickReady.map((item) => (
                    <tr key={item.row.id}>
                      <td className="px-4 py-3 font-mono font-bold text-emerald-300">{item.row.prefixo}</td>
                      <td className="px-4 py-3">
                        {formatDate(entryDate)} {item.record.hora}
                      </td>
                      <td className="px-4 py-3">
                        {item.record.horimetroInicial
                          ? `H ${formatNumber(item.record.horimetroInicial)}`
                          : item.record.kmInicial
                            ? `KM ${formatNumber(item.record.kmInicial, 0)}`
                            : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {formatNumber(item.record.bombaInicial)} → {formatNumber(item.record.bombaFinal)}
                      </td>
                      <td className="px-4 py-3 font-bold text-emerald-300">
                        {formatNumber(item.record.quantidadeLitros)} L
                      </td>
                      <td className="px-4 py-3 text-lime-300">
                        {item.record.custoTotal
                          ? item.record.custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {item.record.capacidadeTanqueLitros
                          ? `${formatNumber(item.record.capacidadeTanqueLitros, 0)} L`
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`border px-2 py-1 text-xs font-bold ${item.alertCount ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>
                          {item.alertCount ? `${item.alertCount} para conferir` : 'Pronto'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-800 p-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-slate-400">
                Os dados serão gravados no banco e passarão a alimentar o painel e os relatórios.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setReviewOpen(false)}
                  className="h-11 border border-slate-700 bg-slate-900 px-4 text-sm font-bold"
                >
                  Alterar
                </button>
                <button
                  onClick={confirmQuickEntry}
                  className="inline-flex h-11 items-center gap-2 bg-emerald-500 px-5 text-sm font-bold text-slate-950"
                >
                  <Save size={18} /> Confirmar envio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CombustivelInteligenteTab;
