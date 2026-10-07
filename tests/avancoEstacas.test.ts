import assert from 'node:assert/strict';
import test from 'node:test';
import type { CravacaoEstaca } from '../src/types';
import {
  cravacoesPorDia,
  estacasPorFrente,
  nomeDaEstaca,
  paraCsv,
  planejarFrente,
  previsaoDeTermino,
  resumirEstacas,
  ritmoDosDias,
} from '../src/modules/estacas/avancoEstacas';

const estaca = (id: string, extra: Partial<CravacaoEstaca>): CravacaoEstaca => ({
  id, data: '2026-09-20', item: '', servico: 'Cravação de estaca prancha', identificacao: 'AP 12 ferradura',
  perfil: '', comprimentoM: 10, comprimentoCravadoM: 8, sobraM: 2, perdaM: 0, responsavel: 'x',
  observacao: '', origem: 'Manual', criadoEm: id, ...extra,
});

// Como a planilha de agosto grava: frente em "identificação" e nome da estaca em "perfil".
const estacas: CravacaoEstaca[] = [
  estaca('a', { item: '1', perfil: 'Estaca 1', data: '2026-09-20' }),
  estaca('b', { item: '2', perfil: 'Estaca 2', data: '2026-09-21', perdaM: 0.5, sobraM: 1.5 }),
  estaca('c', { item: '3', perfil: 'Estaca 3', comprimentoCravadoM: 0, sobraM: 0 }),
  estaca('d', { item: '4', perfil: 'Estaca 4', comprimentoCravadoM: 0, sobraM: 0, comprimentoM: 12 }),
  estaca('e', { identificacao: 'Ramo 900', item: '1', perfil: '', data: '2026-09-21', comprimentoCravadoM: 9 }),
];

test('previstas, cravadas, faltam e porcentagem contam a estaca a cravar pela profundidade zero', () => {
  const resumo = resumirEstacas(estacas);
  assert.equal(resumo.previstas, 5);
  assert.equal(resumo.cravadas, 3);
  assert.equal(resumo.faltam, 2);
  assert.equal(resumo.porcentagem, 60);
  assert.equal(resumo.metrosCravados, 25);
  assert.equal(resumo.metrosACravar, 22);
  assert.equal(resumo.perdaM, 0.5);
});

test('cada frente tem o próprio avanço e a próxima estaca na ordem do número', () => {
  const [ap12, ramo900] = estacasPorFrente(estacas);
  assert.equal(ap12.frente, 'AP 12 ferradura');
  assert.equal(ap12.porcentagem, 50);
  assert.equal(ap12.proxima?.id, 'c');
  assert.equal(ap12.ultimaCravacao, '2026-09-21');
  assert.equal(ramo900.faltam, 0);
  assert.equal(ramo900.proxima, undefined);
  assert.equal(nomeDaEstaca(ramo900.estacas[0]), 'Nº 1');
});

test('frente sem estaca nenhuma não vira 100% nem divide por zero', () => {
  assert.equal(resumirEstacas([]).porcentagem, 0);
});

test('aumentar o total cria as que faltam numeradas depois da última, sem repetir nome', () => {
  const plano = planejarFrente(estacas, { frente: 'AP 12 ferradura', total: 7, comprimentoM: 12, data: '2026-09-28', responsavel: 'Deivid', agora: '2026-09-28T10:00:00Z' });
  assert.deepEqual(plano.novas.map(item => item.perfil), ['Estaca 5', 'Estaca 6', 'Estaca 7']);
  assert.ok(plano.novas.every(item => item.comprimentoCravadoM === 0 && item.comprimentoM === 12 && item.identificacao === 'AP 12 ferradura'));
  assert.equal(new Set(plano.novas.map(item => item.id)).size, 3);
  assert.equal(resumirEstacas([...estacas, ...plano.novas]).previstas, 8);
});

test('diminuir o total só tira estacas a cravar, do fim, e nunca abaixo das cravadas', () => {
  const menos = planejarFrente(estacas, { frente: 'AP 12 ferradura', total: 3, data: '2026-09-28', responsavel: 'x' });
  assert.deepEqual(menos.sobrando, ['d']);
  assert.equal(menos.novas.length, 0);
  const abaixo = planejarFrente(estacas, { frente: 'AP 12 ferradura', total: 1, data: '2026-09-28', responsavel: 'x' });
  assert.deepEqual(abaixo.sobrando, ['c', 'd']);
  assert.equal(abaixo.minimo, 2);
});

test('frente nova começa do número 1', () => {
  const plano = planejarFrente(estacas, { frente: 'Canal norte', total: 2, data: '2026-09-28', responsavel: 'x' });
  assert.deepEqual(plano.novas.map(item => [item.item, item.perfil]), [['1', 'Estaca 1'], ['2', 'Estaca 2']]);
});

test('dia a dia e ritmo só contam as cravadas, com zero nos dias parados', () => {
  const dias = cravacoesPorDia(estacas);
  assert.deepEqual(dias.map(dia => [dia.data, dia.cravadas, dia.metros]), [['2026-09-21', 2, 17], ['2026-09-20', 1, 8]]);
  assert.deepEqual(dias[0].frentes, ['AP 12 ferradura', 'Ramo 900']);
  const ritmo = ritmoDosDias(estacas, '2026-09-22', 3);
  assert.deepEqual(ritmo.map(dia => dia.cravadas), [1, 2, 0]);
});

test('previsão de término usa a média dos dias trabalhados', () => {
  const previsao = previsaoDeTermino(estacas, '2026-09-22');
  assert.equal(previsao.mediaPorDia, 1.5);
  assert.equal(previsao.diasDeTrabalho, 2);
  assert.equal(previsaoDeTermino(estacas, '2027-01-01').diasDeTrabalho, null);
});

test('planilha sai em ponto e vírgula com decimal brasileiro', () => {
  assert.equal(paraCsv([['Frente', 'Metros'], ['AP; 12', 12.5]]), '﻿Frente;Metros\r\n"AP; 12";12,5');
});
