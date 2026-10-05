import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/shared/ui/PageHeader.tsx', import.meta.url), 'utf8');
assert.doesNotMatch(
  source,
  /renea-page-header__copy sr-only/,
  'título e descrição do módulo precisam ficar visíveis, não só para leitor de tela',
);
assert.match(source, /renea-page-header__copy/, 'a classe de estilo continua existindo, só sem sr-only');
