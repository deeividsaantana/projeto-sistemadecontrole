import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import ExcelJS from 'exceljs';
import { lerPlanilhaMateriais } from '../src/imports/lerPlanilhaMateriais';

// Sem Worker (testes, navegador antigo) a leitura acontece na própria tela e
// devolve a mesma prévia que o worker devolveria.
const planilha = new ExcelJS.Workbook();
const aba = planilha.addWorksheet('BRITA');
aba.addRow(['DATA', 'ITEM', 'UNIDADE', 'QUANTIDADE', 'FORNECEDOR', 'PLACA', 'NUMERO DA NOTA', 'LOCAL']);
aba.addRow(['08/09/2026', 'BRITA 02', 'TON', 9.91, 'PEDRA FORTE', 'FEJ7G39', 372175, 'COLUNA DE BRITA RAMO 700']);
const arquivo = new File([new Uint8Array(await planilha.xlsx.writeBuffer())], 'MATERIAIS.xlsx') as unknown as globalThis.File;

assert.equal(typeof (globalThis as { Worker?: unknown }).Worker, 'undefined');
const { preview } = await lerPlanilhaMateriais(arquivo, []);
assert.equal(preview.rows.length, 1);
assert.equal(preview.rows[0].disposition, 'new');
