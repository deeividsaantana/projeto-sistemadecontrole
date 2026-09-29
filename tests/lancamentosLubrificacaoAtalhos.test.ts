import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/LancamentosTab.tsx', import.meta.url), 'utf8');

test('Lubrificação (dentro de Lançamentos) tem atalho N para novo lançamento e / para busca', () => {
  assert.match(source, /if \(mode !== 'lubrificacoes' \|\| isFormOpen\) return undefined;/);
  assert.match(source, /event\.key\.toLowerCase\(\) === 'n'/);
  assert.match(source, /handleOpenCreate\(\);/);
  assert.match(source, /event\.key === '\/'/);
  assert.match(source, /searchInputRef\.current\?\.focus\(\)/);
});

test('o atalho de Lubrificação ignora Ctrl/Cmd/Alt e campos em digitação', () => {
  assert.match(source, /if \(event\.ctrlKey \|\| event\.metaKey \|\| event\.altKey\) return;/);
  assert.match(source, /target\?\.matches\('input, textarea, select, \[contenteditable="true"\]'\)/);
});
