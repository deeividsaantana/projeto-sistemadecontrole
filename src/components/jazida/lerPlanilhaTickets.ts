/**
 * Leitura da planilha de tickets (abas LIBERAÇÃO e RECEBIMENTO) pelo botão
 * "Importar planilha" de Viagens da jazida. Só lê e monta os tickets: quem
 * chama mostra a prévia e grava depois que a pessoa confirma. Linha
 * incompleta ou repetida entra como rascunho/conferência, nunca some.
 */
import type ExcelJS from 'exceljs';
import { loadValidatedWorkbook } from '../../utils/excelCorporate';
import { normalizeTicketNumber } from '../../utils/ticketNumberSequence';
import { ticketDuplicateKey } from '../../utils/ticketDuplicateDetection';
import type { DestinoObraJazida, EmpresaTicketJazida, TicketJazida, TipoMaterialJazida, TipoTicketJazida } from '../../types';
import { DESTINOS_OBRA, TIPOS_MATERIAL, equipmentPlate, type CadastrosDaJazida } from './constantes';

const normalizeImportHeader = (value: string) =>
  String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

const TICKET_COLUMN_SYNONYMS: Record<string, string[]> = {
  data: ['data'],
  ticketNumero: ['ticket nº', 'ticket n', 'ticket numero', 'ticket no'],
  prefixo: ['prefixo', 'frota'],
  familiaEquipamento: ['familia do equipamento', 'familia equipamento'],
  equipamentoNome: ['equipamento', 'equipamento descricao', 'equipamento / descricao', 'descricao'],
  placa: ['placa'],
  horaSaida: ['hora de saida', 'hora saida', 'saida'],
  horaChegada: ['hora de chegada', 'hora chegada', 'chegada'],
  tipoMaterial: ['tipo de material', 'material'],
  quantidadeM3: ['quantidade m3', 'quantidade m³', 'quantidade', 'qtd m3', 'qtd m³'],
  destinoObra: ['destino obra', 'destino / obra', 'destino'],
  ramoDescarga: ['ramo de descarga', 'ramo descarga', 'ramo'],
  empresa: ['empresa'],
  estaca: ['estaca'],
  status: ['status conferencia', 'status / conferencia', 'status', 'conferencia'],
};

const readCellValue = (cell: ExcelJS.Cell): ExcelJS.CellValue => {
  const value = cell.value;
  if (value && typeof value === 'object') {
    const record = value as unknown as Record<string, unknown>;
    if (record.result !== undefined) return record.result as ExcelJS.CellValue;
    if (record.text !== undefined) return record.text as ExcelJS.CellValue;
    if (Array.isArray(record.richText)) {
      return record.richText
        .map(part => (typeof (part as Record<string, unknown>)?.text === 'string' ? (part as Record<string, unknown>).text : ''))
        .join('') as ExcelJS.CellValue;
    }
  }
  return value;
};

