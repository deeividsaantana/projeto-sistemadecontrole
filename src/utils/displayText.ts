/** Converte valores vindos de imports legados em texto seguro para a UI. */
export const displayText = (value: unknown, fallback = '—'): string => {
  if (typeof value === 'string' || typeof value === 'number') return String(value) || fallback;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['nome', 'name', 'label', 'descricao', 'value', 'id']) {
      if (typeof record[key] === 'string' || typeof record[key] === 'number') return String(record[key]);
    }
  }
  return fallback;
};
