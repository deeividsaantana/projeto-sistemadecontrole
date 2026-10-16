import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const sourcePath = join(process.cwd(), 'src', 'components', 'CombustivelOperacionalTab.tsx');
const source = readFileSync(sourcePath, 'utf8');
const appSource = readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8');
const historicoSource = readFileSync(join(process.cwd(), 'src', 'components', 'combustivel', 'HistoricoCombustivel.tsx'), 'utf8');

test('combustivel has only two screens: lançar and lançamentos', () => {
  assert.match(source, /type View = 'novo' \| 'historico';/);
  assert.match(source, /\['novo', 'Lançar', Plus\], \['historico', 'Lançamentos', History\]/);
  assert.match(source, /data-testid="combustivel-numeros"/);
  assert.doesNotMatch(source, /createPortal|combustivel-relatorio|combustivel-dashboard|abaJanela|abaDashboard/);
  assert.doesNotMatch(source, /combustivel-planilha|TabelaPlanilhaCombustivel/);
});

test('combustivel history and report avoid forced desktop-only wide tables', () => {
  assert.doesNotMatch(source, /min-w-\[1180px\]/);
  assert.doesNotMatch(source, /min-w-\[1320px\]/);
  assert.match(source, /listaSomente/);
  assert.match(source, /h-\[calc\(100dvh-0\.5rem\)\]/);
});

test('combustivel excel export follows the FORNECIMENTO DIESEL spreadsheet model', () => {
  assert.match(source, /preencherPlanilhaDiesel\(workbook/);
  assert.doesNotMatch(source, /workbook\.addWorksheet\('LANÇAMENTOS'/);
  assert.doesNotMatch(source, /workbook\.addWorksheet\('RANKING/);
});

test('combustivel avoids stacked repeated section headers in report and list', () => {
  assert.doesNotMatch(source, /<h2[^>]*>Relatório de combustível<\/h2>/);
  assert.doesNotMatch(source, /<h3[^>]*>Lançamentos<\/h3><p[^>]*>Exportação inclui todos os resultados filtrados\.<\/p>/);
  assert.match(historicoSource, /Excel usa todos os resultados filtrados/);
  assert.match(historicoSource, /itens: filtrados/);
});

test('combustivel can open a dedicated list-only route by query string', () => {
  assert.match(appSource, /getInitialTabFromUrl/);
  assert.match(appSource, /getCombustivelViewFromUrl/);
  assert.match(appSource, /combustivelListaSomente/);
  assert.match(appSource, /if \(params\.get\('lista'\) === '1' \|\| params\.get\('lista'\) === 'true'\) return 'lancamentos'/);
  assert.match(appSource, /const combustivelListaSomente = isCombustivelListOnlyUrl\(\)/);
  assert.match(appSource, /combustivelListaSomente \? 'historico' : combustivelUrlView/);
  assert.match(appSource, /combustivelInicial=\{combustivelViewInicial\}/);
});

test('combustivel direct list prioritizes viewport and dense operational rows', () => {
  assert.match(source, /compacto=\{listaSomente\}/);
  assert.match(historicoSource, /compacto = false/);
  assert.match(historicoSource, /compacto \? \{ \.\.\.salvas, tamanhoPagina: Math\.max\(salvas\.tamanhoPagina, 100\) \}/);
});
