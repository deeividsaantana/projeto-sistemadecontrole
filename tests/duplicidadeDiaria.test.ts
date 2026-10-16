import assert from 'node:assert/strict';
import type { ControleEquipamentoDiario } from '../src/types';
import {
  juntarComLancamentoDoDia,
  lancamentoDoDia,
  operadorEmOutroEquipamento,
  repetidosPorDia,
} from '../src/fleet/duplicidadeDiaria';

const dia = '2026-10-16';
const registro = (id: string, extra: Partial<ControleEquipamentoDiario> = {}): ControleEquipamentoDiario => ({
  id,
  chave: `${dia}|${id}`,
  data: dia,
  funcionarioId: '',
  codigoFuncionario: '103177',
  nomeMotorista: 'ADILSON PIRES DA CRUZ',
  equipamentoId: 'eq-726',
  prefixo: 'CB726',
  familia: 'Basculantes',
  status: 'Em operação',
  horaSaida: '07:00',
  horaEntradaManutencao: '',
  horaLiberacao: '',
  observacao: '',
  origem: 'SISTEMA',
  revisao: [],
  eventos: [{ id: `evt-${id}`, ocorridoEm: `${dia}T07:00:00.000Z`, tipo: 'SAIDA_OPERACAO' } as never],
  criadoEm: `${dia}T07:00:00.000Z`,
  atualizadoEm: `${dia}T07:00:00.000Z`,
  ...extra,
});

const existente = registro('a');
const lista = [
  existente,
  registro('excluido', { excluido: true } as never),
  registro('ontem', { data: '2026-10-15' }),
  registro('outro', { equipamentoId: 'eq-727', prefixo: 'CB727', codigoFuncionario: '101671', nomeMotorista: 'ANDERSON PEIXOTO DA SILVA' }),
];

// Mesmo prefixo com id de equipamento diferente (Quadro x formulário) é o mesmo lançamento.
assert.equal(lancamentoDoDia(lista, { id: 'novo', data: dia, equipamentoId: 'outro-id', prefixo: 'cb-726' })?.id, 'a');
assert.equal(lancamentoDoDia(lista, { id: 'novo', data: dia, equipamentoId: 'eq-726', prefixo: '' })?.id, 'a');
// O próprio registro, ao editar, não conta como repetido.
assert.equal(lancamentoDoDia(lista, existente), undefined);
assert.equal(lancamentoDoDia(lista, { id: 'novo', data: '2026-10-14', equipamentoId: 'eq-726', prefixo: 'CB726' }), undefined);

// O mesmo operador em outro caminhão no mesmo dia.
const outroCaminhao = { id: 'novo', data: dia, equipamentoId: 'eq-730', prefixo: 'CB730', codigoFuncionario: '103177', nomeMotorista: '' };
assert.deepEqual(operadorEmOutroEquipamento(lista, outroCaminhao).map(item => item.prefixo), ['CB726']);
assert.deepEqual(operadorEmOutroEquipamento(lista, { ...outroCaminhao, codigoFuncionario: '', nomeMotorista: 'Anderson Peixoto da Silva' }).map(item => item.prefixo), ['CB727']);
assert.deepEqual(operadorEmOutroEquipamento(lista, { ...outroCaminhao, codigoFuncionario: '', nomeMotorista: '' }), []);
assert.deepEqual(operadorEmOutroEquipamento(lista, { ...outroCaminhao, prefixo: 'CB726', equipamentoId: 'eq-726' }), []);

// Na gravação, o novo repetido vira atualização do existente e guarda o histórico dos dois.
const repetido = registro('b', { status: 'Em manutenção', criadoEm: `${dia}T09:00:00.000Z` });
const junto = juntarComLancamentoDoDia(lista, repetido);
assert.equal(junto.novo, false);
assert.equal(junto.registro.id, 'a');
assert.equal(junto.registro.status, 'Em manutenção');
assert.equal(junto.registro.criadoEm, `${dia}T07:00:00.000Z`);
assert.deepEqual(junto.registro.eventos?.map(evento => evento.id), ['evt-a', 'evt-b']);
assert.equal(juntarComLancamentoDoDia(lista, registro('c', { prefixo: 'CB999', equipamentoId: 'eq-999' })).novo, true);

assert.deepEqual([...repetidosPorDia([...lista, registro('b')]).entries()], [[dia, ['CB726']]]);
