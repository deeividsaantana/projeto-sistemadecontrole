import type { Abastecimento } from '../types';

type PumpRecord = Pick<
  Abastecimento,
  'id' | 'data' | 'hora' | 'comboioId' | 'bombaInicial' | 'bombaFinal' | 'quantidadeLitros'
>;

const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));

export const fuelRecordOrderKey = (record: Pick<PumpRecord, 'data' | 'hora'>) =>
  `${record.data || '0000-00-00'}T${validTime(record.hora) ? record.hora : '23:59'}`;

export const findPreviousPumpForConvoy = (
  records: PumpRecord[],
  convoyId: string,
  referenceDate: string,
  referenceTime = '',
  excludeId = '',
) => {
  if (!convoyId || !referenceDate) return undefined;
  const limit = `${referenceDate}T${validTime(referenceTime) ? referenceTime : '24:00'}`;
  return records
    .filter(record =>
      record.id !== excludeId &&
      record.comboioId === convoyId &&
      Number.isFinite(Number(record.bombaFinal)) &&
      fuelRecordOrderKey(record) < limit
    )
    .sort((a, b) => fuelRecordOrderKey(b).localeCompare(fuelRecordOrderKey(a)) || b.id.localeCompare(a.id))[0];
};

export interface PumpContinuityIssue {
  recordId: string;
  previousRecordId: string;
  convoyId: string;
  expectedStart: number;
  informedStart: number;
  difference: number;
}

export const auditPumpContinuityByConvoy = (
  records: PumpRecord[],
  tolerance = 1,
): PumpContinuityIssue[] => {
  const previousByConvoy = new Map<string, PumpRecord>();
  const issues: PumpContinuityIssue[] = [];

  [...records]
    .sort((a, b) => fuelRecordOrderKey(a).localeCompare(fuelRecordOrderKey(b)) || a.id.localeCompare(b.id))
    .forEach(record => {
      if (!record.comboioId) return;
      const previous = previousByConvoy.get(record.comboioId);
      const informedStart = Number(record.bombaInicial);
      const expectedStart = Number(previous?.bombaFinal);
      if (
        previous &&
        Number.isFinite(informedStart) &&
        Number.isFinite(expectedStart) &&
        Math.abs(informedStart - expectedStart) > tolerance
      ) {
        issues.push({
          recordId: record.id,
          previousRecordId: previous.id,
          convoyId: record.comboioId,
          expectedStart,
          informedStart,
          difference: informedStart - expectedStart,
        });
      }
      previousByConvoy.set(record.comboioId, record);
    });

  return issues;
};
