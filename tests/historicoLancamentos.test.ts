import assert from 'node:assert/strict';
import test from 'node:test';
import type { ControleEquipamentoDiario } from '../src/types';
import { FILTROS_HISTORICO_VAZIOS, filtrarHistorico, temFiltroNoHistorico } from '../src/modules/frota/historicoLancamentos';

const registro = (extra: Partial<ControleEquipamentoDiario>): ControleEquipamentoDiario => ({
  id: 'r', chave: 'c', data: '2026-11-01', funcionarioId: 'f', codigoFuncionario: '10',
  nomeMotorista: 'JOAO SILVA', equipamentoId: 'e1', prefixo: 'CB-01', familia: 'Caminhão',
  status: 'Em operação', horaSaida: '', horaEntradaManutencao: '', horaLiberacao: '',
  observacao: '', origem: 'SISTEMA', revisao: [], criadoEm: '', atualizadoEm: '', ...extra,
});

const base = [
  registro({ id: 'a', data: '2026-11-01', prefixo: 'CB-01', nomeMotorista: 'JOAO SILVA', status: 'Em operação' }),
  registro({ id: 'b', data: '2026-11-02', prefixo: 'ES-07', nomeMotorista: 'MARIA SOUZA', status: 'Em manutenção' }),
  registro({ id: 'c', data: '2026-11-03', prefixo: 'CB-02', nomeMotorista: 'JOSE LIMA', status: 'Disponível' }),
];
const ids = (lista: readonly ControleEquipamentoDiario[]) => lista.map(item => item.id);

test('sem filtro devolve tudo, do dia mais novo para o mais antigo', () => {
  assert.deepEqual(ids(filtrarHistorico(base, FILTROS_HISTORICO_VAZIOS)), ['c', 'b', 'a']);
  assert.equal(temFiltroNoHistorico(FILTROS_HISTORICO_VAZIOS), false);
});

test('período inclui o dia inicial e o final', () => {
  const lista = filtrarHistorico(base, { ...FILTROS_HISTORICO_VAZIOS, de: '2026-11-02', ate: '2026-11-02' });
  assert.deepEqual(ids(lista), ['b']);
});

test('busca acha por prefixo, nome ou matrícula, sem acento nem maiúscula', () => {
  assert.deepEqual(ids(filtrarHistorico(base, { ...FILTROS_HISTORICO_VAZIOS, busca: 'cb-0' })), ['c', 'a']);
  assert.deepEqual(ids(filtrarHistorico(base, { ...FILTROS_HISTORICO_VAZIOS, busca: 'joão' })), ['a']);
  assert.deepEqual(ids(filtrarHistorico(base, { ...FILTROS_HISTORICO_VAZIOS, busca: '10' })), ['c', 'b', 'a']);
});

test('filtro de situação agrupa manutenção e espera por manutenção', () => {
  const comEspera = [...base, registro({ id: 'd', data: '2026-11-04', status: 'Aguardando manutenção' })];
  assert.deepEqual(ids(filtrarHistorico(comEspera, { ...FILTROS_HISTORICO_VAZIOS, situacao: 'manutencao' })), ['d', 'b']);
  assert.deepEqual(ids(filtrarHistorico(comEspera, { ...FILTROS_HISTORICO_VAZIOS, situacao: 'operando' })), ['a']);
});

test('filtros combinam e temFiltroNoHistorico acusa qualquer um ligado', () => {
  const filtros = { ...FILTROS_HISTORICO_VAZIOS, busca: 'jo', situacao: 'operando' as const };
  assert.deepEqual(ids(filtrarHistorico(base, filtros)), ['a']);
  assert.equal(temFiltroNoHistorico(filtros), true);
});
