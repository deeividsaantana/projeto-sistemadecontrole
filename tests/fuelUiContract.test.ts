import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const sourcePath = join(process.cwd(), 'src', 'components', 'CombustivelOperacionalTab.tsx');
const source = readFileSync(sourcePath, 'utf8');

test('combustivel expose relatorio as a primary tab instead of a dashboard subtab', () => {
  assert.match(source, /type View = 'resumo' \| 'novo' \| 'historico' \| 'relatorio'/);
  assert.match(source, /\['relatorio', 'Relatório', FileSpreadsheet\]/);
  assert.match(source, /data-testid="combustivel-relatorio"/);
  assert.doesNotMatch(source, /abaDashboard.*'planilha'|combustivel-planilha|TabelaPlanilhaCombustivel/s);
});

test('combustivel history and report avoid forced desktop-only wide tables', () => {
  assert.doesNotMatch(source, /min-w-\[1180px\]/);
  assert.doesNotMatch(source, /min-w-\[1320px\]/);
});

test('combustivel excel export is organized as a workbook report', () => {
  assert.match(source, /addFuelRankingWorksheet/);
  assert.match(source, /workbook\.addWorksheet\('CONFERÊNCIA'/);
  assert.match(source, /workbook\.addWorksheet\('LANÇAMENTOS'/);
});
