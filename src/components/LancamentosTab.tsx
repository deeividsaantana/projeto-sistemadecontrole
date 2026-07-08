/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import { 
  Empresa, 
  ObraLocal, 
  Equipamento, 
  Funcionario, 
  Comboio, 
  TipoCombustivel, 
  ProdutoLubrificacao, 
  EtapaServico, 
  Abastecimento, 
  Lubrificacao, 
  RdoDiario 
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
  Upload
} from 'lucide-react';
import ExcelJS from 'exceljs';

interface LancamentosTabProps {
  empresas: Empresa[];
  obras: ObraLocal[];
  equipamentos: Equipamento[];
  funcionarios: Funcionario[];
  comboios: Comboio[];
  combustiveis: TipoCombustivel[];
  lubrificantes: ProdutoLubrificacao[];
  etapas: EtapaServico[];

  abastecimentos: Abastecimento[];
  lubrificacoes: Lubrificacao[];
  rdos: RdoDiario[];

  onSaveAbastecimento: (item: Abastecimento, isNew: boolean) => void;
  onDeleteAbastecimento: (id: string) => void;
  onImportAbastecimentos: (items: Abastecimento[]) => void;
  onSaveLubrificacao: (item: Lubrificacao, isNew: boolean) => void;
  onDeleteLubrificacao: (id: string) => void;
  onSaveRdo: (item: RdoDiario, isNew: boolean) => void;
  onDeleteRdo: (id: string) => void;
}

type Mode = 'abastecimentos' | 'lubrificacoes' | 'rdos';

