import assert from 'node:assert/strict';
import test from 'node:test';
import { montarRelatorioDiesel } from '../src/modules/frota/relatorioDiesel';
import type { Abastecimento, Comboio, Empresa, Equipamento } from '../src/types';

const ab = (id: string, data: string, equipamentoId: string, litros: number, comboioId = 'c1') => ({
  id, data, hora: '07:00', equipamentoId, quantidadeLitros: litros, comboioId,
} as Abastecimento);
const equipamentos = [
  { id: 'eq-1', prefixo: 'CB940', nome: 'Basculante', empresaId: 'emp-1' },
  { id: 'eq-2', prefixo: 'LO146', nome: 'Gerador', empresaId: 'emp-2' },
] as Equipamento[];
const empresas = [{ id: 'emp-1', nome: 'RENEA' }, { id: 'emp-2', nome: 'Escala' }] as Empresa[];
const comboios = [{ id: 'c1', nome: 'Comboio 01' }, { id: 'c2', nome: 'Comboio 02' }] as Comboio[];

test('relatório soma o período, quebra por dia, máquina, comboio e empresa', () => {
  const registros = [
    ab('a', '2026-10-01', 'eq-1', 100), ab('b', '2026-10-01', 'eq-2', 50, 'c2'), ab('c', '2026-10-03', 'eq-1', 150),
    ab('fora', '2026-09-28', 'eq-1', 999), ab('ant', '2026-09-30', 'eq-1', 200),
  ];
  const r = montarRelatorioDiesel({ registros, equipamentos, empresas, comboios, inicio: '2026-10-01', fim: '2026-10-03', hoje: '2026-10-21' });
  assert.equal(r.litros, 300);
  assert.equal(r.lancamentos, 3);
  assert.equal(r.maquinas, 2);
  assert.deepEqual(r.porDia.map(dia => [dia.dia, dia.litros]), [['2026-10-01', 150], ['2026-10-02', 0], ['2026-10-03', 150]]);
  assert.equal(r.mediaPorDia, 100);
  assert.equal(r.porMaquina[0].rotulo, 'CB940');
  assert.deepEqual(r.porMaquina[0].filtro, { equipamentoId: 'eq-1' });
  assert.deepEqual(r.porComboio.map(linha => [linha.rotulo, linha.litros]), [['Comboio 01', 250], ['Comboio 02', 50]]);
  assert.deepEqual(r.porEmpresa.map(linha => linha.rotulo), ['RENEA', 'Escala']);
  // Período anterior do mesmo tamanho: 28/09 a 30/09.
  assert.equal(r.anterior.litros, 1199);
  assert.ok(r.variacao !== undefined && r.variacao < 0);
});

test('período em curso conta os dias só até hoje', () => {
  const r = montarRelatorioDiesel({ registros: [ab('a', '2026-10-21', 'eq-1', 100)], equipamentos, empresas, comboios, inicio: '2026-10-21', fim: '2026-11-20', hoje: '2026-10-22' });
  assert.equal(r.porDia.length, 2);
  assert.equal(r.mediaPorDia, 50);
  assert.equal(r.variacao, undefined);
});

test('relatório conta repetidos e sem cadastro', () => {
  const registros = [ab('a', '2026-10-01', 'eq-1', 100), ab('b', '2026-10-01', 'eq-1', 100), ab('c', '2026-10-01', 'velho', 10)];
  const r = montarRelatorioDiesel({ registros, equipamentos, empresas, comboios, inicio: '2026-10-01', fim: '2026-10-01', hoje: '2026-10-21' });
  assert.equal(r.repetidos, 2);
  assert.equal(r.semCadastro, 1);
});
