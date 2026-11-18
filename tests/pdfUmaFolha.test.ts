import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import autoTable from 'jspdf-autotable';
import { gerarEmUmaFolha } from '../src/utils/pdfUmaFolha';

const A4_RETRATO = [595.28, 841.89];

const tamanho = (pdf: string) => {
  const caixa = pdf.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);
  return caixa ? [Number(caixa[1]), Number(caixa[2])] : [];
};

test('relatório comprido sai numa folha A4 só', async () => {
  const doc = await gerarEmUmaFolha({ orientacao: 'portrait', compress: false, alargar: true }, folha => {
    folha.text('Relatório', 10, 10);
    autoTable(folha, { startY: 16, head: [['Data', 'Nome']], body: Array.from({ length: 300 }, (_, i) => ['18/11/2026', `Pessoa ${i}`]) });
    return (folha as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
  }, (folha, altura) => folha.text('Rodapé', 10, altura - 6));
  assert.equal(doc.getNumberOfPages(), 1);
  const pdf = doc.output();
  assert.deepEqual(tamanho(pdf).map(Math.round), A4_RETRATO.map(Math.round));
  assert.match(pdf, /q 0\.\d+ 0 0 0\.\d+ [\d.-]+ [\d.-]+ cm/, 'o desenho é encolhido para caber');
  assert.match(pdf, /Pessoa 299/, 'a última linha está na folha');
});

test('relatório curto fica do tamanho de sempre', async () => {
  const doc = await gerarEmUmaFolha({ orientacao: 'landscape', compress: false }, folha => { folha.text('Curto', 10, 10); return 30; });
  assert.equal(doc.getNumberOfPages(), 1);
  assert.match(doc.output(), /q 1\.000000 0 0 1\.000000/);
});

const arquivos = (pasta: string): string[] => readdirSync(pasta).flatMap(nome => {
  const caminho = join(pasta, nome);
  return statSync(caminho).isDirectory() ? arquivos(caminho) : /\.(ts|tsx)$/.test(nome) ? [caminho] : [];
});

test('nenhum PDF do sistema abre segunda página', () => {
  const comPagina = arquivos('src').filter(arquivo => /\.addPage\(/.test(readFileSync(arquivo, 'utf8')));
  assert.deepEqual(comPagina, []);
});

test('impressão pelo navegador: folha sem margem (sem endereço do site) e numa folha só', () => {
  const css = readFileSync('src/index.css', 'utf8');
  assert.match(css, /@page \{ size: A4 portrait; margin: 0; \}/);
  assert.doesNotMatch(css, /@page[^{]*\{[^}]*margin: (?!0;)/, 'nenhuma folha com margem do navegador');
  const comPrint = arquivos('src').filter(arquivo => /\.print\(\)/.test(readFileSync(arquivo, 'utf8')));
  assert.deepEqual(comPrint, ['src/utils/imprimirEmUmaFolha.ts'], 'toda impressão passa por imprimirEmUmaFolha');
});
