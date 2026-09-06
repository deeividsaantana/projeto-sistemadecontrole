import { test } from '@playwright/test';
const DIR = '/tmp/claude-0/-home-user-projeto-sistemadecontrole/bf727dfb-5bfa-5597-85e6-29bac674684c/scratchpad/shots';
test('periodo', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/?screen=periodo');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${DIR}/f4-periodo.png`, fullPage: true });
});
