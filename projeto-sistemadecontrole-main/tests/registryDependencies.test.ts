import assert from 'node:assert/strict';
import test from 'node:test';
import type { Abastecimento, ApontamentoOperacional, Equipamento, Lubrificacao } from '../src/types';
import { obraDependencies, registryDependencies } from '../src/masterData/registryDependencies';

const fuel = { id: 'ab1', comboioId: 'co1', tipoCombustivelId: 'tc1' } as Abastecimento;
const equipment = { id: 'eq1', combustivelId: 'tc1' } as Equipamento;
const lubrication = { id: 'lu1', produtoLubrificacaoId: 'pl1' } as Lubrificacao;
const work = { id: 'ap1', etapaServicoId: 'es1' } as ApontamentoOperacional;
const data = { abastecimentos: [fuel], equipamentos: [equipment], lubrificacoes: [lubrication], apontamentos: [work] };

test('comboio usado em abastecimento não pode ser excluído', () => {
  assert.deepEqual(registryDependencies('comboio', 'co1', data), [{ collection: 'Abastecimentos', count: 1 }]);
  assert.deepEqual(registryDependencies('comboio', 'outro', data), []);
});

test('combustível mantém referências de abastecimento e equipamento', () => {
  assert.deepEqual(registryDependencies('combustivel', 'tc1', data), [
    { collection: 'Abastecimentos', count: 1 },
    { collection: 'Equipamentos', count: 1 },
  ]);
});

test('lubrificante e etapa mantêm lançamentos históricos', () => {
  assert.deepEqual(registryDependencies('lubrificante', 'pl1', data), [{ collection: 'Lubrificações', count: 1 }]);
  assert.deepEqual(registryDependencies('etapa', 'es1', data), [{ collection: 'Apontamentos', count: 1 }]);
});

test('obra/local não pode ser removido enquanto frota ou operação usam seu ID', () => {
  const usage = {
    equipamentos: [{ ...equipment, localAtualId: 'obra1' }],
    collections: {
      'Diários': [{ id: 'dia1', obraId: 'obra1' }],
      'Medições': [{ id: 'med1', obraId: 'outra' }],
    },
  };
  assert.deepEqual(obraDependencies('obra1', usage), [
    { collection: 'Equipamentos', count: 1 },
    { collection: 'Diários', count: 1 },
  ]);
  assert.deepEqual(obraDependencies('sem-referencia', usage), []);
});
