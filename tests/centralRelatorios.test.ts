import assert from 'node:assert/strict';
import test from 'node:test';
import { resumirBase, textoBase } from '../src/utils/centralRelatorios';

test('base do relatório conta só o ativo e acha o último dia', () => {
  const base = resumirBase([
    { data: '2026-10-10' },
    { data: '2026-10-15' },
    { data: '2026-10-16', inativoEm: '2026-10-16T10:00:00Z' },
    { data: '2026-10-14', ativo: false },
    { data: '' },
  ]);
  assert.deepEqual(base, { total: 3, ultimoDia: '2026-10-15' });
});

test('relatório sem lançamento diz que está vazio em vez de mostrar zero', () => {
  assert.equal(textoBase(resumirBase([]), 'abastecimento', 'abastecimentos'), 'Nenhum lançamento ainda');
  assert.equal(textoBase(resumirBase(undefined), 'abastecimento', 'abastecimentos'), 'Nenhum lançamento ainda');
});

test('texto da base usa número brasileiro e data dia/mês/ano', () => {
  const base = { total: 5235, ultimoDia: '2026-10-15' };
  assert.equal(textoBase(base, 'abastecimento', 'abastecimentos'), '5.235 abastecimentos · último em 15/10/2026');
  assert.equal(textoBase({ total: 1, ultimoDia: '' }, 'cravação', 'cravações'), '1 cravação');
});
