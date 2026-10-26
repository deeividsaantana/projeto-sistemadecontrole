import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tab = readFileSync(new URL('../src/components/quadroFrota/QuadroFrota.tsx', import.meta.url), 'utf-8');
const cartao = readFileSync(new URL('../src/components/quadroFrota/CartaoArrastavel.tsx', import.meta.url), 'utf-8');
const coluna = readFileSync(new URL('../src/components/quadroFrota/ColunaCanteiro.tsx', import.meta.url), 'utf-8');
const teclado = readFileSync(new URL('../src/components/quadroFrota/arrastarComTeclado.ts', import.meta.url), 'utf-8');

test('Quadro da Frota arrasta cartão pra trocar de canteiro (Kanban)', () => {
  assert.match(tab, /DndContext sensors=\{sensores\} accessibility=\{acessibilidadeArrastar\} onDragEnd=\{modoSelecao \? undefined : arrastarSoltou\}/, 'a área do quadro precisa estar dentro do DndContext');
  assert.match(tab, /activationConstraint: \{ distance: 4 \}/, 'só arrasta depois de mover, senão um toque na alça já vira arrasto');
  assert.match(tab, /if \(canteiroAtual === novoCanteiro\) return;/, 'soltar no mesmo canteiro não grava nada');
  assert.match(tab, /status: rascunho\.status \|\| 'Dispon[ií]vel'/, 'arrastar uma máquina sem lançamento não trava sem situação, igual ao painel');
});

test('cartão arrastável só liga o drag quando pode editar', () => {
  assert.match(cartao, /disabled: !podeArrastar/);
  assert.match(cartao, /useDraggable/);
  assert.match(cartao, /\{podeArrastar && \(/, 'sem permissão de editar a alça nem aparece');
});

test('coluna do canteiro aceita soltar um cartão', () => {
  assert.match(coluna, /useDroppable/);
});

// Auditoria de front (21/10/2026, A12): o cartão é o botão que abre o painel;
// o arrastar mora numa alça irmã, nunca dentro dele, e funciona no teclado.
test('a alça de arrastar fica fora do botão do cartão e aceita mouse, dedo e teclado', () => {
  assert.match(cartao, /ref=\{setActivatorNodeRef\}/, 'a alça é quem ativa o arrasto');
  assert.match(cartao, /data-testid=\{`quadro-alca-/);
  assert.match(cartao, /touch-none/, 'no celular o dedo arrasta sem rolar a tela');
  assert.doesNotMatch(cartao, /podeArrastar \? listeners/, 'o cartão inteiro não pode mais ser o alvo do arrasto');
  assert.match(tab, /useSensor\(KeyboardSensor, \{ coordinateGetter: coordenadasDoCanteiro \}\)/, 'Espaço pega e as setas trocam de canteiro');
  assert.match(teclado, /ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1/);
  assert.match(tab, /avisosDoArrastar/, 'o leitor de tela ouve o arrastar em português');
});
