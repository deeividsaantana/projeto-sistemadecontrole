import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONTINUIDADE_AUTOMATICA_DESDE, OBSERVACAO_ALEM_DO_LIMITE, OBSERVACAO_LIMITE, confirmarDezHoras, continuacaoParaDesfazer, continuaParadoAmanha,
  continuarAlemDoLimite, encerrarOrdensNoLimite, horasDaOrdem, informarLiberacaoReal, pendentesDeContinuidade, reabrirOrdensAlemDoLimite,
  recalcularOrdemDoLimite, voltarARegraDasDezHoras,
} from '../src/utils/manutencaoLimite';
import { horasParadasDoDia } from '../src/utils/horasParadasDoDia';
import { registroDaEdicao } from '../src/modules/frota/quadroFrota';
import { linhaDoTempo } from '../src/components/manutencao/CartaoParada';
import type { ControleEquipamentoDiario, Equipamento, OrdemServico } from '../src/types';

const DIA = '2026-10-30';
const DIA_SEGUINTE = new Date('2026-10-31T08:00:00-03:00');
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
const AGORA_ISO = '2026-10-30T20:00:00.000Z';
const alem = () => continuarAlemDoLimite(registro(), 'Deivid', AGORA_ISO);

test('continuar além de 10 h grava quem decidiu e quando', () => {
  const r = alem();
  assert.deepEqual(r.continuaAlemDoLimite, { decididoEm: AGORA_ISO, decididoPor: 'Deivid' });
  assert.equal(r.atualizadoEm, AGORA_ISO);
  assert.equal(r.conferenciaManutencao, undefined, 'não é uma decisão de fechamento da conferência');
});

test('com "continuar além de 10 h" o contador passa de 10 h e segue parado', () => {
  const r = horasParadasDoDia(alem(), DIA_SEGUINTE);
  assert.equal(r.totalMin, 945, '07:00 às 24:00 sem DDS e almoço, sem teto');
  assert.equal(r.brutoMin, 945);
  assert.equal(r.situacao, 'PARADO');
  assert.equal(r.limiteAtingidoAs, '18:15', 'continua mostrando quando passou de 10 h');
  assert.equal(r.alemDoLimite, true);
  const sem = horasParadasDoDia(registro(), DIA_SEGUINTE);
  assert.equal(sem.totalMin, 600, 'sem a decisão, a regra das 10 h fica igual');
  assert.equal(sem.alemDoLimite, false);
});

test('OS de dia com "continuar além de 10 h" não fecha sozinha e soma as horas sem teto', () => {
  const { encerradas } = encerrarOrdensNoLimite([alem()], [ordem], DIA_SEGUINTE);
  assert.equal(encerradas.length, 0);
  assert.equal(horasDaOrdem(ordem, [alem()], DIA_SEGUINTE), 15.75);
});

test('OS que já fechou pelo limite reabre quando decidem continuar além de 10 h', () => {
  const fechada = encerrarOrdensNoLimite([registro()], [ordem], DIA_SEGUINTE).ordens[0];
  assert.equal(fechada.status, 'Concluída');
  const reaberta = recalcularOrdemDoLimite(fechada, [alem()], DIA_SEGUINTE);
  assert.ok(reaberta);
  assert.equal(reaberta.status, 'Em Andamento');
  assert.equal(reaberta.dataConclusao, undefined);
  assert.equal(reaberta.horaConclusao, undefined);
  assert.equal(reaberta.horasParadas, 15.75);
  assert.doesNotMatch(reaberta.observacao, new RegExp(OBSERVACAO_LIMITE));
  assert.match(reaberta.observacao, new RegExp(OBSERVACAO_ALEM_DO_LIMITE));
});

const NOVO = CONTINUIDADE_AUTOMATICA_DESDE;
const DEPOIS_DO_NOVO = new Date(`${NOVO}T12:00:00-03:00`);
DEPOIS_DO_NOVO.setUTCDate(DEPOIS_DO_NOVO.getUTCDate() + 1);
const doNovo = (extra: Partial<ControleEquipamentoDiario> = {}) => registro({ id: 'rn', chave: `${NOVO}|eq1`, data: NOVO, ...extra });

