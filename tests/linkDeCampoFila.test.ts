import assert from 'node:assert/strict';
import test from 'node:test';
import { applyFieldUpdates } from '../api/_shared/supabase-admin.js';

test('C4: edição pelo link troca payload.records em vez de criar chave com ponto', () => {
  const atual = { status: 'processed', payload: { grupoId: 'g1', data: '2026-10-18', records: [{ id: 'r1', status: 'Presente' }] } };
  const proximo = applyFieldUpdates(atual, { 'payload.records': [{ id: 'r1', status: 'Falta' }], status: 'pending' });
  assert.deepEqual(proximo.payload.records, [{ id: 'r1', status: 'Falta' }]);
  assert.equal(proximo.payload.grupoId, 'g1');
  assert.equal(proximo.status, 'pending');
  assert.equal(Object.keys(proximo).includes('payload.records'), false);
  assert.deepEqual(atual.payload.records, [{ id: 'r1', status: 'Presente' }], 'o original não muda');
});

test('C4: observação do dia entra dentro do payload', () => {
  const proximo = applyFieldUpdates({ payload: { data: '2026-10-18' } }, { 'payload.observacaoDia': 'Chuva' });
  assert.deepEqual(proximo.payload, { data: '2026-10-18', observacaoDia: 'Chuva' });
});
