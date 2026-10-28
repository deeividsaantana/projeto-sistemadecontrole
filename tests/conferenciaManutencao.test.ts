import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dataDeHoje, descricaoDaConferencia, descricaoDoEncerramento, diasParaConferir, motivosDoDia, registrosDeManutencao, rotuloDaSituacao,
} from '../src/utils/conferenciaManutencao';
import { horasParadasDoDia } from '../src/utils/horasParadasDoDia';
import { montarRelatorioManutencaoDia } from '../src/utils/relatorioManutencaoDia';
import type { ControleEquipamentoDiario, EventoControleEquipamentoDiario, OrdemServico } from '../src/types';

const ev = (tipo: EventoControleEquipamentoDiario['tipo'], hora: string, n: string): EventoControleEquipamentoDiario => ({
  id: n, ocorridoEm: '2026-10-28T15:00:00.000Z', hora, tipo, statusNovo: tipo === 'ENTRADA_MANUTENCAO' ? 'Em manutenção' : 'Disponível',
});
const reg = (id: string, data: string, eventos: EventoControleEquipamentoDiario[], extra: Partial<ControleEquipamentoDiario> = {}): ControleEquipamentoDiario => ({
  id, chave: `${data}|${id}`, data, funcionarioId: '', codigoFuncionario: '', nomeMotorista: '', equipamentoId: id,
  prefixo: id.toUpperCase(), familia: 'Basculantes', status: 'Em manutenção', horaSaida: '', horaEntradaManutencao: '', horaLiberacao: '',
  observacao: '', origem: 'SISTEMA', revisao: [], criadoEm: '', atualizadoEm: '', eventos, ...extra,
});
const AGORA = new Date('2026-10-28T15:00:00-03:00');

test('hoje é a data de Brasília, não a de UTC', () => {
  assert.equal(dataDeHoje(new Date('2026-10-28T23:30:00-03:00')), '2026-10-28');
});

test('só entra o lançamento com manutenção e que não foi excluído', () => {
  const registros = [
    reg('a', '2026-10-28', [ev('ENTRADA_MANUTENCAO', '08:00', '1')]),
    reg('b', '2026-10-28', [], { status: 'Em operação' }),
    reg('c', '2026-10-28', [], { horaEntradaManutencao: '09:00' }),
    { ...reg('d', '2026-10-28', [ev('ENTRADA_MANUTENCAO', '08:00', '2')]), excluido: { em: 'x' } } as ControleEquipamentoDiario,
  ];
  assert.deepEqual(registrosDeManutencao(registros).map(item => item.id), ['a', 'c']);
});

test('dias para conferir trazem ontem sem liberação e ignoram dia resolvido e fora da janela', () => {
  const registros = [
    reg('a', '2026-10-27', [ev('ENTRADA_MANUTENCAO', '08:00', '1')]),
    reg('b', '2026-10-26', [ev('ENTRADA_MANUTENCAO', '08:00', '2'), ev('LIBERACAO_MANUTENCAO', '10:00', '3')]),
    reg('c', '2026-08-01', [ev('ENTRADA_MANUTENCAO', '08:00', '4')]),
    reg('d', '2026-10-28', [ev('ENTRADA_MANUTENCAO', '14:00', '5')]),
  ];
  assert.deepEqual(diasParaConferir(registros, [], AGORA), [{ data: '2026-10-27', aConferir: 1 }]);
});

test('o nome da situação vem da conta; dia passado sem liberação vira "Sem liberação"', () => {
  assert.deepEqual(rotuloDaSituacao('PARADO'), { texto: 'Parado', tom: 'parado' });
  assert.deepEqual(rotuloDaSituacao('PARADO', 'LIMITE'), { texto: 'Sem liberação', tom: 'conferir' });
  assert.deepEqual(rotuloDaSituacao('LIMITE_ATINGIDO', 'LIMITE'), { texto: 'Limite 10 h', tom: 'conferir' });
  assert.deepEqual(rotuloDaSituacao('LIBERADO', 'OK'), { texto: 'Liberado', tom: 'liberado' });
  assert.deepEqual(rotuloDaSituacao('INCONSISTENTE', 'INCONSISTENTE'), { texto: 'Inconsistente', tom: 'conferir' });
});

test('histórico da conferência leva antes, depois e a decisão anterior', () => {
  const antes = horasParadasDoDia(reg('a', '2026-10-27', [ev('ENTRADA_MANUTENCAO', '07:00', '1')]), AGORA);
  const depois = horasParadasDoDia(reg('a', '2026-10-27', [ev('ENTRADA_MANUTENCAO', '07:00', '1'), ev('LIBERACAO_MANUTENCAO', '10:00', '2')]), AGORA);
  const texto = descricaoDaConferencia({
    prefixo: 'CB929', data: '2026-10-27', decisao: 'LIBERACAO_INFORMADA', antes, depois, hora: '10:00',
    anterior: { decisao: 'CONFIRMADO_10H', decididoEm: '', decididoPor: 'Deivid' },
  });
  assert.equal(texto, 'Conferência de CB929 em 27/10/2026: Informou a liberação real às 10:00. Antes: limite 10 h, 10 h; decisão anterior: Confirmou 10 h por Deivid. Depois: liberado, 2 h 45.');
});

test('histórico do encerramento pelo limite leva o antes e o depois da OS', () => {
  const antes = { id: 'os', numero: 'OS-0012', status: 'Em Andamento' } as OrdemServico;
  const depois = { ...antes, status: 'Concluída', dataConclusao: '2026-10-27', horaConclusao: '18:15', horasParadas: 10 } as OrdemServico;
  assert.equal(descricaoDoEncerramento(antes, depois, 'CB929'), 'Encerrada pelo limite de 10 h: OS-0012 de CB929. Antes: Em Andamento, sem liberação. Depois: Concluída em 27/10/2026 às 18:15, 10 h paradas no dia.');
});

test('motivos do dia somam as horas pelo motivo da OS ou do lançamento', () => {
  const registros = [
    reg('a', '2026-10-28', [ev('ENTRADA_MANUTENCAO', '08:00', '1'), ev('LIBERACAO_MANUTENCAO', '10:00', '2')], { ordemServicoId: 'os-a' }),
    reg('b', '2026-10-28', [ev('ENTRADA_MANUTENCAO', '13:00', '3'), ev('LIBERACAO_MANUTENCAO', '14:00', '4')], { motivoManutencao: 'Pneu' }),
    reg('c', '2026-10-28', [ev('ENTRADA_MANUTENCAO', '13:00', '5'), ev('LIBERACAO_MANUTENCAO', '13:30', '6')]),
  ];
  const ordens = [{ id: 'os-a', numero: 'OS-1', motivo: 'Pneu' } as OrdemServico];
  const relatorio = montarRelatorioManutencaoDia('2026-10-28', registros, ordens, AGORA);
  assert.deepEqual(motivosDoDia(relatorio, registros, ordens), [
    { motivo: 'Pneu', totalMin: 180, equipamentos: 2 },
    { motivo: 'Sem motivo informado', totalMin: 30, equipamentos: 1 },
  ]);
});
