import assert from 'node:assert/strict';
import test from 'node:test';
import { assertProcurementPermission } from '../api/_shared/procurement-authorization.js';

test('somente Bruno pode aprovar no servidor', () => {
  assert.doesNotThrow(() => assertProcurementPermission({ name: 'Bruno', role: 'aprovador' }, 'approve'));
  assert.throws(() => assertProcurementPermission({ name: 'Gerente auxiliar', role: 'aprovador' }, 'approve'), /403/);
  assert.throws(() => assertProcurementPermission({ name: 'Bruno', role: 'solicitante' }, 'approve'), /403/);
});

test('somente recepção/campo confirma recebimento no servidor', () => {
  assert.doesNotThrow(() => assertProcurementPermission({ name: 'Almoxarife', role: 'recebedor' }, 'receive'));
  assert.throws(() => assertProcurementPermission({ name: 'Cássia', role: 'suprimentos' }, 'receive'), /403/);
});

test('suprimentos mantém alçada de cotação e reagendamento', () => {
  assert.doesNotThrow(() => assertProcurementPermission({ name: 'Cássia', role: 'suprimentos' }, 'quote'));
  assert.doesNotThrow(() => assertProcurementPermission({ name: 'Sérgio', role: 'suprimentos' }, 'reschedule'));
  assert.throws(() => assertProcurementPermission({ name: 'Thiago', role: 'solicitante' }, 'reschedule'), /403/);
});
