import { test, expect } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';

const buildFixtureWorkbook = async (): Promise<string> => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Tubos de concreto');
  sheet.addRow(['Data', 'Material', 'NF', 'Quantidade Recebida', 'Unidade']);
  sheet.addRow(['05/01/2026', 'Tubo concreto 400mm', '12345', 10, 'UN']);
  sheet.addRow(['06/01/2026', 'Tubo concreto 600mm', '', 4, 'UN']);
  const dir = mkdtempSync(join(tmpdir(), 'renea-import-fixture-'));
  const path = join(dir, 'CONTROLE DE RECEBIMENTO.xlsx');
  await workbook.xlsx.writeFile(path);
  return path;
};

test('materiais: prévia de importação mostra lote, abas, status e ação bloqueada', async ({ page }) => {
  const fixturePath = await buildFixtureWorkbook();
  await page.goto('/?screen=materiais');
  await page.getByRole('button', { name: 'Importações' }).click();
  await page.locator('input[type="file"]').setInputFiles(fixturePath);

  await expect(page.getByText('Lote de importação')).toBeVisible();
  await expect(page.getByText('Hash do arquivo')).toBeVisible();
  await expect(page.getByText('Tubos de concreto', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Executar dry-run/ })).toBeVisible();

  const applyButton = page.getByRole('button', { name: 'Aplicar importação' });
  await expect(applyButton).toBeDisabled();
  await page.getByRole('button', { name: /Executar dry-run/ }).click();
  await expect(page.getByRole('button', { name: 'Executar dry-run novamente' })).toBeVisible();
});
