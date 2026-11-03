import assert from 'node:assert/strict';
import test from 'node:test';
import { __testing } from '../api/public-presenca.js';

const { nextSaturdayInSaoPaulo } = __testing;

test('próximo sábado: segunda-feira aponta para o sábado da mesma semana', () => {
  assert.equal(nextSaturdayInSaoPaulo(new Date('2026-11-02T15:00:00Z')), '2026-11-07');
});

test('próximo sábado: no próprio sábado vale hoje, para apontar a equipe escalada', () => {
  assert.equal(nextSaturdayInSaoPaulo(new Date('2026-11-07T15:00:00Z')), '2026-11-07');
});

test('próximo sábado: à noite em Brasília vale o dia local, não o dia em UTC', () => {
  assert.equal(nextSaturdayInSaoPaulo(new Date('2026-11-14T01:30:00Z')), '2026-11-14');
  assert.equal(nextSaturdayInSaoPaulo(new Date('2026-11-08T01:30:00Z')), '2026-11-07');
});
