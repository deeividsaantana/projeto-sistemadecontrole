import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ler = (caminho: string) => readFileSync(new URL(caminho, import.meta.url), 'utf8');

const panelSource = ler('../src/components/MateriaisImportacoesPanel.tsx');
// A leitura saiu do painel para rodar em segundo plano (Web Worker).
const leituraSource = ler('../src/imports/lerPlanilhaMateriais.ts');
assert.match(panelSource, /lerPlanilhaMateriais/);
assert.match(leituraSource, /readWorkbookFile/);
assert.match(leituraSource, /runImportPipeline/);
assert.match(leituraSource, /materials-receipts/);
assert.match(leituraSource, /materials-movements/);
assert.doesNotMatch(panelSource, /firebase|supabase/i);
assert.doesNotMatch(leituraSource, /firebase|supabase/i);
// Só grava no botão Importar, e com as palavras de quem usa: nada de "dry-run".
assert.match(panelSource, /buildMaterialImportApplication/);
assert.match(panelSource, /Importar \$\{novas/);
assert.doesNotMatch(panelSource, /dry-?run/i);

const tabSource = ler('../src/components/MateriaisTab.tsx');
const secoesSource = ler('../src/components/materiais/MateriaisSecoes.tsx');
assert.match(secoesSource, /'importacoes'/);
assert.match(secoesSource, /Importar planilha/);
assert.match(tabSource, /MateriaisImportacoesPanel/);

// Com 11 mil movimentos, desenhar a lista inteira parava a tela: ela mostra um pedaço por vez.
const listasSource = ler('../src/components/materiais/MateriaisListas.tsx');
assert.match(listasSource, /movimentos\.slice\(0, limite\)/);
assert.match(listasSource, /Mostrar mais/);
