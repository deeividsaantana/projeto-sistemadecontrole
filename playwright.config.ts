import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Ambientes de CI que já trazem o Chromium usam o binário instalado; na máquina
// de quem desenvolve, o Playwright usa o próprio (npx playwright install).
const chromiumDoAmbiente = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const executablePath = existsSync(chromiumDoAmbiente) ? chromiumDoAmbiente : undefined;

/**
 * E2E roda contra o harness de telas (preview/), não contra o app completo: o
 * app exige login no Firebase, e o harness monta as mesmas telas com dados de
 * exemplo — dá para checar render, interação e responsividade sem credencial.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4300',
    launchOptions: { executablePath },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'celular', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'npx vite --config preview/vite.config.ts --port 4300 --host 127.0.0.1',
    url: 'http://127.0.0.1:4300',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