test('em manutenção sem liberação passa sozinho para o dia seguinte', () => {
  assert.deepEqual(pendentesDeContinuidade([doNovo()], DEPOIS_DO_NOVO).map(item => item.id), ['rn']);
  assert.deepEqual(pendentesDeContinuidade([doNovo({ status: 'Aguardando manutenção' })], DEPOIS_DO_NOVO).map(item => item.id), ['rn']);
  const comDecisao = continuarAlemDoLimite(doNovo(), 'Deivid', AGORA_ISO);
  assert.deepEqual(pendentesDeContinuidade([comDecisao], DEPOIS_DO_NOVO).map(item => item.id), ['rn']);
});

test('continuidade sem decisão não volta no tempo: dias antes da regra nova só seguem com "Continua amanhã"', () => {
  assert.equal(pendentesDeContinuidade([registro()], DIA_SEGUINTE).length, 0, 'sem cascata retroativa a cada salvamento');
  const decidido = continuaParadoAmanha(registro(), 'Deivid', AGORA_ISO);
  assert.deepEqual(pendentesDeContinuidade([decidido], DIA_SEGUINTE).map(item => item.id), ['r1'], 'a decisão da conferência continua valendo');
});

test('voltar à regra das 10 h tira a decisão e o teto volta', () => {
  const voltou = voltarARegraDasDezHoras(alem(), 'Bia', '2026-10-30T21:00:00.000Z');
  assert.equal(voltou.continuaAlemDoLimite, undefined);
  assert.equal(voltou.atualizadoEm, '2026-10-30T21:00:00.000Z');
  assert.equal(horasParadasDoDia(voltou, DIA_SEGUINTE).totalMin, 600);
});

test('OS fechada no limite por outro aparelho reabre sozinha quando o dia segue além de 10 h', () => {
  const fechada = encerrarOrdensNoLimite([registro()], [ordem], DIA_SEGUINTE).ordens[0];
  const { ordens, reabertas } = reabrirOrdensAlemDoLimite([alem()], [fechada], DIA_SEGUINTE);
  assert.equal(reabertas.length, 1);
  assert.equal(ordens[0].status, 'Em Andamento');
  const nada = reabrirOrdensAlemDoLimite([registro()], [fechada], DIA_SEGUINTE);
  assert.equal(nada.reabertas.length, 0, 'sem a decisão, a OS fechada no limite fica fechada');
  assert.equal(nada.ordens[0], fechada);
});

test('conferência desfaz o dia seguinte criado pela continuidade quando ninguém mexeu nele', () => {
  const seguinte = registro({ id: 'r2', chave: '2026-10-31|eq1', data: '2026-10-31', continuacaoDe: 'r1', criadoEm: 'T1', atualizadoEm: 'T1', ordemServicoId: 'os2' });
  assert.equal(continuacaoParaDesfazer([registro(), seguinte], registro())?.id, 'r2');
  const mexido = { ...seguinte, atualizadoEm: 'T2' };
  assert.equal(continuacaoParaDesfazer([registro(), mexido], registro()), undefined, 'alguém lançou depois: fica');
  const manual = { ...seguinte, continuacaoDe: undefined };
  assert.equal(continuacaoParaDesfazer([registro(), manual], registro()), undefined, 'lançado à mão: fica');
  const excluido = { ...seguinte, excluido: { em: 'x' } } as unknown as ControleEquipamentoDiario;
  assert.equal(continuacaoParaDesfazer([registro(), excluido], registro()), undefined);
});

test('continuidade automática respeita liberação e decisões da conferência', () => {
  const liberado = registro({ status: 'Em operação', horaLiberacao: '15:00' });
  assert.equal(pendentesDeContinuidade([liberado], DIA_SEGUINTE).length, 0, 'liberado não continua');
  const confirmado = confirmarDezHoras(registro(), 'Deivid', AGORA_ISO);
  assert.equal(pendentesDeContinuidade([confirmado], DIA_SEGUINTE).length, 0, 'confirmado 10 h fecha o assunto');
  const informado = informarLiberacaoReal(registro(), '16:00', 'Deivid', AGORA_ISO);
  assert.ok(informado.ok);
  assert.equal(pendentesDeContinuidade([informado.registro], DIA_SEGUINTE).length, 0, 'liberação informada fecha o assunto');
  assert.equal(pendentesDeContinuidade([registro()], new Date('2026-10-30T20:00:00-03:00')).length, 0, 'espera o dia seguinte começar');
});

