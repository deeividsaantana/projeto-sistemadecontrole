import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panelSource = readFileSync(new URL('../src/components/MateriaisImportacoesPanel.tsx', import.meta.url), 'utf8');
// A leitura saiu do painel para rodar em segundo plano (Web Worker).
const leituraSource = readFileSync(new URL('../src/imports/lerPlanilhaMateriais.ts', import.meta.url), 'utf8');
assert.match(panelSource, /lerPlanilhaMateriais/);
assert.match(leituraSource, /readWorkbookFile/);
assert.match(leituraSource, /runImportPipeline/);
assert.match(panelSource, /batchPreview/);
assert.match(leituraSource, /materials-receipts/);
assert.match(leituraSource, /materials-movements/);
assert.doesNotMatch(panelSource, /firebase|supabase/i);
assert.doesNotMatch(leituraSource, /firebase|supabase/i);

const tabSource = readFileSync(new URL('../src/components/MateriaisTab.tsx', import.meta.url), 'utf8');
assert.match(tabSource, /'importacoes'/);
assert.match(tabSource, /MateriaisImportacoesPanel/);
assert.match(tabSource, /Importações/);
