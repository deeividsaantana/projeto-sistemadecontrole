import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTicketNumberSequence, normalizeTicketNumber } from '../src/utils/ticketNumberSequence';

test('mantém o prefixo operacional 100', () => {
  assert.equal(normalizeTicketNumber('320'), '100320');
  assert.equal(normalizeTicketNumber('100320'), '100320');
});

test('gera sequência decrescente em intervalos de dez', () => {
  assert.deepEqual(
    buildTicketNumberSequence('100320', 4, 10, 'decrescente'),
    ['100320', '100310', '100300', '100290'],
  );
});

test('gera sequência crescente com intervalo livre', () => {
  assert.deepEqual(
    buildTicketNumberSequence('100310', 3, 5, 'crescente'),
    ['100310', '100315', '100320'],
  );
});
