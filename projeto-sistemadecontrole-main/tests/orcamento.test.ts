import assert from 'node:assert/strict';
import test from 'node:test';
import { compararOrcamento, competenciaDe, resumoOrcamento, validarOrcamento } from '../src/utils/orcamento';
import type { OrcamentoItem } from '../src/types';
import type { CustoConsolidado } from '../src/utils/custos';

const orcamento = (extra: Partial<OrcamentoItem> = {}): OrcamentoItem => ({
  id: 'o1',
  competencia: '2026-01',
  categoria: 'Locação',
  valorOrcado: 1000,
  responsavel: 'D',
  ativo: true,
  criadoEm: '',
  atualizadoEm: '',
  ...extra,
});

const custo = (extra: Partial<CustoConsolidado> = {}): CustoConsolidado => ({
  id: 'c1',
  data: '2026-01-10',
  categoria: 'Locação',
  descricao: 'x',
  valor: 600,
  origem: 'Lançamento',
  ...extra,
});

test('competência sai da data do custo', () => {
  assert.equal(competenciaDe('2026-01-10'), '2026-01');
});

test('orçado e realizado se encontram por competência e categoria', () => {
  const [linha] = compararOrcamento([orcamento()], [custo(), custo({ id: 'c2', valor: 200 })]);
  assert.equal(linha.orcado, 1000);
  assert.equal(linha.realizado, 800);
  assert.equal(linha.saldo, 200);
  assert.equal(linha.consumo, 80);
  assert.equal(linha.estourado, false);
});

test('gasto sem orçamento aparece com orçado zero e sem percentual', () => {
  const linhas = compararOrcamento([], [custo({ categoria: 'Serviço de terceiro' })]);
  assert.equal(linhas[0].orcado, 0);
  assert.equal(linhas[0].consumo, undefined);
  assert.equal(resumoOrcamento(linhas).semOrcamento, 1);
});

test('estouro é marcado quando o realizado passa o orçado', () => {
  const [linha] = compararOrcamento([orcamento({ valorOrcado: 500 })], [custo()]);
  assert.equal(linha.estourado, true);
  assert.equal(linha.saldo, -100);
  assert.equal(resumoOrcamento([linha]).estouradas, 1);
});

test('competência inválida e valor não positivo são recusados', () => {
  assert.match(String(validarOrcamento({ competencia: '2026', valorOrcado: 10 })), /AAAA-MM/);
  assert.match(String(validarOrcamento({ competencia: '2026-01', valorOrcado: 0 })), /maior que zero/);
  assert.equal(validarOrcamento({ competencia: '2026-01', valorOrcado: 10 }), null);
});
