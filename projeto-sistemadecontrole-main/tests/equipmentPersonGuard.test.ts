/**
 * A planilha de combustível traz o operador ao lado do prefixo. Importar a
 * coluna errada fazia o nome da pessoa entrar como descrição da máquina —
 * "Genivaldo" e "Cesar" chegaram a ficar ativos na frota por causa disso.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { looksLikePersonName, validateEquipmentMasterRecord } from '../src/utils/equipmentOperations';
import type { Equipamento } from '../src/types';

const equipamento = (overrides: Partial<Equipamento> = {}): Equipamento => ({
  id: 'eq-1',
  prefixo: 'CB-1005',
  nome: 'Caminhão basculante',
  tipo: 'Caminhão',
  marca: '',
  modelo: '',
  seriePlaca: '',
  empresaId: 'emp-1',
  status: 'Ativo',
  localAtualId: 'obr-1',
  observacao: '',
  ...overrides,
});

test('nome de pessoa é reconhecido como suspeito', () => {
  assert.equal(looksLikePersonName('Genivaldo'), true);
  assert.equal(looksLikePersonName('Cesar'), true);
  assert.equal(looksLikePersonName('João Silva'), true);
  assert.equal(looksLikePersonName('  Antonio  '), true);
});

test('descrição real de equipamento não é confundida com pessoa', () => {
  assert.equal(looksLikePersonName('Caminhão basculante'), false);
  assert.equal(looksLikePersonName('Escavadeira'), false);
  assert.equal(looksLikePersonName('Perfuratriz'), false);
  assert.equal(looksLikePersonName('Motoniveladora'), false);
  assert.equal(looksLikePersonName('Rolo compactador'), false);
  assert.equal(looksLikePersonName('Equipamento / Veículo'), false);
  assert.equal(looksLikePersonName('Caminhão Com Cabine Suplementar'), false);
});

test('código, número ou prefixo nunca vira suspeita de pessoa', () => {
  assert.equal(looksLikePersonName('CB-1005'), false);
  assert.equal(looksLikePersonName('LO144'), false);
  assert.equal(looksLikePersonName('Volvo FH 540'), false);
  assert.equal(looksLikePersonName(''), false);
  assert.equal(looksLikePersonName(undefined), false);
});

test('nome longo demais para pessoa não dispara o alerta', () => {
  // Descrições de frota costumam ter três ou mais palavras; sobrenomes
  // compostos ficariam de fora, mas o custo de um falso positivo aqui é
  // alto demais — quem cadastra veria um erro sem motivo.
  assert.equal(looksLikePersonName('Torre de iluminacao movel'), false);
});

test('validação recusa equipamento com nome de pessoa', () => {
  const resultado = validateEquipmentMasterRecord(equipamento({ nome: 'Genivaldo' }));
  assert.equal(resultado.errors.length, 1);
  assert.match(resultado.errors[0], /parece nome de pessoa/);
  assert.match(resultado.errors[0], /Genivaldo/);
});

test('validação aceita equipamento com descrição legítima', () => {
  const resultado = validateEquipmentMasterRecord(equipamento());
  assert.deepEqual(resultado.errors, []);
});
