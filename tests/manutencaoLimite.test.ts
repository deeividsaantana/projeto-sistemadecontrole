import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LIMITE_10H_DESDE, OBSERVACAO_LIMITE, confirmarDezHoras, continuaParadoAmanha, encerrarOrdensNoLimite, horasDaOrdem, horasMedidasDaOrdem, informarLiberacaoReal,
  pendentesDeContinuidade, recalcularOrdemDoLimite, vemParadoDeOntem,
} from '../src/utils/manutencaoLimite';
import { horasParadasDoDia } from '../src/utils/horasParadasDoDia';
import type { ControleEquipamentoDiario, OrdemServico } from '../src/types';

const DIA = '2026-10-30';
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
  const { ordens, encerradas } = encerrarOrdensNoLimite([registro()], [ordem], new Date('2026-10-31T08:00:00-03:00'));
  assert.equal(encerradas.length, 1);
  assert.equal(ordens[0].status, 'Concluída');
  assert.equal(ordens[0].dataConclusao, DIA);
  assert.equal(ordens[0].horaConclusao, '18:15');
  assert.match(ordens[0].observacao, new RegExp(OBSERVACAO_LIMITE));
  assert.equal(ordens[0].atualizadoEm, '2026-10-30T21:15:00.000Z');
});

test('OS com dois dias no limite fecha no dia mais antigo, mesmo com array invertido', () => {
  const dia29 = registro({ id: 'r29', data: '2026-10-29', chave: '2026-10-29|eq1', eventos: [
    { id: 'e29', ocorridoEm: '2026-10-29T10:00:00.000Z', hora: '07:00', tipo: 'ENTRADA_MANUTENCAO', statusNovo: 'Em manutenção' },
  ] });
  const dia30 = registro();
  const agora = new Date('2026-10-31T08:00:00-03:00');
  const emOrdem = encerrarOrdensNoLimite([dia30, dia29], [ordem], agora).ordens[0];
  const reverso = encerrarOrdensNoLimite([dia29, dia30], [ordem], agora).ordens[0];
  assert.equal(emOrdem.dataConclusao, '2026-10-29');
  assert.equal(reverso.dataConclusao, '2026-10-29');
  assert.deepEqual(emOrdem, reverso);
});

test('OS abaixo do limite continua aberta', () => {
  const { encerradas } = encerrarOrdensNoLimite([registro()], [ordem], new Date(`${DIA}T15:00:00-03:00`));
  assert.equal(encerradas.length, 0);
});

test('OS já encerrada não é tocada de novo', () => {
  const fechada = { ...ordem, status: 'Concluída' as const };
  const { encerradas } = encerrarOrdensNoLimite([registro()], [fechada], new Date('2026-10-31T08:00:00-03:00'));
  assert.equal(encerradas.length, 0);
});

test('informar liberação real grava evento e recalcula', () => {
  const res = informarLiberacaoReal(registro(), '11:00', 'deivid', '2026-10-31T11:00:00.000Z');
  assert.equal(res.ok, true);
  if (!res.ok) return;
  const r = res.registro;
  assert.equal(r.horaLiberacao, '11:00');
  assert.equal(r.status, 'Disponível');
  assert.equal(r.eventos?.at(-1)?.hora, '11:00');
  assert.equal(r.conferenciaManutencao?.decisao, 'LIBERACAO_INFORMADA');
  assert.equal(horasParadasDoDia(r, new Date('2026-10-31T08:00:00-03:00')).totalMin, 225);
});

test('confirmar 10 h só registra a decisão', () => {
  const r = confirmarDezHoras(registro(), 'deivid', '2026-10-31T11:00:00.000Z');
  assert.equal(r.conferenciaManutencao?.decisao, 'CONFIRMADO_10H');
  assert.equal(r.status, 'Em manutenção');
});

test('continua parado amanhã faz o dia seguinte começar às 07:00', () => {
  const hoje = continuaParadoAmanha(registro(), 'deivid', '2026-10-31T11:00:00.000Z');
  const amanha = registro({ id: 'r2', data: '2026-10-31', chave: '2026-10-31|eq1', eventos: [], horaEntradaManutencao: '' });
  assert.equal(vemParadoDeOntem([hoje, amanha], amanha), true);
  assert.equal(vemParadoDeOntem([registro(), amanha], amanha), false);
});

