/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ExcelJS from 'exceljs';
import { addCorporateSummarySheet, configureCorporateWorkbook, downloadCorporateWorkbook, loadValidatedWorkbook, styleCorporateWorksheet } from '../utils/excelCorporate';
import {
  Archive,
  BarChart3,
  Download,
  Edit,
  FileSpreadsheet,
  FilterX,
  MapPin,
  Package,
  Plus,
  Save,
  Search,
  Trash2,
  Truck,
  Upload,
  X
} from 'lucide-react';
import {
  MaterialCadastro,
  MaterialCategoria,
  MaterialRegistro,
  MaterialStatus
} from '../types';

interface MateriaisTabProps {
  materiais: MaterialCadastro[];
  registros: MaterialRegistro[];
  onSaveMaterial: (item: MaterialCadastro, isNew: boolean) => void;
  onDeleteMaterial: (id: string) => void;
  onSaveRegistro: (item: MaterialRegistro, isNew: boolean) => void;
  onDeleteRegistro: (id: string) => void;
  onImportRegistros: (registros: MaterialRegistro[], materiais: MaterialCadastro[]) => { success: boolean; message: string };
}

type SubTab = 'dashboard' | 'registros' | 'materiais' | 'resumo';
type SortMode = 'data_desc' | 'data_asc' | 'valor_desc' | 'quantidade_desc';

const CATEGORIAS: MaterialCategoria[] = ['Agregado', 'Solo', 'Bota fora', 'Resíduo', 'Operacional', 'Outros'];
const STATUS_REGISTRO: MaterialStatus[] = ['Conferido', 'Pendente', 'Divergência', 'Cancelado'];
const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const todayInput = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0];
};

const normalize = (value: string = '') =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const cleanText = (value: unknown) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().split('T')[0];
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
  if (typeof value === 'object') {
    const anyValue = value as any;
    if (anyValue.result !== undefined) return cleanText(anyValue.result);
    if (anyValue.text !== undefined) return cleanText(anyValue.text);
    if (Array.isArray(anyValue.richText)) return anyValue.richText.map((part: any) => part.text || '').join('').trim();
    if (anyValue.hyperlink && anyValue.text) return cleanText(anyValue.text);
  }
  return String(value).trim().replace(/\s+/g, ' ');
};

const toNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return Number(value.toFixed(4));
  const raw = cleanText(value).replace(/\s/g, '');
  const text = raw.includes(',') && raw.includes('.')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw.replace(',', '.');
  const num = Number(text);
  return Number.isFinite(num) ? Number(num.toFixed(4)) : 0;
};

const excelSerialToIso = (serial: number) => {
  if (!Number.isFinite(serial) || serial < 30000 || serial > 60000) return '';
  const date = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
  return date.toISOString().split('T')[0];
};

const toIsoDate = (value: unknown) => {
  if (value instanceof Date) return value.toISOString().split('T')[0];
  if (typeof value === 'number') return excelSerialToIso(value);
  const text = cleanText(value);
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const br = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${year}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  }
  return '';
};

const formatDate = (date: string) => date ? date.split('-').reverse().join('/') : '-';
const formatNumber = (value: number = 0) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value || 0);
const formatCurrency = (value: number = 0) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const compact = (item: MaterialRegistro): MaterialRegistro => {
  const out: MaterialRegistro = {
    id: item.id,
    data: item.data,
    aba: item.aba || 'Manual',
    material: item.material.trim(),
    unidade: item.unidade.trim() || 'UN',
    quantidade: Math.max(0, Number(item.quantidade) || 0)
  };
  const optional: Array<[keyof MaterialRegistro, any]> = [
    ['suporte', item.suporte],
    ['fornecedor', item.fornecedor?.trim()],
    ['placa', item.placa?.trim()],
    ['prefixo', item.prefixo?.trim()],
    ['nota', item.nota?.trim()],
    ['origem', item.origem?.trim()],
    ['destino', item.destino?.trim()],
    ['valorUnitario', item.valorUnitario],
    ['total', item.total],
    ['volumeCacamba', item.volumeCacamba],
    ['totalM3', item.totalM3],
    ['status', item.status],
    ['observacao', item.observacao?.trim()],
    ['criadoEm', item.criadoEm],
    ['atualizadoEm', item.atualizadoEm]
  ];
  optional.forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 0) {
      (out as any)[key] = value;
    }
  });
  return out;
};

const classifyMaterial = (material: string): MaterialCategoria => {
  const text = normalize(material).toUpperCase();
  if (text.includes('LIXO') || text.includes('CONTAMINADO')) return 'Resíduo';
  if (text.includes('SOLO') || text.includes('SAIBRO') || text.includes('TURFA')) return 'Solo';
  if (text.includes('REJEITO') || text.includes('FREZA')) return 'Operacional';
  if (text.includes('RACHA') || text.includes('BRITA') || text.includes('AREIA') || text.includes('BICA') || text.includes('MACADAME')) return 'Agregado';
  return 'Outros';
};

