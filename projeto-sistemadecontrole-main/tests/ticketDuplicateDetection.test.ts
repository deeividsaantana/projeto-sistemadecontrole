import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDuplicateTicketKeys, isDuplicateTicket } from '../src/utils/ticketDuplicateDetection';

const ticket = (ticketNumero: string, tipoTicket: 'Liberação' | 'Recebimento') => ({ ticketNumero, tipoTicket });

test('marca todos os recebimentos que repetem o mesmo número', () => {
  const primeiro = ticket('100320', 'Recebimento');
  const segundo = ticket('320', 'Recebimento');
  const duplicates = buildDuplicateTicketKeys([primeiro, segundo]);
  assert.equal(isDuplicateTicket(primeiro, duplicates), true);
  assert.equal(isDuplicateTicket(segundo, duplicates), true);
});

test('não considera liberação e recebimento do mesmo número como duplicidade', () => {
  const liberacao = ticket('100320', 'Liberação');
  const recebimento = ticket('100320', 'Recebimento');
  const duplicates = buildDuplicateTicketKeys([liberacao, recebimento]);
  assert.equal(isDuplicateTicket(liberacao, duplicates), false);
  assert.equal(isDuplicateTicket(recebimento, duplicates), false);
});
