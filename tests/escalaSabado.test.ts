import assert from 'node:assert/strict';
import test from 'node:test';
import { criarEscalaSabado } from '../src/utils/presencaManual';
import type { Funcionario } from '../src/types';

const funcionarios: Funcionario[] = [
  { id: '1', nome: 'João', matricula: '12345', cargo: 'Operador', telefone: '', empresaId: 'e1', ativo: true },
  { id: '2', nome: 'Maria', matricula: '12346', cargo: 'Operador', telefone: '', empresaId: 'e1', ativo: true },
];

test('escalaSabado: cria escala com todos desescalados por padrão', () => {
  const escala = criarEscalaSabado('2026-11-08', funcionarios, 'grupo1');
  assert.equal(escala.data, '2026-11-08');
  assert.equal(escala.grupoEquipeId, 'grupo1');
  assert.equal(escala.funcionarios.length, 2);
  assert.ok(escala.funcionarios.every(f => !f.escalado), 'Todos devem estar desescalados');
});

test('escalaSabado: tem campos obrigatórios', () => {
  const escala = criarEscalaSabado('2026-11-08', funcionarios, 'grupo1');
  assert.ok(escala.id, 'Deve ter id');
  assert.ok(escala.criadoEm, 'Deve ter criadoEm');
  assert.ok(escala.atualizadoEm, 'Deve ter atualizadoEm');
  assert.equal(typeof escala.observacaoGeral, 'undefined');
});

test('escalaSabado: funcionários têm estrutura correta', () => {
  const escala = criarEscalaSabado('2026-11-08', funcionarios, 'grupo1');
  escala.funcionarios.forEach(f => {
    assert.ok(f.id, 'Funcionário deve ter id');
    assert.ok(f.nome, 'Funcionário deve ter nome');
    assert.equal(f.escalado, false, 'Funcionário deve estar desescalado');
  });
});

test('escalaSabado: cria com data específica', () => {
  const data = '2026-12-05';
  const escala = criarEscalaSabado(data, funcionarios, 'grupo1');
  assert.equal(escala.data, data);
});