test('liberação e saída gravam a hora informada e o motorista que assumiu', () => {
  const equipamento = { id: 'eq1', prefixo: 'CB767', nome: 'Caminhão', tipo: 'Caminhão Basculante', status: 'Ativo' } as unknown as Equipamento;
  const base = { dia: DIA, hora: '14:10', agora: `${DIA}T18:00:00.000Z`, usuario: 'Deivid', equipamento, funcionarios: [{ id: 'f1', nome: 'João Pereira', matricula: '9', ativo: true } as never] };
  const edicao = { status: 'Em operação' as const, canteiro: 'IBAR', frente: '', operador: 'joao pereira', motivoManutencao: '', observacao: '' };
  const liberado = registroDaEdicao({ ...base, registros: [registro()], edicao });
  assert.ok(liberado.ok);
  if (!liberado.ok) return;
  const evento = liberado.registro.eventos?.at(-1);
  assert.equal(evento?.tipo, 'LIBERACAO_MANUTENCAO');
  assert.equal(evento?.hora, '14:10');
  assert.equal(evento?.operador, 'João Pereira');

  const saiu = registroDaEdicao({ ...base, hora: '06:50', registros: [], edicao });
  assert.ok(saiu.ok);
  if (!saiu.ok) return;
  assert.equal(saiu.registro.eventos?.[0].tipo, 'SAIDA_OPERACAO');
  assert.equal(saiu.registro.eventos?.[0].hora, '06:50');
  assert.equal(saiu.registro.eventos?.[0].operador, 'João Pereira');
});

test('linha do tempo do card conta quem assumiu a máquina depois da liberação', () => {
  const itens = linhaDoTempo(registro({ eventos: [
    { id: 'e1', ocorridoEm: `${DIA}T10:00:00.000Z`, hora: '07:00', tipo: 'ENTRADA_MANUTENCAO', statusNovo: 'Em manutenção', motivo: 'Pneu', responsavel: 'Ana' },
    { id: 'e2', ocorridoEm: `${DIA}T17:10:00.000Z`, hora: '14:10', tipo: 'LIBERACAO_MANUTENCAO', statusNovo: 'Em operação', responsavel: 'Bia', operador: 'João Pereira' },
  ] }));
  assert.equal(itens[1].texto, 'Liberado');
  assert.equal(itens[1].hora, '14:10');
  assert.equal(itens[1].detalhe, 'João Pereira assumiu às 14:10');
});

test('mudar canteiro de quem já opera não vira "assumiu" na linha do tempo', () => {
  const equipamento = { id: 'eq1', prefixo: 'CB767', nome: 'Caminhão', tipo: 'Caminhão Basculante', status: 'Ativo' } as unknown as Equipamento;
  const base = { dia: DIA, hora: '08:00', agora: `${DIA}T11:00:00.000Z`, usuario: 'Deivid', equipamento, funcionarios: [{ id: 'f1', nome: 'João Pereira', matricula: '9', ativo: true } as never, { id: 'f2', nome: 'Rita Lima', matricula: '8', ativo: true } as never] };
  const edicao = { status: 'Em operação' as const, canteiro: 'IBAR', frente: '', operador: 'João Pereira', motivoManutencao: '', observacao: '' };
  const saiu = registroDaEdicao({ ...base, registros: [], edicao });
  assert.ok(saiu.ok);
  if (!saiu.ok) return;
  const moveu = registroDaEdicao({ ...base, hora: '10:00', agora: `${DIA}T13:00:00.000Z`, registros: [saiu.registro], edicao: { ...edicao, canteiro: 'Marginal' } });
  assert.ok(moveu.ok);
  if (!moveu.ok) return;
  assert.equal(moveu.registro.eventos?.at(-1)?.operador, undefined, 'mesmo motorista, só mudou o canteiro');
  const trocou = registroDaEdicao({ ...base, hora: '12:00', agora: `${DIA}T15:00:00.000Z`, registros: [moveu.registro], edicao: { ...edicao, operador: 'Rita Lima' } });
  assert.ok(trocou.ok);
  if (!trocou.ok) return;
  assert.equal(trocou.registro.eventos?.at(-1)?.operador, 'Rita Lima', 'troca de motorista conta como assumir');
});

test('linha do tempo mantém a observação junto com quem assumiu', () => {
  const itens = linhaDoTempo(registro({ eventos: [
    { id: 'e2', ocorridoEm: `${DIA}T17:10:00.000Z`, hora: '14:10', tipo: 'LIBERACAO_MANUTENCAO', statusNovo: 'Em operação', operador: 'João Pereira', observacao: 'Trocou a mangueira' },
  ] }));
  assert.equal(itens[0].detalhe, 'João Pereira assumiu às 14:10');
  assert.equal(itens[0].observacao, 'Trocou a mangueira');
});
