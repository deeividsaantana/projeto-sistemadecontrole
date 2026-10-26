/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Empresa,
  Equipamento,
  Comboio,
  TipoCombustivel,
  ProdutoLubrificacao,
  Abastecimento,
  Lubrificacao,
  StatusRegistroCombustivel,
  ControleEquipamentoDiario,
  GrupoEquipe,
} from '../types';

import { AlertTriangle, CheckCircle, Edit, Fuel, Plus, Search, Trash2, X } from 'lucide-react';
import type ExcelJS from 'exceljs';
import { loadValidatedWorkbook } from '../utils/excelCorporate';
import SpreadsheetImportReview from './SpreadsheetImportReview';
import CombustivelOperacionalTab from './CombustivelOperacionalTab';
import { findEquipmentByPrefix, isValidFuelDate, normalizeQuickTime } from '../utils/combustivelValidation';
import { buildFuelImportKey, isPublishableFuelImport } from '../utils/fuelImportIdentity';
import { buildFuelImportObservation, fuelSheetCompetence, isFuelImportWorksheet, normalizeConvoyCode } from '../utils/fuelMacroForm';
import {
  buildFuelImportedMasterData,
  normalizeFuelMasterKey,
  type FuelEquipmentRegistryRow,
  type FuelImportedMasterData,
  type FuelLaunchRegistryRow,
} from '../utils/fuelMasterDataImport';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ConfirmDialog, PageHeader, isoDay } from '../shared/ui';
import { TelaCheia } from '../shared/ui/TelaCheia';
import { TabelaPadrao, type ColunaTabela } from '../shared/ui/TabelaPadrao';
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, CARTAO, FOCO, ROTULO } from './cadastros/estilos';

export interface ImportAbastecimentosResult {
  requested: number;
  accepted: number;
  rejected: number;
  totalAfter: number;
  companiesCreated?: number;
  equipmentsCreated?: number;
  convoysCreated?: number;
  fuelTypesCreated?: number;
}

interface LancamentosTabProps {
  empresas: Empresa[];
  equipamentos: Equipamento[];
  comboios: Comboio[];
  combustiveis: TipoCombustivel[];
  lubrificantes: ProdutoLubrificacao[];
  /** Canteiros do cadastro; sem isso usa a lista fixa de reserva. */
  canteiros?: readonly string[];

  abastecimentos: Abastecimento[];
  lubrificacoes: Lubrificacao[];

  onSaveAbastecimento: (item: Abastecimento, isNew: boolean) => void;
  /** Gravar vários de uma vez (trocar data em lote). */
  onSaveAbastecimentos?: (itens: Abastecimento[], descricao: string) => void;
  /** Sem os de excluir, a tela não mostra Excluir: só o administrador exclui lançamento (A7). */
  onDeleteAbastecimento?: (id: string) => void;
  /** Manda para a Lixeira e devolve as exclusões, para o Desfazer. */
  onDeleteAbastecimentos?: (ids: string[]) => string[];
  onRestaurarAbastecimentos?: (exclusaoIds: string[]) => { ok: boolean; mensagem: string };
  onImportAbastecimentos: (items: Abastecimento[], combustiveisImportados?: TipoCombustivel[], cadastrosImportados?: Partial<FuelImportedMasterData>) => ImportAbastecimentosResult;
  onSaveLubrificacao: (item: Lubrificacao, isNew: boolean) => void;
  onDeleteLubrificacao?: (id: string) => void;
  onOpenCadastros?: () => void;
  /** Lançamentos do Controle de Frotas: dão operador, canteiro e situação ao abastecimento. */
  registrosFrota?: ControleEquipamentoDiario[];
  gruposEquipe?: GrupoEquipe[];
  usuario?: string;
  onOpenControle?: () => void;
  combustivelInicial?: 'novo' | 'historico' | 'relatorios';
  combustivelListaSomente?: boolean;
  /** A aba Relatórios abre o Combustível já no consumo por máquina. */
  combustivelPorMaquina?: boolean;
}

