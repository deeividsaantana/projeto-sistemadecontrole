import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/CadastrosTab.tsx', import.meta.url), 'utf8');

test('Cadastros tem atalho para novo cadastro (N) e para busca (/) sem janela aberta', () => {
  assert.match(source, /const semJanelaAberta = !formulario && !confirmacao && !lote && !apagando && !escolhaDeAba && !importacao/);
  assert.match(source, /event\.key\.toLowerCase\(\) === 'n' && !isTyping && podeEditar/);
  assert.match(source, /event\.key === '\/' && !isTyping && vista !== 'lixeira'/);
  assert.match(source, /buscaRef\.current\?\.focus\(\)/);
});

test('o atalho ignora Ctrl/Cmd/Alt e campos em digitação, para não atrapalhar quem está escrevendo', () => {
  assert.match(source, /if \(event\.ctrlKey \|\| event\.metaKey \|\| event\.altKey\) return;/);
  assert.match(source, /target\?\.matches\('input, textarea, select, \[contenteditable="true"\]'\)/);
});