const buildCatalogFromRegistros = (items: MaterialRegistro[]): MaterialCadastro[] => {
  const map = new Map<string, { nome: string; unidades: Map<string, number>; fornecedores: Map<string, number>; valores: number[] }>();
  items.forEach(item => {
    const key = normalize(item.material);
    if (!key) return;
    const current = map.get(key) || { nome: item.material, unidades: new Map(), fornecedores: new Map(), valores: [] };
    current.unidades.set(item.unidade || 'UN', (current.unidades.get(item.unidade || 'UN') || 0) + 1);
    if (item.fornecedor) current.fornecedores.set(item.fornecedor, (current.fornecedores.get(item.fornecedor) || 0) + 1);
    if (item.valorUnitario) current.valores.push(item.valorUnitario);
    map.set(key, current);
  });

  return Array.from(map.values())
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((item, index) => {
      const unidadePadrao = Array.from(item.unidades.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'UN';
      const fornecedorPadrao = Array.from(item.fornecedores.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
      const valorReferencia = item.valores.length
        ? Number((item.valores.reduce((sum, value) => sum + value, 0) / item.valores.length).toFixed(2))
        : undefined;
      return {
        id: `mc-import-${Date.now()}-${index}`,
        nome: item.nome,
        categoria: classifyMaterial(item.nome),
        unidadePadrao,
        fornecedorPadrao,
        valorReferencia,
        status: 'Ativo' as const
      };
    });
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const emptyMaterial = (): MaterialCadastro => ({
  id: `mc-${Date.now()}`,
  nome: '',
  categoria: 'Agregado',
  unidadePadrao: 'TON',
  status: 'Ativo',
  fornecedorPadrao: '',
  observacao: ''
});

const emptyRegistro = (materiais: MaterialCadastro[]): MaterialRegistro => {
  const material = materiais.find(item => item.status === 'Ativo') || materiais[0];
  return {
    id: `mat-${Date.now()}`,
    data: todayInput(),
    aba: 'Manual',
    material: material?.nome || '',
    unidade: material?.unidadePadrao || 'TON',
    quantidade: 0,
    fornecedor: material?.fornecedorPadrao || '',
    destino: '',
    status: 'Conferido'
  };
};

export default function MateriaisTab({
  materiais,
  registros,
  onSaveMaterial,
  onDeleteMaterial,
  onSaveRegistro,
  onDeleteRegistro,
  onImportRegistros
}: MateriaisTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('dashboard');
  const [search, setSearch] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [fMaterial, setFMaterial] = useState('todos');
  const [fFornecedor, setFFornecedor] = useState('todos');
  const [fLocal, setFLocal] = useState('todos');
  const [fAba, setFAba] = useState('todos');
  const [fStatus, setFStatus] = useState('todos');
  const [sortMode, setSortMode] = useState<SortMode>('data_desc');
  const [showFilters, setShowFilters] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  const [isMaterialFormOpen, setIsMaterialFormOpen] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [materialForm, setMaterialForm] = useState<MaterialCadastro>(emptyMaterial());

  const [isRegistroFormOpen, setIsRegistroFormOpen] = useState(false);
  const [editingRegistroId, setEditingRegistroId] = useState<string | null>(null);
  const [registroForm, setRegistroForm] = useState<MaterialRegistro>(emptyRegistro(materiais));

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const materialOptions = useMemo(() => Array.from(new Set([
    ...materiais.map(item => item.nome),
    ...registros.map(item => item.material)
  ].filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [materiais, registros]);

  const fornecedores = useMemo(() => Array.from(new Set(registros.map(item => item.fornecedor).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, 'pt-BR')), [registros]);
  const abas = useMemo(() => Array.from(new Set(registros.map(item => item.aba).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [registros]);
  const locais = useMemo(() => Array.from(new Set(registros.flatMap(item => [item.origem, item.destino]).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, 'pt-BR')), [registros]);

  const filteredRegistros = useMemo(() => {
    const q = normalize(search);
    return registros.filter(item => {
      if (dataInicio && item.data < dataInicio) return false;
      if (dataFim && item.data > dataFim) return false;
      if (fMaterial !== 'todos' && item.material !== fMaterial) return false;
      if (fFornecedor !== 'todos' && item.fornecedor !== fFornecedor) return false;
      if (fLocal !== 'todos' && item.origem !== fLocal && item.destino !== fLocal) return false;
      if (fAba !== 'todos' && item.aba !== fAba) return false;
      if (fStatus !== 'todos' && (item.status || 'Conferido') !== fStatus) return false;
      if (!q) return true;
      return normalize([
        item.data,
        item.aba,
        item.material,
        item.unidade,
        item.fornecedor,
        item.placa,
        item.prefixo,
        item.nota,
        item.origem,
        item.destino,
        item.observacao
      ].join(' ')).includes(q);
    }).sort((a, b) => {
      if (sortMode === 'data_asc') return a.data.localeCompare(b.data);
      if (sortMode === 'valor_desc') return (b.total || 0) - (a.total || 0);
      if (sortMode === 'quantidade_desc') return (b.quantidade || 0) - (a.quantidade || 0);
      return b.data.localeCompare(a.data);
    });
  }, [abas, dataFim, dataInicio, fAba, fFornecedor, fLocal, fMaterial, fStatus, registros, search, sortMode]);

  useEffect(() => setPage(1), [search, dataInicio, dataFim, fMaterial, fFornecedor, fLocal, fAba, fStatus, sortMode, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredRegistros.length / pageSize));
  const pageItems = filteredRegistros.slice((page - 1) * pageSize, page * pageSize);

  const totals = useMemo(() => {
    const valor = filteredRegistros.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    const toneladas = filteredRegistros
      .filter(item => normalize(item.unidade).includes('ton'))
      .reduce((sum, item) => sum + (Number(item.quantidade) || 0), 0);
    const m3 = filteredRegistros.reduce((sum, item) => {
      const byUnit = normalize(item.unidade).includes('m3') || item.unidade.includes('³') ? Number(item.quantidade) || 0 : 0;
      return sum + byUnit + (Number(item.totalM3) || 0);
    }, 0);
    return { valor, toneladas, m3 };
  }, [filteredRegistros]);

  const resumoPorLocal = useMemo(() => {
    const map = new Map<string, { local: string; registros: number; quantidade: number; m3: number; valor: number; materiais: Map<string, number> }>();
    filteredRegistros.forEach(item => {
      const local = item.destino || item.origem || 'Não informado';
      const current = map.get(local) || { local, registros: 0, quantidade: 0, m3: 0, valor: 0, materiais: new Map() };
      current.registros += 1;
      current.quantidade += Number(item.quantidade) || 0;
      current.m3 += (Number(item.totalM3) || 0) + ((normalize(item.unidade).includes('m3') || item.unidade.includes('³')) ? Number(item.quantidade) || 0 : 0);
      current.valor += Number(item.total) || 0;
      current.materiais.set(item.material, (current.materiais.get(item.material) || 0) + (Number(item.quantidade) || 0));
      map.set(local, current);
    });
    return Array.from(map.values())
      .map(item => ({
        ...item,
        principalMaterial: Array.from(item.materiais.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'
      }))
      .sort((a, b) => b.valor - a.valor || b.quantidade - a.quantidade);
  }, [filteredRegistros]);

  const resumoPorMaterial = useMemo(() => {
    const map = new Map<string, { material: string; registros: number; quantidade: number; valor: number; unidade: string }>();
    filteredRegistros.forEach(item => {
      const current = map.get(item.material) || { material: item.material, registros: 0, quantidade: 0, valor: 0, unidade: item.unidade };
      current.registros += 1;
      current.quantidade += Number(item.quantidade) || 0;
      current.valor += Number(item.total) || 0;
      current.unidade = current.unidade || item.unidade;
      map.set(item.material, current);
    });
    return Array.from(map.values()).sort((a, b) => b.valor - a.valor || b.quantidade - a.quantidade);
  }, [filteredRegistros]);

  const openCreateMaterial = () => {
    setEditingMaterialId(null);
    setMaterialForm(emptyMaterial());
    setIsMaterialFormOpen(true);
    setSubTab('materiais');
  };

  const openEditMaterial = (item: MaterialCadastro) => {
    setEditingMaterialId(item.id);
    setMaterialForm({ ...item });
    setIsMaterialFormOpen(true);
    setSubTab('materiais');
  };

  const saveMaterial = () => {
    if (!materialForm.nome.trim() || !materialForm.unidadePadrao.trim()) {
      setFeedback({ type: 'error', message: 'Informe o nome e a unidade padrão do material.' });
      return;
    }
    onSaveMaterial({
      ...materialForm,
      id: editingMaterialId || materialForm.id || `mc-${Date.now()}`,
      nome: materialForm.nome.trim(),
      unidadePadrao: materialForm.unidadePadrao.trim().toUpperCase(),
      fornecedorPadrao: materialForm.fornecedorPadrao?.trim(),
      valorReferencia: Number(materialForm.valorReferencia) || undefined,
      densidade: Number(materialForm.densidade) || undefined,
      observacao: materialForm.observacao?.trim()
    }, editingMaterialId === null);
    setIsMaterialFormOpen(false);
    setEditingMaterialId(null);
    setFeedback({ type: 'success', message: 'Material salvo com sucesso.' });
  };

  const openCreateRegistro = () => {
    setEditingRegistroId(null);
    setRegistroForm(emptyRegistro(materiais));
    setIsRegistroFormOpen(true);
    setSubTab('registros');
  };

  const openEditRegistro = (item: MaterialRegistro) => {
    setEditingRegistroId(item.id);
    setRegistroForm(JSON.parse(JSON.stringify(item)) as MaterialRegistro);
    setIsRegistroFormOpen(true);
    setSubTab('registros');
  };

  const saveRegistro = () => {
    if (!registroForm.data || !registroForm.material.trim() || !registroForm.unidade.trim()) {
      setFeedback({ type: 'error', message: 'Informe data, material e unidade.' });
      return;
    }
    const quantidade = Math.max(0, Number(registroForm.quantidade) || 0);
    const valorUnitario = Number(registroForm.valorUnitario) || 0;
    const total = Number(registroForm.total) || (valorUnitario && quantidade ? Number((valorUnitario * quantidade).toFixed(2)) : 0);
    onSaveRegistro(compact({
      ...registroForm,
      id: editingRegistroId || registroForm.id || `mat-${Date.now()}`,
      quantidade,
      valorUnitario,
      total,
      atualizadoEm: new Date().toISOString(),
      criadoEm: registroForm.criadoEm || new Date().toISOString()
    }), editingRegistroId === null);
    setIsRegistroFormOpen(false);
    setEditingRegistroId(null);
    setFeedback({ type: 'success', message: 'Lançamento de material salvo com sucesso.' });
  };

  const parseWorksheetRows = (worksheet: ExcelJS.Worksheet): MaterialRegistro[] => {
    const imported: MaterialRegistro[] = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const date = toIsoDate(row.getCell(2).value);
      if (!date) return;
      const id = `mat-import-${Date.now()}-${worksheet.id}-${rowNumber}-${Math.floor(Math.random() * 10000)}`;
      if (worksheet.name === 'LANÇ_MAT-RENEA') {
        const material = cleanText(row.getCell(4).value);
        const quantidade = toNumber(row.getCell(6).value);
        const totalM3 = toNumber(row.getCell(8).value);
        if (!material || (quantidade === 0 && totalM3 === 0)) return;
        imported.push(compact({
          id,
          data: date,
          aba: worksheet.name,
          material,
          unidade: cleanText(row.getCell(5).value) || 'M³',
          quantidade,
          fornecedor: 'RENEA',
          prefixo: cleanText(row.getCell(3).value),
          origem: cleanText(row.getCell(9).value),
          destino: cleanText(row.getCell(10).value),
          volumeCacamba: toNumber(row.getCell(7).value),
          totalM3,
          status: 'Conferido'
        }));
        return;
      }

      const material = cleanText(row.getCell(3).value);
      const quantidade = toNumber(row.getCell(5).value);
      if (!material || quantidade === 0) return;
      const noUnitValue = worksheet.name === 'BOTA FORA (ITAQUAREIA)' || worksheet.name === 'Q.E.SÃO BENTO SPE LTDA';
      const local = cleanText(row.getCell(10).value);
      imported.push(compact({
        id,
        data: date,
        aba: worksheet.name,
        material,
        unidade: cleanText(row.getCell(4).value) || 'TON',
        quantidade,
        suporte: toNumber(row.getCell(6).value),
        fornecedor: cleanText(row.getCell(7).value) || (worksheet.name.includes('BOTA FORA') || worksheet.name.includes('SÃO BENTO') ? 'RENEA' : ''),
        placa: cleanText(row.getCell(8).value),
        nota: cleanText(row.getCell(9).value),
        origem: worksheet.name.includes('BOTA FORA') || worksheet.name.includes('SÃO BENTO') ? local : '',
        destino: local,
        valorUnitario: noUnitValue ? 0 : toNumber(row.getCell(11).value),
        total: noUnitValue ? toNumber(row.getCell(11).value) : toNumber(row.getCell(12).value),
        status: 'Conferido'
      }));
    });
    return imported;
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setIsImporting(true);
    setFeedback(null);
    try {
      const workbook = await loadValidatedWorkbook(file);
      const imported = workbook.worksheets
        .filter(sheet => !['RES_GERAL', 'Planilha1'].includes(sheet.name))
        .flatMap(sheet => parseWorksheetRows(sheet));
      if (imported.length === 0) {
        setFeedback({ type: 'error', message: 'Nenhum lançamento válido foi encontrado na planilha.' });
        return;
      }
      if (!window.confirm(`${imported.length} lançamento(s) válido(s) foram encontrados em ${file.name}. Confirma a importação para o banco de dados?`)) {
        setFeedback({ type: 'error', message: 'Importação cancelada. Nenhum registro foi alterado.' });
        return;
      }
      const importedMateriais = buildCatalogFromRegistros(imported);
      const result = onImportRegistros(imported, importedMateriais);
      setFeedback({ type: result.success ? 'success' : 'error', message: result.message });
    } catch (error: any) {
      setFeedback({ type: 'error', message: `Falha ao importar planilha: ${error.message || error}` });
    } finally {
      setIsImporting(false);
    }
  };

  const exportExcel = async () => {
    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      configureCorporateWorkbook(workbook, 'Controle de Materiais');

      const ws = workbook.addWorksheet('Lancamentos');
      ws.columns = [
        { header: 'Data', key: 'data', width: 13 },
        { header: 'Aba', key: 'aba', width: 24 },
        { header: 'Material', key: 'material', width: 24 },
        { header: 'Unidade', key: 'unidade', width: 10 },
        { header: 'Quantidade', key: 'quantidade', width: 14 },
        { header: 'Fornecedor', key: 'fornecedor', width: 20 },
        { header: 'Placa', key: 'placa', width: 14 },
        { header: 'Prefixo', key: 'prefixo', width: 12 },
        { header: 'Nota', key: 'nota', width: 14 },
        { header: 'Origem', key: 'origem', width: 28 },
        { header: 'Destino', key: 'destino', width: 32 },
        { header: 'Valor Unit.', key: 'valorUnitario', width: 14 },
        { header: 'Total R$', key: 'total', width: 14 },
        { header: 'Vol. Caçamba', key: 'volumeCacamba', width: 14 },
        { header: 'Total M³', key: 'totalM3', width: 14 },
        { header: 'Status', key: 'status', width: 14 },
        { header: 'Observação', key: 'observacao', width: 30 }
      ];
      filteredRegistros.forEach(item => ws.addRow({
        data: formatDate(item.data),
        aba: item.aba,
        material: item.material,
        unidade: item.unidade,
        quantidade: item.quantidade,
        fornecedor: item.fornecedor || '',
        placa: item.placa || '',
        prefixo: item.prefixo || '',
        nota: item.nota || '',
        origem: item.origem || '',
        destino: item.destino || '',
        valorUnitario: item.valorUnitario || 0,
        total: item.total || 0,
        volumeCacamba: item.volumeCacamba || 0,
        totalM3: item.totalM3 || 0,
        status: item.status || 'Conferido',
        observacao: item.observacao || ''
      }));
      ws.views = [{ state: 'frozen', ySplit: 1 }];
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
      ws.autoFilter = `A1:Q${Math.max(1, ws.rowCount)}`;

      const resumoWs = workbook.addWorksheet('Resumo por Local');
      resumoWs.columns = [
        { header: 'Local / Ramo', key: 'local', width: 34 },
        { header: 'Registros', key: 'registros', width: 12 },
        { header: 'Quantidade', key: 'quantidade', width: 14 },
        { header: 'Total M³', key: 'm3', width: 14 },
        { header: 'Valor R$', key: 'valor', width: 16 },
        { header: 'Principal Material', key: 'principalMaterial', width: 24 }
      ];
      resumoPorLocal.forEach(item => resumoWs.addRow(item));
      resumoWs.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      resumoWs.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };

      const matWs = workbook.addWorksheet('Materiais');
      matWs.columns = [
        { header: 'Material', key: 'nome', width: 28 },
        { header: 'Categoria', key: 'categoria', width: 16 },
        { header: 'Unidade', key: 'unidadePadrao', width: 12 },
        { header: 'Densidade', key: 'densidade', width: 12 },
        { header: 'Valor Ref.', key: 'valorReferencia', width: 14 },
        { header: 'Fornecedor', key: 'fornecedorPadrao', width: 22 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Observação', key: 'observacao', width: 30 }
      ];
      materiais.forEach(item => matWs.addRow(item));
      matWs.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      matWs.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF115E59' } };

      styleCorporateWorksheet(ws, { title: 'Lançamentos de Materiais', headerRow: 1, recordCount: filteredRegistros.length });
      styleCorporateWorksheet(resumoWs, { title: 'Resumo de Materiais por Local', headerRow: 1 });
      styleCorporateWorksheet(matWs, { title: 'Cadastro de Materiais', headerRow: 1, recordCount: materiais.length });
      addCorporateSummarySheet(workbook, 'Controle de Materiais', [
        ['Lançamentos exportados', filteredRegistros.length],
        ['Materiais cadastrados', materiais.length],
        ['Quantidade total', filteredRegistros.reduce((total, item) => total + Number(item.quantidade || 0), 0)],
      ], [dataInicio ? `Início: ${dataInicio}` : '', dataFim ? `Fim: ${dataFim}` : '', search ? `Busca: ${search}` : '']);
      await downloadCorporateWorkbook(workbook, `RENEA_materiais_${dataInicio || 'inicio'}_${dataFim || 'fim'}.xlsx`);
    } finally {
      setIsExporting(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setDataInicio('');
    setDataFim('');
    setFMaterial('todos');
    setFFornecedor('todos');
    setFLocal('todos');
    setFAba('todos');
    setFStatus('todos');
    setSortMode('data_desc');
  };

  return (
    <div className="space-y-6" id="materiais-tab">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-slate-900 border border-slate-850 p-6 rounded-3xl shadow-xl">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-400" />
            Cadastro de Materiais
          </h1>
          <p className="text-xs text-slate-400 mt-1">Controle por material, fornecedor, placa, nota, origem, descarga e ramo.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input ref={importInputRef} type="file" accept=".xlsx,.xlsm" onChange={handleImportFile} className="hidden" />
          <button onClick={() => importInputRef.current?.click()} disabled={isImporting} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 text-xs font-black flex items-center gap-2">
            <Upload className="w-4 h-4" />
            {isImporting ? 'Importando...' : 'Importar planilha'}
          </button>
          <button onClick={exportExcel} disabled={isExporting || filteredRegistros.length === 0} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black flex items-center gap-2">
            <Download className="w-4 h-4" />
            Excel
          </button>
          <button onClick={openCreateRegistro} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Lançamento
          </button>
          <button onClick={openCreateMaterial} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-black flex items-center gap-2">
            <Archive className="w-4 h-4" />
            Material
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${feedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>
          {feedback.message}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 bg-slate-950 border border-slate-850 p-1 rounded-2xl w-fit">
        {[
          ['dashboard', 'Dashboard'],
          ['registros', 'Lançamentos'],
          ['materiais', 'Materiais'],
          ['resumo', 'Resumo por ramo']
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSubTab(id as SubTab)}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${subTab === id ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-850 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por material, nota, placa, prefixo, origem, destino ou fornecedor" className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setShowFilters(prev => !prev)} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Filtros
            </button>
            <button onClick={clearFilters} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-black flex items-center gap-2">
              <FilterX className="w-4 h-4" />
              Limpar
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3">
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
            <select value={fMaterial} onChange={e => setFMaterial(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500">
              <option value="todos">Todos os materiais</option>
              {materialOptions.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={fFornecedor} onChange={e => setFFornecedor(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500">
              <option value="todos">Todos os fornecedores</option>
              {fornecedores.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={fLocal} onChange={e => setFLocal(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500">
              <option value="todos">Todos os locais/ramos</option>
              {locais.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={fAba} onChange={e => setFAba(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500">
              <option value="todos">Todas as abas</option>
              {abas.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500">
              <option value="todos">Todos os status</option>
              {STATUS_REGISTRO.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={sortMode} onChange={e => setSortMode(e.target.value as SortMode)} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500">
              <option value="data_desc">Data mais recente</option>
              <option value="data_asc">Data mais antiga</option>
              <option value="valor_desc">Maior valor</option>
              <option value="quantidade_desc">Maior quantidade</option>
            </select>
            <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500">
              <option value={50}>50 por página</option>
              <option value={100}>100 por página</option>
              <option value={200}>200 por página</option>
            </select>
          </div>
        )}
      </div>

      {subTab === 'dashboard' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            <MetricCard label="Registros" value={filteredRegistros.length} hint={`${registros.length} no banco`} icon={<FileSpreadsheet />} />
            <MetricCard label="Materiais" value={materiais.length} hint={`${materialOptions.length} com movimentação`} icon={<Package />} />
            <MetricCard label="Toneladas" value={formatNumber(totals.toneladas)} hint="filtro atual" icon={<Truck />} />
            <MetricCard label="Total M³" value={formatNumber(totals.m3)} hint="inclui caçambas" icon={<Archive />} />
            <MetricCard label="Valor total" value={formatCurrency(totals.valor)} hint="filtro atual" icon={<BarChart3 />} />
          </div>

          <div className="grid xl:grid-cols-2 gap-4">
            <SummaryPanel title="Top materiais" rows={resumoPorMaterial.slice(0, 8).map(item => ({
              label: item.material,
              value: `${formatNumber(item.quantidade)} ${item.unidade}`,
              hint: `${item.registros} reg. | ${formatCurrency(item.valor)}`
            }))} />
            <SummaryPanel title="Top locais / ramos" rows={resumoPorLocal.slice(0, 8).map(item => ({
              label: item.local,
              value: formatCurrency(item.valor),
              hint: `${item.registros} reg. | ${item.principalMaterial}`
            }))} />
          </div>
        </div>
      )}

      {subTab === 'registros' && (
        <div className="space-y-4">
          {isRegistroFormOpen && (
            <RegistroForm
              form={registroForm}
              setForm={setRegistroForm}
              materiais={materiais}
              editingId={editingRegistroId}
              onCancel={() => setIsRegistroFormOpen(false)}
              onSave={saveRegistro}
            />
          )}

          <div className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/50 border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Material</th>
                    <th className="py-3 px-4 text-right">Qtd.</th>
                    <th className="py-3 px-4">Fornecedor</th>
                    <th className="py-3 px-4">Placa/Prefixo</th>
                    <th className="py-3 px-4">Origem/Destino</th>
                    <th className="py-3 px-4 text-right">Total</th>
                    <th className="py-3 px-4">Aba</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {pageItems.length === 0 ? (
                    <tr><td colSpan={9} className="py-10 text-center text-slate-500">Nenhum lançamento encontrado.</td></tr>
                  ) : pageItems.map(item => (
                    <tr key={item.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-mono text-slate-300">
                        <span className="font-black text-white block">{formatDate(item.data)}</span>
                        <span className="text-[10px] text-slate-500">{item.status || 'Conferido'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-black text-emerald-300 block">{item.material}</span>
                        <span className="text-slate-500">{item.nota ? `NF ${item.nota}` : '-'}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-white font-mono">
                        {formatNumber(item.quantidade)} <span className="text-slate-500">{item.unidade}</span>
                        {item.totalM3 ? <span className="block text-[10px] text-emerald-300">{formatNumber(item.totalM3)} m³</span> : null}
                      </td>
                      <td className="py-3 px-4 text-slate-300">{item.fornecedor || '-'}</td>
                      <td className="py-3 px-4 text-slate-300">
                        <span className="block">{item.placa || '-'}</span>
                        <span className="text-[10px] text-slate-500">{item.prefixo || ''}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-300 min-w-56">
                        <span className="block text-slate-500">Origem: {item.origem || '-'}</span>
                        <span className="block text-white font-bold">Destino: {item.destino || '-'}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-white font-mono">{formatCurrency(item.total || 0)}</td>
                      <td className="py-3 px-4 text-slate-400">{item.aba}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEditRegistro(item)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200" title="Editar lançamento">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button onClick={() => onDeleteRegistro(item.id)} className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300" title="Excluir lançamento">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-slate-800 text-xs text-slate-400">
              <span>Mostrando {pageItems.length} de {filteredRegistros.length} lançamento(s)</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(prev => Math.max(1, prev - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg bg-slate-800 disabled:opacity-40 text-slate-200 font-bold">Anterior</button>
                <span className="font-mono">Página {page}/{totalPages}</span>
                <button onClick={() => setPage(prev => Math.min(totalPages, prev + 1))} disabled={page >= totalPages} className="px-3 py-1.5 rounded-lg bg-slate-800 disabled:opacity-40 text-slate-200 font-bold">Próxima</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {subTab === 'materiais' && (
        <div className="space-y-4">
          {isMaterialFormOpen && (
            <MaterialForm form={materialForm} setForm={setMaterialForm} editingId={editingMaterialId} onCancel={() => setIsMaterialFormOpen(false)} onSave={saveMaterial} />
          )}

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {materiais.map(item => (
              <div key={item.id} className="bg-slate-900 border border-slate-850 rounded-2xl p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-black text-white truncate">{item.nome}</h3>
                    <p className="text-xs text-emerald-300 font-bold mt-1">{item.categoria} | {item.unidadePadrao}</p>
                  </div>
                  <span className={`text-[10px] font-black rounded-full px-2 py-1 ${item.status === 'Ativo' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                    {item.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <InfoLabel label="Valor ref." value={item.valorReferencia ? formatCurrency(item.valorReferencia) : '-'} />
                  <InfoLabel label="Densidade" value={item.densidade ? String(item.densidade) : '-'} />
                  <InfoLabel label="Fornecedor" value={item.fornecedorPadrao || '-'} span />
                </div>
                {item.observacao && <p className="text-xs text-slate-500">{item.observacao}</p>}
                <div className="flex justify-end gap-2">
                  <button onClick={() => openEditMaterial(item)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200" title="Editar material">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => onDeleteMaterial(item.id)} className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300" title="Excluir material">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'resumo' && (
        <div className="grid xl:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden">
            <TableTitle icon={<MapPin />} title="Resumo por local / ramo" subtitle={`${resumoPorLocal.length} local(is) no filtro`} />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/50 text-slate-400 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Local</th>
                    <th className="py-3 px-4 text-right">Reg.</th>
                    <th className="py-3 px-4 text-right">Qtd.</th>
                    <th className="py-3 px-4 text-right">M³</th>
                    <th className="py-3 px-4 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {resumoPorLocal.map(item => (
                    <tr key={item.local} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 text-white font-bold">
                        {item.local}
                        <span className="block text-[10px] text-slate-500">{item.principalMaterial}</span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300">{item.registros}</td>
                      <td className="py-3 px-4 text-right text-slate-300">{formatNumber(item.quantidade)}</td>
                      <td className="py-3 px-4 text-right text-slate-300">{formatNumber(item.m3)}</td>
                      <td className="py-3 px-4 text-right text-emerald-300 font-black">{formatCurrency(item.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden">
            <TableTitle icon={<Package />} title="Resumo por material" subtitle={`${resumoPorMaterial.length} material(is) no filtro`} />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/50 text-slate-400 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Material</th>
                    <th className="py-3 px-4 text-right">Reg.</th>
                    <th className="py-3 px-4 text-right">Quantidade</th>
                    <th className="py-3 px-4 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {resumoPorMaterial.map(item => (
                    <tr key={item.material} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 text-white font-bold">{item.material}</td>
                      <td className="py-3 px-4 text-right text-slate-300">{item.registros}</td>
                      <td className="py-3 px-4 text-right text-slate-300">{formatNumber(item.quantidade)} {item.unidade}</td>
                      <td className="py-3 px-4 text-right text-emerald-300 font-black">{formatCurrency(item.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, hint, icon }: { label: string; value: string | number; hint: string; icon: React.ReactElement }) {
  return (
    <div className="bg-slate-900 border border-slate-850 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">{label}</span>
        {React.cloneElement(icon, { className: 'w-4 h-4 text-emerald-400' } as any)}
      </div>
      <p className="text-2xl font-black text-white mt-2">{value}</p>
      <span className="text-[10px] text-slate-500">{hint}</span>
    </div>
  );
}

function SummaryPanel({ title, rows }: { title: string; rows: Array<{ label: string; value: string; hint: string }> }) {
  return (
    <div className="bg-slate-900 border border-slate-850 rounded-2xl p-4">
      <h3 className="text-sm font-black text-white mb-3">{title}</h3>
      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">Sem dados para o filtro atual.</p>
        ) : rows.map(row => (
          <div key={`${row.label}-${row.value}`} className="flex items-center justify-between gap-3 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2">
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-200 truncate block">{row.label}</span>
              <span className="text-[10px] text-slate-500">{row.hint}</span>
            </div>
            <span className="text-xs font-black text-emerald-300 whitespace-nowrap">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoLabel({ label, value, span = false }: { label: string; value: string; span?: boolean }) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <span className="text-[10px] uppercase tracking-widest font-black text-slate-500 block">{label}</span>
      <span className="text-xs font-bold text-slate-200">{value}</span>
    </div>
  );
}

function TableTitle({ icon, title, subtitle }: { icon: React.ReactElement; title: string; subtitle: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800">
      <div className="flex items-center gap-2">
        {React.cloneElement(icon, { className: 'w-4 h-4 text-emerald-400' } as any)}
        <h3 className="text-sm font-black text-white">{title}</h3>
      </div>
      <span className="text-[10px] text-slate-500 font-bold">{subtitle}</span>
    </div>
  );
}

function MaterialForm({
  form,
  setForm,
  editingId,
  onCancel,
  onSave
}: {
  form: MaterialCadastro;
  setForm: React.Dispatch<React.SetStateAction<MaterialCadastro>>;
  editingId: string | null;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-4 space-y-4 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-black text-white">{editingId ? 'Editar material' : 'Novo material'}</h3>
        <button onClick={onCancel} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
        <label className="space-y-1 xl:col-span-2">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Material</span>
          <input value={form.nome} onChange={e => setForm(prev => ({ ...prev, nome: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Categoria</span>
          <select value={form.categoria} onChange={e => setForm(prev => ({ ...prev, categoria: e.target.value as MaterialCategoria }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500">
            {CATEGORIAS.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Unidade</span>
          <input value={form.unidadePadrao} onChange={e => setForm(prev => ({ ...prev, unidadePadrao: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Densidade</span>
          <input type="number" step="0.0001" value={form.densidade || ''} onChange={e => setForm(prev => ({ ...prev, densidade: Number(e.target.value) || undefined }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Valor referência</span>
          <input type="number" step="0.01" value={form.valorReferencia || ''} onChange={e => setForm(prev => ({ ...prev, valorReferencia: Number(e.target.value) || undefined }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Fornecedor padrão</span>
          <input value={form.fornecedorPadrao || ''} onChange={e => setForm(prev => ({ ...prev, fornecedorPadrao: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Status</span>
          <select value={form.status} onChange={e => setForm(prev => ({ ...prev, status: e.target.value as 'Ativo' | 'Inativo' }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500">
            <option value="Ativo">Ativo</option>
            <option value="Inativo">Inativo</option>
          </select>
        </label>
      </div>
      <textarea value={form.observacao || ''} onChange={e => setForm(prev => ({ ...prev, observacao: e.target.value }))} rows={2} placeholder="Observação" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 resize-none" />
      <div className="flex flex-wrap justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold hover:bg-slate-700">Cancelar</button>
        <button onClick={onSave} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-500 flex items-center gap-2">
          <Save className="w-4 h-4" />
          Salvar material
        </button>
      </div>
    </div>
  );
}

function RegistroForm({
  form,
  setForm,
  materiais,
  editingId,
  onCancel,
  onSave
}: {
  form: MaterialRegistro;
  setForm: React.Dispatch<React.SetStateAction<MaterialRegistro>>;
  materiais: MaterialCadastro[];
  editingId: string | null;
  onCancel: () => void;
  onSave: () => void;
}) {
  const updateMaterial = (materialName: string) => {
    const material = materiais.find(item => item.nome === materialName);
    setForm(prev => ({
      ...prev,
      material: materialName,
      unidade: material?.unidadePadrao || prev.unidade,
      fornecedor: material?.fornecedorPadrao || prev.fornecedor,
      valorUnitario: material?.valorReferencia || prev.valorUnitario
    }));
  };

  return (
    <div className="bg-slate-900 border border-emerald-500/20 rounded-2xl p-4 space-y-4 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-black text-white">{editingId ? 'Editar lançamento de material' : 'Novo lançamento de material'}</h3>
        <button onClick={onCancel} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Data</span>
          <input type="date" value={form.data} onChange={e => setForm(prev => ({ ...prev, data: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Aba / origem</span>
          <input value={form.aba} onChange={e => setForm(prev => ({ ...prev, aba: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
        </label>
        <label className="space-y-1 xl:col-span-2">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Material</span>
          <input list="materiais-list" value={form.material} onChange={e => updateMaterial(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
          <datalist id="materiais-list">
            {materiais.map(item => <option key={item.id} value={item.nome} />)}
          </datalist>
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Unidade</span>
          <input value={form.unidade} onChange={e => setForm(prev => ({ ...prev, unidade: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Quantidade</span>
          <input type="number" step="0.01" value={form.quantidade} onChange={e => setForm(prev => ({ ...prev, quantidade: Number(e.target.value) || 0 }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Valor unitário</span>
          <input type="number" step="0.01" value={form.valorUnitario || ''} onChange={e => setForm(prev => ({ ...prev, valorUnitario: Number(e.target.value) || 0 }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Total R$</span>
          <input type="number" step="0.01" value={form.total || ''} onChange={e => setForm(prev => ({ ...prev, total: Number(e.target.value) || 0 }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Fornecedor</span>
          <input value={form.fornecedor || ''} onChange={e => setForm(prev => ({ ...prev, fornecedor: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Placa</span>
          <input value={form.placa || ''} onChange={e => setForm(prev => ({ ...prev, placa: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Prefixo</span>
          <input value={form.prefixo || ''} onChange={e => setForm(prev => ({ ...prev, prefixo: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Nota</span>
          <input value={form.nota || ''} onChange={e => setForm(prev => ({ ...prev, nota: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
        </label>
        <label className="space-y-1 xl:col-span-2">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Origem / carregamento</span>
          <input value={form.origem || ''} onChange={e => setForm(prev => ({ ...prev, origem: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
        </label>
        <label className="space-y-1 xl:col-span-2">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Destino / ramo</span>
          <input value={form.destino || ''} onChange={e => setForm(prev => ({ ...prev, destino: e.target.value }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Volume caçamba</span>
          <input type="number" step="0.01" value={form.volumeCacamba || ''} onChange={e => setForm(prev => ({ ...prev, volumeCacamba: Number(e.target.value) || 0 }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Total M³</span>
          <input type="number" step="0.01" value={form.totalM3 || ''} onChange={e => setForm(prev => ({ ...prev, totalM3: Number(e.target.value) || 0 }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-slate-500">Status</span>
          <select value={form.status || 'Conferido'} onChange={e => setForm(prev => ({ ...prev, status: e.target.value as MaterialStatus }))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500">
            {STATUS_REGISTRO.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>
      <textarea value={form.observacao || ''} onChange={e => setForm(prev => ({ ...prev, observacao: e.target.value }))} rows={2} placeholder="Observação" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-emerald-500 resize-none" />
      <div className="flex flex-wrap justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold hover:bg-slate-700">Cancelar</button>
        <button onClick={onSave} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-500 flex items-center gap-2">
          <Save className="w-4 h-4" />
          Salvar lançamento
        </button>
      </div>
    </div>
  );
}
