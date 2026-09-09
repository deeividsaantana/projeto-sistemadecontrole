import assert from 'node:assert/strict';
import test from 'node:test';
import { contemTermo } from '../src/utils/frenteServico';

test('o filtro de ramo não confunde Ramo 100 com Ramo 1000', () => {
  assert.equal(contemTermo('Equipe do Renilson Ramo 100', 'Ramo 100'), true);
  assert.equal(contemTermo('Equipe do Renilson Ramo 1000', 'Ramo 100'), false);
  assert.equal(contemTermo('Equipe do Renilson Ramo 1000', 'Ramo 1000'), true);
  assert.equal(contemTermo('Equipe A Ramo 200 Alargamento', 'Ramo 200'), true);
  assert.equal(contemTermo('Equipe A Ramo 2000', 'Ramo 200'), false);
});

test('canteiro com hífen e acento continua casando', () => {
  assert.equal(contemTermo('Equipe do SP-066 SP-066', 'SP-066'), true);
  assert.equal(contemTermo('Equipe da Padre Eustáquio', 'Padre Eustáquio'), true);
  assert.equal(contemTermo('Equipe da Marginal', 'Marginal'), true);
  assert.equal(contemTermo('Equipe da Fábrica', 'IBAR'), false);
});

test('termo vazio não casa com nada', () => {
  assert.equal(contemTermo('Equipe do Renilson Ramo 200', ''), false);
  assert.equal(contemTermo('', 'Ramo 200'), false);
});
