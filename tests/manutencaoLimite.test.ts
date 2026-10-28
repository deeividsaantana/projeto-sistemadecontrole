import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OBSERVACAO_LIMITE, confirmarDezHoras, continuaParadoAmanha, encerrarOrdensNoLimite, informarLiberacaoReal, vemParadoDeOntem,
} from '../src/utils/manutencaoLimite';
import { horasParadasDoDia } from '../src/utils/horasParadasDoDia';
import type { ControleEquipamentoDiario, OrdemServico } from '../src/types';

const DIA = '2026-10-28';
const registro = (extra: Partial<ControleEquipamentoDiario> = {}): ControleEquipamentoDiario => ({
  id: 'r1', chave: `${DIA}|eq1`, data: DIA, funcionarioId: '', codigoFuncionario: '', nomeMotorista: '',
  equipamentoId: 'eq1', prefixo: 'CB767', familia: 'Basculantes', status: 'Em manutenção',
  horaSaida: '', horaEntradaManutencao: '07:00', horaLiberacao: '', observacao: '', origem: 'SISTEMA',
  revisao: [], criadoEm: '', atualizadoEm: '', ordemServicoId: 'os1',
  eventos: [{ id: 'e1', ocorridoEm: `${DIA}T10:00:00.000Z`, hora: '07:00', tipo: 'ENTRADA_MANUTENCAO', statusNovo: 'Em manutenção' }],
  ...extra,
});
const ordem: OrdemServico = {
  id: 'os1', numero: 'OS-0041', equipamentoId: 'eq1', tipo: 'Corretiva', prioridade: 'Média', descricao: '',
  status: 'Aberta', dataAbertura: DIA, horaAbertura: '07:00', responsavel: 'frota', observacao: '',
};

test('OS aberta de um dia que bateu 10 h fecha na hora do limite', () => {
  const { ordens, encerradas } = encerrarOrdensNoLimite([registro()], [ordem], new Date('2026-10-29T08:00:00-03:00'), 'sistema');
  assert.equal(encerradas.length, 1);
  assert.equal(ordens[0].status, 'Concluída');
  assert.equal(ordens[0].dataConclusao, DIA);
  assert.equal(ordens[0].horaConclusao, '18:15');
  assert.match(ordens[0].observacao, new RegExp(OBSERVACAO_LIMITE));
});

test('OS abaixo do limite continua aberta', () => {
  const { encerradas } = encerrarOrdensNoLimite([registro()], [ordem], new Date(`${DIA}T15:00:00-03:00`), 'sistema');
  assert.equal(encerradas.length, 0);
});

test('OS já encerrada não é tocada de novo', () => {
  const fechada = { ...ordem, status: 'Concluída' as const };
  const { encerradas } = encerrarOrdensNoLimite([registro()], [fechada], new Date('2026-10-29T08:00:00-03:00'), 'sistema');
  assert.equal(encerradas.length, 0);
});

test('informar liberação real grava evento e recalcula', () => {
  const r = informarLiberacaoReal(registro(), '11:00', 'deivid', '2026-10-29T11:00:00.000Z');
  assert.equal(r.horaLiberacao, '11:00');
  assert.equal(r.status, 'Disponível');
  assert.equal(r.eventos?.at(-1)?.hora, '11:00');
  assert.equal(r.conferenciaManutencao?.decisao, 'LIBERACAO_INFORMADA');
  assert.equal(horasParadasDoDia(r, new Date('2026-10-29T08:00:00-03:00')).totalMin, 225);
});

test('confirmar 10 h só registra a decisão', () => {
  const r = confirmarDezHoras(registro(), 'deivid', '2026-10-29T11:00:00.000Z');
  assert.equal(r.conferenciaManutencao?.decisao, 'CONFIRMADO_10H');
  assert.equal(r.status, 'Em manutenção');
});

test('continua parado amanhã faz o dia seguinte começar às 07:00', () => {
  const hoje = continuaParadoAmanha(registro(), 'deivid', '2026-10-29T11:00:00.000Z');
  const amanha = registro({ id: 'r2', data: '2026-10-29', chave: '2026-10-29|eq1', eventos: [], horaEntradaManutencao: '' });
  assert.equal(vemParadoDeOntem([hoje, amanha], amanha), true);
  assert.equal(vemParadoDeOntem([registro(), amanha], amanha), false);
});
