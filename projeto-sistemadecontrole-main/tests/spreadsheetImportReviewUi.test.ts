import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/SpreadsheetImportReview.tsx', import.meta.url), 'utf8');

assert.match(source, /batchPreview/, 'prop opcional de prévia com linhagem deve existir');
assert.match(source, /Lote de importação/i);
assert.match(source, /Hash do arquivo/i);
assert.match(source, /Executar dry-run/);
assert.match(source, /Aplicar importação/);
// A aplicação passou a sincronizar com o Firebase (decisão explícita do
// usuário nesta tarefa); um aviso fixo de "não persiste dado real" no
// componente genérico seria falso — a asserção anterior foi removida por
// isso, não por relaxamento de teste.
assert.match(source, /sem correspondência/i, 'coluna sem mapeamento precisa aparecer explicitamente');
assert.match(source, /disabled\b/);
assert.match(source, /onConfirm/);
assert.match(source, /validCount/);
