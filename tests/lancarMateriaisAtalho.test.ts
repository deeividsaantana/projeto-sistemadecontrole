import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/materiais/LancarMateriais.tsx', import.meta.url), 'utf8');

test('Lançar Materiais tem atalho N que leva pro campo de material', () => {
  assert.match(source, /event\.key\.toLowerCase\(\) !== 'n'\) return;/);
  assert.match(source, /setAba\('um'\);/);
  assert.match(source, /document\.getElementById\('lancar-material'\)\?\.focus\(\)/);
});

test('o atalho ignora Ctrl\\/Cmd\\/Alt e campos em digitação', () => {
  assert.match(source, /if \(event\.ctrlKey \|\| event\.metaKey \|\| event\.altKey\) return;/);
  assert.match(source, /target\?\.matches\('input, textarea, select, \[contenteditable="true"\]'\)/);
});
