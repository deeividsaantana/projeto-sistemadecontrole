const fs = require('node:fs');
const { chromium } = require('C:/Users/deivids/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', message => message.type() === 'error' && errors.push(message.text()));
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4179/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  if (await page.locator('input[type=email]').count()) {
    const password = fs.readFileSync('C:/Users/deivids/AppData/Local/RENEA/senha-inicial-administrador.txt', 'utf8').trim();
    await page.locator('input[type=email]').fill('deividbrandaosouzadesantana@gmail.com');
    await page.locator('input[type=password]').fill(password);
    await page.getByRole('button', { name: /entrar no sistema/i }).click();
    await page.waitForTimeout(5000);
  }
  const initialText = await page.locator('body').innerText();
  const result = {
    url: page.url(),
    horizontalNavigation: initialText.includes('Consulta Geral') && initialText.includes('Painel de Controle'),
    removedModules: !initialText.includes('Inteligência Documental') && !initialText.includes('Auditoria'),
    consoleErrors: errors,
    viewports: [],
  };
  await page.evaluate(() => {
    const rows = JSON.parse(localStorage.getItem('renea_abastecimentos') || '[]');
    if (!rows.some(row => row.id === 'visual-polluted-row')) rows.push({
      id: 'visual-polluted-row', data: '2026-08-10', hora: '12:00', equipamentoId: '', prefixoInformado: 'REVISAR',
      horimetroInicial: 0, kmInicial: 0, bombaInicial: 0, quantidadeLitros: '25.826.481.837.205', bombaFinal: 0,
      tipoCombustivelId: '', comboioId: '', responsavel: 'Teste local', observacao: 'Registro contaminado para teste',
      status: 'Conferência necessária', origem: 'Planilha', integracaoArquivo: 'teste-local.xlsx', integracaoLinha: 99,
    });
    localStorage.setItem('renea_abastecimentos', JSON.stringify(rows));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  for (const [width, height] of [[1440, 900], [1024, 768], [768, 900], [430, 900], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(250);
    result.viewports.push({ width, overflow: await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const bodyAfter = await page.locator('body').innerText();
  result.giantValueVisible = bodyAfter.includes('25.826.481.837.205');
  result.reviewVisible = bodyAfter.includes('fora dos indicadores') || bodyAfter.includes('abastecimento(s) para conferir');
  await page.getByRole('button', { name: /consulta geral/i }).first().click();
  await page.waitForTimeout(1200);
  result.generalConsultation = await page.locator('#consulta-geral-tab').count() === 1;
  result.linkWorkspace = (await page.locator('#consulta-geral-tab').innerText()).includes('Vínculo motorista');
  await page.screenshot({ path: 'artifacts-local-consulta-geral.png', fullPage: true });
  result.modules = [];
  for (const moduleName of ['Manutenção', 'Presença e Controle', 'Combustível', 'Tickets Jazida', 'Controle de Estacas']) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: new RegExp(`^${moduleName}$`, 'i') }).first().click();
    await page.waitForTimeout(900);
    const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const moduleText = await page.locator('body').innerText();
    await page.setViewportSize({ width: 430, height: 900 });
    await page.waitForTimeout(200);
    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    result.modules.push({ moduleName, desktopOverflow, mobileOverflow, oneDrivePanelVisible: moduleText.includes('OneDrive automático') });
  }
  await browser.close();
  console.log(JSON.stringify(result));
})().catch(error => { console.error(error); process.exitCode = 1; });
