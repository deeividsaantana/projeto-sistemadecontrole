import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import type { Material, MovimentoMaterial } from '../src/types';
import { agruparPorMaterial } from '../src/components/materiais/MateriaisListas';

/**
 * Materiais no molde do SGE (pedido de 27/10/2026): lançamento em seções com
 * Ctrl+S / F2 e lista com Detalhado / Agrupado. O agrupado soma só dentro do
 * mesmo material (nunca unidades diferentes) e não conta o que foi desfeito.
 */
const mov = (parcial: Partial<MovimentoMaterial>): MovimentoMaterial => ({
  id: Math.random().toString(36).slice(2), data: '2026-10-20', tipo: 'Entrada', materialId: 'brita', materialDescricao: 'BRITA 1',
  quantidade: 10, unidade: 'm³', criadoEm: '2026-10-20T10:00:00Z', responsavel: 'Teste',
  ...parcial,
} as MovimentoMaterial);

const materiais = new Map<string, Material>([['brita', { id: 'brita', codigo: 'B1', descricao: 'BRITA 1', unidade: 'm³' } as Material]]);

test('agrupado por material soma entradas e saídas do mesmo material e ignora desfeitos', () => {
  const linhas = agruparPorMaterial([
    mov({ quantidade: 10 }),
    mov({ quantidade: 5, data: '2026-10-22' }),
    mov({ tipo: 'Saída', quantidade: -4 }),
    mov({ tipo: 'Transferência', quantidade: 3 }),
    mov({ quantidade: 100, canceladoEm: '2026-10-23T00:00:00Z' }),
    mov({ materialId: 'tubo', materialDescricao: 'TUBO Ø800', unidade: 'pç', quantidade: 2 }),
  ], materiais);
  const brita = linhas.find(linha => linha.materialId === 'brita')!;
  assert.equal(brita.lancamentos, 4, 'o desfeito não conta');
  assert.equal(brita.entradas, 15);
  assert.equal(brita.saidas, 4, 'saída entra pelo valor absoluto');
  assert.equal(brita.ultima, '2026-10-22');
  assert.equal(brita.unidade, 'm³');
  assert.equal(brita.material?.codigo, 'B1');
  const tubo = linhas.find(linha => linha.materialId === 'tubo')!;
  assert.equal(tubo.unidade, 'pç', 'cada material fica na sua unidade');
  assert.equal(tubo.entradas, 2);
});

test('lançar segue o molde do SGE: seções, Ctrl+S / F2 e saldo final em destaque', () => {
  const form = readFileSync('src/components/materiais/FormLancamento.tsx', 'utf8');
  for (const secao of ['Dados do lançamento', 'Nota e transporte', 'Local de aplicação', 'Valores e observações']) {
    assert.match(form, new RegExp(`titulo=[{"'\`].*${secao}`), secao);
  }
  assert.match(form, /event\.key === 'F2'/);
  assert.match(form, /event\.key\.toLowerCase\(\) === 's'/);
  assert.match(form, /data-testid="lancamento-saldo-final"/);
  const grade = readFileSync('src/components/materiais/GradeViagens.tsx', 'utf8');
  assert.match(grade, /Adicionar linha/);
  assert.match(grade, /data-testid="viagens-total"/);
});
