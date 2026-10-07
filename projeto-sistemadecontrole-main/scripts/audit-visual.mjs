import { chromium } from 'file:///C:/Users/deivids/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const outputDir = new URL('../artifacts/visual-audit/', import.meta.url);
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});
const results = [];

for (const viewport of [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 1000 },
]) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  const errors = [];
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:4174/', { waitUntil: 'domcontentloaded', timeout: 15_000 });
  await page.waitForTimeout(1500);
  if (await page.locator('#login-email').isVisible().catch(() => false)) {
    await page.locator('#login-email').fill('deivid.brandao@renea.com.br');
    await page.locator('#login-password').fill('renea123');
    await page.getByRole('button', { name: /Entrar no sistema/i }).click();
    await page.waitForTimeout(3500);
  }
  const authenticated = !(await page.locator('#login-email').isVisible().catch(() => false));
  const pages = [];
  for (const target of [
    { label: /Controle de Basculantes/i, slug: 'basculantes' },
    { label: /Consulta Geral/i, slug: 'consulta' },
    { label: /^Pendências$/i, slug: 'pendencias' },
  ]) {
    if (authenticated && viewport.width < 768) {
      const menuButton = page.locator('button:has(svg.lucide-menu)').first();
      if (await menuButton.isVisible().catch(() => false)) await menuButton.click();
    }
    const candidates = await page.getByText(target.label).all();
    let clicked = false;
    for (const candidate of candidates) {
      if (await candidate.isVisible().catch(() => false)) {
        await candidate.click();
        clicked = true;
        break;
      }
    }
    if (authenticated && clicked) {
      await page.getByText('Carregando módulo...').waitFor({ state: 'hidden', timeout: 6_000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
    const overflow = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    }));
    const screenshot = new URL(`${viewport.name}-${target.slug}.png`, outputDir);
    await page.screenshot({ path: fileURLToPath(screenshot), fullPage: true });
    pages.push({ target: target.slug, clicked, overflow, screenshot: fileURLToPath(screenshot) });
  }
  results.push({ viewport, authenticated, errors: [...new Set(errors)], pages });
  await page.close();
}

await browser.close();
await writeFile(new URL('report.json', outputDir), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
