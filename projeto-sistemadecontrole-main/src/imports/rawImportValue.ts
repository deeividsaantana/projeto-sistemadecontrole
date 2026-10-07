import { cleanImportValue, normalizeImportText } from '../utils/importHelpers';

/**
 * getImportValue (utils/importHelpers) sempre devolve o valor já passado por
 * cleanImportValue, que reduz qualquer Date a "AAAA-MM-DD" — certo para uma
 * coluna de data, mas apaga a hora de uma coluna de horário. Para campos de
 * horário precisamos do valor ainda bruto (Date/serial/texto) para repassar
 * a normalizeImportTimeOrNull, que sabe extrair hora:minuto de cada formato.
 * Mesma lógica de correspondência de getImportValue (exata, depois por
 * substring nos dois sentidos), só sem limpar o valor de retorno.
 */
export const getRawImportValue = (raw: Record<string, unknown>, aliases: readonly string[]): unknown => {
  const entries = Object.entries(raw).filter(([, value]) => cleanImportValue(value) !== '');
  for (const alias of aliases) {
    const normalizedAlias = normalizeImportText(alias);
    const exact = entries.find(([key]) => normalizeImportText(key) === normalizedAlias);
    if (exact) return exact[1];
  }
  for (const alias of aliases) {
    const normalizedAlias = normalizeImportText(alias);
    const match = entries.find(([key]) => {
      const normalizedKey = normalizeImportText(key);
      return normalizedKey.includes(normalizedAlias) || normalizedAlias.includes(normalizedKey);
    });
    if (match) return match[1];
  }
  return undefined;
};
