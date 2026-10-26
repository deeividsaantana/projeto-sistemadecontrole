import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/**
 * Pedido de 26/10/2026: as tabelas (Combustível e as outras abas) mostram
 * poucas linhas. A TabelaPadrao passou a ter uma linha por registro, linha
 * de 36 px (32 px no modo planilha) e rodapé mais baixo no computador.
 */
const ler = (caminho: string) => readFileSync(caminho, 'utf8');
const tabela = ler('src/shared/ui/TabelaPadrao.tsx');
const css = ler('src/index.css');

test('célula do computador tem uma linha só, sem quebrar em duas', () => {
  assert.match(tabela, /'renea-celula line-clamp-1 break-words'/);
  assert.doesNotMatch(tabela, /line-clamp-2/);
});

test('linha de 36 px e 32 px no modo planilha (densa)', () => {
  assert.match(tabela, /densa \? 'h-8' : 'h-9'/);
  assert.doesNotMatch(tabela, /'h-10 /);
});

test('partes empilhadas da célula ficam lado a lado com "·"', () => {
  assert.match(css, /\.renea-celula :is\(p, div, \.block\):not\(\.flex, \.grid, \.inline-flex\) \{ display: inline; \}/);
  assert.match(css, /content: " · ";/);
});

test('rodapé da tabela com botões de 32 px no computador', () => {
  assert.match(tabela, /<footer data-tabela-rodape/);
  assert.match(css, /\[data-tabela-rodape\] button/);
});

test('célula cortada sem dica mostra o texto inteiro no mouse', () => {
  assert.match(tabela, /onMouseEnter=\{dica \? undefined : dicaDoCorte\}/);
});
