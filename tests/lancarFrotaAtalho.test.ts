import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fonte = readFileSync(new URL('../src/components/quadroFrota/LancarFrota.tsx', import.meta.url), 'utf-8');

test('Lançar Frota salva tudo com Ctrl/Cmd+Enter, mesmo padrão do resto do sistema', () => {
  assert.match(fonte, /event\.key === 'Enter' && \(event\.ctrlKey \|\| event\.metaKey\)/);
  assert.match(fonte, /salvarTudo\(\);/);
  assert.match(fonte, /Ctrl\+Enter/, 'a dica do atalho deve aparecer no botão Salvar tudo');
});
