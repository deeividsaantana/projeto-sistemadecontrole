import assert from 'node:assert/strict';
import test from 'node:test';
import { Abastecimento, TicketJazida } from '../src/types';
import { buildFuelAnalytics, buildJazidaAnalytics } from '../src/utils/operationalAnalytics';

const fuelRecord = (overrides: Partial<Abastecimento>): Abastecimento => ({
  id: 'fuel-1',
  data: '2026-07-30',
  hora: '08:00',
  equipamentoId: 'eq-1',
  horimetroInicial: 0,
  kmInicial: 0,
  bombaInicial: 1000,
  quantidadeLitros: 100,
  bombaFinal: 1100,
  tipoCombustivelId: 'diesel',
  comboioId: 'comboio-a',
  responsavel: 'Operador',
  observacao: '',
  status: 'OK',
  ...overrides,
});

const ticket = (number: string, type: 'Liberação' | 'Recebimento', returned: boolean, overrides: Partial<TicketJazida> = {}): TicketJazida => ({
  id: `${type}-${number}-${returned}`,
  data: '2026-07-30',
  tipoTicket: type,
  ticketNumero: number,
  prefixo: 'C-01',
  placa: 'ABC1D23',
  equipamentoNome: 'Caminhão basculante',
  horaSaida: '08:00',
  tipoMaterial: 'Solo',
  quantidadeM3: 12,
  destinoObra: 'Ramo 500',
  responsavelLiberacao: 'Operador',
  nomeLegivel: 'Conferente',
  empresa: 'RENEA',
  observacao: '',
  status: returned ? 'OK' : 'Pendente',
  statusFluxo: returned ? 'Enviado' : 'Rascunho',
  loteImpressaoCriadoEm: '2026-07-30T08:00:00.000Z',
  devolvidoEm: returned ? '2026-07-30T17:00:00.000Z' : undefined,
  ...overrides,
});

const fuelInputs = {
  equipamentos: [
    { id: 'eq-1', prefixo: 'F-01', nome: 'Escavadeira', tipo: 'Escavadeira', marca: '', modelo: '', seriePlaca: '', empresaId: 'emp-a', status: 'Ativo' as const, localAtualId: '', observacao: '' },
    { id: 'eq-2', prefixo: 'F-02', nome: 'Caminhão', tipo: 'Caminhão', marca: '', modelo: '', seriePlaca: '', empresaId: 'emp-b', status: 'Ativo' as const, localAtualId: '', observacao: '' },
  ],
  empresas: [
    { id: 'emp-a', nome: 'Empresa A', cnpj: '', telefone: '', responsavel: '' },
    { id: 'emp-b', nome: 'Empresa B', cnpj: '', telefone: '', responsavel: '' },
  ],
  comboios: [
    { id: 'comboio-a', nome: 'Comboio A', placa: '', capacidadeLitros: 10000, responsavel: '' },
    { id: 'comboio-b', nome: 'Comboio B', placa: '', capacidadeLitros: 8000, responsavel: '' },
  ],
  combustiveis: [{ id: 'diesel', nome: 'Diesel S10' }],
};

test('painel de combustível filtra empresa e consolida consumo por frota', () => {
  const analytics = buildFuelAnalytics({
    ...fuelInputs,
    abastecimentos: [
      fuelRecord({ id: 'a', quantidadeLitros: 100 }),
      fuelRecord({ id: 'b', equipamentoId: 'eq-2', comboioId: 'comboio-b', quantidadeLitros: 60, bombaInicial: 500, bombaFinal: 560 }),
    ],
    filters: { companyId: 'emp-a', startDate: '2026-07-01', endDate: '2026-07-31' },
  });

  assert.equal(analytics.totalLiters, 100);
  assert.equal(analytics.totalRecords, 1);
  assert.equal(analytics.fleets[0]?.name, 'F-01');
  assert.equal(analytics.companies[0]?.name, 'Empresa A');
});

test('painel de combustível valida cada lançamento sem misturar comboios intercalados', () => {
  const analytics = buildFuelAnalytics({
    ...fuelInputs,
    abastecimentos: [
      fuelRecord({ id: 'a', comboioId: 'comboio-a', bombaInicial: 1000, bombaFinal: 1100, quantidadeLitros: 100 }),
      fuelRecord({ id: 'b', equipamentoId: 'eq-2', comboioId: 'comboio-b', bombaInicial: 5000, bombaFinal: 5075, quantidadeLitros: 75 }),
      fuelRecord({ id: 'c', comboioId: 'comboio-a', bombaInicial: 1100, bombaFinal: 1150, quantidadeLitros: 50, hora: '09:00' }),
    ],
  });

  assert.equal(analytics.pumpDivergences, 0);
  assert.equal(analytics.comboios.length, 2);
});

test('painel de combustível destaca divergência interna de bomba', () => {
  const analytics = buildFuelAnalytics({
    ...fuelInputs,
    abastecimentos: [fuelRecord({ bombaInicial: 1000, bombaFinal: 1080, quantidadeLitros: 100 })],
  });

  assert.equal(analytics.pumpDivergences, 1);
  assert.equal(analytics.warningRecords, 1);
});

test('painel da jazida separa devolução das duas vias e pendências', () => {
  const analytics = buildJazidaAnalytics({
    tickets: [
      ticket('100320', 'Liberação', true),
      ticket('100320', 'Recebimento', false),
      ticket('100310', 'Liberação', true),
      ticket('100310', 'Recebimento', true),
    ],
    filters: { startDate: '2026-07-30', endDate: '2026-07-30' },
  });

  assert.equal(analytics.totalTickets, 2);
  assert.equal(analytics.releaseReturned, 2);
  assert.equal(analytics.receiptReturned, 1);
  assert.equal(analytics.completePairs, 1);
  assert.equal(analytics.pendingReceipt, 1);
  assert.equal(analytics.conferencePercentage, 75);
});

test('painel da jazida detecta duplicidade somente na mesma data e via', () => {
  const analytics = buildJazidaAnalytics({
    tickets: [
      ticket('100320', 'Liberação', true, { id: 'lib-a' }),
      ticket('100320', 'Liberação', true, { id: 'lib-b' }),
      ticket('100320', 'Recebimento', true, { id: 'rec-a' }),
    ],
  });

  assert.equal(analytics.totalTickets, 1);
  assert.equal(analytics.duplicateTickets, 1);
  assert.equal(analytics.details[0]?.duplicateCount, 1);
});

