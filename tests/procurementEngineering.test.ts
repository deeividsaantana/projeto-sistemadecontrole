import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileThreeWay, validateDrawingRevision, validateTheoreticalDeviation } from '../src/modules/procurement/engineeringValidation';

test('aceita desenho executivo R3/R4 e bloqueia revisão obsoleta', () => {
  assert.equal(validateDrawingRevision('AB-SPM-001.R3'), null);
  assert.equal(validateDrawingRevision('AB-SPM-001.R4'), null);
  assert.match(validateDrawingRevision('AB-SPM-001.R1') || '', /obsoleta/i);
  assert.match(validateDrawingRevision('AB-SPM-001') || '', /revisão/i);
});

test('alerta divergência teórica acima de 5%', () => {
  assert.deepEqual(validateTheoreticalDeviation(100, 104), { percentual: 4, alerta: false });
  assert.deepEqual(validateTheoreticalDeviation(100, 106), { percentual: 6, alerta: true });
  assert.throws(() => validateTheoreticalDeviation(0, 1), /teórico/i);
});

test('3-way match exige pedido, NF e RDO/balança compatíveis', () => {
  assert.equal(reconcileThreeWay({ pedido: 100, notaFiscal: 100, rdoBalanca: 100, tolerancia: 0.05 }).ok, true);
  const divergente = reconcileThreeWay({ pedido: 100, notaFiscal: 100, rdoBalanca: 106, tolerancia: 0.05 });
  assert.equal(divergente.ok, false);
  assert.match(divergente.motivo || '', /5%/);
});
