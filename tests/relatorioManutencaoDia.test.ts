import assert from 'node:assert/strict';
import test from 'node:test';
import { linhasExcelManutencaoDia, montarRelatorioManutencaoDia } from '../src/utils/relatorioManutencaoDia';
import type { ControleEquipamentoDiario, EventoControleEquipamentoDiario } from '../src/types';

const DIA = '2026-10-28';
const ev = (tipo: EventoControleEquipamentoDiario['tipo'], hora: string, n: string): EventoControleEquipamentoDiario => ({
  id: n, ocorridoEm: `${DIA}T15:00:00.000Z`, hora, tipo, statusNovo: tipo === 'ENTRADA_MANUTENCAO' ? 'Em manutenção' : 'Disponível',
});
const reg = (id: string, prefixo: string, familia: string, eventos: EventoControleEquipamentoDiario[], extra: Partial<ControleEquipamentoDiario> = {}): ControleEquipamentoDiario => ({
  id, chave: `${DIA}|${id}`, data: DIA, funcionarioId: '', codigoFuncionario: '', nomeMotorista: '', equipamentoId: id,
  prefixo, familia, status: 'Em manutenção', horaSaida: '', horaEntradaManutencao: '', horaLiberacao: '', observacao: '',
  origem: 'SISTEMA', revisao: [], criadoEm: '', atualizadoEm: '', eventos, ...extra,
});
const decisao = { decisao: 'CONFIRMADO_10H' as const, decididoEm: '', decididoPor: 'deivid' };

const registros = [
  reg('a', 'CB767', 'Basculantes', [ev('ENTRADA_MANUTENCAO', '07:00', '1'), ev('LIBERACAO_MANUTENCAO', '14:00', '2')]),
  reg('b', 'CB929', 'Basculantes', [ev('ENTRADA_MANUTENCAO', '07:00', '3')]),
  reg('c', 'EH010', 'Escavadeiras', [ev('LIBERACAO_MANUTENCAO', '08:00', '4')]),
  reg('d', 'CB100', 'Basculantes', [], { status: 'Em operação' }),
];
const DEPOIS = new Date('2026-10-29T08:00:00-03:00');

test('relatório separa ok, limite e inconsistente e soma o dia', () => {
  const r = montarRelatorioManutencaoDia(DIA, registros, [], DEPOIS);
  assert.equal(r.linhas.length, 3);
  assert.deepEqual(r.linhas.map(l => [l.prefixo, l.grupo]), [['CB929', 'LIMITE'], ['EH010', 'INCONSISTENTE'], ['CB767', 'OK']]);
  assert.equal(r.totalMin, 345 + 600);
  assert.equal(r.aConferir, 2);
  assert.equal(r.fechado, false);
  assert.deepEqual(r.porTipo.find(t => t.tipo === 'Basculantes'), { tipo: 'Basculantes', totalMin: 945, equipamentos: 2 });
});

test('dia não fecha enquanto inconsistente estiver pendente, mesmo com limite conferido', () => {
  const conferidos = registros.map(item => item.id === 'b' ? { ...item, conferenciaManutencao: decisao } : item);
  const r = montarRelatorioManutencaoDia(DIA, conferidos, [], DEPOIS);
  assert.equal(r.aConferir, 1);
  assert.equal(r.fechado, false);
});

test('inconsistente nunca fica conferido, mesmo com decisão gravada', () => {
  const comDecisao = registros.map(item => item.id === 'b' || item.id === 'c' ? { ...item, conferenciaManutencao: decisao } : item);
  const r = montarRelatorioManutencaoDia(DIA, comDecisao, [], DEPOIS);
  assert.equal(r.linhas.find(l => l.prefixo === 'EH010')?.conferido, false);
  assert.equal(r.aConferir, 1);
  assert.equal(r.fechado, false);
});

test('dia passado fecha quando limite e OK estão resolvidos', () => {
  const semInconsistente = registros.filter(item => item.id !== 'c')
    .map(item => item.id === 'b' ? { ...item, conferenciaManutencao: decisao } : item);
  const r = montarRelatorioManutencaoDia(DIA, semInconsistente, [], DEPOIS);
  assert.equal(r.aConferir, 0);
  assert.equal(r.fechado, true);
});

test('parado hoje não vai para conferência e impede fechar o dia', () => {
  const agora = new Date('2026-10-28T15:00:00-03:00');
  const r = montarRelatorioManutencaoDia(DIA, [reg('e', 'CB900', 'Basculantes', [ev('ENTRADA_MANUTENCAO', '07:00', '9')])], [], agora);
  assert.equal(r.linhas[0].grupo, 'OK');
  assert.equal(r.parados, 1);
  assert.equal(r.fechado, false);
});

test('parado de dia passado vai para conferência e fecha com decisão CONTINUA_AMANHA', () => {
  const pendente = reg('f', 'CB300', 'Basculantes', [ev('ENTRADA_MANUTENCAO', '17:00', '10')]);
  const antes = montarRelatorioManutencaoDia(DIA, [pendente], [], DEPOIS);
  assert.equal(antes.linhas[0].grupo, 'LIMITE');
  assert.equal(antes.linhas[0].conferido, false);
  assert.equal(antes.parados, 0);

  const decidido = { ...pendente, conferenciaManutencao: { decisao: 'CONTINUA_AMANHA' as const, decididoEm: '', decididoPor: 'deivid' } };
  const depois = montarRelatorioManutencaoDia(DIA, [decidido], [], DEPOIS);
  assert.equal(depois.linhas[0].conferido, true);
  assert.equal(depois.fechado, true);
});

test('excel tem uma linha por período', () => {
  const linhas = linhasExcelManutencaoDia(montarRelatorioManutencaoDia(DIA, registros, [], DEPOIS));
  assert.equal(linhas.filter(l => l.Prefixo === 'CB767').length, 1);
  assert.equal(linhas.find(l => l.Prefixo === 'CB767')?.['Horas paradas'], '5 h 45');
});
