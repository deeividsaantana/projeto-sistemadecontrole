import assert from 'node:assert/strict';
import test from 'node:test';
import type { EtapaServico, Material, MovimentoMaterial } from '../src/types';
import { buildUtilizacaoPorRamo } from '../src/utils/materialUtilization';

const material = (extra: Partial<Material>): Material => ({
  id: 'mat-1',
  codigo: 'TB-800',
  descricao: 'Tubo Ø800 1,50m',
  categoria: 'Tubulação',
  unidade: 'un',
  ativo: true,
  criadoEm: '',
  atualizadoEm: '',
  ...extra,
});

const ramo = (extra: Partial<EtapaServico>): EtapaServico => ({
  id: 'ramo-1400',
  nome: 'Ramo 1400',
  ...extra,
});

const movimento = (extra: Partial<MovimentoMaterial>): MovimentoMaterial => ({
  id: 'mv-1',
  data: '2026-09-01',
  tipo: 'Entrada',
  materialId: 'mat-1',
  materialDescricao: 'Tubo Ø800 1,50m',
  quantidade: 10,
  unidade: 'un',
  responsavel: 'Apontador',
  criadoEm: '',
  ...extra,
});

test('recebido, utilizado, saldo e percentual do exemplo real: 60 recebidos, 50 usados', () => {
  const rows = buildUtilizacaoPorRamo(
    [material({})],
    [
      movimento({ id: 'mv-1', tipo: 'Entrada', quantidade: 60, ramoId: 'ramo-1400' }),
      movimento({ id: 'mv-2', tipo: 'Saída', quantidade: 50, ramoId: 'ramo-1400' }),
    ],
    [ramo({})],
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].recebido, 60);
  assert.equal(rows[0].utilizado, 50);
  assert.equal(rows[0].saldo, 10);
  assert.ok(rows[0].percentualUtilizacao !== null);
  assert.ok(Math.abs((rows[0].percentualUtilizacao as number) - 83.3333) < 0.001);
});

test('movimento sem ramoId nunca entra na utilização por ramo', () => {
  const rows = buildUtilizacaoPorRamo(
    [material({})],
    [movimento({ tipo: 'Entrada', quantidade: 60, ramoId: undefined })],
    [ramo({})],
  );
  assert.equal(rows.length, 0);
});

test('sem nenhum recebimento ainda, percentual fica null em vez de dividir por zero', () => {
  const rows = buildUtilizacaoPorRamo(
    [material({})],
    [movimento({ tipo: 'Saída', quantidade: 5, ramoId: 'ramo-1400' })],
    [ramo({})],
  );
  assert.equal(rows[0].recebido, 0);
  assert.equal(rows[0].utilizado, 5);
  assert.equal(rows[0].saldo, -5);
  assert.equal(rows[0].percentualUtilizacao, null);
});

test('transferência e ajuste não contam como recebido/utilizado', () => {
  const rows = buildUtilizacaoPorRamo(
    [material({})],
    [
      movimento({ id: 'mv-1', tipo: 'Entrada', quantidade: 60, ramoId: 'ramo-1400' }),
      movimento({ id: 'mv-2', tipo: 'Transferência', quantidade: 5, ramoId: 'ramo-1400' }),
      movimento({ id: 'mv-3', tipo: 'Ajuste', quantidade: 2, ramoId: 'ramo-1400' }),
    ],
    [ramo({})],
  );
  assert.equal(rows[0].recebido, 60);
  assert.equal(rows[0].utilizado, 0);
});

test('ramo removido do cadastro ainda aparece no relatório, sem apagar o histórico', () => {
  const rows = buildUtilizacaoPorRamo(
    [material({})],
    [movimento({ tipo: 'Entrada', quantidade: 10, ramoId: 'ramo-inexistente' })],
    [ramo({})],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ramoNome, 'Ramo removido');
});
