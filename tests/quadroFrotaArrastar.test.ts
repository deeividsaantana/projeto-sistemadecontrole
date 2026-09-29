import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tab = readFileSync(new URL('../src/components/QuadroFrotaTab.tsx', import.meta.url), 'utf-8');
const cartao = readFileSync(new URL('../src/components/quadroFrota/CartaoArrastavel.tsx', import.meta.url), 'utf-8');
const coluna = readFileSync(new URL('../src/components/quadroFrota/ColunaCanteiro.tsx', import.meta.url), 'utf-8');

test('Quadro da Frota arrasta cartão pra trocar de canteiro (Kanban)', () => {
  assert.match(tab, /DndContext sensors=\{sensores\} onDragEnd=\{modoSelecao \? undefined : arrastarSoltou\}/, 'a área do quadro precisa estar dentro do DndContext');
  assert.match(tab, /activationConstraint: \{ distance: 8 \}/, 'só arrasta depois de mover, senão o clique de abrir o painel para de funcionar');
  assert.match(tab, /if \(canteiroAtual === novoCanteiro\) return;/, 'soltar no mesmo canteiro não grava nada');
  assert.match(tab, /status: rascunho\.status \|\| 'Dispon[ií]vel'/, 'arrastar uma máquina sem lançamento não trava sem situação, igual ao painel');
});

test('cartão arrastável só liga o drag quando pode editar', () => {
  assert.match(cartao, /disabled: !podeArrastar/);
  assert.match(cartao, /useDraggable/);
});

test('coluna do canteiro aceita soltar um cartão', () => {
  assert.match(coluna, /useDroppable/);
});