type Mode = 'abastecimentos' | 'lubrificacoes';

export default function LancamentosTab({
  empresas,
  equipamentos,
  comboios,
  combustiveis,
  lubrificantes,
  canteiros,
  abastecimentos,
  lubrificacoes,
  onSaveAbastecimento,
  onSaveAbastecimentos,
  onDeleteAbastecimento,
  onDeleteAbastecimentos,
  onRestaurarAbastecimentos,
  onImportAbastecimentos,
  onSaveLubrificacao,
  onDeleteLubrificacao,
  onOpenCadastros,
  registrosFrota,
  gruposEquipe,
  usuario,
  onOpenControle,
  combustivelInicial,
  combustivelListaSomente = false,
  combustivelPorMaquina = false,
}: LancamentosTabProps) {

  const [mode, setMode] = useState<Mode>('abastecimentos');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState('');
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
  const equipamentoFieldRef = useRef<HTMLSelectElement>(null);
  const moduleRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Foco automático no campo de Frota/Equipamento ao abrir o formulário: data e
  // hora já vêm preenchidas por padrão, então é o próximo campo que o usuário
  // precisa preencher primeiro.
  useEffect(() => {
    if (!isFormOpen) return;
    const raf = requestAnimationFrame(() => equipamentoFieldRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [isFormOpen, mode]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isParsingImport, setIsParsingImport] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [isConfirmingImport, setIsConfirmingImport] = useState(false);
  const [importedFuelTypes, setImportedFuelTypes] = useState<TipoCombustivel[]>([]);
  const [importedMasterData, setImportedMasterData] = useState<FuelImportedMasterData>({ empresas: [], equipamentos: [], comboios: [] });
  const [importReport, setImportReport] = useState('');
  const [openFuelHistorySignal, setOpenFuelHistorySignal] = useState(0);

  const normalizeHeader = (s: string) =>
    (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  const COLUMN_SYNONYMS: Record<string, string[]> = {
    data: ['data', 'data abastecimento', 'data do abastecimento', 'dt', 'dia'],
    frota: ['frota', 'prefixo', 'equipamento', 'frota prefixo', 'equipamento frota', 'cb', 'codigo equipamento', 'código equipamento', 'cod equipamento', 'n frota', 'numero frota', 'número frota', 'prefixo placa', 'placa', 'veiculo', 'veículo', 'maquina', 'máquina'],
    descricao: ['descricao do equipamento', 'descrição do equipamento', 'descricao equipamento', 'descrição equipamento', 'descricao', 'descrição'],
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

  const unwrapCellValue = (value: ExcelJS.CellValue): ExcelJS.CellValue => {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value;
    if (typeof value === 'object') {
      const record = value as unknown as Record<string, unknown>;
      if (record.result !== undefined) return unwrapCellValue(record.result as ExcelJS.CellValue);
      if (record.text !== undefined) return unwrapCellValue(record.text as ExcelJS.CellValue);
      if (Array.isArray(record.richText)) {
        return record.richText
          .map(part => (typeof (part as Record<string, unknown>)?.text === 'string' ? (part as Record<string, unknown>).text : ''))
          .join('') as ExcelJS.CellValue;
      }
      if (record.hyperlink && record.text) return unwrapCellValue(record.text as ExcelJS.CellValue);
    }
    return value;
  };

  const cellToText = (value: ExcelJS.CellValue) => {
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

  const parseDateValue = (val: ExcelJS.CellValue): string => {
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

  const parseTimeValue = (val: ExcelJS.CellValue): string => {
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

  const parseNumberValue = (val: ExcelJS.CellValue): number => {
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
    setImportedMasterData({ empresas: [], equipamentos: [], comboios: [] });
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
      const equipmentRegistryRows: FuelEquipmentRegistryRow[] = [];
      const launchRegistryRows: FuelLaunchRegistryRow[] = [];

      const equipmentSheet = worksheetsToRead.find(ws => normalizeFuelMasterKey(ws.name) === 'equipamentos');
      if (equipmentSheet) {
        const headerLookup = new Map<string, number>();
        equipmentSheet.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
          headerLookup.set(normalizeFuelMasterKey(cellToText(cell.value)), col);
        });
        const valueFromEquipment = (row: ExcelJS.Row, key: string) => {
          const column = headerLookup.get(key);
          return column ? unwrapCellValue(row.getCell(column).value) : undefined;
        };
        equipmentSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          if (rowNumber === 1) return;
          equipmentRegistryRows.push({
            frota: valueFromEquipment(row, 'frota'),
            equipamento: valueFromEquipment(row, 'equipamento'),
            familia: valueFromEquipment(row, 'familia'),
            empresa: valueFromEquipment(row, 'empresa'),
            status: valueFromEquipment(row, 'status'),
            mobilizado: valueFromEquipment(row, 'mobilizado'),
            dataMob: valueFromEquipment(row, 'datamob'),
            dataDesmob: valueFromEquipment(row, 'datadesmob'),
            metaDispMec: valueFromEquipment(row, 'metadispmec'),
          });
        });
      }

      worksheetsToRead.forEach(ws => {
        if (!isFuelImportWorksheet(ws.name)) return;
        const headerCandidate = findHeaderRow(ws);
        const colMap = headerCandidate.rowNumber
          ? { ...FALLBACK_COLUMN_MAP, ...headerCandidate.map }
          : FALLBACK_COLUMN_MAP;
        const dataStartRow = headerCandidate.rowNumber ? headerCandidate.rowNumber + 1 : 1;
        const getCell = (row: ExcelJS.Row, key: string) => {
          const idx = colMap[key];
          return idx ? unwrapCellValue(row.getCell(idx).value) : undefined;
        };
        ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          if (rowNumber < dataStartRow) return;
          launchRegistryRows.push({
            prefixo: getCell(row, 'frota'),
            descricao: getCell(row, 'descricao') || getCell(row, 'frota'),
            empresa: getCell(row, 'empresa'),
            comboio: getCell(row, 'comboio'),
          });
        });
      });

      const masterData = buildFuelImportedMasterData({
        equipmentRows: equipmentRegistryRows,
        launchRows: launchRegistryRows,
        nowIso: new Date().toISOString(),
      });
      const equipamentosDisponiveis = [...equipamentos, ...masterData.equipamentos];
      const comboiosDisponiveis = [...comboios, ...masterData.comboios];

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
        if (!isFuelImportWorksheet(ws.name)) return;

        const colMap = headerCandidate.rowNumber
          ? { ...FALLBACK_COLUMN_MAP, ...headerCandidate.map }
          : FALLBACK_COLUMN_MAP;
        const dataStartRow = headerCandidate.rowNumber ? headerCandidate.rowNumber + 1 : 1;
        const fallbackMode = headerCandidate.score < 2;
        const getCell = (row: ExcelJS.Row, key: string) => {
          const idx = colMap[key];
          return idx ? unwrapCellValue(row.getCell(idx).value) : undefined;
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
          const comboioNorm = normalizeConvoyCode(comboioTexto);
          const eq = findEquipmentByPrefix(frotaTexto, equipamentosDisponiveis)
            || equipamentosDisponiveis.find(e => e.nome.toLowerCase() === frotaNorm);
          const fuelResolution = resolveFuelType(tipoCombustivelTexto);
          const comb = fuelResolution.fuel;
          const comboioExato = comboiosDisponiveis.find(c => normalizeConvoyCode(c.placa || c.nome) === comboioNorm || normalizeConvoyCode(c.nome) === comboioNorm);
          const comboiosParciais = comboioNorm
            ? comboiosDisponiveis.filter(c => {
              const candidate = normalizeConvoyCode(c.placa || c.nome);
              return comboioNorm.includes(candidate) || candidate.includes(comboioNorm);
            })
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
          let statusFinal: StatusRegistroCombustivel = 'OK';
          const bombaFinalCalculada = Number.isFinite(bombaInicial) && Number.isFinite(quantidade) ? bombaInicial + quantidade : NaN;
          if (Number.isFinite(bombaFinalPlanilha) && Number.isFinite(bombaFinalCalculada) && Math.abs(bombaFinalPlanilha - bombaFinalCalculada) > 0.01) {
            statusFinal = 'Verificar bomba';
          }

          // Identidade: Data + Prefixo + Litros + Hora + Bomba Inicial + Bomba Final.
          const dataFinal = dataStr;
          const competenciaPlanilha = fuelSheetCompetence(ws.name) || dataFinal.slice(0, 7);
          const horaFinal = normalizeQuickTime(horaStr).valid ? horaStr : '';
          const quantidadeFinal = Number.isFinite(quantidade) ? Number(quantidade.toFixed(4)) : NaN;
          const candidate: Partial<Abastecimento> = {
            data: dataFinal,
            hora: horaFinal,
            equipamentoId: eq?.id || '',
            prefixoInformado: frotaTexto.toUpperCase(),
            quantidadeLitros: quantidadeFinal,
            bombaInicial: Number.isFinite(bombaInicial) ? bombaInicial : undefined,
            bombaFinal: Number.isFinite(bombaFinal) ? bombaFinal : undefined,
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
            observacao: buildFuelImportObservation({
              sheetName: ws.name,
              rowNumber,
              observacao,
              empresaTexto,
              frotaTexto,
              equipmentFound: Boolean(eq),
              tipoCombustivelTexto,
              comboioTexto,
              responsavel,
              quantidadeFoiCalculada,
              motivo,
              rawRowText,
            }),
            status: motivo && statusFinal === 'OK' ? 'Conferência necessária' : statusFinal,
            origem: 'Planilha',
            documentoOrigemNome: file.name,
            documentoOrigemHash: dupKey,
            integracaoAba: ws.name,
            integracaoLinha: rowNumber,
            competencia: competenciaPlanilha,
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
      setImportedMasterData(masterData);
      setIsImportModalOpen(true);
    } catch (err: unknown) {
      console.error('Erro ao ler planilha:', err);
      setValidationError(err instanceof Error && err.message ? err.message : 'Não foi possível ler a planilha. Verifique se o arquivo é um .xlsx válido.');
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
    const applied = onImportAbastecimentos(validItems, importedFuelTypes.filter(item => usedFuelIds.has(item.id)), importedMasterData);
    if (applied.accepted > 0) setOpenFuelHistorySignal(signal => signal + 1);
    const cadastrosCriados = [
      applied.companiesCreated ? `${applied.companiesCreated} empresa(s)/locadora(s)` : '',
      applied.equipmentsCreated ? `${applied.equipmentsCreated} equipamento(s)` : '',
      applied.convoysCreated ? `${applied.convoysCreated} comboio(s)` : '',
      applied.fuelTypesCreated ? `${applied.fuelTypesCreated} tipo(s) de combustível` : '',
    ].filter(Boolean);
    setImportReport(`Importação concluída: ${applied.accepted} de ${applied.requested} abastecimento(s) publicado(s); ${applied.rejected + importSummary.duplicadas + importSummary.ignoradas + importSummary.comErro} registro(s) não foram publicados. Total no histórico: ${applied.totalAfter}.${cadastrosCriados.length ? ` Também cadastrou ${cadastrosCriados.join(', ')}.` : ''}`);
    setIsConfirmingImport(false);
    setIsImportModalOpen(false);
    setImportRows([]);
    setImportFileName('');
    setImportedFuelTypes([]);
    setImportedMasterData({ empresas: [], equipamentos: [], comboios: [] });
  };

  const handleCancelImport = () => {
    setIsImportModalOpen(false);
    setImportRows([]);
    setImportFileName('');
    setImportedFuelTypes([]);
    setImportedMasterData({ empresas: [], equipamentos: [], comboios: [] });
  };

  // Formulário da Lubrificação. O abastecimento é lançado no CombustivelOperacionalTab.
  const [date, setDate] = useState(isoDay(new Date()));
  const [time, setTime] = useState('08:00');
  const [equipamentoId, setEquipamentoId] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [observacao, setObservacao] = useState('');
  const [lubHorimetro, setLubHorimetro] = useState<number>(0);
  const [produtoLubrificacaoId, setProdutoLubrificacaoId] = useState('');
  const [compartimento, setCompartimento] = useState('Pinos do Braço / Caçamba');
  const [lubQuantidade, setLubQuantidade] = useState<number>(1);

  const selectedEquipment = equipamentos.find(e => e.id === equipamentoId);
  const derivedEquipmentDesc = selectedEquipment ? `${selectedEquipment.marca} ${selectedEquipment.modelo}` : '';
  const derivedCompany = selectedEquipment ? empresas.find(em => em.id === selectedEquipment.empresaId)?.nome : '';

  const resetFormFields = () => {
    setEditingId(null);
    setValidationError('');
    setDate(isoDay(new Date()));
    setTime(new Date().toTimeString().split(' ')[0].substring(0, 5));
    setEquipamentoId('');
    setResponsavel('');
    setObservacao('');
    setLubHorimetro(0);
    setProdutoLubrificacaoId(lubrificantes[0]?.id || '');
    setCompartimento('Pinos do Braço / Caçamba');
    setLubQuantidade(1);
  };

  const handleOpenCreate = () => {
    resetFormFields();
    setIsFormOpen(true);
  };

  // Mesmo padrão do Combustível: N lança, / busca.
  useEffect(() => {
    if (mode !== 'lubrificacoes' || isFormOpen) return undefined;
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        handleOpenCreate();
      } else if (event.key === '/') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [mode, isFormOpen]);

  const handleOpenEdit = (x: Lubrificacao) => {
    resetFormFields();
    setEditingId(x.id);
    setDate(x.data); setTime(x.hora); setEquipamentoId(x.equipamentoId);
    setLubHorimetro(x.horimetro); setProdutoLubrificacaoId(x.produtoLubrificacaoId);
    setCompartimento(x.compartimento); setLubQuantidade(x.quantidade);
    setResponsavel(x.responsavel); setObservacao(x.observacao);
    setIsFormOpen(true);
  };

  // Salva. Com `keepOpen` (Salvar e lançar outra) produto, compartimento e
  // responsável continuam e o foco volta para a máquina.
  const submitForm = (keepOpen: boolean) => {
    setValidationError('');
    const isNew = editingId === null;
    if (!equipamentoId || !responsavel.trim() || lubQuantidade <= 0) {
      setValidationError('Preencha a máquina, a quantidade e o responsável.');
      return;
    }
    onSaveLubrificacao({
      id: isNew ? `txn-${Date.now()}` : editingId!,
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

    if (keepOpen && isNew) {
      const preservedProduto = produtoLubrificacaoId;
      const preservedCompartimento = compartimento;
      const preservedResponsavel = responsavel;
      resetFormFields();
      setProdutoLubrificacaoId(preservedProduto);
      setCompartimento(preservedCompartimento);
      setResponsavel(preservedResponsavel);
      requestAnimationFrame(() => equipamentoFieldRef.current?.focus());
      return;
    }
    setIsFormOpen(false);
    resetFormFields();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitForm(false);
  };

  const handleSaveAndNew = () => {
    submitForm(true);
  };

  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsFormOpen(false);
      resetFormFields();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      submitForm(false);
    }
  };

  // Busca
  const q = searchQuery.toLowerCase().trim();

  const filteredLubrificacoes = lubrificacoes.filter(lub => {
    const eq = equipamentos.find(e => e.id === lub.equipamentoId);
    return lub.data.includes(q) || lub.compartimento.toLowerCase().includes(q) || (eq && eq.prefixo.toLowerCase().includes(q));
  }).sort((a,b) => b.data.localeCompare(a.data));

  const colunasLubrificacao: ColunaTabela<Lubrificacao>[] = [
    { chave: 'data', titulo: 'Data', render: lub => <><span className="block font-bold text-slate-800">{lub.data.split('-').reverse().join('/')}</span><span className="block text-xs text-[#5b6870]">{lub.hora}</span></>, valorOrdenacao: lub => `${lub.data}${lub.hora}` },
    {
      chave: 'maquina', titulo: 'Máquina', larguraMinima: 160,
      render: lub => { const eq = equipamentos.find(e => e.id === lub.equipamentoId); return <><span className="block font-mono font-black text-slate-950">{eq?.prefixo || 'Sem cadastro'}</span><span className="block truncate text-xs text-[#5b6870]">{eq?.nome || ''}</span></>; },
      valorOrdenacao: lub => equipamentos.find(e => e.id === lub.equipamentoId)?.prefixo,
    },
    { chave: 'produto', titulo: 'Produto', render: lub => lubrificantes.find(p => p.id === lub.produtoLubrificacaoId)?.nome || '—', valorOrdenacao: lub => lubrificantes.find(p => p.id === lub.produtoLubrificacaoId)?.nome },
    { chave: 'compartimento', titulo: 'Onde aplicou', render: lub => lub.compartimento, valorOrdenacao: lub => lub.compartimento },
    { chave: 'quantidade', titulo: 'Quantidade', alinhamento: 'direita', render: lub => <span className="font-black text-[#176b4d]">{lub.quantidade.toLocaleString('pt-BR')} L/kg</span>, valorOrdenacao: lub => lub.quantidade },
    { chave: 'horimetro', titulo: 'Horímetro', alinhamento: 'direita', render: lub => (lub.horimetro > 0 ? `${lub.horimetro.toLocaleString('pt-BR')} h` : '—'), valorOrdenacao: lub => lub.horimetro || null },
    { chave: 'responsavel', titulo: 'Responsável', render: lub => lub.responsavel, valorOrdenacao: lub => lub.responsavel, noCartao: false },
  ];

  // Cascata curta nas linhas da lista. O hook fica antes do primeiro retorno
  // condicional para manter a ordem dos hooks estável entre os dois modos.
  useGSAP(() => {
    const root = moduleRef.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rows = root.querySelectorAll('[data-linha-lista]');
    if (!rows.length) return;
    gsap.fromTo(
      rows,
      { autoAlpha: 0, y: 8 },
      { autoAlpha: 1, y: 0, duration: 0.32, stagger: 0.022, ease: 'power2.out', clearProps: 'transform,opacity,visibility' },
    );
  }, { scope: moduleRef, dependencies: [mode, filteredLubrificacoes.length] });

  if (String(mode) === 'abastecimentos') {
    return (
      <div ref={moduleRef}>
        {validationError && (
          <div className="mb-4 flex items-start gap-3 border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-700">
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
        <CombustivelOperacionalTab
          empresas={empresas}
          equipamentos={equipamentos}
          comboios={comboios}
          combustiveis={combustiveis}
          canteiros={canteiros}
          abastecimentos={abastecimentos}
          onSaveAbastecimento={onSaveAbastecimento}
          onSaveAbastecimentos={onSaveAbastecimentos}
          onDeleteAbastecimento={onDeleteAbastecimento}
          onDeleteAbastecimentos={onDeleteAbastecimentos}
          onRestaurarAbastecimentos={onRestaurarAbastecimentos}
          onImportAbastecimentos={onImportAbastecimentos}
          onOpenLubrificacao={() => {
            setMode('lubrificacoes');
            setIsFormOpen(false);
            setSearchQuery('');
            resetFormFields();
          }}
          onOpenCadastros={onOpenCadastros}
          onOpenControle={onOpenControle}
          registros={registrosFrota}
          gruposEquipe={gruposEquipe}
          usuario={usuario}
          onOpenSpreadsheetImport={() => fileInputRef.current?.click()}
          isParsingSpreadsheet={isParsingImport}
          openHistorySignal={openFuelHistorySignal}
          initialView={combustivelInicial}
          listaSomente={combustivelListaSomente}
          porMaquinaInicial={combustivelPorMaquina}
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
      </div>
    );
  }

  // Lubrificação: aba escondida que o botão de gota do Combustível abre.
  // Mesmo molde do Combustível (TelaCheia + PageHeader + TabelaPadrao).
  const voltarAoCombustivel = () => {
    setMode('abastecimentos');
    setIsFormOpen(false);
    setSearchQuery('');
    resetFormFields();
  };
  const campo = (rotulo: string, controle: React.ReactNode, classe = '') => (
    <label className={`block ${classe}`}>
      <span className={`${ROTULO} mb-1 block`}>{rotulo}</span>
      {controle}
    </label>
  );

  return (
    <TelaCheia
      ref={moduleRef}
      id="lancamentos-tab"
      rotulo="Lubrificação"
      idDados="lubrificacao-dados"
      cabecalho={(
        <PageHeader
          eyebrow="Frota"
          title="Lubrificação"
          actions={<>
            <button type="button" onClick={voltarAoCombustivel} className={BOTAO_SECUNDARIO} data-testid="lubrificacao-voltar">
              <Fuel className="size-4" aria-hidden="true" />Combustível
            </button>
            <button type="button" onClick={handleOpenCreate} className={BOTAO_PRIMARIO} data-testid="lubrificacao-nova">
              <Plus className="size-4" aria-hidden="true" />Nova lubrificação
              <kbd className="hidden rounded-md bg-white/15 px-1.5 font-mono text-xs xl:inline">N</kbd>
            </button>
          </>}
        />
      )}
      faixa={(
        <label className="relative block">
          <span className="sr-only">Buscar lubrificação</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="search"
            placeholder="Buscar por data, compartimento ou prefixo…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`${CAMPO} pl-9`}
          />
        </label>
      )}
    >
      {isFormOpen && (
        <section aria-labelledby="lubrificacao-form-titulo" className={`${CARTAO} mb-2 shrink-0 p-4`} id="log-editor-card">
          <div className="mb-3 flex items-start justify-between gap-2">
            <h2 id="lubrificacao-form-titulo" className="text-base font-black text-slate-950">{editingId ? 'Corrigir lubrificação' : 'Nova lubrificação'}</h2>
            <button type="button" onClick={() => { setIsFormOpen(false); resetFormFields(); }} aria-label="Fechar sem salvar" className={`grid size-10 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 ${FOCO}`}>
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {campo('Data *', <input type="date" value={date} onChange={e => setDate(e.target.value)} className={CAMPO} required />)}
              {campo('Hora *', <input type="time" value={time} onChange={e => setTime(e.target.value)} className={CAMPO} required />)}
              {campo('Máquina *', (
                <select ref={equipamentoFieldRef} value={equipamentoId} onChange={e => setEquipamentoId(e.target.value)} className={CAMPO} required>
                  <option value="">Escolha a máquina</option>
                  {equipamentos.map(eq => <option key={eq.id} value={eq.id}>{eq.prefixo} — {eq.nome}</option>)}
                </select>
              ))}
              {campo('Produto *', (
                <select value={produtoLubrificacaoId} onChange={e => setProdutoLubrificacaoId(e.target.value)} className={CAMPO} required>
                  <option value="">Escolha o produto</option>
                  {lubrificantes.map(pl => <option key={pl.id} value={pl.id}>{pl.nome}</option>)}
                </select>
              ))}
            </div>
            {selectedEquipment && (
              <p className="text-sm text-[#5b6870]">{derivedEquipmentDesc}{derivedCompany ? ` · ${derivedCompany}` : ''}</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {campo('Horímetro', <input type="number" inputMode="decimal" value={lubHorimetro || ''} onChange={e => setLubHorimetro(Number(e.target.value))} placeholder="0" className={CAMPO} />)}
              {campo('Onde aplicou *', <input type="text" value={compartimento} onChange={e => setCompartimento(e.target.value)} placeholder="Ex.: cárter do motor, pinos" className={CAMPO} required />)}
              {campo('Quantidade (L ou kg) *', <input type="number" inputMode="decimal" step="any" value={lubQuantidade} onChange={e => setLubQuantidade(Number(e.target.value))} className={CAMPO} required />)}
              {campo('Responsável *', <input type="text" value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Quem fez" className={CAMPO} required />)}
            </div>
            {campo('Observação', <input type="text" value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Ex.: trocou o filtro de óleo junto" className={CAMPO} />)}
            {validationError && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 ring-1 ring-inset ring-rose-200">{validationError}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" className={BOTAO_PRIMARIO}>{editingId ? 'Salvar correção' : 'Salvar'}</button>
              {!editingId && <button type="button" onClick={handleSaveAndNew} className={BOTAO_SECUNDARIO}>Salvar e lançar outra</button>}
              <button type="button" onClick={() => { setIsFormOpen(false); resetFormFields(); }} className={BOTAO_SECUNDARIO}>Cancelar</button>
              <span className="ml-auto text-xs font-semibold text-[#5b6870] max-sm:hidden">Ctrl+Enter salva · Esc cancela</span>
            </div>
          </form>
        </section>
      )}

      <TabelaPadrao
        titulo="Lubrificações lançadas"
        linhas={filteredLubrificacoes}
        colunas={colunasLubrificacao}
        idDaLinha={lub => lub.id}
        nomeDoItem={{ um: 'lubrificação', varios: 'lubrificações' }}
        linhaAtivaId={editingId}
        onAbrirLinha={handleOpenEdit}
        acoes={lub => <>
          <button type="button" onClick={() => handleOpenEdit(lub)} aria-label={`Corrigir lubrificação de ${equipamentos.find(e => e.id === lub.equipamentoId)?.prefixo || 'máquina'}`} className={`grid size-8 place-items-center rounded-lg text-slate-700 hover:bg-emerald-50 hover:text-[#176b4d] ${FOCO}`}><Edit className="size-4" aria-hidden="true" /></button>
          {onDeleteLubrificacao && <button type="button" onClick={() => setDeleteConfirmId(lub.id)} aria-label={`Excluir lubrificação de ${equipamentos.find(e => e.id === lub.equipamentoId)?.prefixo || 'máquina'}`} className={`grid size-8 place-items-center rounded-lg text-slate-700 hover:bg-rose-50 hover:text-rose-700 ${FOCO}`}><Trash2 className="size-4" aria-hidden="true" /></button>}
        </>}
        vazio={searchQuery ? 'Nenhuma lubrificação com essa busca.' : 'Nenhuma lubrificação lançada ainda. Toque em "Nova lubrificação".'}
        testId="lubrificacao-lista"
      />

      <ConfirmDialog
        open={deleteConfirmId !== null}
        tone="danger"
        title="Excluir esta lubrificação?"
        description="O registro sai da lista e dos totais e não volta pela sincronização."
        confirmLabel="Excluir"
        onConfirm={() => { if (deleteConfirmId) onDeleteLubrificacao?.(deleteConfirmId); setDeleteConfirmId(null); }}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </TelaCheia>
  );
}
