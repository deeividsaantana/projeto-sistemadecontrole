import assert from 'node:assert/strict';
import test from 'node:test';
import { auditPumpContinuityByConvoy, findPreviousPumpForConvoy } from '../src/utils/fuelPumpSequence';

const records = [
  { id: 'a1', data: '2026-07-01', hora: '08:00', comboioId: 'A', bombaInicial: 1000, bombaFinal: 1100, quantidadeLitros: 100 },
  { id: 'b1', data: '2026-07-01', hora: '08:10', comboioId: 'B', bombaInicial: 5000, bombaFinal: 5075, quantidadeLitros: 75 },
  { id: 'a2', data: '2026-07-01', hora: '09:00', comboioId: 'A', bombaInicial: 1100, bombaFinal: 1150, quantidadeLitros: 50 },
  { id: 'b2', data: '2026-07-01', hora: '09:10', comboioId: 'B', bombaInicial: 5075, bombaFinal: 5125, quantidadeLitros: 50 },
];

test('localiza a leitura anterior somente do mesmo comboio', () => {
  assert.equal(findPreviousPumpForConvoy(records, 'A', '2026-07-01', '08:30')?.id, 'a1');
  assert.equal(findPreviousPumpForConvoy(records, 'B', '2026-07-01', '08:30')?.id, 'b1');
});

test('lançamento retroativo usa a leitura anterior pela data e hora', () => {
  assert.equal(findPreviousPumpForConvoy(records, 'A', '2026-07-01', '08:45')?.bombaFinal, 1100);
  assert.equal(findPreviousPumpForConvoy(records, 'A', '2026-07-01')?.bombaFinal, 1150);
});

test('auditoria não mistura sequências de comboios intercalados', () => {
  assert.deepEqual(auditPumpContinuityByConvoy(records), []);
  const inconsistent = records.map(record => record.id === 'b2' ? { ...record, bombaInicial: 1100 } : record);
  assert.deepEqual(auditPumpContinuityByConvoy(inconsistent).map(issue => issue.recordId), ['b2']);
});

test('leituras de bomba vazias não quebram a sequência conhecida do comboio', () => {
  const withMissingReading = [
    records[0],
    { id: 'a-sem-bomba', data: '2026-07-01', hora: '08:30', comboioId: 'A', bombaInicial: 0, bombaFinal: 0, quantidadeLitros: 40 },
    records[2],
  ];
  assert.equal(findPreviousPumpForConvoy(withMissingReading, 'A', '2026-07-01', '08:45')?.id, 'a1');
  assert.deepEqual(auditPumpContinuityByConvoy(withMissingReading), []);
});
