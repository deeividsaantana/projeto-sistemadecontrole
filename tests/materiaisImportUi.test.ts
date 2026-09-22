import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panelSource = readFileSync(new URL('../src/components/MateriaisImportacoesPanel.tsx', import.meta.url), 'utf8');
assert.match(panelSource, /readWorkbookFile/);
assert.match(panelSource, /runImportPipeline/);
assert.match(panelSource, /batchPreview/);
assert.match(panelSource, /materials-receipts/);
assert.match(panelSource, /materials-movements/);
assert.doesNotMatch(panelSource, /firebase|supabase/i);

const tabSource = readFileSync(new URL('../src/components/MateriaisTab.tsx', import.meta.url), 'utf8');
assert.match(tabSource, /'importacoes'/);
assert.match(tabSource, /MateriaisImportacoesPanel/);
assert.match(tabSource, /Importações/);
