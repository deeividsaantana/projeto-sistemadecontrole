import assert from 'node:assert/strict';
import test from 'node:test';
import { TicketJazida } from '../src/types';
import { buildJazidaDailyControl } from '../src/utils/jazidaDailyControl';

const ticket = (numero: string, tipo: 'Liberação' | 'Recebimento', returned = false): TicketJazida => ({
  id: `${tipo}-${numero}`,
  data: '2026-07-30',
  tipoTicket: tipo,
  ticketNumero: numero,
  prefixo: '',
  placa: '',
  horaSaida: '',
  tipoMaterial: 'Solo',
  quantidadeM3: 0,
  destinoObra: 'Jazida',
  responsavelLiberacao: '',
  nomeLegivel: '',
  empresa: 'RENEA',
  observacao: '',
  status: returned ? 'OK' : 'Pendente',
  statusFluxo: returned ? 'Enviado' : 'Rascunho',
  loteImpressaoId: 'lote-1',
  loteImpressaoCriadoEm: '2026-07-30T08:15:00.000Z',
  devolvidoEm: returned ? '2026-07-30T17:30:00.000Z' : undefined,
});

test('conferência diária separa corretamente as duas vias', () => {
  const control = buildJazidaDailyControl([
    ticket('100320', 'Liberação', true),
    ticket('100320', 'Recebimento', false),
    ticket('100310', 'Liberação', true),
    ticket('100310', 'Recebimento', true),
  ], '2026-07-30');

  assert.equal(control.totalCriados, 2);
  assert.equal(control.liberacoesRecebidas, 2);
  assert.equal(control.recebimentosRecebidos, 1);
  assert.equal(control.paresCompletos, 1);
  assert.deepEqual(control.pendentesLiberacao, []);
  assert.deepEqual(control.pendentesRecebimento, ['100320']);
  assert.equal(control.percentualConferencia, 75);
});

test('rascunho impresso não é contado como ticket devolvido', () => {
  const control = buildJazidaDailyControl([
    ticket('100300', 'Liberação'),
    ticket('100300', 'Recebimento'),
  ], '2026-07-30');

  assert.equal(control.totalCriados, 1);
  assert.equal(control.liberacoesRecebidas, 0);
  assert.equal(control.recebimentosRecebidos, 0);
  assert.equal(control.pendentesQualquerVia, 1);
});
