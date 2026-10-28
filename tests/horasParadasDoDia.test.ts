import assert from 'node:assert/strict';
import test from 'node:test';
import { formatarMinutos, horasParadasDoDia } from '../src/utils/horasParadasDoDia';
import type { ControleEquipamentoDiario, EventoControleEquipamentoDiario } from '../src/types';

const DIA = '2026-10-28';
const agoraEm = (hora: string) => new Date(`${DIA}T${hora}:00-03:00`);
const ONTEM_DEPOIS = new Date('2026-10-29T08:00:00-03:00');

const ev = (tipo: EventoControleEquipamentoDiario['tipo'], hora: string, n: number): EventoControleEquipamentoDiario => ({
  id: `evt-${n}`,
  ocorridoEm: `${DIA}T15:00:00.000Z`,
  hora,
  tipo,
  statusNovo: tipo === 'ENTRADA_MANUTENCAO' ? 'Em manutenção' : 'Disponível',
});

const registro = (eventos: EventoControleEquipamentoDiario[], extra: Partial<ControleEquipamentoDiario> = {}): ControleEquipamentoDiario => ({
  id: 'r1', chave: `${DIA}|eq1`, data: DIA, funcionarioId: '', codigoFuncionario: '', nomeMotorista: '',
  equipamentoId: 'eq1', prefixo: 'CB767', familia: 'Basculantes', status: 'Em manutenção',
  horaSaida: '', horaEntradaManutencao: '', horaLiberacao: '', observacao: '', origem: 'SISTEMA',
  revisao: [], criadoEm: `${DIA}T10:00:00.000Z`, atualizadoEm: `${DIA}T10:00:00.000Z`,
  eventos, ...extra,
});

const E = 'ENTRADA_MANUTENCAO' as const;
const L = 'LIBERACAO_MANUTENCAO' as const;

test('07:00 a 14:00 desconta DDS e almoço: 5 h 45', () => {
  const r = horasParadasDoDia(registro([ev(E, '07:00', 1), ev(L, '14:00', 2)]), agoraEm('18:00'));
  assert.equal(r.totalMin, 345);
  assert.equal(r.situacao, 'LIBERADO');
  assert.equal(formatarMinutos(r.totalMin), '5 h 45');
});

test('07:30 a 10:00 sem pausa no meio: 2 h 30', () => {
  const r = horasParadasDoDia(registro([ev(E, '07:30', 1), ev(L, '10:00', 2)]), agoraEm('18:00'));
  assert.equal(r.totalMin, 150);
});

test('entrada 10:00 sem liberação, agora 15:00: 4 h e segue parado', () => {
  const r = horasParadasDoDia(registro([ev(E, '10:00', 1)]), agoraEm('15:00'));
  assert.equal(r.totalMin, 240);
  assert.equal(r.situacao, 'PARADO');
  assert.equal(r.periodos[0].fim, null);
});

test('entrada 07:00 sem liberação em dia passado: 10 h e limite', () => {
  const r = horasParadasDoDia(registro([ev(E, '07:00', 1)]), ONTEM_DEPOIS);
  assert.equal(r.totalMin, 600);
  assert.equal(r.situacao, 'LIMITE_ATINGIDO');
  assert.equal(r.limiteAtingidoAs, '18:15');
});

test('dois períodos no dia somam: 3 h 30', () => {
  const r = horasParadasDoDia(registro([ev(E, '09:30', 1), ev(L, '11:00', 2), ev(E, '14:00', 3), ev(L, '16:00', 4)]), agoraEm('18:00'));
  assert.equal(r.totalMin, 210);
  assert.equal(r.periodos.length, 2);
});

test('entrada às 12:30 desconta só meia hora de almoço', () => {
  const r = horasParadasDoDia(registro([ev(E, '12:30', 1), ev(L, '14:00', 2)]), agoraEm('18:00'));
  assert.equal(r.totalMin, 60);
});

test('entrada repetida com o equipamento já parado não abre outro período', () => {
  const r = horasParadasDoDia(registro([ev(E, '09:16', 1), ev(E, '09:20', 2), ev(E, '09:25', 3), ev(L, '11:16', 4)]), agoraEm('18:00'));
  assert.equal(r.periodos.length, 1);
  assert.equal(r.totalMin, 120);
});

test('liberação antes da entrada é inconsistente e não vira número', () => {
  const r = horasParadasDoDia(registro([ev(L, '08:00', 1), ev(E, '09:00', 2), ev(L, '08:30', 3)]), agoraEm('18:00'));
  assert.equal(r.situacao, 'INCONSISTENTE');
});

test('hora em branco ou inválida é inconsistente', () => {
  const r = horasParadasDoDia(registro([ev(E, '25:99', 1)]), agoraEm('18:00'));
  assert.equal(r.situacao, 'INCONSISTENTE');
});

test('registro antigo sem hora nos eventos usa horaEntradaManutencao e horaLiberacao', () => {
  const antigo = registro([{ id: 'x', ocorridoEm: `${DIA}T12:12:00.000Z`, tipo: E, statusNovo: 'Em manutenção' }], {
    horaEntradaManutencao: '07:00', horaLiberacao: '14:00', status: 'Disponível',
  });
  assert.equal(horasParadasDoDia(antigo, agoraEm('18:00')).totalMin, 345);
});

test('vem parado de ontem: começa às 07:00', () => {
  const r = horasParadasDoDia(registro([ev(L, '09:00', 1)]), agoraEm('18:00'), { vemParadoDeOntem: true });
  assert.equal(r.periodos[0].inicio, '07:00');
  assert.equal(r.totalMin, 105);
});

test('entrada sem hora (legado) e liberação com hora: usa horaEntradaManutencao, 104 min', () => {
  const misto = registro([{ id: 'x', ocorridoEm: `${DIA}T12:12:00.000Z`, tipo: E, statusNovo: 'Em manutenção' }, ev(L, '11:00', 2)], {
    horaEntradaManutencao: '09:16',
  });
  const r = horasParadasDoDia(misto, agoraEm('18:00'));
  assert.equal(r.totalMin, 104);
  assert.equal(r.situacao, 'LIBERADO');
});

test('entrada com hora e liberação sem hora (legado): usa horaLiberacao, 150 min', () => {
  const misto = registro([ev(E, '07:30', 1), { id: 'y', ocorridoEm: `${DIA}T13:00:00.000Z`, tipo: L, statusNovo: 'Disponível' }], {
    horaLiberacao: '10:00',
  });
  const r = horasParadasDoDia(misto, agoraEm('18:00'));
  assert.equal(r.totalMin, 150);
  assert.equal(r.situacao, 'LIBERADO');
});

test('campo do dia com hora inválida (legado) é inconsistente', () => {
  const r = horasParadasDoDia(registro([], { horaEntradaManutencao: '9:16' }), agoraEm('18:00'));
  assert.equal(r.situacao, 'INCONSISTENTE');
});

test('equipamento que não parou no dia dá zero e liberado', () => {
  const r = horasParadasDoDia(registro([], { status: 'Em operação' }), agoraEm('18:00'));
  assert.equal(r.totalMin, 0);
  assert.equal(r.periodos.length, 0);
});
