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

test('dia fecha quando limite e inconsistente estão conferidos', () => {
  const conferidos = registros.map(item => item.id === 'b' || item.id === 'c'
    ? { ...item, conferenciaManutencao: { decisao: 'CONFIRMADO_10H' as const, decididoEm: '', decididoPor: 'deivid' } }
    : item);
  const r = montarRelatorioManutencaoDia(DIA, conferidos, [], DEPOIS);
  assert.equal(r.aConferir, 0);
  assert.equal(r.fechado, true);
});

test('excel tem uma linha por período', () => {
  const linhas = linhasExcelManutencaoDia(montarRelatorioManutencaoDia(DIA, registros, [], DEPOIS));
  assert.equal(linhas.filter(l => l.Prefixo === 'CB767').length, 1);
  assert.equal(linhas.find(l => l.Prefixo === 'CB767')?.['Horas paradas'], '5 h 45');
});
