export const TICKET_PREFIX = '100';

export const normalizeTicketNumber = (value: string | number) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith(TICKET_PREFIX) ? digits : `${TICKET_PREFIX}${digits}`;
};

export const baseTicketNumber = (value: string | number) => {
  const normalized = normalizeTicketNumber(value);
  return normalized.startsWith(TICKET_PREFIX)
    ? Number(normalized.slice(TICKET_PREFIX.length))
    : Number(normalized);
};

export const buildTicketNumberSequence = (
  start: string | number,
  quantity: number,
  step = 1,
  direction: 'crescente' | 'decrescente' = 'crescente',
) => {
  const base = baseTicketNumber(start);
  if (!Number.isFinite(base)) return [];
  const safeQuantity = Math.max(1, Math.min(200, Math.floor(Number(quantity) || 1)));
  const safeStep = Math.max(1, Math.floor(Number(step) || 1));
  const signal = direction === 'decrescente' ? -1 : 1;
  return Array.from({ length: safeQuantity }, (_, index) =>
    normalizeTicketNumber(base + signal * index * safeStep)
  );
};
