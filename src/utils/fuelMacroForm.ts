import type { Abastecimento, Equipamento, TipoCombustivel } from '../types';
import { normalizeQuickTime } from './combustivelValidation';
import { findPreviousPumpForConvoy } from './fuelPumpSequence';

const normalizeFuelText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const MONTHS = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

const normalizeSheetName = (sheetName: string) => String(sheetName || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

export const fuelSheetCompetence = (sheetName: string) => {
  const normalized = String(sheetName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  const year = Number(normalized.match(/20\d{2}/)?.[0] || 0);
  const month = MONTHS.findIndex(item => normalized.includes(item)) + 1;
  return year && month ? `${year}-${String(month).padStart(2, '0')}` : '';
};

export const isFuelImportWorksheet = (sheetName: string) => {
  const normalized = normalizeSheetName(sheetName);
  if (['equipamentos', 'combustiveis', 'comboios', 'resumogeral'].includes(normalized)) return false;
  return Boolean(
    fuelSheetCompetence(sheetName)
    || normalized === 'detalhe'
    || normalized === 'dadoscombustivel'
  );
};

export const normalizeConvoyCode = (value: string) => {
  const compact = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return compact.replace(/^TCQ/, 'TQC');
};

export const buildFuelImportObservation = ({
  sheetName,
  rowNumber,
  observacao,
  empresaTexto,
  frotaTexto,
  equipmentFound,
  tipoCombustivelTexto,
  comboioTexto,
  responsavel,
  quantidadeFoiCalculada,
  motivo,
}: {
  sheetName: string;
  rowNumber: number;
  observacao?: string;
  empresaTexto?: string;
  frotaTexto?: string;
  equipmentFound: boolean;
  tipoCombustivelTexto?: string;
  comboioTexto?: string;
  responsavel?: string;
  quantidadeFoiCalculada?: boolean;
  motivo?: string;
  rawRowText?: string;
}) => [
  observacao?.trim() || `Fonte: ${sheetName}:${rowNumber}`,
  empresaTexto?.trim() ? `Empresa informada na planilha: ${empresaTexto.trim()}.` : '',
  frotaTexto?.trim() && !equipmentFound ? `Prefixo informado sem cadastro: ${frotaTexto.trim()}.` : '',
  tipoCombustivelTexto?.trim() ? `Combustível informado na planilha: ${tipoCombustivelTexto.trim()}.` : '',
  comboioTexto?.trim() ? `Comboio informado na planilha: ${comboioTexto.trim()}.` : '',
  !responsavel?.trim() ? 'Responsável não informado na planilha; conferir no registro.' : '',
  quantidadeFoiCalculada ? 'Quantidade calculada pela diferença entre bomba final e inicial.' : '',
  motivo?.trim() || '',
].filter(Boolean).join(' | ');

/**
 * Leitor único de número do lançamento de diesel (A16). Vírgula é decimal;
 * sem vírgula, "1.250" e "45.320" são milhar (três dígitos depois de cada
 * ponto) e "12.5" é decimal.
 */
export const parseFuelFormNumber = (value: unknown, fallback = NaN) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  let text = String(value ?? '').trim()
    .replace(/['´`\s]/g, '');

  if (!text) return fallback;

  const comma = text.lastIndexOf(',');
  const dot = text.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    const decimalSeparator = comma > dot ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    text = text.replace(new RegExp(`\\${thousandsSeparator}`, 'g'), '');
    text = text.replace(decimalSeparator, '.');
  } else if (comma >= 0) {
    text = text.replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, '');
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const getDefaultDieselFuelId = (combustiveis: TipoCombustivel[]) => {
  const s10 = combustiveis.find(item => {
    const name = normalizeFuelText(item.nome);
    return name.includes('diesel') && name.includes('s10');
  });
  return s10?.id || combustiveis.find(item => normalizeFuelText(item.nome).includes('diesel'))?.id || combustiveis[0]?.id || '';
};

/**
 * Bomba inicial sugerida: a bomba final do abastecimento do mesmo comboio
 * logo antes da data e hora deste lançamento (A20), não o último da lista.
 */
export const resolveMacroPumpReadings = ({
  records,
  comboioId,
  data,
  hora,
  litros,
  bombaInicialManual,
}: {
  records: Abastecimento[];
  comboioId: string;
  data: string;
  hora: string;
  litros: unknown;
  bombaInicialManual?: unknown;
}) => {
  const bombaDigitada = parseFuelFormNumber(bombaInicialManual, NaN);
  const horaLimpa = normalizeQuickTime(hora);
  const bombaInicial = Number.isFinite(bombaDigitada) && bombaDigitada > 0
    ? bombaDigitada
    : Number(findPreviousPumpForConvoy(records, comboioId, data, horaLimpa.valid ? horaLimpa.value : '')?.bombaFinal || 0);
  const quantidadeLitros = parseFuelFormNumber(litros, 0);
  return {
    bombaInicial,
    bombaFinal: bombaInicial > 0 && quantidadeLitros > 0 ? bombaInicial + quantidadeLitros : 0,
  };
};

export const buildMacroFuelingRecord = ({
  id,
  equipment,
  prefixo,
  records,
  data,
  hora,
  litros,
  horimetro,
  km,
  tipoCombustivelId,
  comboioId,
  responsavel,
  bombaInicialManual,
  operador,
  local,
  observacao,
  nowIso,
}: {
  id: string;
  /** Sem cadastro, o abastecimento fica só com o prefixo digitado. */
  equipment?: Equipamento;
  prefixo?: string;
  records: Abastecimento[];
  data: string;
  hora: string;
  litros: unknown;
  horimetro: unknown;
  km: unknown;
  tipoCombustivelId: string;
  comboioId: string;
  responsavel: string;
  bombaInicialManual?: unknown;
  operador?: string;
  local?: string;
  observacao?: string;
  nowIso: string;
}): Abastecimento => {
  const normalizedTime = normalizeQuickTime(hora);
  const quantidadeLitros = parseFuelFormNumber(litros, 0);
  const { bombaInicial, bombaFinal } = resolveMacroPumpReadings({ records, comboioId, data, hora, litros: quantidadeLitros, bombaInicialManual });

  return {
    id,
    data,
    hora: normalizedTime.valid ? normalizedTime.value : hora,
    equipamentoId: equipment?.id || '',
    prefixoInformado: equipment?.prefixo || (prefixo || '').trim().toUpperCase(),
    horimetroInicial: parseFuelFormNumber(horimetro, 0),
    kmInicial: parseFuelFormNumber(km, 0),
    bombaInicial,
    quantidadeLitros,
    bombaFinal,
    tipoCombustivelId,
    comboioId,
    responsavel: responsavel.trim() || 'Nao informado',
    operadorNome: operador?.trim() || undefined,
    localAbastecimento: local?.trim() || undefined,
    observacao: observacao?.trim() || '',
    status: 'OK',
    origem: 'Manual',
    competencia: data.slice(0, 7),
    criadoEm: nowIso,
    atualizadoEm: nowIso,
  };
};
