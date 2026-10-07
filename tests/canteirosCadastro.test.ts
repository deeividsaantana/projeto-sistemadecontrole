import assert from 'node:assert/strict';
import test from 'node:test';
import type { DadosCadastros } from '../src/utils/cadastrosLista';
import type { Canteiro } from '../src/types';
import { montarRegistro, valoresIniciais } from '../src/components/cadastros/camposCadastro';
import { registrosComCanteiroRenomeado } from '../src/utils/frenteServico';

const dados: DadosCadastros = {
  empresas: [], funcionarios: [], equipamentos: [], obras: [], comboios: [], combustiveis: [],
  lubrificantes: [], canteiros: [{ id: 'cant-1', nome: 'Fábrica' }, { id: 'cant-2', nome: 'Marginal' }],
  etapas: [], frentesServico: [], servicosObra: [],
};

test('canteiro novo entra com nome preenchido', () => {
  const valores = { ...valoresIniciais('canteiros', undefined, dados), nome: 'Pátio Novo' };
  const resultado = montarRegistro('canteiros', valores, undefined, 'cant-3', dados);
  assert.equal(resultado.ok, true);
  if (resultado.ok) assert.deepEqual(resultado.registro as Canteiro, { id: 'cant-3', nome: 'Pátio Novo' });
});

test('canteiro não aceita nome repetido, mas aceita editar mantendo o próprio nome', () => {
  const duplicado = montarRegistro('canteiros', { nome: 'fabrica' }, undefined, 'cant-3', dados);
  assert.equal(duplicado.ok, false);

  const mesmoItem = montarRegistro('canteiros', { nome: 'Fábrica' }, dados.canteiros[0], 'cant-1', dados);
  assert.equal(mesmoItem.ok, true);
});

test('canteiro sem nome não passa na validação obrigatória', () => {
  const resultado = montarRegistro('canteiros', { nome: '' }, undefined, 'cant-3', dados);
  assert.equal(resultado.ok, false);
});

test('renomear canteiro reescreve só os lançamentos que citam o nome antigo', () => {
  const registros = [
    { id: 'r1', local: 'Fábrica' },
    { id: 'r2', local: 'Pátio Fábrica velha' },
    { id: 'r3', local: 'Fabricante Tal' },
    { id: 'r4', local: 'Marginal' },
    { id: 'r5', local: undefined },
  ];
  const { afetados, atualizados } = registrosComCanteiroRenomeado(registros, 'Fábrica', 'Fábrica Nova');
  assert.deepEqual(afetados.map(item => item.id), ['r1', 'r2'], '"Fabricante" não é a palavra inteira "Fábrica"');
  assert.deepEqual(atualizados, [
    { id: 'r1', local: 'Fábrica Nova' },
    { id: 'r2', local: 'Fábrica Nova' },
    { id: 'r3', local: 'Fabricante Tal' },
    { id: 'r4', local: 'Marginal' },
    { id: 'r5', local: undefined },
  ]);
});

test('renomear canteiro sem nenhum lançamento afetado não mexe na lista', () => {
  const registros = [{ id: 'r1', local: 'Marginal' }];
  const { afetados, atualizados } = registrosComCanteiroRenomeado(registros, 'Fábrica', 'Fábrica Nova');
  assert.deepEqual(afetados, []);
  assert.equal(atualizados, registros);
});