test('liberação antes da entrada é recusada', () => {
  const res = informarLiberacaoReal(registro(), '06:30', 'deivid', '2026-10-31T11:00:00.000Z');
  assert.equal(res.ok, false);
});

test('hora malformada é recusada com mensagem de formato', () => {
  const res = informarLiberacaoReal(registro(), '7:5', 'deivid', '2026-10-31T11:00:00.000Z');
  assert.deepEqual(res, { ok: false, erro: 'Informe a hora no formato HH:MM.' });
});

test('dia antes de LIMITE_10H_DESDE não fecha OS sozinho; a partir dele fecha', () => {
  assert.equal(LIMITE_10H_DESDE, '2026-10-29');
  const antigo = registro({ data: '2026-10-28', chave: '2026-10-28|eq1', eventos: [
    { id: 'e0', ocorridoEm: '2026-10-28T10:00:00.000Z', hora: '07:00', tipo: 'ENTRADA_MANUTENCAO', statusNovo: 'Em manutenção' },
  ] });
  const novo = registro({ data: '2026-10-29', chave: '2026-10-29|eq1', eventos: [
    { id: 'e1', ocorridoEm: '2026-10-29T10:00:00.000Z', hora: '07:00', tipo: 'ENTRADA_MANUTENCAO', statusNovo: 'Em manutenção' },
  ] });
  const agora = new Date('2026-10-30T08:00:00-03:00');
  assert.equal(encerrarOrdensNoLimite([antigo], [ordem], agora).encerradas.length, 0);
  assert.equal(encerrarOrdensNoLimite([novo], [ordem], agora).encerradas.length, 1);
});

test('horas da OS somam os dias dela, cada um já limitado a 10 h', () => {
  const dia1 = registro({ id: 'a', data: '2026-10-29', eventos: [
    { id: 'a1', ocorridoEm: '2026-10-29T10:00:00.000Z', hora: '07:00', tipo: 'ENTRADA_MANUTENCAO', statusNovo: 'Em manutenção' },
  ] });
  const dia2 = registro({ id: 'b', data: '2026-10-30', eventos: [
    { id: 'b1', ocorridoEm: '2026-10-30T10:00:00.000Z', hora: '07:00', tipo: 'ENTRADA_MANUTENCAO', statusNovo: 'Em manutenção' },
    { id: 'b2', ocorridoEm: '2026-10-30T17:00:00.000Z', hora: '14:00', tipo: 'LIBERACAO_MANUTENCAO', statusNovo: 'Disponível' },
  ] });
  const inconsistente = registro({ id: 'c', data: '2026-10-31', horaEntradaManutencao: '', eventos: [
    { id: 'c1', ocorridoEm: '2026-10-31T10:00:00.000Z', hora: '08:00', tipo: 'LIBERACAO_MANUTENCAO', statusNovo: 'Disponível' },
  ] });
  const outra = registro({ id: 'd', ordemServicoId: 'os2' });
  assert.equal(horasDaOrdem(ordem, [dia1, dia2, inconsistente, outra], new Date('2026-11-01T08:00:00-03:00')), 15.75);
});

const continua = (data: string) => continuaParadoAmanha(registro({ id: `r-${data}`, data, chave: `${data}|eq1` }), 'deivid', `${data}T21:00:00.000Z`);

test('continua parado amanhã pede lançamento no dia seguinte quando ele falta', () => {
  const pendentes = pendentesDeContinuidade([continua('2026-10-30')], new Date('2026-10-31T06:30:00-03:00'));
  assert.deepEqual(pendentes.map(item => item.id), ['r-2026-10-30']);
});

test('continuidade não cria quando o dia seguinte já tem lançamento', () => {
  const amanha = registro({ id: 'r2', data: '2026-10-31', chave: '2026-10-31|eq1', status: 'Em operação', eventos: [] });
  assert.deepEqual(pendentesDeContinuidade([continua('2026-10-30'), amanha], new Date('2026-10-31T09:00:00-03:00')), []);
});

test('continuidade espera o dia seguinte começar e ignora dia antes de LIMITE_10H_DESDE', () => {
  assert.deepEqual(pendentesDeContinuidade([continua('2026-10-30')], new Date('2026-10-30T23:00:00-03:00')), []);
  assert.deepEqual(pendentesDeContinuidade([continua('2026-10-28')], new Date('2026-10-30T09:00:00-03:00')), []);
});

