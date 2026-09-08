import assert from 'node:assert/strict';
import test from 'node:test';
import { diaDoHistorico, instanteDoHistorico } from '../src/utils/formato';

test('carimbo do histórico em pt-BR vira instante correto', () => {
  const brasileiro = instanteDoHistorico('08/09/2026, 11:42:00');
  assert.equal(new Date(brasileiro).getDate(), 8);
  assert.equal(new Date(brasileiro).getMonth(), 8);
  assert.equal(new Date(brasileiro).getFullYear(), 2026);
  assert.equal(diaDoHistorico('08/09/2026, 11:42:00'), '2026-09-08');
});

test('ordenar pelo texto inverteria a ordem que o instante acerta', () => {
  const trinta = '30/08/2026, 09:00:00';
  const oito = '08/09/2026, 09:00:00';
  assert.ok(trinta.localeCompare(oito) > 0, 'o texto coloca 30/08 na frente');
  assert.ok(instanteDoHistorico(oito) > instanteDoHistorico(trinta), 'o instante corrige');
});

test('carimbo ISO antigo continua sendo entendido', () => {
  assert.equal(diaDoHistorico('2026-09-08T11:42:00.000Z'), new Date('2026-09-08T11:42:00.000Z').getFullYear() + '-09-08');
});

test('carimbo vazio ou quebrado não vira data inventada', () => {
  assert.ok(Number.isNaN(instanteDoHistorico('')));
  assert.ok(Number.isNaN(instanteDoHistorico('ontem à tarde')));
  assert.equal(diaDoHistorico(undefined), '');
});
