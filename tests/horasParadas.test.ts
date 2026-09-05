import assert from 'node:assert/strict';
import test from 'node:test';
import type { ControleEquipamentoDiario } from '../src/types';
import { listarParadas, paradasSemHorario, somarPor } from '../src/utils/horasParadas';

const registro = (extra: Partial<ControleEquipamentoDiario> & { frenteServico?: string }) => ({
  id: 'r1',
  chave: 'k1',
  data: '2026-09-01',
  funcionarioId: 'f1',
  codigoFuncionario: '1',
  nomeMotorista: 'Motorista',
  equipamentoId: 'eq-1',
  prefixo: 'CB770',
  familia: 'Basculante',
  status: 'Em manutenção' as const,
  horaSaida: '07:00',
  horaEntradaManutencao: '',
  horaLiberacao: '',
  observacao: '',
  origem: 'SISTEMA' as const,
  revisao: [],
  criadoEm: '',
  atualizadoEm: '',
  ...extra,
});

test('parada mede da entrada em manutenção até a liberação', () => {
  const [parada] = listarParadas([registro({ horaEntradaManutencao: '08:00', horaLiberacao: '12:30' })]);
  assert.equal(parada.horas, 4.5);
  assert.equal(parada.emCurso, false);
});

test('sem liberação a parada corre até o fim do dia e fica marcada em curso', () => {
  const [parada] = listarParadas([registro({ horaEntradaManutencao: '22:00' })]);
  assert.equal(parada.horas, 2);
  assert.equal(parada.emCurso, true);
});

test('registro sem horário de entrada não vira hora estimada', () => {
  assert.deepEqual(listarParadas([registro({ status: 'Em manutenção' })]), []);
  assert.equal(paradasSemHorario([registro({ status: 'Em manutenção' })]), 1);
});

test('liberação anterior à entrada é descartada', () => {
  assert.deepEqual(listarParadas([registro({ horaEntradaManutencao: '15:00', horaLiberacao: '09:00' })]), []);
});

test('parada carrega frente, motivo e OS vinculada', () => {
  const [parada] = listarParadas(
    [registro({ horaEntradaManutencao: '08:00', horaLiberacao: '10:00', motivoManutencao: 'Pneu', frenteServico: 'Ramo 200', ordemServicoId: 'os-1' })],
    [{ id: 'os-1', numero: 'OS-0100' } as never],
  );
  assert.equal(parada.motivo, 'Pneu');
  assert.equal(parada.frente, 'Ramo 200');
  assert.equal(parada.ordemNumero, 'OS-0100');
});

test('soma agrupa e ordena da maior para a menor', () => {
  const paradas = listarParadas([
    registro({ id: 'a', horaEntradaManutencao: '08:00', horaLiberacao: '09:00' }),
    registro({ id: 'b', prefixo: 'CB1005', equipamentoId: 'eq-2', horaEntradaManutencao: '08:00', horaLiberacao: '12:00' }),
    registro({ id: 'c', horaEntradaManutencao: '13:00', horaLiberacao: '14:00' }),
  ]);
  const porEquipamento = somarPor(paradas, parada => parada.prefixo);
  assert.deepEqual(porEquipamento.map(item => [item.chave, item.horas, item.ocorrencias]), [
    ['CB1005', 4, 1],
    ['CB770', 2, 2],
  ]);
});