test('informar liberação real corrige a liberação lançada antes da entrada, sem apagar', () => {
  const rc044 = registro({ status: 'Disponível', horaEntradaManutencao: '10:00', horaLiberacao: '08:30', eventos: [
    { id: 'ent', ocorridoEm: `${DIA}T13:00:00.000Z`, hora: '10:00', tipo: 'ENTRADA_MANUTENCAO', statusNovo: 'Em manutenção' },
    { id: 'lib', ocorridoEm: `${DIA}T14:00:00.000Z`, hora: '08:30', tipo: 'LIBERACAO_MANUTENCAO', statusNovo: 'Disponível' },
  ] });
  const res = informarLiberacaoReal(rc044, '11:00', 'deivid', '2026-10-31T11:00:00.000Z');
  assert.equal(res.ok, true);
  if (!res.ok) return;
  const antiga = res.registro.eventos?.find(evento => evento.id === 'lib');
  const nova = res.registro.eventos?.at(-1);
  assert.equal(antiga?.substituidoPor, nova?.id);
  assert.equal(res.registro.eventos?.length, 3);
  assert.equal(horasParadasDoDia(res.registro, new Date('2026-10-31T08:00:00-03:00')).totalMin, 60);
});

test('OS fechada no limite é recalculada quando a conferência informa a liberação', () => {
  const fechada = encerrarOrdensNoLimite([registro()], [ordem], new Date('2026-10-31T08:00:00-03:00')).ordens[0];
  const res = informarLiberacaoReal(registro(), '11:00', 'deivid', '2026-10-31T11:00:00.000Z');
  assert.equal(res.ok, true);
  if (!res.ok) return;
  const recalculada = recalcularOrdemDoLimite(fechada, [res.registro], new Date('2026-10-31T11:00:00-03:00'));
  assert.ok(recalculada);
  assert.equal(recalculada.horasParadas, 3.75);
  assert.equal(recalculada.horaConclusao, '11:00');
  assert.doesNotMatch(recalculada.observacao, new RegExp(OBSERVACAO_LIMITE));
  assert.match(recalculada.observacao, /Concluída na conferência\./);
  assert.equal(recalcularOrdemDoLimite(fechada, [registro()], new Date('2026-10-31T11:00:00-03:00')), null);
  assert.equal(recalcularOrdemDoLimite(ordem, [res.registro], new Date('2026-10-31T11:00:00-03:00')), null);
});

test('informar liberação real em lançamento antigo sem eventos usa a entrada do campo', () => {
  const antigo = registro({ eventos: [], horaEntradaManutencao: '10:00' });
  const res = informarLiberacaoReal(antigo, '11:00', 'deivid', '2026-10-31T11:00:00.000Z');
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(horasParadasDoDia(res.registro, new Date('2026-10-31T08:00:00-03:00')).totalMin, 60);
});

test('liberação antiga errada no campo (antes da entrada) não impede informar a real', () => {
  const antigo = registro({ eventos: [], horaEntradaManutencao: '10:00', horaLiberacao: '07:00' });
  const res = informarLiberacaoReal(antigo, '11:00', 'deivid', '2026-10-31T11:00:00.000Z');
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(horasParadasDoDia(res.registro, new Date('2026-10-31T08:00:00-03:00')).totalMin, 60);
});

test('continuidade trata lançamento excluído do dia seguinte como existente', () => {
  const excluido = { ...registro({ id: 'r2', data: '2026-10-31', chave: '2026-10-31|eq1', eventos: [] }), excluido: { em: 'x' } } as ControleEquipamentoDiario;
  assert.deepEqual(pendentesDeContinuidade([continua('2026-10-30'), excluido], new Date('2026-10-31T09:00:00-03:00')), []);
});

test('OS sem nenhum dia lançado não tem hora medida: vazio, não zero', () => {
  assert.equal(horasMedidasDaOrdem({ id: 'sem-dias' }, [registro()], new Date('2026-10-31T08:00:00-03:00')), undefined);
  assert.equal(horasMedidasDaOrdem(ordem, [registro()], new Date('2026-10-31T08:00:00-03:00')), 10);
});
