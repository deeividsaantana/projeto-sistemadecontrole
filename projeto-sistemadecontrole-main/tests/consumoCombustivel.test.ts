import assert from 'node:assert/strict';
import test from 'node:test';
import type { Abastecimento } from '../src/types';
import { abastecimentoAnterior, calcularConsumo } from '../src/utils/fuelOperations';

const abastecimento = (extra: Partial<Abastecimento>): Abastecimento => ({
  id: 'a1',
  data: '2026-09-01',
  hora: '08:00',
  equipamentoId: 'eq-1',
  horimetroInicial: 0,
  kmInicial: 0,
  bombaInicial: 0,
  quantidadeLitros: 100,
  bombaFinal: 0,
  tipoCombustivelId: 'tc-1',
  comboioId: 'c-1',
  responsavel: 'Abastecedor',
  observacao: '',
  ...extra,
});

test('veículo com KM crescente rende km por litro', () => {
  const consumo = calcularConsumo(
    abastecimento({ kmInicial: 1500, quantidadeLitros: 100 }),
    abastecimento({ kmInicial: 1200 }),
  );
  assert.deepEqual(consumo, { unidade: 'km/L', valor: 3, percorrido: 300 });
});

test('equipamento com horímetro crescente rende litros por hora', () => {
  const consumo = calcularConsumo(
    abastecimento({ horimetroInicial: 520, quantidadeLitros: 200 }),
    abastecimento({ horimetroInicial: 500 }),
  );
  assert.deepEqual(consumo, { unidade: 'L/h', valor: 10, percorrido: 20 });
});

test('sem abastecimento anterior não há consumo', () => {
  assert.equal(calcularConsumo(abastecimento({ kmInicial: 1500 })), undefined);
});

test('leitura parada ou regredida não vira consumo', () => {
  assert.equal(
    calcularConsumo(abastecimento({ kmInicial: 1200 }), abastecimento({ kmInicial: 1200 })),
    undefined,
  );
  assert.equal(
    calcularConsumo(abastecimento({ horimetroInicial: 480 }), abastecimento({ horimetroInicial: 500 })),
    undefined,
  );
});

test('KM tem prioridade sobre horímetro quando os dois crescem', () => {
  const consumo = calcularConsumo(
    abastecimento({ kmInicial: 1400, horimetroInicial: 520, quantidadeLitros: 100 }),
    abastecimento({ kmInicial: 1200, horimetroInicial: 500 }),
  );
  assert.equal(consumo?.unidade, 'km/L');
});

test('anterior é o do mesmo equipamento mais próximo no tempo', () => {
  const atual = abastecimento({ id: 'atual', data: '2026-09-03', hora: '09:00' });
  const anterior = abastecimentoAnterior(atual, [
    atual,
    abastecimento({ id: 'antigo', data: '2026-09-01' }),
    abastecimento({ id: 'ontem', data: '2026-09-02' }),
    abastecimento({ id: 'outro-eq', data: '2026-09-02', equipamentoId: 'eq-9' }),
    abastecimento({ id: 'futuro', data: '2026-09-05' }),
  ]);
  assert.equal(anterior?.id, 'ontem');
});
