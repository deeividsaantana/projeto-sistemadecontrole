import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApontamentoOperacional } from '../src/types';
import { horasNoDia, horasPor, validarApontamento } from '../src/utils/apontamentos';

const apontamento = (extra: Partial<ApontamentoOperacional>): ApontamentoOperacional => ({
  id: 'a1',
  data: '2026-09-05',
  funcionarioId: 'f1',
  funcionarioNome: 'Colaborador',
  atividade: 'Escavação',
  horas: 8,
  responsavel: 'Apontador',
  criadoEm: '',
  ...extra,
});

test('horas do dia somam só a pessoa e a data certas', () => {
  const base = [
    apontamento({ id: 'a', horas: 4 }),
    apontamento({ id: 'b', horas: 4 }),
    apontamento({ id: 'c', horas: 8, data: '2026-09-04' }),
    apontamento({ id: 'd', horas: 8, funcionarioId: 'f2' }),
  ];
  assert.equal(horasNoDia(base, 'f1', '2026-09-05'), 8);
});

test('edição não conta as próprias horas duas vezes', () => {
  const base = [apontamento({ id: 'a', horas: 8 })];
  assert.equal(horasNoDia(base, 'f1', '2026-09-05', 'a'), 0);
  assert.equal(validarApontamento(base, { id: 'a', funcionarioId: 'f1', data: '2026-09-05', horas: 10, atividade: 'Escavação' }), null);
});

test('lançamento que estoura o dia é recusado', () => {
  const base = [apontamento({ id: 'a', horas: 20 })];
  const erro = validarApontamento(base, { id: 'novo', funcionarioId: 'f1', data: '2026-09-05', horas: 6, atividade: 'Escavação' });
  assert.match(String(erro), /acima das 24 h/);
});

test('campos obrigatórios barram o lançamento', () => {
  assert.match(String(validarApontamento([], { id: 'x', funcionarioId: '', data: '2026-09-05', horas: 8, atividade: 'a' })), /colaborador/i);
  assert.match(String(validarApontamento([], { id: 'x', funcionarioId: 'f1', data: '2026-09-05', horas: 8, atividade: '  ' })), /atividade/i);
  assert.match(String(validarApontamento([], { id: 'x', funcionarioId: 'f1', data: '2026-09-05', horas: 0, atividade: 'a' })), /horas/i);
});

test('horas agrupadas dão a base da produtividade', () => {
  const base = [
    apontamento({ id: 'a', servico: 'Terraplenagem', horas: 8 }),
    apontamento({ id: 'b', servico: 'Terraplenagem', horas: 4 }),
    apontamento({ id: 'c', servico: 'Drenagem', horas: 6 }),
  ];
  assert.deepEqual(horasPor(base, item => item.servico || ''), [
    { chave: 'Terraplenagem', horas: 12, lancamentos: 2 },
    { chave: 'Drenagem', horas: 6, lancamentos: 1 },
  ]);
});
