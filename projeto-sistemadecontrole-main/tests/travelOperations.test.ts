import assert from 'node:assert/strict';
import test from 'node:test';
import { TicketJazida } from '../src/types';
import {
  buildTravelOperationControl,
  calculateTravelDurationMinutes,
  getTicketOperationalEvents,
} from '../src/utils/travelOperations';

const ticket = (
  number: string,
  type: 'Liberação' | 'Recebimento',
  overrides: Partial<TicketJazida> = {},
): TicketJazida => ({
  id: `${type}-${number}-${overrides.prefixo || 'CB-01'}`,
  data: '2026-07-01',
  tipoTicket: type,
  ticketNumero: number,
  prefixo: 'CB-01',
  placa: 'ABC1D23',
  horaSaida: '08:00',
  horaChegada: type === 'Recebimento' ? '09:30' : undefined,
  tipoMaterial: 'Solo',
  quantidadeM3: 14,
  destinoObra: type === 'Recebimento' ? 'Ramo 500' : 'Marginal',
  responsavelLiberacao: '',
  nomeLegivel: '',
  empresa: 'RENEA',
  observacao: '',
  status: 'OK',
  statusFluxo: 'Enviado',
  ...overrides,
});

test('pareia liberação e recebimento pelo número sem descartar vias avulsas', () => {
  const control = buildTravelOperationControl([
    ticket('100001', 'Liberação'),
    ticket('100001', 'Recebimento'),
    ticket('100002', 'Liberação'),
    ticket('100003', 'Recebimento'),
  ]);

  assert.equal(control.totalTickets, 3);
  assert.equal(control.completeTrips, 1);
  assert.equal(control.releasesWithoutReceipt, 1);
  assert.equal(control.receiptsWithoutRelease, 1);
});

test('compara os mesmos quatro campos da planilha operacional', () => {
  const control = buildTravelOperationControl([
    ticket('100010', 'Liberação'),
    ticket('100010', 'Recebimento', {
      prefixo: 'CB-02',
      placa: 'DEF4G56',
      tipoMaterial: 'Brita',
      quantidadeM3: 12,
    }),
  ]);

  assert.equal(control.divergentTrips, 1);
  assert.deepEqual(
    control.operations[0].divergences.map(item => item.field),
    ['prefixo', 'placa', 'material', 'quantidade'],
  );
});

test('ticket duplicado permanece na operação e exige revisão', () => {
  const control = buildTravelOperationControl([
    ticket('100020', 'Liberação'),
    ticket('100020', 'Liberação', { id: 'liberacao-repetida' }),
    ticket('100020', 'Recebimento'),
  ]);

  assert.equal(control.duplicateTickets, 1);
  assert.equal(control.operations[0].releases.length, 2);
  assert.equal(control.operations[0].status, 'Ticket duplicado');
});

test('calcula duração inclusive em virada de meia-noite', () => {
  const release = ticket('100030', 'Liberação', { horaSaida: '23:40' });
  const receipt = ticket('100030', 'Recebimento', { horaChegada: '00:20' });
  assert.equal(calculateTravelDurationMinutes(release, receipt), 40);
});

test('materializa eventos de operação, impressão e devolução', () => {
  const events = getTicketOperationalEvents(ticket('100040', 'Liberação', {
    loteImpressaoCriadoEm: '2026-07-01T07:00:00.000Z',
    devolvidoEm: '2026-07-01T17:00:00.000Z',
  }));

  assert.deepEqual(events.map(event => event.tipo), ['Impressão', 'Liberação', 'Devolução']);
});
