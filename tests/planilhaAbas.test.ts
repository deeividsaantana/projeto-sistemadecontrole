import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { abaSugerida, abaVisivel, type AbaPlanilha } from '../src/utils/planilhaAbas';

const aba = (nome: string, linhas = 1): AbaPlanilha => ({ nome, linhas: Array.from({ length: linhas }, (_, i) => ({ n: String(i) })) });

test('só abas visíveis entram na importação', async () => {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('EQUIPAMENTOS');
  workbook.addWorksheet('RESUMO', { state: 'hidden' });
  workbook.addWorksheet('DETALHE_COMBUSTIVEL', { state: 'veryHidden' });
  const lida = new ExcelJS.Workbook();
  await lida.xlsx.load(await workbook.xlsx.writeBuffer());
  assert.deepEqual(lida.worksheets.filter(ws => abaVisivel(ws.state)).map(ws => ws.name), ['EQUIPAMENTOS']);
  assert.equal(abaVisivel(undefined), true);
});

test('sugere a aba com nome do tipo aberto, sem acento nem caixa', () => {
  const abas = [aba('Resumo'), aba('Combustível', 1228), aba('Equipamentos', 40)];
  assert.equal(abaSugerida(abas, ['Equipamentos', 'equipamentos']), 'Equipamentos');
  assert.equal(abaSugerida(abas, ['Combustíveis', 'combustiveis']), 'Combustível');
});

test('sem aba parecida, sugere a primeira com linhas', () => {
  assert.equal(abaSugerida([aba('Vazia', 0), aba('Plan1', 3)], ['Locais', 'obras']), 'Plan1');
  assert.equal(abaSugerida([aba('Vazia', 0)], ['Locais']), null);
});

test('Cadastros filtra abas ocultas e pede a aba quando há mais de uma', () => {
  const source = readFileSync(new URL('../src/components/CadastrosTab.tsx', import.meta.url), 'utf8');
  assert.match(source, /worksheets\.filter\(worksheet => abaVisivel\(worksheet\.state\)\)/);
  assert.doesNotMatch(source, /workbook\.worksheets\.forEach/);
  assert.match(source, /data-testid="cadastro-escolher-aba"/);
});
