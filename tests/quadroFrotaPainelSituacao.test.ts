import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fonte = readFileSync(new URL('../src/components/quadroFrota/PainelEquipamento.tsx', import.meta.url), 'utf-8');

test('salvar no painel do Quadro não trava sem situação escolhida', () => {
  assert.match(fonte, /const status = edicao\.status \|\| 'Dispon[ií]vel'/, 'sem situação escolhida, assume Disponível em vez de bloquear');
  assert.doesNotMatch(fonte, /Escolha a situação da máquina/, 'não deve mais existir o bloqueio que exigia escolher a situação para salvar');
});
