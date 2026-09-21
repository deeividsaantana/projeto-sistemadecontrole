// src/imports/normalizers.ts
import { cleanImportValue, parseImportNumber, toImportIsoDate } from '../utils/importHelpers';
import { normalizePlate, normalizePrefix } from '../utils/canonicalIdentity';

export const normalizeImportDateOrNull = (value: unknown): string | null => {
  const iso = toImportIsoDate(value);
  return iso || null;
};

/** Aceita "HH:mm", "HHhmm", Date e serial Excel (fração do dia). */
export const normalizeImportTimeOrNull = (value: unknown): string | null => {
  if (value instanceof Date) return value.toISOString().slice(11, 16);
  if (typeof value === 'number' && Number.isFinite(value)) {
    const fraction = value < 1 ? value : value - Math.floor(value);
    const totalMinutes = Math.round(fraction * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  const text = cleanImportValue(value);
  const match = text.match(/^(\d{1,2})[:h](\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/**
 * parseImportNumber devolve 0 tanto para ausência quanto para "0" real; aqui
 * checamos o texto limpo primeiro para não confundir as duas coisas.
 */
export const normalizeImportDecimalOrNull = (value: unknown): number | null => {
  const text = cleanImportValue(value);
  if (!text) return null;
  return parseImportNumber(value);
};

const UNIT_ALIASES: Record<string, string> = {
  un: 'UN', und: 'UN', unid: 'UN', unidade: 'UN',
  pc: 'PC', pca: 'PC', pcs: 'PC', peca: 'PC',
  mt: 'MT', m: 'MT', metro: 'MT', metros: 'MT',
  m3: 'M3', ton: 'TON', t: 'TON', tonelada: 'TON', toneladas: 'TON',
};

export const normalizeImportUnitOrNull = (value: unknown): string | null => {
  const clean = cleanImportValue(value);
  if (!clean) return null;
  const key = clean.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim();
  return UNIT_ALIASES[key] || clean.toUpperCase();
};

export const normalizeImportInvoiceOrNull = (value: unknown): string | null => {
  const clean = cleanImportValue(value).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return clean || null;
};

export const normalizeImportPlateOrNull = (value: unknown): string | null => {
  const plate = normalizePlate(value);
  return plate || null;
};

export const normalizeImportPrefixOrNull = (value: unknown): string | null => {
  const prefix = normalizePrefix(value);
  return prefix || null;
};

export const normalizeImportTextOrNull = (value: unknown): string | null => {
  const clean = cleanImportValue(value);
  return clean || null;
};
