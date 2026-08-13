import { chromium } from 'file:///C:/Users/deivids/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = 'C:/Users/deivids/Documents/teste70-rdo-removal';
const outputDir = path.join(root, 'artifacts', 'fleet-reconstruction');
const downloadDir = path.join(outputDir, 'downloads');
await fs.mkdir(downloadDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});

const breakpoints = [
  { width: 320, height: 740 },
  { width: 360, height: 780 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 412, height: 860 },
  { width: 430, height: 900 },
  { width: 480, height: 900 },
  { width: 768, height: 1024 },
  { width: 1024, height: 900 },
  { width: 1280, height: 900 },
  { width: 1366, height: 900 },
  { width: 1440, height: 1000 },
  { width: 1920, height: 1080 },
];

const results = [];

const authenticate = async page => {
  await page.goto('http://localhost:4174/', {
    waitUntil: 'domcontentloaded',
    timeout: 20_000,
  });
  await page.waitForTimeout(800);
  if (await page.locator('#login-email').isVisible().catch(() => false)) {
    await page.locator('#login-email').fill('deivid.brandao@renea.com.br');
    await page.locator('#login-password').fill('renea123');
    await page.getByRole('button', { name: /Entrar no sistema/i }).click();
    await page.locator('#login-email').waitFor({ state: 'hidden', timeout: 20_000 });
  }
};

const openFleet = async (page, width) => {
  if (width < 768) {
    await page.locator('button[aria-label="Abrir menu de navegação"]').click();
  }
  let clicked = false;
  if (width < 768) {
    const mobileItem = page.locator('#mobile-drawer button[title="Controle de Basculantes"]');
    await mobileItem.click();
    clicked = true;
  } else {
    const desktopItem = page.getByText('Controle de Basculantes', { exact: true }).last();
    await desktopItem.click();
    clicked = true;
  }
  try {
    await page.getByRole('heading', { name: 'Caminhões Basculantes' })
      .waitFor({ state: 'visible', timeout: 15_000 });
  } catch (error) {
    const buttons = await page.locator('button').evaluateAll(elements => elements
      .map(element => ({ text: element.textContent?.trim(), title: element.title, aria: element.getAttribute('aria-label'), visible: Boolean(element.offsetWidth || element.offsetHeight) }))
      .filter(item => item.visible)
      .slice(0, 15));
    throw new Error(`Falha ao abrir frota em ${width}px. Navegação clicada: ${clicked}. Botões: ${JSON.stringify(buttons)}\n${error}`);
  }
};

for (const viewport of breakpoints) {
  console.error(`Validando ${viewport.width}px`);
  const page = await browser.newPage({
    viewport,
    acceptDownloads: true,
  });
  const consoleErrors = [];
  const consoleWarnings = [];
  const failedRequests = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
    if (message.type() === 'warning') consoleWarnings.push(message.text());
  });
  page.on('pageerror', error => consoleErrors.push(error.message));
  page.on('requestfailed', request => {
    failedRequests.push({
      url: request.url(),
      error: request.failure()?.errorText || 'unknown',
    });
  });
  await authenticate(page);
  await openFleet(page, viewport.width);
  await page.waitForTimeout(800);
  const layout = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    horizontalOverflow:
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    headingVisible: Array.from(document.querySelectorAll('h1'))
      .some(element => element.textContent?.includes('Caminhões Basculantes')),
    visibleButtons: Array.from(document.querySelectorAll('button'))
      .filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }).map(element => element.textContent?.trim()).filter(Boolean).slice(0, 40),
  }));
  if ([320, 390, 768, 1366, 1920].includes(viewport.width)) {
    await page.screenshot({
      path: path.join(outputDir, `fleet-${viewport.width}.png`),
      fullPage: true,
    });
  }
  results.push({
    viewport,
    layout,
    consoleErrors: [...new Set(consoleErrors)],
    consoleWarnings: [...new Set(consoleWarnings)],
    failedRequests,
  });
  await page.close();
}

const exportPage = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const exportErrors = [];
exportPage.on('console', message => {
  if (message.type() === 'error') exportErrors.push(message.text());
});
exportPage.on('pageerror', error => exportErrors.push(error.message));
await authenticate(exportPage);
await openFleet(exportPage, 1440);
await exportPage.locator('section').filter({ hasText: 'DataEmpresa' }).getByLabel('Data').fill('2026-08-12');
await exportPage.waitForTimeout(500);

const pdfPromise = exportPage.waitForEvent('download', { timeout: 30_000 });
await exportPage.getByRole('button', { name: /Relatório PDF/i }).click();
const pdfDownload = await pdfPromise;
const pdfPath = path.join(downloadDir, await pdfDownload.suggestedFilename());
await pdfDownload.saveAs(pdfPath);

const excelPromise = exportPage.waitForEvent('download', { timeout: 30_000 });
await exportPage.getByRole('button', { name: /Exportar Excel/i }).click();
const excelDownload = await excelPromise;
const excelPath = path.join(downloadDir, await excelDownload.suggestedFilename());
await excelDownload.saveAs(excelPath);

const formButton = exportPage.getByRole('button', { name: /Novo lançamento/i });
await formButton.click();
const formDialog = exportPage.getByRole('dialog');
const formChecks = {
  dialogVisible: await formDialog.isVisible(),
  dateVisible: await formDialog.getByLabel('Data').isVisible(),
  employeeCodeVisible: await formDialog.getByText('Matrícula / código').isVisible(),
  prefixVisible: await formDialog.getByLabel('Prefixo').isVisible(),
  saveVisible: await formDialog.getByRole('button', { name: /Salvar e registrar histórico/i }).isVisible(),
};
await exportPage.getByRole('button', { name: /Fechar formulário/i }).click();

await exportPage.close();
await browser.close();

const report = {
  generatedAt: new Date().toISOString(),
  results,
  exports: {
    pdfPath,
    excelPath,
    pdfBytes: (await fs.stat(pdfPath)).size,
    excelBytes: (await fs.stat(excelPath)).size,
    errors: [...new Set(exportErrors)],
  },
  formChecks,
};
await fs.writeFile(
  path.join(outputDir, 'audit-report.json'),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report));
