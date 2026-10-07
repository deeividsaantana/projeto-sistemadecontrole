import assert from 'node:assert/strict';
import test from 'node:test';
import type { Abastecimento, ControleEquipamentoDiario, Equipamento, Material, MovimentoMaterial } from '../src/types';
import { resumoDoDia } from '../src/modules/rotina/resumoDoDia';

const dia = '2026-09-20';
const material = { id: 'brita', descricao: 'BRITA 1', unidade: 't', estoqueMinimo: 100, ativo: true } as unknown as Material;
const mov = (id: string, extra: Partial<MovimentoMaterial>): MovimentoMaterial => ({
  id, data: dia, tipo: 'Entrada', materialId: 'brita', materialDescricao: 'BRITA 1', quantidade: 30, unidade: 't', responsavel: 'Deivid', criadoEm: `${dia}T10:00:00Z`, ...extra,
} as MovimentoMaterial);
const controle = (id: string, prefixo: string, status: ControleEquipamentoDiario['status'], extra: Partial<ControleEquipamentoDiario> = {}) => ({
  id, data: dia, prefixo, status, observacao: '', ...extra,
} as ControleEquipamentoDiario);
const abastecimento = (id: string, equipamentoId: string, litros: number, extra: Partial<Abastecimento> = {}) => ({
  id, data: dia, equipamentoId, quantidadeLitros: litros, status: 'OK', ...extra,
} as Abastecimento);

const resumo = resumoDoDia({
  dia,
  materiais: [material],
  movimentos: [
    mov('e1', {}),
    mov('e2', { quantidade: 20 }),
    mov('e3', { data: '2026-09-19', quantidade: 100 }),
    mov('s1', { tipo: 'Saída', quantidade: -80 }),
    mov('x', { quantidade: 999, canceladoEm: `${dia}T11:00:00Z` }),
    mov('a1', { tipo: 'Saída', quantidade: -5, origemApontamentoId: 'envio-1', apontadoPor: 'João' }),
    mov('a0', { tipo: 'Saída', quantidade: -5, data: '2026-09-18', origemApontamentoId: 'envio-0', apontadoPor: 'Maria' }),
  ],
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

test('materiais do dia somam por material e deixam de fora o desfeito', () => {
  assert.deepEqual(resumo.materiais.entradas, [{ material: 'BRITA 1', unidade: 't', quantidade: 50, movimentos: 2 }]);
  assert.deepEqual(resumo.materiais.saidas, [{ material: 'BRITA 1', unidade: 't', quantidade: 85, movimentos: 2 }]);
  assert.ok(resumo.materiais.avisos.some(aviso => /BRITA 1/.test(`${aviso.titulo} ${aviso.detalhe}`)), 'saldo 60 t abaixo do mínimo de 100 t vira aviso');
});

test('apontadores: envios do dia e quem ainda não mandou', () => {
  assert.deepEqual(resumo.apontadores.envios.map(envio => envio.id), ['envio-1']);
  assert.deepEqual(resumo.apontadores.faltando, ['Maria']);
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
