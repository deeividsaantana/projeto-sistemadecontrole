import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fonte = readFileSync(new URL('../src/components/quadroFrota/PainelEquipamento.tsx', import.meta.url), 'utf-8');

test('painel de editar a máquina usa o Modal padrão, não o Drawer estreito', () => {
  assert.match(fonte, /import \{ Modal \} from '\.\.\/\.\.\/shared\/ui';/);
  assert.doesNotMatch(fonte, /Drawer|createPortal/, 'não deve mais existir o drawer lateral feito à mão');
  assert.match(fonte, /^\s*lancamento$/m, 'abre em tela cheia, igual aos outros lançamentos');
  assert.doesNotMatch(fonte, /DesenhoMaquina/, 'sem desenho grande ocupando a tela do lançamento');
});
