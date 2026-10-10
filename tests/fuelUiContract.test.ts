import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const sourcePath = join(process.cwd(), 'src', 'components', 'CombustivelOperacionalTab.tsx');
const source = readFileSync(sourcePath, 'utf8');
const appSource = readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8');

test('combustivel expose relatorio as a primary tab instead of a dashboard subtab', () => {
  assert.match(source, /type View = 'resumo' \| 'novo' \| 'historico' \| 'relatorio'/);
  assert.match(source, /\['relatorio', 'Relatório', FileSpreadsheet\]/);
  assert.match(source, /data-testid="combustivel-relatorio"/);
  assert.doesNotMatch(source, /abaDashboard.*'planilha'|combustivel-planilha|TabelaPlanilhaCombustivel/s);
});

test('combustivel history and report avoid forced desktop-only wide tables', () => {
  assert.doesNotMatch(source, /min-w-\[1180px\]/);
  assert.doesNotMatch(source, /min-w-\[1320px\]/);
  assert.match(source, /listaSomente/);
  assert.match(source, /h-\[calc\(100dvh-1rem\)\]/);
});

test('combustivel excel export is organized as a workbook report', () => {
  assert.match(source, /addFuelSupplyWorksheet/);
  assert.match(source, /workbook\.addWorksheet\('FORNECIMENTO DIESEL'/);
  assert.match(source, /showTitleBlock: false/);
  assert.match(source, /'Data', key: 'data'/);
  assert.match(source, /'Prefixo', key: 'prefixo'/);
  assert.match(source, /'Descrição do equipamento', key: 'descricao'/);
  assert.match(source, /'KM inicial', key: 'kmInicial'/);
  assert.match(source, /'Horímetro', key: 'horimetro'/);
  assert.match(source, /'Litros', key: 'litros'/);
  assert.match(source, /'Hora', key: 'hora'/);
  assert.match(source, /'Comboio', key: 'comboio'/);
  assert.match(source, /'Tipo de combustível', key: 'tipoCombustivel'/);
  assert.match(source, /'Empresa', key: 'empresa'/);
  assert.match(source, /'Bomba inicial', key: 'bombaInicial'/);
  assert.match(source, /'Bomba final', key: 'bombaFinal'/);
  assert.match(source, /workbook\.addWorksheet\('CONFERÊNCIA'/);
  assert.doesNotMatch(source, /workbook\.addWorksheet\('LANÇAMENTOS'/);
  assert.doesNotMatch(source, /workbook\.addWorksheet\('RANKING/);
});

test('combustivel avoids stacked repeated section headers in report and list', () => {
  assert.doesNotMatch(source, /<h2[^>]*>Relatório de combustível<\/h2>/);
  assert.doesNotMatch(source, /<h3[^>]*>Lançamentos<\/h3><p[^>]*>Exportação inclui todos os resultados filtrados\.<\/p>/);
  assert.match(source, /Excel usa todos os resultados filtrados/);
});

test('combustivel can open a dedicated list-only route by query string', () => {
  assert.match(appSource, /getInitialTabFromUrl/);
  assert.match(appSource, /getCombustivelViewFromUrl/);
  assert.match(appSource, /combustivelListaSomente/);
  assert.match(appSource, /combustivelInicial=\{combustivelViewInicial\}/);
});
