import assert from 'node:assert/strict';
import test from 'node:test';
import type { Abastecimento, ControleEquipamentoDiario, Equipamento } from '../src/types';
import { resumoDoDia } from '../src/modules/rotina/resumoDoDia';

const dia = '2026-09-20';
const controle = (id: string, prefixo: string, status: ControleEquipamentoDiario['status'], extra: Partial<ControleEquipamentoDiario> = {}) => ({
  id, data: dia, prefixo, status, observacao: '', ...extra,
} as ControleEquipamentoDiario);
const abastecimento = (id: string, equipamentoId: string, litros: number, extra: Partial<Abastecimento> = {}) => ({
  id, data: dia, equipamentoId, quantidadeLitros: litros, status: 'OK', ...extra,
} as Abastecimento);

const resumo = resumoDoDia({
  dia,
  abastecimentos: [
    abastecimento('d1', 'eq1', 120),
    abastecimento('d2', 'eq1', 80),
    abastecimento('d3', 'eq2', 60, { status: 'Verificar quantidade' }),
    abastecimento('d4', 'eq2', 500, { status: 'Cancelado' }),
    abastecimento('d5', 'eq9', 40, { prefixoInformado: 'CB-99', data: '2026-09-19' }),
  ],
  controles: [
    controle('c1', 'EH-12', 'Em operação'),
    controle('c2', 'EH-15', 'Em manutenção', { motivoManutencao: 'Mangueira hidráulica' }),
    controle('c3', 'RE-03', 'Aguardando motorista'),
    controle('c4', 'EH-12', 'Em operação'),
    controle('c5', 'CB-01', 'Desmobilizado'),
  ],
  equipamentos: [{ id: 'eq1', prefixo: 'CB-10' }, { id: 'eq2', prefixo: 'EH-15' }] as Equipamento[],
});

test('equipamentos parados com e sem motivo, repetidos e desmobilizado fora', () => {
  assert.equal(resumo.equipamentos.apontados, 3);
  assert.equal(resumo.equipamentos.emOperacao, 1);
  assert.deepEqual(resumo.equipamentos.parados.map(item => [item.prefixo, item.motivo]), [['RE-03', ''], ['EH-15', 'Mangueira hidráulica']]);
  assert.equal(resumo.equipamentos.semMotivo, 1);
  assert.deepEqual(resumo.equipamentos.repetidos, ['EH-12']);
});

test('diesel do dia sem cancelado, por equipamento, com o que falta conferir', () => {
  assert.equal(resumo.diesel.litros, 260);
  assert.equal(resumo.diesel.abastecimentos, 3);
  assert.deepEqual(resumo.diesel.porEquipamento, [{ prefixo: 'CB-10', litros: 200 }, { prefixo: 'EH-15', litros: 60 }]);
  assert.equal(resumo.diesel.aConferir, 1);
});