const parseDateValue = (value: ExcelJS.CellValue) => {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    const parsed = new Date(Math.round((value - 25569) * 86400 * 1000));
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  const br = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (br) return `${br[3].length === 2 ? `20${br[3]}` : br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  return iso ? `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}` : '';
};

const parseTimeValue = (value: ExcelJS.CellValue) => {
  if (!value) return '';
  if (value instanceof Date) return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  if (typeof value === 'number') {
    let totalMinutes = Math.round((value % 1) * 24 * 60);
    if (totalMinutes < 0) totalMinutes += 24 * 60;
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
  }
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '';
};

const parseNumberValue = (value: ExcelJS.CellValue) => {
  if (typeof value === 'number') return value;
  const parsed = Number(String(value || '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeMaterialValue = (value: ExcelJS.CellValue): TipoMaterialJazida => {
  const text = String(value || '').trim();
  return TIPOS_MATERIAL.find(item => item.toLowerCase() === text.toLowerCase()) || 'Outros';
};

const normalizeEmpresaValue = (value: ExcelJS.CellValue): EmpresaTicketJazida => {
  const text = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (text.includes('terce')) return 'Terceiro';
  if (text.includes('outro')) return 'Outros';
  return 'RENEA';
};

const normalizeStatusValue = (value: ExcelJS.CellValue): TicketJazida['status'] => {
  const text = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (text.includes('duplic')) return 'Duplicado';
  if (text.includes('quant')) return 'Verificar quantidade';
  if (text.includes('bomba')) return 'Verificar bomba';
  if (text.includes('pend')) return 'Pendente';
  if (text.includes('erro')) return 'Erro de importação';
  return 'OK';
};

const normalizeDestinoValue = (value: ExcelJS.CellValue): DestinoObraJazida => {
  const text = String(value || '').trim();
  if (!text) return 'Outros';
  const normalized = normalizeImportHeader(text);
  if (normalized === 'renea' || /^\d+$/.test(normalized)) return 'Outros';
  return DESTINOS_OBRA.find(item => normalizeImportHeader(item) === normalized) || text;
};

const buildTicketColumnMap = (row: ExcelJS.Row) => {
  const colMap: Record<string, number> = {};
  row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const header = normalizeImportHeader(String(readCellValue(cell) || ''));
    Object.entries(TICKET_COLUMN_SYNONYMS).forEach(([key, aliases]) => {
      if (!colMap[key] && aliases.some(alias => normalizeImportHeader(alias) === header)) colMap[key] = colNumber;
    });
  });
  return colMap;
};

const findTicketHeaderRow = (ws: ExcelJS.Worksheet) => {
  let bestRow = 1;
  let bestScore = 0;
  for (let rowNumber = 1; rowNumber <= Math.min(ws.rowCount, 20); rowNumber += 1) {
    const map = buildTicketColumnMap(ws.getRow(rowNumber));
    const score = ['data', 'ticketNumero', 'prefixo', 'placa', 'tipoMaterial', 'quantidadeM3'].filter(key => map[key]).length;
    if (score > bestScore) {
      bestScore = score;
      bestRow = rowNumber;
    }
  }
  return bestScore >= 4 ? bestRow : 0;
};

export interface PlanilhaDeTickets { imported: TicketJazida[]; ignored: number }

export const lerPlanilhaDeTickets = async (
  file: File,
  tickets: readonly TicketJazida[],
  { findEquipmentByPrefix, resolveDestinationIds, originLocationId }: CadastrosDaJazida,
): Promise<PlanilhaDeTickets> => {
  const wb = await loadValidatedWorkbook(file);
  const worksheets = wb.worksheets.filter(ws => {
    const name = normalizeImportHeader(ws.name);
    return name.includes('liberacao') || name.includes('recebimento');
  });
  const targetSheets = worksheets.length ? worksheets : wb.worksheets;
  const imported: TicketJazida[] = [];
  let ignored = 0;
  const seen = new Set(tickets.filter(item => normalizeTicketNumber(item.ticketNumero)).map(ticketDuplicateKey));

  targetSheets.forEach(ws => {
    const sheetName = normalizeImportHeader(ws.name);
    const tipo: TipoTicketJazida = sheetName.includes('recebimento') ? 'Recebimento' : 'Liberação';
    const headerRowNumber = findTicketHeaderRow(ws);
    if (!headerRowNumber) return;
    const colMap = buildTicketColumnMap(ws.getRow(headerRowNumber));
    const getValue = (row: ExcelJS.Row, key: string) => colMap[key] ? readCellValue(row.getCell(colMap[key])) : undefined;

    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber <= headerRowNumber) return;
      const dataImportada = parseDateValue(getValue(row, 'data'));
      const ticketImportado = String(getValue(row, 'ticketNumero') || '').trim();
      const prefixoImportado = String(getValue(row, 'prefixo') || '').trim().toUpperCase();
      const placaImportada = String(getValue(row, 'placa') || '').trim().toUpperCase();
      const equipamentoEncontrado = findEquipmentByPrefix(prefixoImportado);
      const quantidadeImportada = parseNumberValue(getValue(row, 'quantidadeM3'));
      const materialImportado = getValue(row, 'tipoMaterial');
      const destinoImportado = getValue(row, tipo === 'Recebimento' ? 'ramoDescarga' : 'destinoObra');
      const hasRecognizedValue = Boolean(
        dataImportada || ticketImportado || prefixoImportado || placaImportada || quantidadeImportada || materialImportado || destinoImportado
      );
      if (!hasRecognizedValue) {
        ignored += 1;
        return;
      }
      const key = ticketImportado ? `${tipo}|${normalizeTicketNumber(ticketImportado)}` : '';
      const duplicate = Boolean(key && seen.has(key));
      if (key) seen.add(key);
      const hora = parseTimeValue(getValue(row, tipo === 'Recebimento' ? 'horaChegada' : 'horaSaida')) || '00:00';
      const materialNormalizado = normalizeMaterialValue(materialImportado);
      const destinoNormalizado = normalizeDestinoValue(destinoImportado);
      const destinationIds = resolveDestinationIds(destinoNormalizado);
      const missingFields = [
        !dataImportada && 'data',
        !ticketImportado && 'número',
        !prefixoImportado && 'prefixo',
        !quantidadeImportada && 'quantidade',
      ].filter(Boolean) as string[];
      const reviewNotes = [
        `Importado de ${file.name} / ${ws.name} / linha ${rowNumber}`,
        duplicate ? 'Possível duplicidade preservada para conferência.' : '',
        missingFields.length ? `Campos pendentes: ${missingFields.join(', ')}.` : '',
      ].filter(Boolean);
      imported.push({
        id: `ticket-import-${Date.now()}-${rowNumber}-${imported.length}`,
        data: dataImportada || '',
        tipoTicket: tipo,
        ticketNumero: ticketImportado ? normalizeTicketNumber(ticketImportado) : '',
        prefixo: prefixoImportado,
        placa: placaImportada || (equipamentoEncontrado ? equipmentPlate(equipamentoEncontrado) : ''),
        familiaEquipamento: String(getValue(row, 'familiaEquipamento') || equipamentoEncontrado?.tipo || '').trim(),
        equipamentoNome: String(getValue(row, 'equipamentoNome') || equipamentoEncontrado?.nome || '').trim(),
        horaChegada: tipo === 'Recebimento' ? hora : undefined,
        horaSaida: tipo === 'Liberação' ? hora : '',
        tipoMaterial: materialNormalizado,
        quantidadeM3: quantidadeImportada,
        destinoObra: destinoNormalizado,
        estaca: tipo === 'Recebimento' ? String(getValue(row, 'estaca') || '').trim() : '',
        responsavelLiberacao: '',
        nomeLegivel: '',
        empresa: normalizeEmpresaValue(getValue(row, 'empresa')),
        observacao: reviewNotes.join(' | '),
        status: duplicate ? 'Duplicado' : missingFields.length ? 'Erro de importação' : normalizeStatusValue(getValue(row, 'status')),
        statusFluxo: missingFields.length ? 'Rascunho' : 'Enviado',
        origemRegistro: 'Importação',
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
        equipamentoId: equipamentoEncontrado?.id,
        localOrigemId: originLocationId,
        localDestinoId: destinationIds.localDestinoId,
      });
    });
  });

  return { imported, ignored };
};
