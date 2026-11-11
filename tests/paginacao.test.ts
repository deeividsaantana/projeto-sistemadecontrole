import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// A paginação das listas mora na TabelaPadrao: o contrato está em
// tests/tabelaPadrao.test.tsx.

// Atalhos de teclado exigidos no desktop: ESC fecha e CTRL+ENTER salva, sem
// atrapalhar quem está escrevendo num campo de texto longo.
const modal = readFileSync(new URL('../src/shared/ui/Modal.tsx', import.meta.url), 'utf8');

test('o diálogo salva com CTRL+ENTER e respeita textarea', () => {
  assert.match(modal, /event\.ctrlKey \|\| event\.metaKey/);
  assert.match(modal, /TEXTAREA/);
  assert.match(modal, /event\.key === 'Escape'/);
});

// Limpeza: formatação de data, número e moeda mora em um lugar só.
test('as telas usam a formatação compartilhada, não cópias locais', () => {
  const copias = ['PluviometroTab']
    .map(nome => readFileSync(new URL(`../src/components/${nome}.tsx`, import.meta.url), 'utf8'));
  copias.forEach(fonte => {
    assert.match(fonte, /from '\.\.\/utils\/formato'/);
    assert.equal(/const formatarData = \(valor: string\)/.test(fonte), false);
  });
});
