import assert from 'node:assert/strict';
import test from 'node:test';
import { applyFieldUpdates } from '../api/_shared/supabase-admin.js';
import { normalizeMaterialUseRows } from '../src/supabase/submissions';
import { movementsFromMaterialUse } from '../src/modules/materials/materialFieldUse';

test('C3: uso de material da fila chega com payload e vira saída de consumo', () => {
  const rows = [
    {
      id: 'material_uso_abc1234567890123',
      kind: 'material-uso',
      status: 'pending',
      created_at: '2026-10-18T12:00:00.000Z',
      payload: {
        data: '2026-10-18',
        etapaServicoId: 'ramo-1400',
        etapaServicoNome: 'Ramo 1400',
        apontador: 'João',
        itens: [{ materialId: 'tubo-600', materialDescricao: 'Tubo 600', unidade: 'm', quantidade: 12 }],
      },
    },
    { id: 'p1', kind: 'presence', status: 'pending', created_at: '2026-10-18T12:00:00.000Z', payload: { data: '2026-10-18' } },
  ];
  const fila = normalizeMaterialUseRows(rows as never);
  assert.equal(fila.length, 1);
  assert.equal(fila[0].createdAtIso, '2026-10-18T12:00:00.000Z');
  const saidas = movementsFromMaterialUse(fila[0]);
  assert.equal(saidas.length, 1);
  assert.equal(saidas[0].tipo, 'Saída');
  assert.equal(saidas[0].finalidade, 'Consumo');
  assert.equal(saidas[0].quantidade, 12);
  assert.equal(saidas[0].etapaServicoId, 'ramo-1400');
  assert.equal(saidas[0].origemApontamentoId, 'material_uso_abc1234567890123');
});

test('C3: envio de material sem itens fica de fora em vez de travar a fila', () => {
  const fila = normalizeMaterialUseRows([
    { id: 'x', kind: 'material-uso', status: 'pending', created_at: '2026-10-18T12:00:00.000Z', payload: { data: '2026-10-18' } },
  ] as never);
  assert.equal(fila.length, 0);
});

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
