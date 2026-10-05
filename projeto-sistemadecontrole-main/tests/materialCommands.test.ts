import assert from 'node:assert/strict';
import test from 'node:test';
import type { Material, MovimentoMaterial } from '../src/types';
import { appendMovement, applyMaterialImport, saveMaterial } from '../src/modules/materials/materialCommands';

const material = (id: string): Material => ({ id, codigo: id, descricao: id, categoria: '', unidade: 'un', ativo: true, criadoEm: '', atualizadoEm: '' });
const movement = (id: string, materialId = 'mat-1'): MovimentoMaterial => ({ id, data: '2026-09-23', tipo: 'Entrada', materialId, materialDescricao: materialId, quantidade: 1, unidade: 'un', responsavel: 'Operador', criadoEm: '' });

test('cadastro substitui edição sem perder a posição e inclui novo no início', () => {
  const a = material('mat-1');
  const b = material('mat-2');
  assert.deepEqual(saveMaterial([a, b], { ...b, descricao: 'Alterado' }, false).map(item => item.descricao), ['mat-1', 'Alterado']);
  assert.deepEqual(saveMaterial([a], b, true).map(item => item.id), ['mat-2', 'mat-1']);
});

test('movimento novo entra no início sem alterar histórico anterior', () => {
  const a = movement('mov-1');
  const b = movement('mov-2');
  assert.deepEqual(appendMovement([a], b).map(item => item.id), ['mov-2', 'mov-1']);
});

test('importação preserva registros atuais e aceita cada id novo uma vez', () => {
  const currentMaterials = [material('mat-1')];
  const currentMovements = [movement('mov-1')];
  const first = applyMaterialImport(currentMaterials, currentMovements, [material('mat-1'), material('mat-2'), material('mat-2')], [movement('mov-1'), movement('mov-2', 'mat-2'), movement('mov-2', 'mat-2')]);
  assert.deepEqual(first.materials.map(item => item.id), ['mat-2', 'mat-1']);
  assert.deepEqual(first.movements.map(item => item.id), ['mov-2', 'mov-1']);
  assert.equal(first.addedMaterials, 1);
  assert.equal(first.addedMovements, 1);
  const again = applyMaterialImport(first.materials, first.movements, [material('mat-2')], [movement('mov-2', 'mat-2')]);
  assert.equal(again.addedMaterials, 0);
  assert.equal(again.addedMovements, 0);
});
