import assert from 'node:assert/strict';
import test from 'node:test';
import { montarFornecimento, montarRelatorioDiesel } from '../src/modules/frota/relatorioDiesel';
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

test('fornecimento por empresa lista só as máquinas dela, em ordem de data, com total por equipamento', () => {
  const registros = [
    { ...ab('b', '2026-10-05', 'eq-2', 64, 'c2'), hora: '09:00', horimetroInicial: 1200, bombaInicial: 100, bombaFinal: 164, tipoCombustivelId: 's10' },
    { ...ab('a', '2026-10-05', 'eq-2', 154), hora: '07:00', tipoCombustivelId: 's10' },
    ab('renea', '2026-10-05', 'eq-1', 500),
    ab('fora', '2026-09-01', 'eq-2', 99),
  ];
  const f = montarFornecimento({ registros, equipamentos, empresas, comboios, combustiveis: [{ id: 's10', nome: 'Diesel S10' }], inicio: '2026-09-21', fim: '2026-10-20', empresaId: 'emp-2' });
  assert.equal(f.empresa, 'Escala');
  assert.equal(f.combustivel, 'Diesel S10');
  assert.equal(f.lancamentos, 2);
  assert.equal(f.litros, 218);
  assert.deepEqual(f.linhas.map(linha => [linha.hora, linha.comboio, linha.litros]), [['07:00', 'Comboio 01', 154], ['09:00', 'Comboio 02', 64]]);
  assert.equal(f.linhas[1].horimetro, 1200);
  assert.equal(f.linhas[0].horimetro, undefined);
  assert.deepEqual(f.porEquipamento, [{ prefixo: 'LO146', descricao: 'Gerador', abastecimentos: 2, litros: 218 }]);
  const todas = montarFornecimento({ registros, equipamentos, empresas, comboios, combustiveis: [], inicio: '2026-09-21', fim: '2026-10-20', empresaId: '' });
  assert.equal(todas.empresa, 'Todas as empresas');
  assert.equal(todas.lancamentos, 3);
});
