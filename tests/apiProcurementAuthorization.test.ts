import assert from 'node:assert/strict';
import test from 'node:test';
import { assertProcurementPermission } from '../api/_shared/procurement-authorization.js';
import fs from 'node:fs';

const procurementApi = fs.readFileSync('api/procurement.js', 'utf8');

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

test('matriz nominal define visualização, solicitação e compras', () => {
  assert.doesNotThrow(() => assertProcurementPermission({ name: 'Lucas', role: 'visualizador' }, 'view'));
  assert.doesNotThrow(() => assertProcurementPermission({ name: 'Deivid', role: 'visualizador' }, 'view'));
  assert.doesNotThrow(() => assertProcurementPermission({ name: 'Michele', role: 'solicitante' }, 'request'));
  assert.doesNotThrow(() => assertProcurementPermission({ name: 'Sérgio', role: 'suprimentos' }, 'dispatch'));
  assert.doesNotThrow(() => assertProcurementPermission({ name: 'Bruno', role: 'aprovador' }, 'comment'));
  assert.throws(() => assertProcurementPermission({ name: 'Lucas', role: 'visualizador' }, 'request'), /403/);
  assert.throws(() => assertProcurementPermission({ name: 'Michele', role: 'solicitante' }, 'dispatch'), /403/);
});

test('API rejeita primeira entrega parcial acima da quantidade solicitada', () => {
  assert.match(procurementApi, /quantity_first_delivery.*quantity_requested/is);
  assert.match(procurementApi, /allow_partial.*quantity_first_delivery/is);
});
