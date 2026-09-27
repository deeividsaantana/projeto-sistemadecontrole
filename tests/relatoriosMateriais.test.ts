import assert from 'node:assert/strict';
import test from 'node:test';
import type { EtapaServico, MovimentoMaterial } from '../src/types';
import {
  SEM_FORNECEDOR,
  SEM_RAMO,
  diasDoPeriodo,
  filtrarRelatorio,
  indicadores,
  mesAMes,
  paraCsv,
  periodoAnterior,
  porDia,
  porFornecedor,
  porMaterial,
  porRamo,
  ramoDoMovimento,
  type FiltroRelatorio,
} from '../src/modules/materials/relatoriosMateriais';

const mov = (id: string, extra: Partial<MovimentoMaterial>): MovimentoMaterial => ({
  id, data: '2026-09-10', tipo: 'Entrada', materialId: 'rachao', materialDescricao: 'RACHÃO', quantidade: 10, unidade: 't',
  responsavel: 'x', criadoEm: id, ...extra,
});

const etapas: EtapaServico[] = [
  { id: 'r9', nome: 'RAMO 900', tipoLocal: 'Ramo' } as EtapaServico,
  { id: 'cs9', nome: 'CS RAMO 900', tipoLocal: 'Frente', ramo: 'RAMO 900' } as EtapaServico,
];

const movimentos = [
  mov('a', { destino: 'CS RAMO 900', fornecedorNome: 'PEDRA FORTE', valorTotal: 1000 }),
  mov('b', { data: '2026-09-11', fornecedorNome: 'Pedra Forte', valorUnitario: 50, quantidade: 4 }),
  mov('c', { materialId: 'areia', materialDescricao: 'AREIA', unidade: 'm³', quantidade: 8, destino: 'ESTOQUE' }),
  mov('d', { materialId: 'tubo', materialDescricao: 'TUBO', unidade: 'un', quantidade: 3 }),
  mov('e', { data: '2026-08-20', fornecedorNome: 'EMBU' }),
  mov('f', { canceladoEm: '2026-09-12' }),
  mov('g', { tipo: 'Saída', quantidade: 2 }),
];

const filtro: FiltroRelatorio = { de: '2026-09-01', ate: '2026-09-30', tipo: 'Entrada', materialId: '', fornecedor: '', ramo: '' };
const ramoDe = ramoDoMovimento(etapas);

test('período anterior tem o mesmo tamanho e termina na véspera', () => {
  assert.equal(diasDoPeriodo('2026-09-01', '2026-09-30'), 30);
  assert.deepEqual(periodoAnterior('2026-09-01', '2026-09-30'), { de: '2026-08-02', ate: '2026-08-31' });
  assert.deepEqual(periodoAnterior('2026-03-01', '2026-03-01'), { de: '2026-02-28', ate: '2026-02-28' });
});

test('filtro tira desfeitos, outro tipo e outro período; fornecedor ignora maiúsculas', () => {
  assert.deepEqual(filtrarRelatorio(movimentos, filtro, ramoDe).map(item => item.id), ['b', 'd', 'c', 'a']);
  assert.deepEqual(filtrarRelatorio(movimentos, { ...filtro, fornecedor: 'pedra forte' }, ramoDe).map(item => item.id), ['b', 'a']);
  assert.deepEqual(filtrarRelatorio(movimentos, { ...filtro, fornecedor: SEM_FORNECEDOR }, ramoDe).map(item => item.id), ['d', 'c']);
  assert.deepEqual(filtrarRelatorio(movimentos, { ...filtro, ramo: 'RAMO 900' }, ramoDe).map(item => item.id), ['a']);
  assert.deepEqual(filtrarRelatorio(movimentos, { ...filtro, tipo: '' }, ramoDe).length, 5);
});

test('indicadores somam t, m³ e valor sem misturar e comparam com o anterior', () => {
  const agora = filtrarRelatorio(movimentos, filtro, ramoDe);
  const antes = filtrarRelatorio(movimentos, { ...filtro, ...periodoAnterior(filtro.de, filtro.ate) }, ramoDe);
  const porChave = Object.fromEntries(indicadores(agora, antes, 30).map(item => [item.chave, item]));
  assert.equal(porChave.toneladas.valor, 14);
  assert.equal(porChave.toneladas.anterior, 10);
  assert.equal(porChave.toneladas.variacao, 40);
  assert.equal(porChave.metrosCubicos.valor, 8);
  assert.equal(porChave.metrosCubicos.variacao, null, 'antes era zero');
  assert.equal(porChave.valor.valor, 1200);
  assert.equal(porChave.fornecedores.valor, 1, 'Pedra Forte com grafias diferentes é um só');
});

test('tabelas por material, fornecedor, ramo e dia', () => {
  const lista = filtrarRelatorio(movimentos, filtro, ramoDe);
  const materiais = porMaterial(lista);
  assert.equal(materiais[0].nome, 'RACHÃO');
  assert.equal(materiais[0].toneladas, 14);
  assert.equal(materiais[0].ultima, '2026-09-11');
  assert.deepEqual(materiais.find(item => item.nome === 'TUBO')?.outras, { un: 3 });

  assert.deepEqual(porFornecedor(lista).map(item => [item.nome, item.lancamentos]), [['Pedra Forte', 2], [SEM_FORNECEDOR, 2]]);
  assert.deepEqual(porRamo(lista, ramoDe).map(item => item.nome), ['RAMO 900', SEM_RAMO], 'fora dos ramos vai para o fim');
  assert.deepEqual(porDia(lista).map(item => [item.nome, item.lancamentos]), [['2026-09-11', 1], ['2026-09-10', 3]]);
});

test('mês a mês separa unidades e soma por mês', () => {
  const matriz = mesAMes(filtrarRelatorio(movimentos, { ...filtro, de: '2026-08-01' }, ramoDe));
  assert.deepEqual(matriz.meses, ['2026-08', '2026-09']);
  const rachao = matriz.linhas.find(linha => linha.nome === 'RACHÃO');
  assert.deepEqual(rachao?.porMes, { '2026-08': 10, '2026-09': 14 });
  assert.equal(rachao?.total, 24);
});

test('planilha usa ponto e vírgula, vírgula decimal e escapa aspas', () => {
  assert.equal(paraCsv([['Nome "A"', 12.5]]), '﻿"Nome ""A""";"12,5"');
});
