export interface ProcurementKpiRecord {
  openedAt: string;
  quotedAt?: string;
  promisedEnd: string;
  receivedAt?: string;
  ordered: number;
  received: number;
}

const hoursBetween = (start: string, end: string) => {
  const value = (Date.parse(end) - Date.parse(start)) / 3_600_000;
  return Number.isFinite(value) && value >= 0 ? value : null;
};

const round = (value: number) => Math.round(value * 100) / 100;

export const calculateProcurementKpis = (records: readonly ProcurementKpiRecord[], now: string) => {
  const valid = records.filter(record => Date.parse(record.openedAt) >= 0 && Number.isFinite(record.ordered) && record.ordered > 0);
  if (!valid.length) return { total: 0, otifPercent: 0, latePercent: 0, averageLeadTimeHours: 0, averageQuotationSlaHours: 0 };
  const completed = valid.filter(record => Boolean(record.receivedAt));
  const otif = completed.filter(record => {
    const receivedOnTime = new Date(record.receivedAt!).toISOString().slice(0, 10) <= record.promisedEnd;
    return receivedOnTime && record.received >= record.ordered;
  }).length;
  const late = valid.filter(record => record.receivedAt
    ? new Date(record.receivedAt).toISOString().slice(0, 10) > record.promisedEnd
    : now.slice(0, 10) > record.promisedEnd).length;
  const leadTimes = completed.map(record => hoursBetween(record.openedAt, record.receivedAt!)).filter((value): value is number => value !== null);
  const quotationTimes = valid.map(record => record.quotedAt ? hoursBetween(record.openedAt, record.quotedAt) : null).filter((value): value is number => value !== null);
  return {
    total: valid.length,
    otifPercent: round((otif / valid.length) * 100),
    latePercent: round((late / valid.length) * 100),
    averageLeadTimeHours: leadTimes.length ? round(leadTimes.reduce((sum, value) => sum + value, 0) / leadTimes.length) : 0,
    averageQuotationSlaHours: quotationTimes.length ? round(quotationTimes.reduce((sum, value) => sum + value, 0) / quotationTimes.length) : 0,
  };
};
