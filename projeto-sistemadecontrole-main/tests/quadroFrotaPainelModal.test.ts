import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fonte = readFileSync(new URL('../src/components/quadroFrota/PainelEquipamento.tsx', import.meta.url), 'utf-8');

test('painel de editar a máquina usa o Modal padrão, não o Drawer estreito', () => {
  assert.match(fonte, /import \{ Modal \} from '\.\.\/\.\.\/shared\/ui';/);
  assert.doesNotMatch(fonte, /Drawer|createPortal/, 'não deve mais existir o drawer lateral feito à mão');
  assert.match(fonte, /size="lg"/, 'o painel precisa da largura do Modal grande, não do pequeno (sm/md)');
  assert.match(fonte, /telaCheia="quadro-frota-painel"/, 'oferece tela cheia, igual aos outros diálogos de lançamento');
});
