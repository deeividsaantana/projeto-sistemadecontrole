import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMaintenanceQueue } from '../src/utils/maintenanceQueue';
import type { ControleEquipamentoDiario, Equipamento, OrdemServico } from '../src/types';

const equipamentos: Equipamento[] = [{
  id: 'cb-01', prefixo: 'CB701', nome: 'Caminhão Basculante', tipo: 'Veículo',
  empresaId: 'empresa-1', marca: '', modelo: '', seriePlaca: '', placa: '',
  status: 'Manutenção', localAtualId: '', observacao: '',
}];

const ordem = (overrides: Partial<OrdemServico> = {}): OrdemServico => ({
  id: 'os-1', numero: 'OS-0001', equipamentoId: 'cb-01', tipo: 'Corretiva', prioridade: 'Alta',
  descricao: 'Vazamento hidráulico', motivo: 'Hidráulica', status: 'Aberta',
  dataAbertura: '2026-09-18', horaAbertura: '08:00', responsavel: 'Oficina', observacao: '',
  ...overrides,
});

test('fila de manutenção resume uma OS aberta por equipamento', () => {
  const queue = buildMaintenanceQueue([ordem()], equipamentos, new Date('2026-09-18T12:00:00'));

  assert.equal(queue.length, 1);
  assert.equal(queue[0].prefixo, 'CB701');
  assert.equal(queue[0].ordemId, 'os-1');
  assert.equal(queue[0].horasParadas, 4);
  assert.equal(queue[0].motivo, 'Hidráulica');
});

test('fila não mostra OS concluídas como parada em curso', () => {
  const queue = buildMaintenanceQueue([ordem({ status: 'Concluída', dataConclusao: '2026-09-18', horaConclusao: '10:00' })], equipamentos);
  assert.deepEqual(queue, []);
});

test('fila preserva prefixo do controle de frotas quando o cadastro não está mais disponível', () => {
  const controle: ControleEquipamentoDiario = {
    id: 'controle-1', chave: '2026-09-18|cb-701', data: '2026-09-18', funcionarioId: '', codigoFuncionario: '', nomeMotorista: '',
    equipamentoId: 'cb-removido', prefixo: 'CB701', familia: 'Basculantes', tipoEquipamento: 'Caminhão Basculante', status: 'Em manutenção',
    horaSaida: '', horaEntradaManutencao: '08:00', horaLiberacao: '', motivoManutencao: 'Falha hidráulica', observacao: '', origem: 'SISTEMA', revisao: [],
    criadoEm: '2026-09-18T08:00:00.000Z', atualizadoEm: '2026-09-18T08:00:00.000Z', ordemServicoId: 'os-1',
  };

  const queue = buildMaintenanceQueue([ordem({ equipamentoId: 'cb-removido' })], [], new Date('2026-09-18T12:00:00'), [controle]);

  assert.equal(queue[0].prefixo, 'CB701');
  assert.equal(queue[0].equipamentoNome, 'Caminhão Basculante');
});

test('fila rejeita vínculo de OS de outro equipamento e usa o histórico compatível', () => {
  const vinculoIncorreto: ControleEquipamentoDiario = {
    id: 'controle-incorreto', chave: '2026-09-18|cb-999', data: '2026-09-18', funcionarioId: '', codigoFuncionario: '', nomeMotorista: '',
    equipamentoId: 'cb-outro', prefixo: 'CB999', familia: 'Basculantes', tipoEquipamento: 'Caminhão Basculante', status: 'Em manutenção',
    horaSaida: '', horaEntradaManutencao: '08:00', horaLiberacao: '', motivoManutencao: '', observacao: '', origem: 'SISTEMA', revisao: [],
    criadoEm: '2026-09-18T08:00:00.000Z', atualizadoEm: '2026-09-18T08:00:00.000Z', ordemServicoId: 'os-1',
  };
  const historicoCompativel = { ...vinculoIncorreto, id: 'controle-correto', equipamentoId: 'cb-removido', prefixo: 'CB701', ordemServicoId: undefined };

  const queue = buildMaintenanceQueue([ordem({ equipamentoId: 'cb-removido' })], [], new Date('2026-09-18T12:00:00'), [vinculoIncorreto, historicoCompativel]);

  assert.equal(queue[0].prefixo, 'CB701');
});

test('fila prioriza o prefixo documentado na OS quando o vínculo legado diverge', () => {
  const controleComVinculoDivergente: ControleEquipamentoDiario = {
    id: 'controle-divergente', chave: '2026-09-18|cb-999', data: '2026-09-18', funcionarioId: '', codigoFuncionario: '', nomeMotorista: '',
    equipamentoId: 'cb-removido', prefixo: 'CB999', familia: 'Basculantes', tipoEquipamento: 'Caminhão Basculante', status: 'Em manutenção',
    horaSaida: '', horaEntradaManutencao: '08:00', horaLiberacao: '', motivoManutencao: '', observacao: '', origem: 'SISTEMA', revisao: [],
    criadoEm: '2026-09-18T08:00:00.000Z', atualizadoEm: '2026-09-18T08:00:00.000Z',
  };
  const ordemHistorica = ordem({ equipamentoId: 'cb-removido', descricao: 'Entrada em manutenção registrada no controle operacional do CB701.' });

  const queue = buildMaintenanceQueue([ordemHistorica], [], new Date('2026-09-18T12:00:00'), [controleComVinculoDivergente]);

  assert.equal(queue[0].prefixo, 'CB701');
  assert.equal(queue[0].identificacaoOrigem, 'registro');
});
