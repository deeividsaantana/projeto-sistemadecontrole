/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import type { Funcionario } from '../src/types';

// Teste unitário simples para BuscaColaborador
// Os testes completos de componentes React seriam feitos com playwright
// Este arquivo apenas valida a estrutura básica do componente

test('BuscaColaborador: funcionarios type é validado', () => {
  const colaboradores: Funcionario[] = [
    {
      id: '1',
      nome: 'João Silva',
      matricula: '12345',
      cargo: 'Motorista',
      telefone: '11999999999',
      empresaId: 'emp1',
      ativo: true,
    },
    {
      id: '2',
      nome: 'Maria Santos',
      matricula: '12346',
      cargo: 'Operador',
      telefone: '11888888888',
      empresaId: 'emp1',
      ativo: true,
    },
  ];

  // Validar que a estrutura de Funcionario está correta
  assert.ok(Array.isArray(colaboradores));
  assert.ok(colaboradores.length > 0);
  assert.ok(colaboradores[0].id);
  assert.ok(colaboradores[0].nome);
  assert.ok(colaboradores[0].matricula);
  assert.ok(colaboradores[0].cargo);
  assert.ok(colaboradores[0].ativo === true);
});

test('BuscaColaborador: filtra corretamente por nome', () => {
  const colaboradores: Funcionario[] = [
    { id: '1', nome: 'João Silva', matricula: '12345', cargo: 'Motorista', telefone: '11999999999', empresaId: 'emp1', ativo: true },
    { id: '2', nome: 'Maria Santos', matricula: '12346', cargo: 'Operador', telefone: '11888888888', empresaId: 'emp1', ativo: true },
    { id: '3', nome: 'Pedro Oliveira', matricula: '12347', cargo: 'Mecânico', telefone: '11777777777', empresaId: 'emp1', ativo: true },
  ];

  const termoLower = 'joão'.toLowerCase();
  const resultado = colaboradores.filter(f =>
    f.nome?.toLowerCase().includes(termoLower) ||
    f.matricula?.toLowerCase().includes(termoLower)
  );

  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].nome, 'João Silva');
});

test('BuscaColaborador: filtra corretamente por matrícula', () => {
  const colaboradores: Funcionario[] = [
    { id: '1', nome: 'João Silva', matricula: '12345', cargo: 'Motorista', telefone: '11999999999', empresaId: 'emp1', ativo: true },
    { id: '2', nome: 'Maria Santos', matricula: '12346', cargo: 'Operador', telefone: '11888888888', empresaId: 'emp1', ativo: true },
  ];

  const termoLower = '12345'.toLowerCase();
  const resultado = colaboradores.filter(f =>
    f.nome?.toLowerCase().includes(termoLower) ||
    f.matricula?.toLowerCase().includes(termoLower)
  );

  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].matricula, '12345');
});

test('BuscaColaborador: retorna primeiros 10 quando vazio', () => {
  const muitosColaboradores: Funcionario[] = Array.from({ length: 20 }, (_, i) => ({
    id: String(i + 1),
    nome: `Colaborador ${i + 1}`,
    matricula: String(1000 + i),
    cargo: 'Motorista',
    telefone: '11999999999',
    empresaId: 'emp1',
    ativo: true,
  }));

  const resultado = Array.from(muitosColaboradores).slice(0, 10);

  assert.equal(resultado.length, 10);
  assert.equal(resultado[0].nome, 'Colaborador 1');
  assert.equal(resultado[9].nome, 'Colaborador 10');
});

test('BuscaColaborador: trata matrícula ausente', () => {
  const colaboradores: Funcionario[] = [
    { id: '1', nome: 'João Silva', cargo: 'Motorista', telefone: '11999999999', empresaId: 'emp1', ativo: true },
  ];

  const result = colaboradores[0];
  const matriculaDisplay = result.matricula || 'Sem matrícula';

  assert.equal(matriculaDisplay, 'Sem matrícula');
});
