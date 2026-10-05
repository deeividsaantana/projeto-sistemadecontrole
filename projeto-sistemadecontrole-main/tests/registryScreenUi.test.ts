import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/shared/registry/RegistryScreen.tsx', import.meta.url), 'utf8');
assert.match(source, /useRegistryState/, 'usa o hook genérico de filtro/paginação/duplicidade');
assert.match(source, /from '..\/ui'/, 'reaproveita o kit de UI compartilhado (Modal, TableShell, etc.)');
assert.match(source, /ConfirmDialog/, 'usa o diálogo de confirmação compartilhado, não um overlay artesanal');
assert.match(source, /Pagination/, 'toda categoria pagina, não só uma');
assert.match(source, /Adicionar linha/i, 'tem o modo de lançamento em lote');
assert.match(source, /duplicateCount|duplicad/i, 'mostra a contagem de possíveis duplicados no cabeçalho');
assert.doesNotMatch(source, /from ['"](?:firebase|@supabase)/, 'não pode importar SDK de nuvem');
