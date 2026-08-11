import type { Abastecimento } from '../types';

const cleanText = (value: unknown) => String(value ?? '')
  .replace(/[\u200B-\u200D\uFEFF]/g, '')
  .trim()
  .replace(/\s+/g, ' ');

const cleanPrefix = (value: unknown) => cleanText(value).toUpperCase().replace(/\s+/g, '');

const fixedNumber = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed.toFixed(4) : '';
};

export const buildFuelImportKey = (item: Partial<Abastecimento>) => [
  cleanText(item.data),
  cleanPrefix(item.prefixoInformado || item.equipamentoId),
  fixedNumber(item.quantidadeLitros),
  cleanText(item.hora),
  fixedNumber(item.bombaInicial),
  fixedNumber(item.bombaFinal),
].join('|');

export const isPublishableFuelImport = (item: Partial<Abastecimento>) => (
  /^\d{4}-\d{2}-\d{2}$/.test(cleanText(item.data))
  && Boolean(cleanPrefix(item.prefixoInformado || item.equipamentoId))
  && Number.isFinite(Number(item.quantidadeLitros))
  && Number(item.quantidadeLitros) > 0
);

export const filterNovelFuelImports = (
  existing: Abastecimento[],
  candidates: Abastecimento[],
) => {
  const seen = new Set(existing.filter(isPublishableFuelImport).map(buildFuelImportKey));
  const accepted: Abastecimento[] = [];
  const rejected: Abastecimento[] = [];

  candidates.forEach(item => {
    const key = buildFuelImportKey(item);
    if (!isPublishableFuelImport(item) || seen.has(key)) {
      rejected.push(item);
      return;
    }
    seen.add(key);
    accepted.push({ ...item, documentoOrigemHash: item.documentoOrigemHash || key });
  });

  return { accepted, rejected };
};
