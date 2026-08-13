export interface ParsedOperationalTime {
  raw: string;
  hours: number;
  minutes: number;
  totalMinutes: number;
  valid: boolean;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

export const isValidIsoDate = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  const match = DATE_PATTERN.exec(value.trim());
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.getFullYear() === Number(year)
    && date.getMonth() === Number(month) - 1
    && date.getDate() === Number(day);
};

export const normalizeIsoDate = (
  value: unknown,
  fallback = '',
): string => {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const text = String(value ?? '').trim();
  if (isValidIsoDate(text)) return text;
  const brazilian = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(text);
  if (brazilian) {
    const [, day, month, year] = brazilian;
    const candidate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    return isValidIsoDate(candidate) ? candidate : fallback;
  }
  const excelSerial = Number(text.replace(',', '.'));
  if (Number.isFinite(excelSerial) && excelSerial > 20_000 && excelSerial < 80_000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + excelSerial * 86_400_000);
    return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : fallback;
  }
  return fallback;
};

export const parseOperationalTime = (value: unknown): ParsedOperationalTime => {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    const hours = value.getHours();
    const minutes = value.getMinutes();
    return {
      raw: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      hours,
      minutes,
      totalMinutes: hours * 60 + minutes,
      valid: true,
    };
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const dayFraction = ((value % 1) + 1) % 1;
    const totalMinutes = Math.round(dayFraction * 24 * 60) % (24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return {
      raw: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      hours,
      minutes,
      totalMinutes,
      valid: true,
    };
  }
  const text = String(value ?? '').trim();
  const match = TIME_PATTERN.exec(text);
  if (!match) return { raw: text, hours: 0, minutes: 0, totalMinutes: 0, valid: false };
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || 0);
  if (hours > 23 || minutes > 59 || seconds > 59) {
    return { raw: text, hours, minutes, totalMinutes: 0, valid: false };
  }
  return {
    raw: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    hours,
    minutes,
    totalMinutes: hours * 60 + minutes + Math.round(seconds / 60),
    valid: true,
  };
};

export const normalizeOperationalTime = (value: unknown): string => {
  const parsed = parseOperationalTime(value);
  return parsed.valid ? parsed.raw : '';
};

export const combineOperationalDateTime = (
  date: string,
  time: string,
): Date | undefined => {
  if (!isValidIsoDate(date)) return undefined;
  const parsedTime = parseOperationalTime(time);
  if (!parsedTime.valid) return undefined;
  const [year, month, day] = date.split('-').map(Number);
  const result = new Date(year, month - 1, day, parsedTime.hours, parsedTime.minutes, 0, 0);
  return Number.isFinite(result.getTime()) ? result : undefined;
};

export const calculateDurationMinutes = (
  date: string,
  startTime?: string,
  endTime?: string,
  now = new Date(),
): number | undefined => {
  if (!startTime) return undefined;
  const start = combineOperationalDateTime(date, startTime);
  if (!start) return undefined;
  const explicitEnd = endTime ? combineOperationalDateTime(date, endTime) : undefined;
  let end = explicitEnd ?? now;
  if (explicitEnd && explicitEnd.getTime() < start.getTime()) {
    end = new Date(explicitEnd.getTime() + 86_400_000);
  }
  if (!explicitEnd && now.getTime() < start.getTime()) return undefined;
  const minutes = Math.floor((end.getTime() - start.getTime()) / 60_000);
  return minutes >= 0 && minutes <= 30 * 24 * 60 ? minutes : undefined;
};

export const calculateStoppedMinutes = (
  date: string,
  maintenanceEntryTime?: string,
  releaseTime?: string,
  availableSince?: string,
  now = new Date(),
): number | undefined => {
  if (maintenanceEntryTime) {
    return calculateDurationMinutes(date, maintenanceEntryTime, releaseTime, now);
  }
  if (availableSince) {
    return calculateDurationMinutes(date, availableSince, undefined, now);
  }
  return undefined;
};

export const formatDurationMinutes = (
  value: number | undefined,
  emptyLabel = '—',
): string => {
  if (value === undefined || !Number.isFinite(value) || value < 0) return emptyLabel;
  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const formatBrazilianDate = (
  value: string,
  emptyLabel = 'Não informado',
): string => {
  if (!isValidIsoDate(value)) return emptyLabel;
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
};

export const formatBrazilianDateTime = (
  value: string,
  emptyLabel = 'Não informado',
): string => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return emptyLabel;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

export const compareOperationalTimestamps = (
  left: string,
  right: string,
): number => {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (!Number.isFinite(leftTime) && !Number.isFinite(rightTime)) return 0;
  if (!Number.isFinite(leftTime)) return 1;
  if (!Number.isFinite(rightTime)) return -1;
  return leftTime - rightTime;
};

export const isChronological = (timestamps: string[]): boolean => {
  const valid = timestamps.map(Date.parse).filter(Number.isFinite);
  return valid.every((value, index) => index === 0 || value >= valid[index - 1]);
};

export const getOperationalNowIso = (): string => new Date().toISOString();

export const getOperationalToday = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
