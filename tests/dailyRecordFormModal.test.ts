import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fonte = readFileSync(new URL('../src/components/fleet/DailyRecordForm.tsx', import.meta.url), 'utf-8');
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf-8');

test('Controle de Frotas usa o Modal padrão em vez do drawer feito à mão', () => {
  assert.match(fonte, /import\s*\{\s*ConfirmDialog,\s*Modal\s*\}\s*from\s*'\.\.\/\.\.\/shared\/ui'/);
  assert.doesNotMatch(fonte, /createPortal/);
  assert.doesNotMatch(fonte, /fleet-entry-dialog/);
  assert.match(fonte, /<Modal[\s\S]*telaCheia="fleet-lancamento"/);
});

test('Controle de Frotas mantém os atalhos Alt+1..4/Alt+P/Alt+M e Ctrl+Enter', () => {
  assert.match(fonte, /event\.altKey && \['1', '2', '3', '4'\]\.includes\(event\.key\)/);
  assert.match(fonte, /event\.altKey && event\.key\.toLocaleLowerCase\('pt-BR'\) === 'p'/);
  assert.match(fonte, /event\.altKey && event\.key\.toLocaleLowerCase\('pt-BR'\) === 'm'/);
  assert.match(fonte, /\(event\.ctrlKey \|\| event\.metaKey\) && event\.key === 'Enter'/);
  assert.match(fonte, /formRef\.current\?\.requestSubmit\(\)/);
});

test('Fechar com lançamento não salvo pede confirmação antes de descartar', () => {
  assert.match(fonte, /temAlteracaoNaoSalva/);
  assert.match(fonte, /<ConfirmDialog/);
  assert.match(fonte, /Fechar sem salvar\?/);
});

test('CSS órfão do drawer antigo foi removido', () => {
  assert.doesNotMatch(css, /fleet-entry-dialog/);
});