export default function LancamentosTab({
  empresas,
  obras,
  equipamentos,
  funcionarios,
  comboios,
  combustiveis,
  lubrificantes,
  etapas,
  abastecimentos,
  lubrificacoes,
  rdos,
  onSaveAbastecimento,
  onDeleteAbastecimento,
  onImportAbastecimentos,
  onSaveLubrificacao,
  onDeleteLubrificacao,
  onSaveRdo,
  onDeleteRdo
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
    linha: number;
    valido: boolean;
    duplicado: boolean;
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

  const normalizeHeader = (s: string) =>
    (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  const COLUMN_SYNONYMS: Record<string, string[]> = {
    data: ['data'],
    frota: ['frota', 'prefixo', 'equipamento'],
    kmInicial: ['km inicial', 'kminicial', 'km'],
    horimetroInicial: ['horimetro inicial', 'horimetro'],
    bombaInicial: ['bomba inicial', 'inicio bomba', 'inicial bomba'],
    quantidadeLitros: ['qtde de litros', 'quantidade de litros', 'quantidade', 'litros', 'qtd litros'],
    bombaFinal: ['bomba final', 'fim bomba', 'final bomba'],
    hora: ['hora'],
    comboio: ['comboio', 'tanque', 'comboio tanque'],
    tipoCombustivel: ['tipo do combustivel', 'tipo combustivel', 'tipo de combustivel', 'combustivel'],
    empresa: ['empresa'],
    observacao: ['observacao', 'obs'],
    responsavel: ['responsavel'],
  };

  const parseDateValue = (val: any): string => {
    if (!val) return '';
    if (val instanceof Date) {
      const y = val.getFullYear(), m = String(val.getMonth() + 1).padStart(2, '0'), d = String(val.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    if (typeof val === 'number') {
      const parsed = new Date(Math.round((val - 25569) * 86400 * 1000));
      return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
    }
    const str = String(val).trim();
    // dd/mm/yyyy
    const br = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (br) {
      const [, d, m, y] = br;
      const year = y.length === 2 ? `20${y}` : y;
      return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    // yyyy-mm-dd
    const iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) {
      const [, y, m, d] = iso;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return '';
  };

  const parseTimeValue = (val: any): string => {
    if (!val) return '';
    if (val instanceof Date) {
      return `${String(val.getHours()).padStart(2, '0')}:${String(val.getMinutes()).padStart(2, '0')}`;
    }
    if (typeof val === 'number') {
      let totalMinutes = Math.round((val % 1) * 24 * 60);
      if (totalMinutes < 0) totalMinutes += 24 * 60;
      return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
    }
    const str = String(val).trim();
    const m = str.match(/^(\d{1,2}):(\d{2})/);
    if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
    return '';
  };

  const parseNumberValue = (val: any): number => {
    if (val === null || val === undefined || val === '') return NaN;
    if (typeof val === 'number') return val;
    const str = String(val).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    return parseFloat(str);
  };

  const handleImportFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    setIsParsingImport(true);
    setValidationError('');
    try {
      const buffer = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer as any);
      const targetSheets = wb.worksheets.filter(sheet => {
        const name = normalizeHeader(sheet.name);
        return name.includes('combustivel') || name.includes('nao cadastrados') || name.includes('naocadastrados');
      });
      const worksheetsToRead = targetSheets.length ? targetSheets : wb.worksheets;
      if (worksheetsToRead.length === 0) throw new Error('Planilha vazia ou aba não encontrada.');

      const buildColMap = (row: ExcelJS.Row) => {
        const map: Record<string, number> = {};
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          const value = cell.value as any;
          const norm = normalizeHeader(value?.text || value?.result || String(value || ''));
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
        for (let rowNumber = 1; rowNumber <= Math.min(ws.rowCount, 20); rowNumber += 1) {
          const map = buildColMap(ws.getRow(rowNumber));
          const score = ['data', 'frota', 'quantidadeLitros', 'hora', 'tipoCombustivel'].filter(key => map[key]).length;
          if (score > bestScore) {
            bestScore = score;
            bestRow = rowNumber;
          }
        }
        return bestScore >= 3 ? bestRow : 0;
      };

      const rows: ImportRow[] = [];
      const seenInBatch = new Set<string>();

      worksheetsToRead.forEach(ws => {
        const headerRowNumber = findHeaderRow(ws);
        if (!headerRowNumber) return;
        const colMap = buildColMap(ws.getRow(headerRowNumber));
        const getCell = (row: ExcelJS.Row, key: string) => {
          const idx = colMap[key];
          const value = idx ? row.getCell(idx).value as any : undefined;
          if (value && typeof value === 'object') {
            if (value.result !== undefined) return value.result;
            if (value.text !== undefined) return value.text;
            if (Array.isArray(value.richText)) return value.richText.map((part: any) => part.text || '').join('');
          }
          return value;
        };

        ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          if (rowNumber <= headerRowNumber) return;
          const rawFrota = getCell(row, 'frota');
          const rawData = getCell(row, 'data');
          const rawQtd = getCell(row, 'quantidadeLitros');

          // Ignora linhas totalmente vazias
          const isEmptyRow = !rawFrota && !rawData && !rawQtd;
          if (isEmptyRow) return;

          const dataStr = parseDateValue(rawData);
          const frotaTexto = String(rawFrota || '').trim();
          const horaStr = parseTimeValue(getCell(row, 'hora')) || '00:00';
          const quantidade = parseNumberValue(rawQtd);
          const bombaInicial = parseNumberValue(getCell(row, 'bombaInicial')) || 0;
          const bombaFinalPlanilha = parseNumberValue(getCell(row, 'bombaFinal'));
          const tipoCombustivelTexto = String(getCell(row, 'tipoCombustivel') || '').trim();
          const comboioTexto = String(getCell(row, 'comboio') || '').trim();
          const empresaTexto = String(getCell(row, 'empresa') || '').trim();
          const observacao = String(getCell(row, 'observacao') || '').trim();
          const responsavel = String(getCell(row, 'responsavel') || '').trim();
          const kmInicial = parseNumberValue(getCell(row, 'kmInicial')) || 0;
          const horimetroInicial = parseNumberValue(getCell(row, 'horimetroInicial')) || 0;

          const eq = equipamentos.find(e => e.prefixo.toLowerCase() === frotaTexto.toLowerCase() || e.nome.toLowerCase() === frotaTexto.toLowerCase());
          const comb = combustiveis.find(c => c.nome.toLowerCase() === tipoCombustivelTexto.toLowerCase() || tipoCombustivelTexto.toLowerCase().includes(c.nome.toLowerCase()));
          const combVeic = comboios.find(c => c.nome.toLowerCase() === comboioTexto.toLowerCase() || c.nome.toLowerCase().includes(comboioTexto.toLowerCase()));

          const preview: Record<string, string> = {
            Aba: ws.name, Data: dataStr || String(rawData || ''), Frota: frotaTexto, Hora: horaStr,
            Litros: String(quantidade || ''), Combustível: tipoCombustivelTexto, Comboio: comboioTexto, Empresa: empresaTexto,
          };

          // Validações
          let motivo = '';
          if (!dataStr) motivo = 'Data inválida.';
          else if (!frotaTexto) motivo = 'Frota vazia.';
          else if (!eq) motivo = `Frota "${frotaTexto}" não encontrada no cadastro.`;
          else if (isNaN(quantidade) || quantidade === undefined) motivo = 'Quantidade vazia.';
          else if (quantidade <= 0) motivo = 'Quantidade menor ou igual a zero.';
          else if (!tipoCombustivelTexto) motivo = 'Tipo de combustível vazio.';
          else if (!comb) motivo = `Tipo de combustível "${tipoCombustivelTexto}" não encontrado no cadastro.`;

          // Checagem de bomba final (Prioridade 4)
          let statusFinal: string = 'OK';
          const bombaFinalCalculada = bombaInicial + (isNaN(quantidade) ? 0 : quantidade);
          if (!isNaN(bombaFinalPlanilha) && bombaFinalPlanilha !== undefined && Math.abs(bombaFinalPlanilha - bombaFinalCalculada) > 0.01) {
            statusFinal = 'Verificar bomba';
          }

          // Duplicidade: Data + Frota + Hora + Quantidade + Tipo Combustível
          const dupKey = `${dataStr}|${eq?.id || frotaTexto}|${horaStr}|${quantidade}|${comb?.id || tipoCombustivelTexto}`;
          const dupNoSistema = abastecimentos.some(a => `${a.data}|${a.equipamentoId}|${a.hora}|${a.quantidadeLitros}|${a.tipoCombustivelId}` === dupKey);
          const dupNoLote = seenInBatch.has(dupKey);
          seenInBatch.add(dupKey);
          const isDuplicado = !motivo && (dupNoSistema || dupNoLote);
          if (isDuplicado) motivo = 'Registro duplicado.';

          const valido = !motivo;

          rows.push({
            linha: rowNumber,
            valido,
            duplicado: isDuplicado,
            motivo,
            preview,
            item: valido ? {
              id: `import-${Date.now()}-${ws.name}-${rowNumber}`,
              data: dataStr,
              hora: horaStr,
              equipamentoId: eq!.id,
              horimetroInicial,
              kmInicial,
              bombaInicial,
              quantidadeLitros: quantidade,
              bombaFinal: bombaFinalCalculada,
              tipoCombustivelId: comb!.id,
              comboioId: combVeic?.id || '',
              responsavel: responsavel || 'Importado da planilha',
              observacao: observacao || `Fonte: ${ws.name}`,
              status: statusFinal as any,
              criadoEm: new Date().toISOString(),
              atualizadoEm: new Date().toISOString(),
            } : undefined,
          });
        });
      });

      setImportRows(rows);
      setIsImportModalOpen(true);
    } catch (err) {
      console.error('Erro ao ler planilha:', err);
      setValidationError('Não foi possível ler a planilha. Verifique se o arquivo é um .xlsx válido.');
    } finally {
      setIsParsingImport(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const importSummary = useMemo(() => {
    const total = importRows.length;
    const validas = importRows.filter(r => r.valido).length;
    const duplicadas = importRows.filter(r => r.duplicado).length;
    const comErro = importRows.filter(r => !r.valido && !r.duplicado).length;
    return { total, validas, duplicadas, comErro };
  }, [importRows]);

  const handleConfirmImport = () => {
    setIsConfirmingImport(true);
    const validItems = importRows.filter(r => r.valido && r.item).map(r => r.item!) as Abastecimento[];
    onImportAbastecimentos(validItems);
    setIsConfirmingImport(false);
    setIsImportModalOpen(false);
    setImportRows([]);
    setImportFileName('');
  };

  const handleCancelImport = () => {
    setIsImportModalOpen(false);
    setImportRows([]);
    setImportFileName('');
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
  const [quantidadeLitros, setQuantidadeLitros] = useState<number>(100);
  const [bombaFinal, setBombaFinal] = useState<number>(100);
  const [tipoCombustivelId, setTipoCombustivelId] = useState('');
  const [comboioId, setComboioId] = useState('');

  // Lubrication specific
  const [lubHorimetro, setLubHorimetro] = useState<number>(0);
  const [produtoLubrificacaoId, setProdutoLubrificacaoId] = useState('');
  const [compartimento, setCompartimento] = useState('Pinos do Braço / Caçamba');
  const [lubQuantidade, setLubQuantidade] = useState<number>(1);

  // RDO Specific
  const [rdoEmpresaId, setRdoEmpresaId] = useState('');
  const [rdoObraId, setRdoObraId] = useState('');
  const [rdoEtapaId, setRdoEtapaId] = useState('');
  const [servicoExecutado, setServicoExecutado] = useState('');
  const [quantidadeEquipe, setQuantidadeEquipe] = useState<number>(1);
  const [selectedEqIds, setSelectedEqIds] = useState<string[]>([]);
  const [statusAtividade, setStatusAtividade] = useState<RdoDiario['statusAtividade']>('Andamento');
  const [pendencias, setPendencias] = useState('');
  const [proximasEtapas, setProximasEtapas] = useState('');

  // Helper to get derived info
  const selectedEquipment = equipamentos.find(e => e.id === equipamentoId);
  const derivedEquipmentDesc = selectedEquipment ? `${selectedEquipment.marca} ${selectedEquipment.modelo}` : '';
  const derivedCompany = selectedEquipment ? empresas.find(em => em.id === selectedEquipment.empresaId)?.nome : '';

  // Encontra a leitura "Bomba Final" mais recente já registrada para um comboio,
  // ordenando do menor para o maior valor de bomba (a maior leitura = a mais recente).
  // Essa leitura vira automaticamente a "Bomba Inicial" do próximo abastecimento daquele comboio.
  const getUltimaBombaFinal = (comboioIdAlvo: string, excluirId: string | null = null): number => {
    const registrosDoComboio = abastecimentos
      .filter(ab => ab.comboioId === comboioIdAlvo && ab.id !== excluirId)
      .sort((a, b) => a.bombaFinal - b.bombaFinal);

    if (registrosDoComboio.length === 0) return 1000; // valor inicial padrão quando o comboio ainda não tem histórico
    return registrosDoComboio[registrosDoComboio.length - 1].bombaFinal;
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
    const comboioPadrao = comboios[0]?.id || '';
    const bombaInicialPadrao = comboioPadrao ? getUltimaBombaFinal(comboioPadrao) : 1000;
    setBombaInicial(bombaInicialPadrao);
    setQuantidadeLitros(100);
    setBombaFinal(bombaInicialPadrao + 100);
    setTipoCombustivelId(combustiveis[0]?.id || '');
    setComboioId(comboioPadrao);

    setLubHorimetro(0);
    setProdutoLubrificacaoId(lubrificantes[0]?.id || '');
    setCompartimento('Pinos do Braço / Caçamba');
    setLubQuantidade(1);

    setRdoEmpresaId(empresas[0]?.id || '');
    setRdoObraId(obras[0]?.id || '');
    setRdoEtapaId(etapas[0]?.id || '');
    setServicoExecutado('');
    setQuantidadeEquipe(1);
    setSelectedEqIds([]);
    setStatusAtividade('Andamento');
    setPendencias('');
    setProximasEtapas('');
  };

  // Open forms
  const handleOpenCreate = () => {
    resetFormFields();
    if (equipamentos.length > 0) setEquipamentoId(equipamentos[0].id);
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

    } else if (mode === 'lubrificacoes') {
      const x = item as Lubrificacao;
      setDate(x.data); setTime(x.hora); setEquipamentoId(x.equipamentoId);
      setLubHorimetro(x.horimetro); setProdutoLubrificacaoId(x.produtoLubrificacaoId);
      setCompartimento(x.compartimento); setLubQuantidade(x.quantidade);
      setResponsavel(x.responsavel); setObservacao(x.observacao);

    } else if (mode === 'rdos') {
      const x = item as RdoDiario;
      setDate(x.data); setRdoEmpresaId(x.empresaId); setRdoObraId(x.obraLocalId);
      setRdoEtapaId(x.etapaServicoId); setServicoExecutado(x.servicoExecutado);
      setQuantidadeEquipe(x.quantidadeEquipe); setSelectedEqIds(x.equipamentosUtilizadosIds || []);
      setStatusAtividade(x.statusAtividade); setObservacao(x.observacao);
      setPendencias(x.pendencias); setProximasEtapas(x.proximasEtapas);
    }
    setIsFormOpen(true);
  };

  // Quando o usuário troca o comboio no formulário, a Bomba Inicial é recalculada
  // automaticamente com base na última Bomba Final registrada para aquele comboio
  // (apenas em novos lançamentos; ao editar um já existente, o valor original é preservado).
  const handleComboioChange = (novoComboioId: string) => {
    setComboioId(novoComboioId);
    if (editingId === null) {
      const novaBombaInicial = getUltimaBombaFinal(novoComboioId);
      setBombaInicial(novaBombaInicial);
      setBombaFinal(novaBombaInicial + Number(quantidadeLitros));
    }
  };

  // Form Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    const isNew = editingId === null;
    const currentId = isNew ? `txn-${Date.now()}` : editingId!;

    if (mode === 'abastecimentos') {
      if (!equipamentoId || !responsavel.trim() || quantidadeLitros <= 0) {
        setValidationError('Preencha todos os campos obrigatórios (Frota, Litros, Responsável)!');
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
        tipoCombustivelId: tipoCombustivelId || (combustiveis[0] ? combustiveis[0].id : ''),
        comboioId: comboioId || (comboios[0] ? comboios[0].id : ''),
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

    } else if (mode === 'rdos') {
      if (!rdoEmpresaId || !rdoObraId || !servicoExecutado.trim()) {
        setValidationError('Empresa, Canteiro de Obra e Serviço Executado são obrigatórios!');
        return;
      }
      onSaveRdo({
        id: currentId,
        data: date,
        empresaId: rdoEmpresaId,
        obraLocalId: rdoObraId,
        etapaServicoId: rdoEtapaId || (etapas[0] ? etapas[0].id : ''),
        servicoExecutado: servicoExecutado.trim(),
        quantidadeEquipe: Number(quantidadeEquipe) || 1,
        equipamentosUtilizadosIds: selectedEqIds,
        statusAtividade,
        observacao: observacao.trim(),
        pendencias: pendencias.trim(),
        proximasEtapas: proximasEtapas.trim()
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
    else if (mode === 'rdos') onDeleteRdo(id);

    setDeleteConfirmId(null);
  };

  // Checkbox multi-select list for used equipments
  const handleToggleEqSelection = (eqId: string) => {
    if (selectedEqIds.includes(eqId)) {
      setSelectedEqIds(selectedEqIds.filter(id => id !== eqId));
    } else {
      setSelectedEqIds([...selectedEqIds, eqId]);
    }
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
    const totalLitros = filteredAbastecimentos.reduce((sum, ab) => sum + (Number(ab.quantidadeLitros) || 0), 0);
    const totalRegistros = filteredAbastecimentos.length;
    const mediaLitros = totalRegistros > 0 ? totalLitros / totalRegistros : 0;
    const frotasUnicas = new Set(filteredAbastecimentos.map(ab => ab.equipamentoId)).size;
    return { totalLitros, totalRegistros, mediaLitros, frotasUnicas };
  }, [filteredAbastecimentos]);

  // Exportação Excel do módulo de Combustível — Prioridade 2
  // Exporta somente os registros filtrados (filteredAbastecimentos já reflete os filtros ativos).
  const handleExportExcelAbastecimentos = async () => {
    setIsExportingExcel(true);
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'RENEA';
      wb.created = new Date();
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

      ws.eachRow((row, rowNumber) => {
        row.eachCell({ includeEmpty: true }, cell => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          };
          if (rowNumber > 4) cell.alignment = { vertical: 'middle', horizontal: 'left' };
        });
      });
      ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: headers.length } };
      ws.views = [{ state: 'frozen', ySplit: 4 }];

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const sufixo = hasFiltrosAtivos ? '_filtrado' : '';
      link.setAttribute('download', `RENEA_combustivel${sufixo}_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
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

  const filteredRdos = rdos.filter(r => {
    const ob = obras.find(o => o.id === r.obraLocalId);
    return r.data.includes(q) || r.servicoExecutado.toLowerCase().includes(q) || (ob && ob.nome.toLowerCase().includes(q));
  }).sort((a,b) => b.data.localeCompare(a.data));

  return (
    <div className="space-y-6" id="lancamentos-tab">
      
      {/* Tab Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-850 pb-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-emerald-500" />
            Lançamentos de Campo Diários
          </h1>
          <p className="text-xs text-slate-400 mt-1">Insira abastecimentos rápidos, manutenções de lubrificação e o Relatório Diário de Obra (RDO).</p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4.5 h-4.5" />
          {mode === 'abastecimentos' ? 'Novo Abastecimento' : mode === 'lubrificacoes' ? 'Nova Lubrificação' : 'Criar RDO Diário'}
        </button>
      </div>

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
        <button
          onClick={() => { setMode('rdos'); setIsFormOpen(false); setSearchQuery(''); resetFormFields(); }}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${mode === 'rdos' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-100'}`}
        >
          <ClipboardList className="w-4 h-4" />
          RDO Diário
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
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-950 border border-emerald-600/40 hover:border-emerald-500 disabled:opacity-60 text-emerald-400 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              {isParsingImport ? 'Lendo planilha...' : 'Importar planilha'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xlsm"
              onChange={handleImportFileSelected}
              className="hidden"
            />
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
            {editingId ? '✏️ Editando Lançamento' : '➕ Novo Lançamento'} • {mode === 'abastecimentos' ? 'Abastecimento de Combustível' : mode === 'lubrificacoes' ? 'Manutenção / Lubrificação de Máquina' : 'Relatório Diário de Obra (RDO)'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* 1. ABASTECIMENTO FORM FIELDS */}
            {mode === 'abastecimentos' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Data de Registro *</label>
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
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Bomba Inicial (Litros) <span className="text-emerald-500 normal-case font-semibold">— auto (última leitura)</span></label>
                    <input type="number" value={bombaInicial} onChange={e => {
                      const inicial = Number(e.target.value);
                      setBombaInicial(inicial);
                      setBombaFinal(inicial + Number(quantidadeLitros));
                    }} placeholder="1000" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                    <span className="text-[9px] text-slate-500 font-mono block">Preenchido com a Bomba Final do último abastecimento deste comboio</span>
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

            {/* 3. RDO FORM FIELDS */}
            {mode === 'rdos' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Data do RDO *</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Empresa Responsável *</label>
                    <select value={rdoEmpresaId} onChange={e => setRdoEmpresaId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer" required>
                      <option value="">Selecione...</option>
                      {empresas.map(emp => (
                        <option key={emp.id} value={emp.id} className="bg-slate-900 text-white">{emp.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Canteiro de Obra / Local *</label>
                    <select value={rdoObraId} onChange={e => setRdoObraId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer" required>
                      <option value="">Selecione...</option>
                      {obras.map(ob => (
                        <option key={ob.id} value={ob.id} className="bg-slate-900 text-white">{ob.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Ramo / Etapa do Serviço</label>
                    <select value={rdoEtapaId} onChange={e => setRdoEtapaId(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer">
                      <option value="">Selecione...</option>
                      {etapas.map(et => (
                        <option key={et.id} value={et.id} className="bg-slate-900 text-white">{et.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-3 space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Descrição do Serviço Executado *</label>
                    <textarea value={servicoExecutado} onChange={e => setServicoExecutado(e.target.value)} placeholder="Descreva os trabalhos concluídos hoje, trecho, etc..." rows={3} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none" required />
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Quantidade de Equipe (Pessoas) *</label>
                      <input type="number" value={quantidadeEquipe} onChange={e => setQuantidadeEquipe(Number(e.target.value))} placeholder="1" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500" required />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Status da Atividade</label>
                      <select value={statusAtividade} onChange={e => setStatusAtividade(e.target.value as any)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer">
                        <option value="Andamento" className="bg-slate-900 text-white">Andamento</option>
                        <option value="Concluído" className="bg-slate-900 text-white">Concluído</option>
                        <option value="Paralisado Chuva" className="bg-slate-900 text-white">Paralisado Chuva</option>
                        <option value="Paralisado Quebrado" className="bg-slate-900 text-white">Paralisado Quebrado</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Equipments utilized multi-select grid */}
                <div className="space-y-1.5">
                  <label className="text-xxs font-bold uppercase tracking-wider text-slate-400 block">Equipamentos Utilizados hoje (Selecione todos os aplicados):</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 p-3.5 bg-slate-950 border border-slate-800 rounded-xl max-h-40 overflow-y-auto">
                    {equipamentos.length === 0 ? (
                      <span className="text-xxs text-slate-500 italic">Cadastre equipamentos primeiro.</span>
                    ) : (
                      equipamentos.map(eq => {
                        const checked = selectedEqIds.includes(eq.id);
                        return (
                          <label key={eq.id} className={`flex items-center gap-2 p-2 rounded-lg border text-xxs cursor-pointer select-none transition-all ${checked ? 'bg-emerald-600/10 border-emerald-500 text-emerald-400 font-bold' : 'bg-slate-900 border-slate-850 text-slate-400'}`}>
                            <input 
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleEqSelection(eq.id)}
                              className="accent-emerald-500 shrink-0 cursor-pointer rounded"
                            />
                            <span className="font-mono truncate">{eq.prefixo}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Observações Gerais</label>
                    <input type="text" value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Clima, eventos, etc..." className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Pendências encontradas</label>
                    <input type="text" value={pendencias} onChange={e => setPendencias(e.target.value)} placeholder="Peças, frentes de obra embargadas, etc..." className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xxs font-bold uppercase tracking-wider text-slate-400">Próximas etapas do planejamento</label>
                    <input type="text" value={proximasEtapas} onChange={e => setProximasEtapas(e.target.value)} placeholder="Próximas frentes de serviço..." className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                  </div>
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
                          Início: {ab.bombaInicial.toLocaleString('pt-BR')} L<br />
                          Final: {ab.bombaFinal.toLocaleString('pt-BR')} L
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

        {/* RDOS TABLE */}
        {mode === 'rdos' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-850 text-slate-400 uppercase text-[10px] font-bold bg-slate-950/20 font-mono">
                  <th className="py-3.5 px-5">Data RDO</th>
                  <th className="py-3.5 px-5">Canteiro de Obra</th>
                  <th className="py-3.5 px-5">Empresa</th>
                  <th className="py-3.5 px-5">Serviço Diário Executado</th>
                  <th className="py-3.5 px-5 text-center">Efetivo (Pess.)</th>
                  <th className="py-3.5 px-5">Status Trabalho</th>
                  <th className="py-3.5 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredRdos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500 italic">Nenhum RDO encontrado.</td>
                  </tr>
                ) : (
                  filteredRdos.map(rdo => {
                    const ob = obras.find(o => o.id === rdo.obraLocalId);
                    const emp = empresas.find(e => e.id === rdo.empresaId);
                    
                    const statusColor = rdo.statusAtividade === 'Concluído' 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : rdo.statusAtividade === 'Andamento' 
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

                    return (
                      <tr key={rdo.id} className="hover:bg-slate-950/20 transition-colors">
                        <td className="py-4 px-5">
                          <span className="font-mono font-black text-slate-100 bg-slate-950 border border-slate-850 px-2.5 py-1 rounded-md">
                            {rdo.data.split('-').reverse().join('/')}
                          </span>
                        </td>
                        <td className="py-4 px-5">
                          <span className="font-bold text-slate-200 block">{ob ? ob.nome : 'Obra Geral'}</span>
                          <span className="text-[10px] text-slate-500 font-mono uppercase">{ob ? ob.endereco : '—'}</span>
                        </td>
                        <td className="py-4 px-5 text-slate-400 truncate max-w-[120px]" title={emp ? emp.nome : ''}>
                          {emp ? emp.nome : '—'}
                        </td>
                        <td className="py-4 px-5">
                          <p className="text-xs text-slate-300 font-semibold max-w-xs line-clamp-2" title={rdo.servicoExecutado}>
                            {rdo.servicoExecutado}
                          </p>
                          {rdo.pendencias && (
                            <span className="text-[9px] font-bold text-rose-400 block mt-1">⚠️ Pendência: {rdo.pendencias}</span>
                          )}
                        </td>
                        <td className="py-4 px-5 text-center font-mono font-bold text-slate-200">
                          {rdo.quantidadeEquipe} colab.
                        </td>
                        <td className="py-4 px-5">
                          <span className={`px-2.5 py-0.5 border text-[9px] font-bold rounded-full ${statusColor}`}>
                            {rdo.statusAtividade}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleOpenEdit(rdo)} className="p-1.5 bg-slate-800 text-slate-300 hover:text-emerald-400 rounded-lg cursor-pointer"><Edit className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDeleteTrigger(rdo.id)} className="p-1.5 bg-slate-800 text-slate-300 hover:text-rose-400 rounded-lg cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
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
              <h3 className="text-sm uppercase tracking-wider font-black text-white font-mono">⚠️ Confirmar Exclusão de Lançamento?</h3>
              <p className="text-xxs text-slate-400 mt-1 leading-relaxed">
                Você tem certeza que deseja excluir esta movimentação? Isso recalculará os saldos operacionais e consumo na mesma hora.
              </p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => executeDeletion(deleteConfirmId)}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Sim, Excluir
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

      {/* Modal de Conferência da Importação de Planilha — Prioridade 3 */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-3xl max-h-[85vh] bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 shadow-2xl space-y-4 flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-sm uppercase tracking-wider font-black text-white font-mono flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-400" />
                Conferência da Importação — {importFileName}
              </h3>
              <button onClick={handleCancelImport} className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-950 border border-slate-850 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Linhas encontradas</p>
                <p className="text-lg font-black text-white font-mono mt-0.5">{importSummary.total}</p>
              </div>
              <div className="bg-slate-950 border border-emerald-500/20 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Válidas</p>
                <p className="text-lg font-black text-emerald-400 font-mono mt-0.5">{importSummary.validas}</p>
              </div>
              <div className="bg-slate-950 border border-rose-500/20 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Com erro</p>
                <p className="text-lg font-black text-rose-400 font-mono mt-0.5">{importSummary.comErro}</p>
              </div>
              <div className="bg-slate-950 border border-amber-500/20 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Duplicadas</p>
                <p className="text-lg font-black text-amber-400 font-mono mt-0.5">{importSummary.duplicadas}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border border-slate-850 rounded-xl">
              <table className="w-full text-left border-collapse text-xxs">
                <thead className="sticky top-0 bg-slate-950">
                  <tr className="text-slate-400 uppercase text-[10px] font-bold">
                    <th className="py-2 px-3">Linha</th>
                    <th className="py-2 px-3">Data</th>
                    <th className="py-2 px-3">Frota</th>
                    <th className="py-2 px-3">Litros</th>
                    <th className="py-2 px-3">Combustível</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {importRows.map(r => (
                    <tr key={r.linha} className={!r.valido ? 'bg-rose-500/5' : ''}>
                      <td className="py-2 px-3 text-slate-500 font-mono">{r.linha}</td>
                      <td className="py-2 px-3 text-slate-300">{r.preview.Data}</td>
                      <td className="py-2 px-3 text-slate-300">{r.preview.Frota}</td>
                      <td className="py-2 px-3 text-slate-300">{r.preview.Litros}</td>
                      <td className="py-2 px-3 text-slate-300">{r.preview['Combustível']}</td>
                      <td className="py-2 px-3">
                        {r.valido ? (
                          <span className="text-emerald-400 font-bold">✔ Válido</span>
                        ) : r.duplicado ? (
                          <span className="text-amber-400 font-bold">Duplicado</span>
                        ) : (
                          <span className="text-rose-400 font-bold">Erro</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-500">{r.motivo || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={handleConfirmImport}
                disabled={importSummary.validas === 0 || isConfirmingImport}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                {isConfirmingImport ? 'Importando...' : `Confirmar Importação (${importSummary.validas} registro(s))`}
              </button>
              <button
                onClick={handleCancelImport}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
