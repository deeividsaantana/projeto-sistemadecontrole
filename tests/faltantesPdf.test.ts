import assert from 'node:assert/strict';
import test from 'node:test';
import { montarListaFaltantes } from '../src/fleet/faltantesPdf';

test('a lista de faltantes traz só quem não foi lançado, ordenado', () => {
  const conferencia = {
    equipamentos: {
      total: 3,
      informed: 1,
      items: [
        { prefix: 'CB790', equipmentType: 'Caminhão Basculante', group: 'Basculantes', informed: false },
        { prefix: 'CB770', equipmentType: 'Caminhão Basculante', group: 'Basculantes', informed: true },
        { prefix: 'CB789', equipmentType: 'Caminhão Basculante', group: 'Basculantes', informed: false },
      ],
    },
    operadores: {
      total: 2,
      informed: 1,
      items: [
        { nome: 'JOSE RICARDO', matricula: '2', informed: false },
        { nome: 'ADILSON PIRES', matricula: '1', informed: true },
      ],
    },
  } as never;
  const lista = montarListaFaltantes(conferencia, '2026-10-27');
  assert.deepEqual(lista.equipamentos.map(item => item.prefixo), ['CB789', 'CB790']);
  assert.deepEqual(lista.operadores.map(item => item.nome), ['JOSE RICARDO']);
  assert.equal(lista.esperadosEquipamentos, 3);
  assert.equal(lista.lancadosEquipamentos, 1);
});
