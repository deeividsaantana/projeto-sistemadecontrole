import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizarOrigemCombustivel } from '../src/utils/origemCombustivel';

test('lançamento antigo do OneDrive é lido como Planilha, não descartado', () => {
  assert.equal(normalizarOrigemCombustivel('OneDrive'), 'Planilha');
});

test('as origens que continuam no produto passam intactas', () => {
  assert.equal(normalizarOrigemCombustivel('Planilha'), 'Planilha');
  assert.equal(normalizarOrigemCombustivel('PDF/Foto IA'), 'PDF/Foto IA');
  assert.equal(normalizarOrigemCombustivel('Legado Access'), 'Legado Access');
  assert.equal(normalizarOrigemCombustivel('Manual'), 'Manual');
});

test('origem ausente, vazia ou desconhecida cai em Manual', () => {
  assert.equal(normalizarOrigemCombustivel(undefined), 'Manual');
  assert.equal(normalizarOrigemCombustivel(''), 'Manual');
  assert.equal(normalizarOrigemCombustivel('Sei lá'), 'Manual');
});
