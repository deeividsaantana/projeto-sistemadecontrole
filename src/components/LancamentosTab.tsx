/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import { 
  Empresa, 
  Equipamento, 
  Comboio, 
  TipoCombustivel, 
  ProdutoLubrificacao, 
  Abastecimento, 
  Lubrificacao
} from '../types';

import { 
  Fuel, 
  Droplets, 
  ClipboardList, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  X, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  MapPin, 
  CheckCircle, 
  Truck, 
  Users,
  FileSpreadsheet,
  FilterX,
  Upload,
  Download
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { addCorporateSummarySheet, configureCorporateWorkbook, downloadCorporateWorkbook, loadValidatedWorkbook, styleCorporateWorksheet } from '../utils/excelCorporate';
import SpreadsheetImportReview from './SpreadsheetImportReview';
import CombustivelInteligenteTab from './CombustivelInteligenteTab';
import { findEquipmentByPrefix, isValidFuelDate, normalizeQuickTime } from '../utils/combustivelValidation';
import { findPreviousPumpForConvoy } from '../utils/fuelPumpSequence';
import { buildFuelImportKey, isPublishableFuelImport } from '../utils/fuelImportIdentity';

interface LancamentosTabProps {
  empresas: Empresa[];
  equipamentos: Equipamento[];
  comboios: Comboio[];
  combustiveis: TipoCombustivel[];
  lubrificantes: ProdutoLubrificacao[];

  abastecimentos: Abastecimento[];
  lubrificacoes: Lubrificacao[];

  onSaveAbastecimento: (item: Abastecimento, isNew: boolean) => void;
  onDeleteAbastecimento: (id: string) => void;
  onImportAbastecimentos: (items: Abastecimento[], combustiveisImportados?: TipoCombustivel[]) => void;
  onSaveLubrificacao: (item: Lubrificacao, isNew: boolean) => void;
  onDeleteLubrificacao: (id: string) => void;
  onOpenCadastros?: () => void;
}

type Mode = 'abastecimentos' | 'lubrificacoes';

export default function LancamentosTab({
  empresas,
  equipamentos,
  comboios,
  combustiveis,
  lubrificantes,
  abastecimentos,
  lubrificacoes,
  onSaveAbastecimento,
  onDeleteAbastecimento,
  onImportAbastecimentos,
  onSaveLubrificacao,
  onDeleteLubrificacao,
  onOpenCadastros,
}: LancamentosTabProps) {

  const [mode, setMode] = useState<Mode>('abastecimentos');
  const [searchQuery, setSearchQuery] = useState('');
  const [abastecimentoSort, setAbastecimentoSort] = useState<'data_desc' | 'litros_desc' | 'litros_asc'>('data_desc');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState('');

  // --- Filtros avançados do módulo de Combustível/Lubrificação (Prioridade 1) ---
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [fDataInicial, setFDataInicial] = useState('');
  const [fDataFinal, setFDataFinal] = useState('');
  const [fFrotaId, setFFrotaId] = useState('');
  const [fTipoCombustivelId, setFTipoCombustivelId] = useState('');
  const [fComboioId, setFComboioId] = useState('');
  const [fEmpresaId, setFEmpresaId] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fResponsavel, setFResponsavel] = useState('');
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const limparFiltros = () => {
    setFDataInicial(''); setFDataFinal(''); setFFrotaId(''); setFTipoCombustivelId('');
    setFComboioId(''); setFEmpresaId(''); setFStatus(''); setFResponsavel(''); setSearchQuery('');
  };

  const hasFiltrosAtivos = !!(fDataInicial || fDataFinal || fFrotaId || fTipoCombustivelId || fComboioId || fEmpresaId || fStatus || fResponsavel || searchQuery);

  // --- Importação de Planilhas — Prioridade 3 ---
  interface ImportRow {
    aba: string;
    linha: number;
    valido: boolean;
    duplicado: boolean;
    status: 'valido' | 'duplicado' | 'ignorado' | 'erro';
    motivo: string;
    item?: Abastecimento;
    preview: Record<string, string>;
  }

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isParsingImport, setIsParsingImport] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [isConfirmingImport, setIsConfirmingImport] = useState(false);
  const [importedFuelTypes, setImportedFuelTypes] = useState<TipoCombustivel[]>([]);
  const [importReport, setImportReport] = useState('');

  const normalizeHeader = (s: string) =>
    (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  const COLUMN_SYNONYMS: Record<string, string[]> = {
    data: ['data', 'data abastecimento', 'data do abastecimento', 'dt', 'dia'],
    frota: ['frota', 'prefixo', 'equipamento', 'frota prefixo', 'equipamento frota', 'cb', 'codigo equipamento', 'código equipamento', 'cod equipamento', 'n frota', 'numero frota', 'número frota', 'prefixo placa', 'placa', 'veiculo', 'veículo', 'maquina', 'máquina'],
    kmInicial: ['km inicial', 'kminicial', 'km', 'hodometro', 'odometro'],
    horimetroInicial: ['horimetro inicial', 'horimetro', 'hm inicial', 'hm'],
    bombaInicial: ['bomba inicial', 'inicio bomba', 'inicial bomba', 'bico inicial', 'marcador inicial', 'encerrante inicial', 'enc inicial'],
    quantidadeLitros: ['qtde de litros', 'quantidade de litros', 'quantidade', 'litros', 'qtd litros', 'qtde litros', 'qtd', 'qtde', 'litragem', 'litros abastecidos', 'volume', 'abastecido', 'qtd l', 'qtde l', 'volume abastecido', 'diesel', 'oleo diesel', 'óleo diesel'],
    bombaFinal: ['bomba final', 'fim bomba', 'final bomba', 'bico final', 'marcador final', 'encerrante final', 'enc final'],
    hora: ['hora', 'hora abastecimento', 'hora do abastecimento', 'horario', 'horário'],
    comboio: ['comboio', 'tanque', 'comboio tanque', 'bomba', 'caminhao comboio', 'caminhao tanque'],
    tipoCombustivel: ['tipo do combustivel', 'tipo combustivel', 'tipo de combustivel', 'combustivel', 'combustível', 'produto', 'diesel'],
    empresa: ['empresa'],
    observacao: ['observacao', 'observação', 'obs', 'observacoes', 'observações'],
    responsavel: ['responsavel', 'responsável', 'operador', 'frentista', 'apontador'],
    custoLitro: ['custo litro', 'custo por litro', 'valor unitario', 'valor unitário', 'valor litro', 'preco litro', 'preço litro'],
  };

  const FALLBACK_COLUMN_MAP: Record<string, number> = {
    data: 1,
    frota: 2,
    hora: 3,
    tipoCombustivel: 4,
    quantidadeLitros: 5,
    bombaInicial: 6,
    bombaFinal: 7,
    comboio: 8,
    responsavel: 9,
    kmInicial: 10,
    horimetroInicial: 11,
    empresa: 12,
    observacao: 13,
    custoLitro: 14,
  };

  const normalizeCompact = (value: string) => normalizeHeader(value).replace(/\s+/g, '');

  const unwrapCellValue = (value: any): any => {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value;
    if (typeof value === 'object') {
      if (value.result !== undefined) return unwrapCellValue(value.result);
      if (value.text !== undefined) return unwrapCellValue(value.text);
      if (Array.isArray(value.richText)) return value.richText.map((part: any) => part.text || '').join('');
      if (value.hyperlink && value.text) return unwrapCellValue(value.text);
    }
    return value;
  };

  const cellToText = (value: any) => {
    const raw = unwrapCellValue(value);
    if (raw === null || raw === undefined) return '';
    if (raw instanceof Date) {
      const y = raw.getUTCFullYear();
      const m = String(raw.getUTCMonth() + 1).padStart(2, '0');
      const d = String(raw.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return String(raw).trim().replace(/\s+/g, ' ');
  };

  const rowToRawText = (row: ExcelJS.Row) => {
    const values: string[] = [];
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const text = cellToText(cell.value);
      if (text) values.push(`${colNumber}: ${text}`);
    });
    return values.join(' | ');
  };

  const parseDateValue = (val: any): string => {
    if (!val) return '';
    if (val instanceof Date) {
      const y = val.getUTCFullYear(), m = String(val.getUTCMonth() + 1).padStart(2, '0'), d = String(val.getUTCDate()).padStart(2, '0');
      const parsed = `${y}-${m}-${d}`;
      return isValidFuelDate(parsed) ? parsed : '';
    }
    if (typeof val === 'number') {
      const wholeDays = Math.floor(val);
      const parsed = new Date(Date.UTC(1899, 11, 30) + wholeDays * 86400 * 1000);
      const iso = Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
      return isValidFuelDate(iso) ? iso : '';
    }
    const str = String(val).trim();
    // dd/mm/yyyy
    const br = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (br) {
      const [, d, m, y] = br;
      const year = y.length === 2 ? `20${y}` : y;
      const parsed = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      return isValidFuelDate(parsed) ? parsed : '';
    }
    // yyyy-mm-dd
    const iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) {
      const [, y, m, d] = iso;
      const parsed = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      return isValidFuelDate(parsed) ? parsed : '';
    }
    return '';
  };

  const parseTimeValue = (val: any): string => {
    if (val === null || val === undefined || val === '') return '';
    if (val instanceof Date) {
      return `${String(val.getUTCHours()).padStart(2, '0')}:${String(val.getUTCMinutes()).padStart(2, '0')}`;
    }
    if (typeof val === 'number') {
      if (val >= 0 && val < 1) {
        let totalMinutes = Math.round(val * 24 * 60);
        if (totalMinutes < 0) totalMinutes += 24 * 60;
        return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
      }
      const normalized = normalizeQuickTime(String(val));
      return normalized.valid ? normalized.value : String(val);
    }
    const str = String(val).trim();
    const normalized = normalizeQuickTime(str);
    return normalized.valid ? normalized.value : str;
  };

  const parseNumberValue = (val: any): number => {
    if (val === null || val === undefined || val === '') return NaN;
    if (typeof val === 'number') return val;
    const raw = String(val).trim().replace(/\s/g, '');
    const numberLike = raw.replace(/[^\d.,-]/g, '');
    const normalized = numberLike.includes(',') && numberLike.includes('.')
      ? numberLike.replace(/\./g, '').replace(',', '.')
      : numberLike.includes(',')
        ? numberLike.replace(',', '.')
        : /^\d{1,3}(\.\d{3})+$/.test(numberLike)
          ? numberLike.replace(/\./g, '')
          : numberLike;
    const cleaned = normalized.replace(/[^\d.-]/g, '');
    return parseFloat(cleaned);
  };

  const handleImportFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    setIsParsingImport(true);
    setValidationError('');
    setImportedFuelTypes([]);
    try {
      const wb = await loadValidatedWorkbook(file);
      const worksheetsToRead = wb.worksheets;
      if (worksheetsToRead.length === 0) throw new Error('Planilha vazia ou aba não encontrada.');

      const buildColMap = (row: ExcelJS.Row) => {
        const map: Record<string, number> = {};
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          const norm = normalizeHeader(cellToText(cell.value));
          for (const [canonical, synonyms] of Object.entries(COLUMN_SYNONYMS)) {
            if (!map[canonical] && synonyms.some(s => normalizeHeader(s) === norm)) {
              map[canonical] = colNumber;
            }
          }
        });
        return map;
      };

      const findHeaderRow = (ws: ExcelJS.Worksheet) => {
        let bestRow = 0;
        let bestScore = 0;
        let bestMap: Record<string, number> = {};
        for (let rowNumber = 1; rowNumber <= Math.min(ws.rowCount, 20); rowNumber += 1) {
          const map = buildColMap(ws.getRow(rowNumber));
          const score = ['data', 'frota', 'quantidadeLitros', 'hora', 'tipoCombustivel', 'bombaInicial', 'bombaFinal'].filter(key => map[key]).length;
          if (score > bestScore) {
            bestScore = score;
            bestRow = rowNumber;
            bestMap = map;
          }
        }
        return { rowNumber: bestScore > 0 ? bestRow : 0, score: bestScore, map: bestMap };
      };

      const rows: ImportRow[] = [];
      const seenInBatch = new Set<string>();
      const createdFuelTypes = new Map<string, TipoCombustivel>();
      const referenceSheetNames = new Set(['equipamentos', 'combustiveis', 'comboios']);

      const resolveFuelType = (rawText: string) => {
        const nomePlanilha = rawText.trim();
        const normalized = normalizeCompact(nomePlanilha);
        const knownFuelTypes = [...combustiveis, ...Array.from(createdFuelTypes.values())];
        const dieselPadrao = knownFuelTypes.find(c => normalizeCompact(c.nome).includes('diesel'));

        if (!normalized) {
          return {
            fuel: dieselPadrao || knownFuelTypes[0],
            created: false,
            ambiguous: false,
            missing: true,
          };
        }

        const exact = knownFuelTypes.find(c => normalizeCompact(c.nome) === normalized);
        if (exact) return { fuel: exact, created: false, ambiguous: false, missing: false };

        const partials = knownFuelTypes.filter(c => {
          const candidate = normalizeCompact(c.nome);
          return candidate && (candidate.includes(normalized) || normalized.includes(candidate));
        });
        if (partials.length === 1) return { fuel: partials[0], created: false, ambiguous: false, missing: false };

        const existingCreated = createdFuelTypes.get(normalized);
        if (existingCreated) return { fuel: existingCreated, created: true, ambiguous: partials.length > 1, missing: false };

        const suffix = normalized.replace(/[^a-z0-9]+/g, '-') || `linha-${Date.now()}`;
        const existingIds = new Set(knownFuelTypes.map(item => item.id));
        let id = `tc-import-${suffix}`;
        let counter = 2;
        while (existingIds.has(id)) {
          id = `tc-import-${suffix}-${counter}`;
          counter += 1;
        }
        const fuel: TipoCombustivel = { id, nome: nomePlanilha };
        createdFuelTypes.set(normalized, fuel);
        return { fuel, created: true, ambiguous: partials.length > 1, missing: false };
      };

      worksheetsToRead.forEach(ws => {
        const headerCandidate = findHeaderRow(ws);
        const normalizedSheetName = normalizeCompact(ws.name);
        if (headerCandidate.score < 2 && referenceSheetNames.has(normalizedSheetName)) return;

        const colMap = headerCandidate.rowNumber
          ? { ...FALLBACK_COLUMN_MAP, ...headerCandidate.map }
          : FALLBACK_COLUMN_MAP;
        const dataStartRow = headerCandidate.rowNumber ? headerCandidate.rowNumber + 1 : 1;
        const fallbackMode = headerCandidate.score < 2;
        const getCell = (row: ExcelJS.Row, key: string) => {
          const idx = colMap[key];
          return idx ? unwrapCellValue(row.getCell(idx).value as any) : undefined;
        };

        ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          if (rowNumber < dataStartRow) return;
          const rawRowText = rowToRawText(row);
          if (!rawRowText) return;

          const rawFrota = getCell(row, 'frota');
          const rawData = getCell(row, 'data');
          const rawQtd = getCell(row, 'quantidadeLitros');
          const rawBombaInicial = getCell(row, 'bombaInicial');
          const rawBombaFinal = getCell(row, 'bombaFinal');
          const rawHora = getCell(row, 'hora');
          const rawResponsavel = getCell(row, 'responsavel');

          const dataStr = parseDateValue(rawData);
          const frotaTexto = String(rawFrota || '').trim();
          const horaStr = parseTimeValue(rawHora);
          const quantidadeLida = parseNumberValue(rawQtd);
          const bombaInicialLida = parseNumberValue(rawBombaInicial);
          const bombaFinalPlanilha = parseNumberValue(rawBombaFinal);
          const bombaInicial = Number.isFinite(bombaInicialLida) ? bombaInicialLida : NaN;
          const quantidadeCalculada = Number.isFinite(bombaFinalPlanilha) && Number.isFinite(bombaInicial) && bombaFinalPlanilha > bombaInicial
            ? bombaFinalPlanilha - bombaInicial
            : NaN;
          const quantidade = Number.isFinite(quantidadeLida) ? quantidadeLida : quantidadeCalculada;
          const quantidadeFoiCalculada = !Number.isFinite(quantidadeLida) && Number.isFinite(quantidadeCalculada);
          const bombaFinal = Number.isFinite(bombaFinalPlanilha)
            ? bombaFinalPlanilha
            : Number.isFinite(quantidade) && Number.isFinite(bombaInicial) ? bombaInicial + quantidade : NaN;
          const tipoCombustivelTexto = String(getCell(row, 'tipoCombustivel') || '').trim();
          const comboioTexto = String(getCell(row, 'comboio') || '').trim();
          const empresaTexto = String(getCell(row, 'empresa') || '').trim();
          const observacao = String(getCell(row, 'observacao') || '').trim();
          const responsavel = String(rawResponsavel || '').trim();
          const kmInicialLido = parseNumberValue(getCell(row, 'kmInicial'));
          const horimetroInicialLido = parseNumberValue(getCell(row, 'horimetroInicial'));
          const kmInicial = Number.isFinite(kmInicialLido) ? kmInicialLido : 0;
          const horimetroInicial = Number.isFinite(horimetroInicialLido) ? horimetroInicialLido : 0;
          const custoLitroLido = parseNumberValue(getCell(row, 'custoLitro'));
          const custoLitro = Number.isFinite(custoLitroLido) && custoLitroLido > 0 ? custoLitroLido : 0;

          const frotaNorm = frotaTexto.toLowerCase();
          const comboioNorm = comboioTexto.toLowerCase();
          const eq = findEquipmentByPrefix(frotaTexto, equipamentos)
            || equipamentos.find(e => e.nome.toLowerCase() === frotaNorm);
          const fuelResolution = resolveFuelType(tipoCombustivelTexto);
          const comb = fuelResolution.fuel;
          const comboioExato = comboios.find(c => c.nome.toLowerCase() === comboioNorm);
          const comboiosParciais = comboioNorm
            ? comboios.filter(c => comboioNorm.includes(c.nome.toLowerCase()) || c.nome.toLowerCase().includes(comboioNorm))
            : [];
          const combVeic = comboioExato || (comboiosParciais.length === 1 ? comboiosParciais[0] : undefined);

          const preview: Record<string, string> = {
            Aba: ws.name, Data: dataStr || String(rawData || ''), Frota: frotaTexto, Hora: horaStr,
            Litros: Number.isFinite(quantidade) ? String(quantidade) : '', Combustível: tipoCombustivelTexto || comb?.nome || '', Comboio: comboioTexto, Empresa: empresaTexto,
            Responsável: responsavel || 'Não informado na planilha',
            Leitura: horimetroInicial > 0 ? `H ${horimetroInicial}` : kmInicial > 0 ? `KM ${kmInicial}` : '',
            Bomba: `${Number.isFinite(bombaInicial) ? bombaInicial : ''} → ${Number.isFinite(bombaFinal) ? bombaFinal : ''}`,
            Custo: custoLitro > 0 ? `R$ ${custoLitro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/L` : '',
            Original: rawRowText,
          };

          const importAlerts = [
            fallbackMode ? 'Cabeçalho não reconhecido com segurança; linha importada por posição para conferência.' : '',
            !dataStr ? 'Data vazia ou inválida.' : '',
            !frotaTexto ? 'Prefixo/frota não informado na planilha.' : '',
            frotaTexto && !eq ? `Prefixo "${frotaTexto}" ainda não está cadastrado.` : '',
            (!horaStr || !normalizeQuickTime(horaStr).valid) ? 'Hora vazia ou inválida.' : '',
            (isNaN(quantidade) || quantidade === undefined) ? 'Quantidade vazia ou ilegível; conferir litros.' : '',
            quantidade <= 0 ? 'Quantidade menor ou igual a zero; conferir litros.' : '',
            fuelResolution.missing && comb ? `Tipo de combustível vazio; foi usado "${comb.nome}" para manter o registro importável.` : '',
            fuelResolution.missing && !comb ? 'Tipo de combustível vazio; registro ficou sem vínculo de combustível.' : '',
            fuelResolution.created && fuelResolution.ambiguous ? `Tipo "${tipoCombustivelTexto}" estava ambíguo; foi criado novo cadastro com o texto da planilha.` : '',
            fuelResolution.created && !fuelResolution.ambiguous ? `Tipo "${tipoCombustivelTexto}" não existia; cadastro criado pela importação.` : '',
            comboioTexto && !combVeic ? `Comboio "${comboioTexto}" não localizado de forma única; registro ficou sem vínculo de comboio.` : '',
            !comboioTexto ? 'Comboio vazio; conferir abastecedor.' : '',
            getCell(row, 'custoLitro') && custoLitro <= 0 ? 'Custo por litro inválido; valor original preservado para conferência.' : '',
          ].filter(Boolean);

          // Checagem de bomba final (Prioridade 4)
          let statusFinal: string = 'OK';
          const bombaFinalCalculada = Number.isFinite(bombaInicial) && Number.isFinite(quantidade) ? bombaInicial + quantidade : NaN;
          if (Number.isFinite(bombaFinalPlanilha) && Number.isFinite(bombaFinalCalculada) && Math.abs(bombaFinalPlanilha - bombaFinalCalculada) > 0.01) {
            statusFinal = 'Verificar bomba';
          }

          // Identidade: Data + Prefixo + Litros + Hora + Bomba Inicial + Bomba Final.
          const dataFinal = dataStr;
          const horaFinal = normalizeQuickTime(horaStr).valid ? horaStr : '';
          const quantidadeFinal = Number.isFinite(quantidade) ? Number(quantidade.toFixed(4)) : NaN;
          const candidate: Partial<Abastecimento> = {
            data: dataFinal,
            hora: horaFinal,
            equipamentoId: eq?.id || '',
            prefixoInformado: frotaTexto.toUpperCase(),
            quantidadeLitros: quantidadeFinal,
            bombaInicial: Number.isFinite(bombaInicial) ? bombaInicial : undefined as any,
            bombaFinal: Number.isFinite(bombaFinal) ? bombaFinal : undefined as any,
          };
          const dupKey = buildFuelImportKey(candidate);
          const dupNoSistema = abastecimentos.some(a => buildFuelImportKey({
            ...a,
            prefixoInformado: a.prefixoInformado || equipamentos.find(eqItem => eqItem.id === a.equipamentoId)?.prefixo || a.equipamentoId,
          }) === dupKey);
          const dupNoLote = seenInBatch.has(dupKey);
          seenInBatch.add(dupKey);
          const isDuplicado = dupNoSistema || dupNoLote;
          const rowHasEssentialContent = Boolean(dataStr || frotaTexto || Number.isFinite(quantidade));
          const ignored = !rowHasEssentialContent || !Number.isFinite(quantidade) || quantidade <= 0;
          const publishable = isPublishableFuelImport(candidate) && Boolean(comb);
          const status: ImportRow['status'] = isDuplicado ? 'duplicado' : ignored ? 'ignorado' : publishable ? 'valido' : 'erro';
          if (isDuplicado) importAlerts.push('Duplicado identificado; esta linha não será publicada.');
          if (ignored) importAlerts.push('Linha vazia, sem litros válidos ou zerada; esta linha não será publicada.');
          if (!ignored && !publishable) importAlerts.push('Campos obrigatórios inválidos; esta linha não será publicada.');

          const valido = status === 'valido';
          const motivo = importAlerts.join(' | ');
          const item: Abastecimento | undefined = valido ? {
            id: `import-${Date.now()}-${ws.name}-${rowNumber}`,
            data: dataFinal,
            hora: horaFinal,
            equipamentoId: eq?.id || '',
            prefixoInformado: frotaTexto.toUpperCase(),
            horimetroInicial,
            kmInicial,
            bombaInicial,
            quantidadeLitros: quantidadeFinal,
            bombaFinal,
            custoLitro,
            tipoCombustivelId: comb?.id || '',
            comboioId: combVeic?.id || '',
            responsavel,
            observacao: [
              observacao || `Fonte: ${ws.name}`,
              `Linha original ${ws.name}:${rowNumber}: ${rawRowText}.`,
              empresaTexto ? `Empresa informada na planilha: ${empresaTexto}.` : '',
              frotaTexto && !eq ? `Prefixo informado sem cadastro: ${frotaTexto}.` : '',
              tipoCombustivelTexto ? `Combustível informado na planilha: ${tipoCombustivelTexto}.` : '',
              comboioTexto ? `Comboio informado na planilha: ${comboioTexto}.` : '',
              !responsavel ? 'Responsável não informado na planilha; conferir no registro.' : '',
              quantidadeFoiCalculada ? 'Quantidade calculada pela diferença entre bomba final e inicial.' : '',
              motivo,
            ].filter(Boolean).join(' | '),
            status: (motivo && statusFinal === 'OK' ? 'Conferência necessária' : statusFinal) as any,
            origem: 'Planilha',
            documentoOrigemNome: file.name,
            documentoOrigemHash: dupKey,
            integracaoAba: ws.name,
            integracaoLinha: rowNumber,
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString(),
          } : undefined;

          rows.push({
            aba: ws.name,
            linha: rowNumber,
            valido,
            duplicado: isDuplicado,
            status,
            motivo,
            preview,
            item,
          });
        });
      });

      setImportRows(rows);
      setImportedFuelTypes(Array.from(createdFuelTypes.values()));
      setIsImportModalOpen(true);
    } catch (err: any) {
      console.error('Erro ao ler planilha:', err);
      setValidationError(err?.message || 'Não foi possível ler a planilha. Verifique se o arquivo é um .xlsx válido.');
    } finally {
      setIsParsingImport(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const importSummary = useMemo(() => {
    const total = importRows.length;
    const validas = importRows.filter(r => r.status === 'valido').length;
    const duplicadas = importRows.filter(r => r.status === 'duplicado').length;
    const ignoradas = importRows.filter(r => r.status === 'ignorado').length;
    const comErro = importRows.filter(r => r.status === 'erro').length;
    const conferencia = importRows.filter(r => r.motivo).length;
    return { total, validas, duplicadas, ignoradas, comErro, conferencia };
  }, [importRows]);

  const handleConfirmImport = () => {
    setIsConfirmingImport(true);
    const validItems = importRows.filter(r => r.status === 'valido' && r.item).map(r => r.item!) as Abastecimento[];
    const usedFuelIds = new Set(validItems.map(item => item.tipoCombustivelId));
    onImportAbastecimentos(validItems, importedFuelTypes.filter(item => usedFuelIds.has(item.id)));
    setImportReport(`Importação concluída: ${validItems.length} novo(s) abastecimento(s) publicado(s); ${importSummary.duplicadas} duplicado(s), ${importSummary.ignoradas} linha(s) vazia(s)/zerada(s) e ${importSummary.comErro} registro(s) inválido(s) não foram publicados.`);
    setIsConfirmingImport(false);
    setIsImportModalOpen(false);
    setImportRows([]);
    setImportFileName('');
    setImportedFuelTypes([]);
  };

  const handleCancelImport = () => {
    setIsImportModalOpen(false);
    setImportRows([]);
    setImportFileName('');
    setImportedFuelTypes([]);
  };

  // 1. Form Temporary States
  // Shared
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('08:00');
  const [equipamentoId, setEquipamentoId] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [observacao, setObservacao] = useState('');

  // Fueling logs specific
  const [horimetroInicial, setHorimetroInicial] = useState<number>(0);
  const [kmInicial, setKmInicial] = useState<number>(0);
  const [bombaInicial, setBombaInicial] = useState<number>(0);
  const [quantidadeLitros, setQuantidadeLitros] = useState<number>(0);
  const [bombaFinal, setBombaFinal] = useState<number>(0);
  const [tipoCombustivelId, setTipoCombustivelId] = useState('');
  const [comboioId, setComboioId] = useState('');
  const pumpValuesManuallyEditedRef = useRef(false);

  // Lubrication specific
  const [lubHorimetro, setLubHorimetro] = useState<number>(0);
  const [produtoLubrificacaoId, setProdutoLubrificacaoId] = useState('');
  const [compartimento, setCompartimento] = useState('Pinos do Braço / Caçamba');
  const [lubQuantidade, setLubQuantidade] = useState<number>(1);

  // Helper to get derived info
  const selectedEquipment = equipamentos.find(e => e.id === equipamentoId);
  const derivedEquipmentDesc = selectedEquipment ? `${selectedEquipment.marca} ${selectedEquipment.modelo}` : '';
  const derivedCompany = selectedEquipment ? empresas.find(em => em.id === selectedEquipment.empresaId)?.nome : '';

  // A sugestão respeita data/hora e somente o comboio selecionado. Não usa a
  // maior leitura, pois um medidor pode ser reiniciado e lançamentos retroativos
  // precisam continuar a sequência que existia naquele momento.
  const getUltimaBombaFinal = (
    comboioIdAlvo: string,
    excluirId: string | null = null,
    dataReferencia = date,
    horaReferencia = time,
  ): number => findPreviousPumpForConvoy(
    abastecimentos,
    comboioIdAlvo,
    dataReferencia,
    horaReferencia,
    excluirId || '',
  )?.bombaFinal || 0;

  const previousPumpForForm = comboioId
    ? findPreviousPumpForConvoy(abastecimentos, comboioId, date, time, editingId || '')
    : undefined;

  const applyPumpSuggestion = (
    nextComboioId: string,
    nextDate = date,
    nextTime = time,
    force = false,
  ) => {
    if (editingId !== null || !nextComboioId || (pumpValuesManuallyEditedRef.current && !force)) return;
    const suggested = getUltimaBombaFinal(nextComboioId, null, nextDate, nextTime);
    setBombaInicial(suggested);
    setBombaFinal(suggested + Number(quantidadeLitros));
  };

  // Reset fields helper
  const resetFormFields = () => {
    setEditingId(null);
    setValidationError('');
    setDate(new Date().toISOString().split('T')[0]);
    setTime(new Date().toTimeString().split(' ')[0].substring(0, 5));
    setEquipamentoId('');
    setResponsavel('');
    setObservacao('');

    setHorimetroInicial(0);
    setKmInicial(0);
    setBombaInicial(0);
    setQuantidadeLitros(0);
    setBombaFinal(0);
    setTipoCombustivelId('');
    setComboioId('');
    pumpValuesManuallyEditedRef.current = false;

    setLubHorimetro(0);
    setProdutoLubrificacaoId(lubrificantes[0]?.id || '');
    setCompartimento('Pinos do Braço / Caçamba');
    setLubQuantidade(1);

  };

  // Open forms
  const handleOpenCreate = () => {
    resetFormFields();
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    resetFormFields();
    setEditingId(item.id);
    setValidationError('');

    if (mode === 'abastecimentos') {
      const x = item as Abastecimento;
      setDate(x.data); setTime(x.hora); setEquipamentoId(x.equipamentoId);
      setHorimetroInicial(x.horimetroInicial); setKmInicial(x.kmInicial);
      setBombaInicial(x.bombaInicial); setQuantidadeLitros(x.quantidadeLitros);
      setBombaFinal(x.bombaFinal);
      setTipoCombustivelId(x.tipoCombustivelId); setComboioId(x.comboioId);
      setResponsavel(x.responsavel); setObservacao(x.observacao);
      pumpValuesManuallyEditedRef.current = true;

    } else if (mode === 'lubrificacoes') {
      const x = item as Lubrificacao;
      setDate(x.data); setTime(x.hora); setEquipamentoId(x.equipamentoId);
      setLubHorimetro(x.horimetro); setProdutoLubrificacaoId(x.produtoLubrificacaoId);
      setCompartimento(x.compartimento); setLubQuantidade(x.quantidade);
      setResponsavel(x.responsavel); setObservacao(x.observacao);

    }
    setIsFormOpen(true);
  };

  // Quando o usuário troca o comboio no formulário, a Bomba Inicial é recalculada
  // automaticamente com base na última Bomba Final registrada para aquele comboio
  // (apenas em novos lançamentos; ao editar um já existente, o valor original é preservado).
  const handleComboioChange = (novoComboioId: string) => {
    setComboioId(novoComboioId);
    pumpValuesManuallyEditedRef.current = false;
    applyPumpSuggestion(novoComboioId, date, time, true);
  };

  // Form Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    const isNew = editingId === null;
    const currentId = isNew ? `txn-${Date.now()}` : editingId!;

    if (mode === 'abastecimentos') {
      if (!equipamentoId || !tipoCombustivelId || !responsavel.trim() || quantidadeLitros <= 0) {
        setValidationError('Preencha todos os campos obrigatórios (Frota, Combustível, Litros e Responsável).');
        return;
      }
      onSaveAbastecimento({
        id: currentId,
        data: date,
        hora: time,
        equipamentoId,
        horimetroInicial: Number(horimetroInicial) || 0,
        kmInicial: Number(kmInicial) || 0,
        bombaInicial: Number(bombaInicial) || 0,
        quantidadeLitros: Number(quantidadeLitros),
        bombaFinal: Number(bombaFinal) || (Number(bombaInicial) + Number(quantidadeLitros)),
        tipoCombustivelId,
        comboioId,
        responsavel: responsavel.trim(),
        observacao: observacao.trim()
      }, isNew);

    } else if (mode === 'lubrificacoes') {
      if (!equipamentoId || !responsavel.trim() || lubQuantidade <= 0) {
        setValidationError('Preencha todos os campos obrigatórios (Frota, Quantidade, Responsável)!');
        return;
      }
      onSaveLubrificacao({
        id: currentId,
        data: date,
        hora: time,
        equipamentoId,
        horimetro: Number(lubHorimetro) || 0,
        produtoLubrificacaoId: produtoLubrificacaoId || (lubrificantes[0] ? lubrificantes[0].id : ''),
        compartimento: compartimento.trim() || 'Motor',
        quantidade: Number(lubQuantidade),
        responsavel: responsavel.trim(),
        observacao: observacao.trim()
      }, isNew);

    }

    setIsFormOpen(false);
    resetFormFields();
  };

  // Safe deletion confirmation toggle
  const handleDeleteTrigger = (id: string) => {
    setDeleteConfirmId(id);
  };

  const executeDeletion = (id: string) => {
    if (mode === 'abastecimentos') onDeleteAbastecimento(id);
    else if (mode === 'lubrificacoes') onDeleteLubrificacao(id);

    setDeleteConfirmId(null);
  };

  // Search filter
  const q = searchQuery.toLowerCase().trim();

  // Filtragem combinada (AND) do módulo de Combustível — Prioridade 1
  const filteredAbastecimentos = useMemo(() => {
    return abastecimentos.filter(ab => {
      const eq = equipamentos.find(e => e.id === ab.equipamentoId);
      const comb = combustiveis.find(t => t.id === ab.tipoCombustivelId);
      const combVeic = comboios.find(c => c.id === ab.comboioId);
      const emp = eq ? empresas.find(e => e.id === eq.empresaId) : undefined;
      const status = ab.status || 'OK';

      if (fDataInicial && ab.data < fDataInicial) return false;
      if (fDataFinal && ab.data > fDataFinal) return false;
      if (fFrotaId && ab.equipamentoId !== fFrotaId) return false;
      if (fTipoCombustivelId && ab.tipoCombustivelId !== fTipoCombustivelId) return false;
      if (fComboioId && ab.comboioId !== fComboioId) return false;
      if (fEmpresaId && (!eq || eq.empresaId !== fEmpresaId)) return false;
      if (fStatus && status !== fStatus) return false;
      if (fResponsavel && !ab.responsavel.toLowerCase().includes(fResponsavel.toLowerCase())) return false;

      if (q) {
        const haystack = [
          eq?.prefixo, eq?.nome, comb?.nome, combVeic?.nome, emp?.nome,
          ab.observacao, ab.responsavel, ab.data
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    }).sort((a,b) => {
      if (abastecimentoSort === 'litros_desc') {
        return b.quantidadeLitros - a.quantidadeLitros || b.data.localeCompare(a.data);
      }
      if (abastecimentoSort === 'litros_asc') {
        return a.quantidadeLitros - b.quantidadeLitros || b.data.localeCompare(a.data);
      }
      return b.data.localeCompare(a.data) || b.hora.localeCompare(a.hora);
    });
  }, [abastecimentos, equipamentos, combustiveis, comboios, empresas, fDataInicial, fDataFinal, fFrotaId, fTipoCombustivelId, fComboioId, fEmpresaId, fStatus, fResponsavel, q, abastecimentoSort]);

  // Cards de resumo respeitando os filtros ativos (Prioridade 1)
  const resumoAbastecimentos = useMemo(() => {
    const validRecords = filteredAbastecimentos.filter(ab => ab.status !== 'Cancelado');
    const totalLitros = validRecords.reduce((sum, ab) => sum + (Number(ab.quantidadeLitros) || 0), 0);
    const totalRegistros = validRecords.length;
    const mediaLitros = totalRegistros > 0 ? totalLitros / totalRegistros : 0;
    const frotasUnicas = new Set(validRecords.map(ab => ab.equipamentoId)).size;
    return { totalLitros, totalRegistros, mediaLitros, frotasUnicas };
  }, [filteredAbastecimentos]);

  const downloadWorkbookFile = async (wb: ExcelJS.Workbook, fileName: string) => {
    await downloadCorporateWorkbook(wb, fileName);
  };

  const handleDownloadModeloCombustivel = async () => {
    try {
      const wb = new ExcelJS.Workbook();
      configureCorporateWorkbook(wb, 'Modelo de Importação de Combustível');

      const ws = wb.addWorksheet('COMBUSTIVEL');
      const headers = [
        'Data', 'Frota', 'Hora', 'Tipo do Combustivel', 'Quantidade de Litros', 'Bomba Inicial',
        'Bomba Final', 'Comboio', 'Responsavel', 'Km Inicial', 'Horimetro Inicial', 'Empresa', 'Observacao'
      ];
      const widths = [13, 14, 10, 24, 18, 15, 15, 18, 22, 14, 17, 22, 34];

      ws.columns = headers.map((header, index) => ({
        header,
        key: `col${index + 1}`,
        width: widths[index] || 16,
      }));
      ws.mergeCells(1, 1, 1, headers.length);
      ws.getCell(1, 1).value = 'MODELO DE IMPORTAÇÃO - COMBUSTÍVEL';
      ws.getRow(1).height = 24;
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 13 };
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } };
      ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      ws.mergeCells(2, 1, 2, headers.length);
      ws.getCell(2, 1).value = 'Preencha uma linha por abastecimento. Use as abas EQUIPAMENTOS, COMBUSTIVEIS e COMBOIOS como referência para os nomes aceitos.';
      ws.getRow(2).height = 26;
      ws.getRow(2).font = { color: { argb: 'FF475569' }, italic: true };
      ws.getRow(2).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

      const headerRow = ws.getRow(4);
      headerRow.values = [, ...headers];
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      headerRow.height = 22;

      const eqModelo = equipamentos[0];
      const combModelo = combustiveis[0];
      const comboioModelo = comboios[0];
      const empresaModelo = eqModelo ? empresas.find(emp => emp.id === eqModelo.empresaId) : undefined;
      ws.getRow(5).values = [
        ,
        new Date(),
        eqModelo?.prefixo || '',
        '07:00',
        combModelo?.nome || '',
        0,
        0,
        0,
        comboioModelo?.nome || '',
        comboioModelo?.responsavel || '',
        0,
        0,
        empresaModelo?.nome || '',
        'Exemplo: abastecimento importado pela planilha',
      ];

      ws.getColumn(1).numFmt = 'dd/mm/yyyy';
      [5, 6, 7, 10, 11].forEach(col => { ws.getColumn(col).numFmt = '#,##0.##'; });
      ws.eachRow((row, rowNumber) => {
        row.eachCell({ includeEmpty: true }, cell => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          };
          if (rowNumber >= 5) cell.alignment = { vertical: 'middle', horizontal: 'left' };
        });
      });
      ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: headers.length } };
      ws.views = [{ state: 'frozen', ySplit: 4 }];

      for (let row = 5; row <= 500; row += 1) {
        ws.getCell(row, 2).dataValidation = { type: 'list', allowBlank: false, formulae: ['EQUIPAMENTOS!$A$2:$A$1000'] };
        ws.getCell(row, 4).dataValidation = { type: 'list', allowBlank: false, formulae: ['COMBUSTIVEIS!$A$2:$A$1000'] };
        ws.getCell(row, 8).dataValidation = { type: 'list', allowBlank: true, formulae: ['COMBOIOS!$A$2:$A$1000'] };
      }

      const setupCatalogSheet = (sheet: ExcelJS.Worksheet, catalogHeaders: string[]) => {
        sheet.columns = catalogHeaders.map((header, index) => ({ header, key: `col${index + 1}`, width: [18, 32, 18, 16, 24, 18][index] || 18 }));
        const row = sheet.getRow(1);
        row.values = [, ...catalogHeaders];
        row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } };
        row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        sheet.views = [{ state: 'frozen', ySplit: 1 }];
        sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: catalogHeaders.length } };
      };

      const eqSheet = wb.addWorksheet('EQUIPAMENTOS');
      setupCatalogSheet(eqSheet, ['Frota', 'Descricao', 'Tipo', 'Placa', 'Empresa', 'Status']);
      equipamentos.forEach(eq => {
        const empresa = empresas.find(emp => emp.id === eq.empresaId);
        eqSheet.addRow([eq.prefixo, eq.nome, eq.tipo, eq.placa || eq.seriePlaca || '', empresa?.nome || '', eq.status]);
      });

      const combSheet = wb.addWorksheet('COMBUSTIVEIS');
      setupCatalogSheet(combSheet, ['Tipo do Combustivel']);
      (combustiveis.length ? combustiveis : [{ id: 'modelo-diesel-s10', nome: 'Diesel S10' }]).forEach(comb => combSheet.addRow([comb.nome]));

      const comboioSheet = wb.addWorksheet('COMBOIOS');
      setupCatalogSheet(comboioSheet, ['Comboio', 'Placa', 'Capacidade Litros', 'Responsavel']);
      comboios.forEach(comboio => comboioSheet.addRow([comboio.nome, comboio.placa, comboio.capacidadeLitros, comboio.responsavel]));

      await downloadWorkbookFile(wb, `MODELO_importacao_combustivel_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('Erro ao gerar modelo de combustível:', err);
      setValidationError('Não foi possível gerar o modelo de importação. Tente novamente.');
    }
  };

  // Exportação Excel do módulo de Combustível — Prioridade 2
  // Exporta somente os registros filtrados (filteredAbastecimentos já reflete os filtros ativos).
  const handleExportExcelAbastecimentos = async () => {
    setIsExportingExcel(true);
    try {
      const wb = new ExcelJS.Workbook();
      configureCorporateWorkbook(wb, 'Controle de Combustível');
      const ws = wb.addWorksheet('COMBUSTIVEL');
      const headers = [
        'Data', 'Prefixo', 'Descrição', 'Km inicial', 'Horímetro', 'Início bomba', 'Fim bomba',
        'Litros', 'Hora', 'Comboio', 'Tipo combustível', 'Empresa', 'Bomba calculada',
        'Fim anterior mesmo comboio', 'Status sequência', 'Observação', 'Criado em', 'Atualizado em'
      ];

      ws.columns = headers.map((_, index) => ({
        key: `col${index + 1}`,
        width: [12, 14, 28, 12, 12, 14, 14, 12, 10, 16, 24, 20, 16, 24, 18, 30, 18, 18][index] || 16,
      }));
      ws.mergeCells(1, 1, 1, headers.length);
      ws.getCell(1, 1).value = 'COMBUSTIVEL';
      ws.getRow(1).height = 24;
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 13 };
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } };
      ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      const headerRow = ws.getRow(4);
      headerRow.values = [, ...headers];
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

      filteredAbastecimentos.forEach(ab => {
        const eq = equipamentos.find(e => e.id === ab.equipamentoId);
        const comb = combustiveis.find(t => t.id === ab.tipoCombustivelId);
        const combVeic = comboios.find(c => c.id === ab.comboioId);
        const emp = eq ? empresas.find(e => e.id === eq.empresaId) : undefined;

        ws.addRow([
          ab.data ? ab.data.split('-').reverse().join('/') : '',
          eq?.prefixo || '',
          eq?.nome || '',
          ab.kmInicial || '',
          ab.horimetroInicial || '',
          ab.bombaInicial ?? '',
          ab.bombaFinal ?? '',
          ab.quantidadeLitros ?? '',
          ab.hora || '',
          combVeic?.nome || '',
          comb?.nome || '',
          emp?.nome || '',
          (ab.bombaInicial || 0) + (ab.quantidadeLitros || 0),
          '',
          ab.status || 'OK',
          ab.observacao || '',
          ab.criadoEm ? new Date(ab.criadoEm).toLocaleString('pt-BR') : '',
          ab.atualizadoEm ? new Date(ab.atualizadoEm).toLocaleString('pt-BR') : '',
        ]);
      });

      styleCorporateWorksheet(ws, { title: 'Controle de Combustível', headerRow: 4, lastColumn: headers.length, recordCount: filteredAbastecimentos.length });
      addCorporateSummarySheet(wb, 'Controle de Combustível', [
        ['Registros exportados', filteredAbastecimentos.length],
        ['Litros totais', filteredAbastecimentos.reduce((total, item) => total + Number(item.quantidadeLitros || 0), 0)],
        ['Equipamentos atendidos', new Set(filteredAbastecimentos.map(item => item.equipamentoId)).size],
        ['Comboios utilizados', new Set(filteredAbastecimentos.map(item => item.comboioId).filter(Boolean)).size],
      ], [hasFiltrosAtivos ? 'Filtros da tela aplicados' : 'Base completa']);

      const sufixo = hasFiltrosAtivos ? '_filtrado' : '';
      await downloadWorkbookFile(wb, `RENEA_combustivel${sufixo}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('Erro ao exportar Excel de combustível:', err);
      setValidationError('Não foi possível exportar o Excel. Tente novamente.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const filteredLubrificacoes = lubrificacoes.filter(lub => {
    const eq = equipamentos.find(e => e.id === lub.equipamentoId);
    return lub.data.includes(q) || lub.compartimento.toLowerCase().includes(q) || (eq && eq.prefixo.toLowerCase().includes(q));
  }).sort((a,b) => b.data.localeCompare(a.data));

  if (String(mode) === 'abastecimentos') {
    return (
      <>
        {validationError && (
          <div className="mb-4 flex items-start gap-3 border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {validationError}
          </div>
        )}
        {importReport && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">{importReport}</span>
            <button type="button" onClick={() => setImportReport('')} className="rounded p-1 text-emerald-700 hover:bg-emerald-100" aria-label="Fechar relatório"><X className="h-4 w-4" /></button>
          </div>
        )}
        <CombustivelInteligenteTab
          empresas={empresas}
          equipamentos={equipamentos}
          comboios={comboios}
          combustiveis={combustiveis}
          abastecimentos={abastecimentos}
          onSaveAbastecimento={onSaveAbastecimento}
          onDeleteAbastecimento={onDeleteAbastecimento}
          onImportAbastecimentos={onImportAbastecimentos}
          onOpenLubrificacao={() => {
            setMode('lubrificacoes');
            setIsFormOpen(false);
            setSearchQuery('');
            resetFormFields();
          }}
          onOpenCadastros={onOpenCadastros}
          onOpenSpreadsheetImport={() => fileInputRef.current?.click()}
          isParsingSpreadsheet={isParsingImport}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xlsm"
          onChange={handleImportFileSelected}
          className="hidden"
        />
        <SpreadsheetImportReview
          open={isImportModalOpen}
          title="Importar abastecimentos"
          fileName={importFileName}
          validCount={importSummary.validas}
          ignoredCount={importSummary.duplicadas + importSummary.ignoradas + importSummary.comErro}
          columns={['Linha', 'Aba', 'Status', 'Data', 'Frota', 'Litros', 'Hora', 'Leitura', 'Bomba', 'Combustível', 'Comboio', 'Empresa', 'Responsável']}
          rows={importRows.map(row => ({
            Linha: row.linha,
            Aba: row.aba,
            Status: row.status === 'valido' ? '✅ Válido'
              : row.status === 'duplicado' ? '⚠ Duplicado • bloqueado'
              : row.status === 'ignorado' ? '⚠ Ignorado • bloqueado'
              : '❌ Erro • bloqueado',
            Data: row.preview.Data,
            Hora: row.preview.Hora,
            Frota: row.preview.Frota,
            Leitura: row.preview.Leitura,
            Bomba: row.preview.Bomba,
            Litros: row.preview.Litros,
            Combustível: row.preview['Combustível'],
            Comboio: row.preview.Comboio,
            Empresa: row.preview.Empresa,
            Responsável: row.preview['Responsável']
          }))}
          note={`${importSummary.total} linha(s) lida(s): ${importSummary.validas} válida(s), ${importSummary.duplicadas} duplicada(s), ${importSummary.ignoradas} ignorada(s) e ${importSummary.comErro} com erro. Somente ${importSummary.validas} registro(s) serão publicados.${importedFuelTypes.length ? ` Cadastros de combustível serão criados apenas quando usados por uma linha válida.` : ''}`}
          confirming={isConfirmingImport}
          onCancel={handleCancelImport}
          onConfirm={handleConfirmImport}
        />
      </>
    );
  }

  return (
    <div className="space-y-6" id="lancamentos-tab">
      
      {/* Tab Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-850 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-emerald-500" />
            Lançamentos de Campo Diários
          </h1>
          <p className="text-xs text-slate-400 mt-1">Insira abastecimentos rápidos e manutenções de lubrificação.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {mode === 'abastecimentos' && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsingImport}
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-4 text-xs font-black text-slate-200 transition-colors hover:border-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {isParsingImport ? 'Lendo planilha...' : 'Importar planilha'}
              </button>
              <button
                type="button"
                onClick={handleExportExcelAbastecimentos}
                disabled={isExportingExcel}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                {isExportingExcel ? 'Exportando...' : 'Exportar Excel'}
              </button>
              <button
                type="button"
                onClick={handleDownloadModeloCombustivel}
                className="px-4 py-2.5 bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Baixar modelo
              </button>
            </>
          )}
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4.5 h-4.5" />
            {mode === 'abastecimentos' ? 'Novo Abastecimento' : 'Nova Lubrificação'}
          </button>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xlsm"
        onChange={handleImportFileSelected}
        className="hidden"
      />

      {/* Subtab Selectors */}
      <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-850 max-w-md" id="lancamentos-selector">
        <button
          onClick={() => { setMode('abastecimentos'); setIsFormOpen(false); setSearchQuery(''); resetFormFields(); }}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${mode === 'abastecimentos' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-100'}`}
        >
          <Fuel className="w-4 h-4" />
          Abastecimentos
        </button>
        <button
          onClick={() => { setMode('lubrificacoes'); setIsFormOpen(false); setSearchQuery(''); resetFormFields(); }}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${mode === 'lubrificacoes' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-100'}`}
        >
          <Droplets className="w-4 h-4" />
          Lubrificação
        </button>
      </div>

      {/* Quick Search */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 bg-slate-900 border border-slate-850 p-3 rounded-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 w-4.5 h-4.5 text-slate-600" />
          <input 
            type="text"
            placeholder={mode === 'abastecimentos' ? 'Filtrar por data, responsável ou prefixo de frota...' : mode === 'lubrificacoes' ? 'Filtrar por data, compartimento ou prefixo...' : 'Filtrar por data, obra ou serviço executado...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
        {mode === 'abastecimentos' && (
          <select
            value={abastecimentoSort}
            onChange={(e) => setAbastecimentoSort(e.target.value as 'data_desc' | 'litros_desc' | 'litros_asc')}
            className="w-full md:w-64 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors"
            title="Ordenar abastecimentos"
          >
            <option value="data_desc">Mais recentes primeiro</option>
            <option value="litros_desc">Maior volume para menor</option>
            <option value="litros_asc">Menor volume para maior</option>
          </select>
        )}
        {mode === 'abastecimentos' && (
          <button
            type="button"
            onClick={() => setFiltrosAbertos(v => !v)}
            className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${filtrosAbertos ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-emerald-500'}`}
            id="btn-toggle-filtros-combustivel"
          >
            <Search className="w-3.5 h-3.5" />
            Filtros avançados
          </button>
        )}
      </div>

      {/* Painel de Filtros Avançados + Cards de Resumo — Módulo Combustível (Prioridade 1) */}
      {mode === 'abastecimentos' && filtrosAbertos && (
        <div className="bg-slate-900 border border-slate-850 rounded-2xl p-5 space-y-4" id="filtros-combustivel-painel">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Data Inicial</label>
              <input type="date" value={fDataInicial} onChange={e => setFDataInicial(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1">
              <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Data Final</label>
              <input type="date" value={fDataFinal} onChange={e => setFDataFinal(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1">
              <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Frota / Equipamento</label>
              <select value={fFrotaId} onChange={e => setFFrotaId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer">
                <option value="">Todas</option>
                {equipamentos.map(eq => <option key={eq.id} value={eq.id}>{eq.prefixo} — {eq.nome}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Tipo de Combustível</label>
              <select value={fTipoCombustivelId} onChange={e => setFTipoCombustivelId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer">
                <option value="">Todos</option>
                {combustiveis.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Comboio / Tanque</label>
              <select value={fComboioId} onChange={e => setFComboioId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer">
                <option value="">Todos</option>
                {comboios.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Empresa</label>
              <select value={fEmpresaId} onChange={e => setFEmpresaId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer">
                <option value="">Todas</option>
                {empresas.map(em => <option key={em.id} value={em.id}>{em.nome}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Status</label>
              <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer">
                <option value="">Todos</option>
                <option value="OK">OK</option>
                <option value="Pendente">Pendente</option>
                <option value="Cancelado">Cancelado</option>
                <option value="Duplicado">Duplicado</option>
                <option value="Verificar quantidade">Verificar quantidade</option>
                <option value="Verificar bomba">Verificar bomba</option>
                <option value="Erro de importação">Erro de importação</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Responsável</label>
              <input type="text" value={fResponsavel} onChange={e => setFResponsavel(e.target.value)} placeholder="Nome do responsável..." className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={limparFiltros}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              <FilterX className="w-3.5 h-3.5" />
              Limpar filtros
            </button>
            <button
              type="button"
              onClick={handleExportExcelAbastecimentos}
              disabled={isExportingExcel}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              {isExportingExcel ? 'Exportando...' : hasFiltrosAtivos ? 'Exportar Excel filtrado' : 'Exportar Excel'}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsingImport}
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-4 text-xs font-black text-slate-200 transition-colors hover:border-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              {isParsingImport ? 'Lendo planilha...' : 'Importar planilha'}
            </button>
          </div>

          {/* Cards de resumo respeitando os filtros aplicados */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
            <div className="bg-slate-950 border border-slate-850 rounded-xl p-3.5">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Total de Litros</p>
              <p className="text-lg font-black text-emerald-400 font-mono mt-1">{resumoAbastecimentos.totalLitros.toLocaleString('pt-BR')} L</p>
            </div>
            <div className="bg-slate-950 border border-slate-850 rounded-xl p-3.5">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Registros</p>
              <p className="text-lg font-black text-white font-mono mt-1">{resumoAbastecimentos.totalRegistros}</p>
            </div>
            <div className="bg-slate-950 border border-slate-850 rounded-xl p-3.5">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Média por Abastecimento</p>
              <p className="text-lg font-black text-white font-mono mt-1">{resumoAbastecimentos.mediaLitros.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L</p>
            </div>
            <div className="bg-slate-950 border border-slate-850 rounded-xl p-3.5">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Frotas Distintas</p>
              <p className="text-lg font-black text-white font-mono mt-1">{resumoAbastecimentos.frotasUnicas}</p>
            </div>
          </div>
        </div>
      )}

      {/* Log Form Editor Card */}
      {isFormOpen && (
        <div className="bg-slate-900 border border-emerald-500/30 p-6 rounded-2xl shadow-xl relative" id="log-editor-card">
          <button 
            onClick={() => { setIsFormOpen(false); resetFormFields(); }}
            className="absolute top-4 right-4 p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <h3 className="text-xs uppercase tracking-widest font-black text-emerald-400 font-mono mb-5 flex items-center gap-2">
            {editingId ? '✏️ Editando Lançamento' : '➕ Novo Lançamento'} • {mode === 'abastecimentos' ? 'Abastecimento de Combustível' : 'Manutenção / Lubrificação de Máquina'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* 1. ABASTECIMENTO FORM FIELDS */}
            {mode === 'abastecimentos' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Data de Registro *</label>
                    <input type="date" value={date} onChange={e => { const nextDate = e.target.value; setDate(nextDate); applyPumpSuggestion(comboioId, nextDate, time); }} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Hora *</label>
                    <input type="time" value={time} onChange={e => { const nextTime = e.target.value; setTime(nextTime); applyPumpSuggestion(comboioId, date, nextTime); }} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Frota / Equipamento *</label>
                    <select value={equipamentoId} onChange={e => setEquipamentoId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer" required>
                      <option value="">Selecione...</option>
                      {equipamentos.map(eq => (
                        <option key={eq.id} value={eq.id} className="bg-slate-900 text-white">{eq.prefixo} — {eq.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Combustível Utilizado *</label>
                    <select value={tipoCombustivelId} onChange={e => setTipoCombustivelId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer" required>
                      <option value="">Selecione...</option>
                      {combustiveis.map(tc => (
                        <option key={tc.id} value={tc.id} className="bg-slate-900 text-white">{tc.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Derived / Readonly Fields row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/40 p-4.5 rounded-xl border border-slate-850/60">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">Descrição Automática da Frota</span>
                    <span className="text-xs font-bold text-slate-300 block">{derivedEquipmentDesc || 'Aguardando seleção de frota...'}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">Empresa Proprietária Automática</span>
                    <span className="text-xs font-bold text-slate-300 block">{derivedCompany || 'Aguardando seleção de frota...'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Horímetro Inicial</label>
                    <input type="number" value={horimetroInicial} onChange={e => setHorimetroInicial(Number(e.target.value))} placeholder="0" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">KM Inicial</label>
                    <input type="number" value={kmInicial} onChange={e => setKmInicial(Number(e.target.value))} placeholder="0" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Bomba Inicial (Litros) <span className="text-emerald-500 normal-case font-semibold">— {previousPumpForForm ? 'sugerida pelo histórico' : 'informe a primeira leitura'}</span></label>
                    <input type="number" value={bombaInicial} onChange={e => {
                      const inicial = Number(e.target.value);
                      pumpValuesManuallyEditedRef.current = true;
                      setBombaInicial(inicial);
                      setBombaFinal(inicial + Number(quantidadeLitros));
                    }} placeholder="Leitura real da bomba" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                    <span className="text-[9px] text-slate-500 font-mono block">{previousPumpForForm ? `Último registro deste comboio: ${previousPumpForForm.data.split('-').reverse().join('/')} ${previousPumpForForm.hora} • ${previousPumpForForm.bombaFinal.toLocaleString('pt-BR')} L` : 'Nenhuma leitura anterior encontrada para este comboio e horário.'}</span>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Quantidade de Litros *</label>
                    <input type="number" value={quantidadeLitros} onChange={e => {
                      const litros = Number(e.target.value);
                      setQuantidadeLitros(litros);
                      setBombaFinal(Number(bombaInicial) + litros);
                    }} placeholder="100" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" required />
                  </div>

                  {/* Bomba final agora é editável: digitar aqui recalcula os litros automaticamente */}
                  <div className="space-y-1 bg-slate-950/20 px-3.5 py-1.5 border border-emerald-700/40 rounded-xl">
                    <label className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block font-mono">Bomba Final (Litros)</label>
                    <input type="number" value={bombaFinal} onChange={e => {
                      const final = Number(e.target.value);
                      pumpValuesManuallyEditedRef.current = true;
                      setBombaFinal(final);
                      setQuantidadeLitros(Math.max(0, final - Number(bombaInicial)));
                    }} placeholder="0" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500" />
                    <span className="text-[9px] text-slate-500 font-mono block">Vira a Bomba Inicial do próximo abastecimento deste comboio</span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Comboio Abastecedor</label>
                    <select value={comboioId} onChange={e => handleComboioChange(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer">
                      <option value="">Selecione...</option>
                      {comboios.map(com => (
                        <option key={com.id} value={com.id} className="bg-slate-900 text-white">{com.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Responsável pelo Lançamento *</label>
                    <input type="text" value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Ex: José da Silva Costa" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" required />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Observação</label>
                    <input type="text" value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Ex: Abastecido no canteiro de obras norte" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                  </div>
                </div>
              </div>
            )}

            {/* 2. LUBRIFICACAO FORM FIELDS */}
            {mode === 'lubrificacoes' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Data *</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Hora *</label>
                    <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Frota / Equipamento *</label>
                    <select value={equipamentoId} onChange={e => setEquipamentoId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer" required>
                      <option value="">Selecione...</option>
                      {equipamentos.map(eq => (
                        <option key={eq.id} value={eq.id} className="bg-slate-900 text-white">{eq.prefixo} — {eq.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Produto Lubrificante *</label>
                    <select value={produtoLubrificacaoId} onChange={e => setProdutoLubrificacaoId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer" required>
                      <option value="">Selecione...</option>
                      {lubrificantes.map(pl => (
                        <option key={pl.id} value={pl.id} className="bg-slate-900 text-white">{pl.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Derived Equipment / Company Info Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/40 p-4.5 rounded-xl border border-slate-850/60">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">Descrição Automática</span>
                    <span className="text-xs font-bold text-slate-300 block">{derivedEquipmentDesc || 'Aguardando seleção de frota...'}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">Empresa Proprietária</span>
                    <span className="text-xs font-bold text-slate-300 block">{derivedCompany || 'Aguardando seleção de frota...'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Horímetro Atual</label>
                    <input type="number" value={lubHorimetro} onChange={e => setLubHorimetro(Number(e.target.value))} placeholder="0" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Compartimento Aplicado *</label>
                    <input type="text" value={compartimento} onChange={e => setCompartimento(e.target.value)} placeholder="Ex: Cárter Motor, Pinos" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Quantidade Aplicada *</label>
                    <input type="number" step="any" value={lubQuantidade} onChange={e => setLubQuantidade(Number(e.target.value))} placeholder="1" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Responsável Técnico *</label>
                    <input type="text" value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Ex: Marcos de Souza" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" required />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Observações adicionais</label>
                  <input type="text" value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Ex: Substituído filtro de óleo na mesma intervenção" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                </div>
              </div>
            )}

            {validationError && (
              <div className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-xl">
                ⚠️ {validationError}
              </div>
            )}

            {/* Form Actions */}
            <div className="flex gap-2.5">
              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                {editingId ? 'Salvar Lançamento' : 'Registrar na Obra'}
              </button>
              <button
                type="button"
                onClick={() => { setIsFormOpen(false); resetFormFields(); }}
                className="px-5 py-2.5 bg-slate-850 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
            </div>

          </form>
        </div>
      )}

      {/* Lists of saved transactions */}
      <div className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden" id="transactions-viewport">
        
        {/* ABASTECIMENTOS TABLE */}
        {mode === 'abastecimentos' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-850 text-slate-400 uppercase text-[10px] font-bold bg-slate-950/20 font-mono">
                  <th className="py-3.5 px-5">Data / Hora</th>
                  <th className="py-3.5 px-5">Frota</th>
                  <th className="py-3.5 px-5">Combustível</th>
                  <th className="py-3.5 px-5">Vol. Abastecido</th>
                  <th className="py-3.5 px-5">Bomba Inicial/Final</th>
                  <th className="py-3.5 px-5">Horímetro / KM</th>
                  <th className="py-3.5 px-5">Comboio / Posto</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredAbastecimentos.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-500 italic">
                      {hasFiltrosAtivos ? 'Nenhum registro encontrado para os filtros selecionados.' : 'Nenhum abastecimento encontrado.'}
                    </td>
                  </tr>
                ) : (
                  filteredAbastecimentos.map(ab => {
                    const eq = equipamentos.find(e => e.id === ab.equipamentoId);
                    const comb = combustiveis.find(t => t.id === ab.tipoCombustivelId);
                    const combName = comb ? comb.nome : 'Diesel';
                    const combVeic = comboios.find(c => c.id === ab.comboioId);
                    const status = ab.status || 'OK';
                    const statusStyles: Record<string, string> = {
                      'OK': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                      'Pendente': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                      'Duplicado': 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                      'Verificar quantidade': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
                      'Verificar bomba': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
                      'Erro de importação': 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                    };

                    return (
                      <tr key={ab.id} className="hover:bg-slate-950/20 transition-colors">
                        <td className="py-4 px-5">
                          <span className="font-bold text-slate-100 block">{ab.data.split('-').reverse().join('/')}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{ab.hora}</span>
                        </td>
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-emerald-400 font-bold bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-xxs">
                              {eq ? eq.prefixo : 'FROTA'}
                            </span>
                            <span className="font-semibold text-slate-300 max-w-[130px] truncate block">{eq ? eq.nome : 'Equipamento'}</span>
                          </div>
                        </td>
                        <td className="py-4 px-5 font-semibold text-slate-300">{combName}</td>
                        <td className="py-4 px-5 font-mono text-emerald-400 font-black text-sm">
                          {ab.quantidadeLitros.toLocaleString('pt-BR')} L
                        </td>
                        <td className="py-4 px-5 font-mono text-slate-400 text-xxs">
                          {ab.bombaInicial > 0 ? <>Início: {ab.bombaInicial.toLocaleString('pt-BR')} L<br /></> : <>Início: —<br /></>}
                          {ab.bombaFinal > 0 ? <>Final: {ab.bombaFinal.toLocaleString('pt-BR')} L</> : <>Final: —</>}
                        </td>
                        <td className="py-4 px-5 font-mono text-slate-300 text-xxs">
                          {ab.horimetroInicial > 0 && <span>Horím: {ab.horimetroInicial} h<br /></span>}
                          {ab.kmInicial > 0 && <span>Quilom: {ab.kmInicial} km</span>}
                          {ab.horimetroInicial === 0 && ab.kmInicial === 0 && '—'}
                        </td>
                        <td className="py-4 px-5 text-slate-400">
                          {combVeic ? combVeic.nome : 'Posto Fixo'}
                        </td>
                        <td className="py-4 px-5">
                          <span className={`inline-block px-2 py-1 rounded-lg border text-[10px] font-bold ${statusStyles[status] || statusStyles['OK']}`}>
                            {status}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleOpenEdit(ab)} className="p-1.5 bg-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg cursor-pointer"><Edit className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDeleteTrigger(ab.id)} className="p-1.5 bg-slate-800 text-slate-300 hover:text-rose-400 rounded-lg cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* LUBRIFICACOES TABLE */}
        {mode === 'lubrificacoes' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-850 text-slate-400 uppercase text-[10px] font-bold bg-slate-950/20 font-mono">
                  <th className="py-3.5 px-5">Data / Hora</th>
                  <th className="py-3.5 px-5">Frota</th>
                  <th className="py-3.5 px-5">Produto Lubrificante</th>
                  <th className="py-3.5 px-5">Compartimento</th>
                  <th className="py-3.5 px-5">Quantidade</th>
                  <th className="py-3.5 px-5">Horímetro</th>
                  <th className="py-3.5 px-5">Responsável</th>
                  <th className="py-3.5 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredLubrificacoes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500 italic">Nenhum registro de lubrificação encontrado.</td>
                  </tr>
                ) : (
                  filteredLubrificacoes.map(lub => {
                    const eq = equipamentos.find(e => e.id === lub.equipamentoId);
                    const prod = lubrificantes.find(p => p.id === lub.produtoLubrificacaoId);

                    return (
                      <tr key={lub.id} className="hover:bg-slate-950/20 transition-colors">
                        <td className="py-4 px-5">
                          <span className="font-bold text-slate-100 block">{lub.data.split('-').reverse().join('/')}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{lub.hora}</span>
                        </td>
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-emerald-400 font-bold bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-xxs">
                              {eq ? eq.prefixo : 'FROTA'}
                            </span>
                            <span className="font-semibold text-slate-300 max-w-[130px] truncate block">{eq ? eq.nome : 'Equipamento'}</span>
                          </div>
                        </td>
                        <td className="py-4 px-5 font-semibold text-slate-300">{prod ? prod.nome : 'Graxa / Óleo'}</td>
                        <td className="py-4 px-5 text-slate-300">{lub.compartimento}</td>
                        <td className="py-4 px-5 font-mono text-emerald-400 font-black text-sm">{lub.quantidade} L/kg</td>
                        <td className="py-4 px-5 font-mono text-slate-300">{lub.horimetro > 0 ? `${lub.horimetro} h` : '—'}</td>
                        <td className="py-4 px-5 text-slate-400">{lub.responsavel}</td>
                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleOpenEdit(lub)} className="p-1.5 bg-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg cursor-pointer"><Edit className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDeleteTrigger(lub.id)} className="p-1.5 bg-slate-800 text-slate-300 hover:text-rose-400 rounded-lg cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Deletion safe prompt confirm */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm bg-slate-900 border border-rose-500/30 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="p-3 bg-rose-500/10 text-rose-400 rounded-2xl w-fit">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm uppercase tracking-wider font-black text-white font-mono">{mode === 'abastecimentos' ? 'Confirmar cancelamento?' : 'Confirmar exclusão?'}</h3>
              <p className="text-xxs text-slate-400 mt-1 leading-relaxed">
                {mode === 'abastecimentos'
                  ? 'O lançamento ficará marcado como Cancelado, continuará disponível para auditoria e deixará de compor os indicadores operacionais.'
                  : 'Você tem certeza que deseja excluir esta movimentação? Isso recalculará os saldos operacionais na mesma hora.'}
              </p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => executeDeletion(deleteConfirmId)}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                {mode === 'abastecimentos' ? 'Sim, Cancelar lançamento' : 'Sim, Excluir'}
              </button>
              <button 
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Não, Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <SpreadsheetImportReview
        open={isImportModalOpen}
        title="Importar abastecimentos"
        fileName={importFileName}
        validCount={importSummary.validas}
        ignoredCount={importSummary.duplicadas + importSummary.ignoradas + importSummary.comErro}
        columns={['Linha', 'Aba', 'Status', 'Data', 'Frota', 'Litros', 'Hora', 'Leitura', 'Bomba', 'Combustível', 'Comboio', 'Empresa', 'Responsável']}
        rows={importRows.map(row => ({
          Linha: row.linha,
          Aba: row.aba,
          Status: row.status === 'valido' ? '✅ Válido'
            : row.status === 'duplicado' ? '⚠ Duplicado • bloqueado'
            : row.status === 'ignorado' ? '⚠ Ignorado • bloqueado'
            : '❌ Erro • bloqueado',
          Data: row.preview.Data,
          Hora: row.preview.Hora,
          Frota: row.preview.Frota,
          Leitura: row.preview.Leitura,
          Bomba: row.preview.Bomba,
          Litros: row.preview.Litros,
          Combustível: row.preview['Combustível'],
          Comboio: row.preview.Comboio,
          Empresa: row.preview.Empresa,
          Responsável: row.preview['Responsável']
        }))}
        note={`${importSummary.total} linha(s) lida(s): ${importSummary.validas} válida(s), ${importSummary.duplicadas} duplicada(s), ${importSummary.ignoradas} ignorada(s) e ${importSummary.comErro} com erro. Somente ${importSummary.validas} registro(s) serão publicados.${importedFuelTypes.length ? ` Cadastros de combustível serão criados apenas quando usados por uma linha válida.` : ''}`}
        confirming={isConfirmingImport}
        onCancel={handleCancelImport}
        onConfirm={handleConfirmImport}
      />

    </div>
  );
}
