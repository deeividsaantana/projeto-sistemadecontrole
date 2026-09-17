import assert from 'node:assert/strict';
import test from 'node:test';
import { fleetSnapshot, fleetSummary, aggregateProduction, withinPeriod, periodStart } from '../src/utils/dashboardOperational';
import type { ControleEquipamentoDiario, Equipamento, RegistroProducao } from '../src/types';

const equipment = (id: string) => ({ id, prefixo: id, nome: id, status: 'Ativo', empresaId: 'e1', localAtualId: 'o1' } as Equipamento);
const record = (id: string, status: string, updated: string) => ({ id: updated, equipamentoId: id, prefixo: id, data: '2026-09-17', status, atualizadoEm: updated } as ControleEquipamentoDiario);

test('missing daily records remain unknown, never available', () => {
  const rows = fleetSnapshot([equipment('A'), equipment('B')], [record('A', 'Em operação', '10:00')], '2026-09-17');
  assert.equal(rows[1].state, 'unknown');
  const summary = fleetSummary(rows);
  assert.equal(summary.unknown, 1);
  assert.equal(summary.available, 0);
  assert.equal(summary.availability, 100);
  assert.equal(summary.coverage, 50);
  assert.equal(fleetSummary([]).availability, null);
});

test('latest record wins and uncatalogued equipment is retained', () => {
  const rows = fleetSnapshot([equipment('A')], [record('A', 'Em operação', '08:00'), record('A', 'Em manutenção', '10:00'), record('X', 'A confirmar', '09:00')], '2026-09-17');
  assert.equal(rows.length, 2);
  assert.equal(rows.find(row => row.prefix === 'A')?.state, 'maintenance');
  assert.equal(rows.find(row => row.prefix === 'X')?.state, 'pending');
  assert.equal(fleetSummary(rows).availability, 0);
});

test('unrecognised status and other dates cannot inflate availability', () => {
  const rows = fleetSnapshot([equipment('A')], [record('A', 'Texto legado', '08:00')], '2026-09-17');
  assert.equal(rows[0].state, 'unknown');
  assert.equal(fleetSummary(rows).availability, null);
  assert.equal(fleetSnapshot([equipment('A')], [record('A', 'Em operação', '08:00')], '2026-09-16')[0].state, 'unknown');
});

test('production never mixes units or services', () => {
  const rows = [
    { id: '1', servicoId: 'a', servicoDescricao: 'Escavação', unidade: 'm³', quantidade: 10, ativo: true },
    { id: '2', servicoId: 'a', servicoDescricao: 'Escavação', unidade: 'm³', quantidade: 20, ativo: true },
    { id: '3', servicoId: 'a', servicoDescricao: 'Escavação', unidade: 'm', quantidade: 5, ativo: true },
    { id: '4', servicoId: 'a', servicoDescricao: 'Escavação', unidade: 'm³', quantidade: 99, ativo: false },
  ] as RegistroProducao[];
  assert.deepEqual(aggregateProduction(rows).map(row => [row.unit, row.quantity]), [['m³', 30], ['m', 5]]);
});

test('period boundaries use calendar days, including leap year', () => {
  assert.equal(periodStart('2024-03-01', 7), '2024-02-24');
  assert.equal(withinPeriod('2026-09-17', '2026-09-11', '2026-09-17'), true);
  assert.equal(withinPeriod('', '2026-09-11', '2026-09-17'), false);
});
