import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDashboardGeneralViewModel } from '../src/utils/dashboardGeneral';
import type { Abastecimento, ControleEquipamentoDiario, Equipamento, OrdemServico, PresencaApontamento, RegistroProducao } from '../src/types';

const source = {
  equipamentos: [
    { id: 'eq-a', prefixo: 'A', localAtualId: 'obra-a', status: 'Ativo' },
    { id: 'eq-b', prefixo: 'B', localAtualId: 'obra-b', status: 'Ativo' },
  ] as Equipamento[],
  controlesEquipamentos: [
    { id: 'daily-a', equipamentoId: 'eq-a', data: '2026-09-24', status: 'Em operação' },
    { id: 'daily-b', equipamentoId: 'eq-b', data: '2026-09-24', status: 'Em manutenção' },
  ] as ControleEquipamentoDiario[],
  producao: [
    { id: 'p-a', obraId: 'obra-a', data: '2026-09-24', quantidade: 10, unidade: 'm³', ativo: true },
    { id: 'p-b', obraId: 'obra-b', data: '2026-09-24', quantidade: 50, unidade: 'm³', ativo: true },
  ] as RegistroProducao[],
  abastecimentos: [
    { id: 'f-a', equipamentoId: 'eq-a', data: '2026-09-24', quantidadeLitros: 30 },
    { id: 'f-b', equipamentoId: 'eq-b', data: '2026-09-24', quantidadeLitros: 90 },
  ] as Abastecimento[],
  presencasLink: [
    { id: 'a', grupoId: 'ga', data: '2026-09-24', status: 'Presente' },
    { id: 'b', grupoId: 'gb', data: '2026-09-24', status: 'Presente' },
  ] as PresencaApontamento[],
  gruposEquipe: [{ id: 'ga', obraId: 'obra-a', nome: 'Terraplenagem', frenteServico: 'Frente norte', status: 'ativo' as const }, { id: 'gb', obraId: 'obra-b', nome: 'Drenagem', frenteServico: 'Frente sul', status: 'ativo' as const }],
  ordensServico: [{ id: 'os-a', equipamentoId: 'eq-a', status: 'Aberta', prioridade: 'Urgente', numero: 'OS-1', dataAbertura: '2026-09-23' }] as OrdemServico[],
};

test('painel isola obra e período em todos os indicadores', () => {
  const view = buildDashboardGeneralViewModel({ obraId: 'obra-a', from: '2026-09-24', to: '2026-09-24' }, source);
  assert.equal(view.fleet.operating, 1);
  assert.equal(view.production.value, 10);
  assert.equal(view.fuel.value, 30);
  assert.equal(view.presence.value, 1);
  assert.equal(view.maintenance.value, 1);
  assert.equal(view.attention[0]?.target, 'Manutenção');
  assert.equal(view.teams.total, 1);
  assert.equal(view.teams.withRecords, 1);
  assert.deepEqual(view.teams.items.map(team => [team.name, team.present, team.lastDate]), [['Terraplenagem', 1, '2026-09-24']]);
});

test('sem registros não transforma desconhecido em zero', () => {
  const view = buildDashboardGeneralViewModel({ obraId: 'obra-a', from: '2026-09-22', to: '2026-09-22' }, source);
  assert.equal(view.fleet.availability, null);
  assert.equal(view.production.value, null);
  assert.equal(view.fuel.value, null);
  assert.equal(view.presence.value, null);
  assert.equal(view.teams.withRecords, 0);
  assert.equal(view.teams.items[0]?.lastDate, null);
});

test('séries mantêm datas sem registros como ausência e escala limitada', () => {
  const view = buildDashboardGeneralViewModel({ obraId: 'obra-a', from: '2026-09-23', to: '2026-09-24' }, source);
  assert.deepEqual(view.production.series.map(point => point.value), [null, 10]);
  assert.ok(view.production.series.every(point => point.percent >= 0 && point.percent <= 100));
  assert.deepEqual(view.availability.series.map(point => point.value), [null, 100]);
});
