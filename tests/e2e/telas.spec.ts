import { expect, test } from '@playwright/test';

/**
 * Fumaça das telas: cada uma precisa montar sem erro de página, sem estourar a
 * largura no celular e mostrando o próprio título. É a checagem que antes eu
 * fazia à mão a cada versão.
 */
const TELAS: Array<{ screen: string; titulo: string | RegExp }> = [
  { screen: 'painel', titulo: 'Painel de Controle' },
  { screen: 'central-operacional', titulo: 'Central Operacional' },
  { screen: 'frota', titulo: 'Frota' },
  { screen: 'manutencao', titulo: 'Manutenção' },
  { screen: 'horas-paradas', titulo: 'Horas Paradas' },
  { screen: 'checklist', titulo: 'Checklist' },
  { screen: 'consulta', titulo: 'Consulta Geral' },
  { screen: 'periodo', titulo: /^Registros de / },
];

for (const { screen, titulo } of TELAS) {
  test(`${screen} monta sem erro e cabe na tela`, async ({ page }) => {
    const erros: string[] = [];
    page.on('pageerror', erro => erros.push(erro.message));

    await page.goto(`/?screen=${screen}`);
    await expect(page.getByRole('heading', { name: titulo, level: 1 })).toBeVisible();

    const estouro = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(estouro, 'a página não pode rolar na horizontal').toBeLessThanOrEqual(0);
    expect(erros, 'nenhum erro de página').toEqual([]);
  });
}

test('checklist bloqueia salvar não conformidade sem justificativa', async ({ page }) => {
  await page.goto('/?screen=checklist');
  await page.getByRole('button', { name: 'Novo checklist' }).click();
  await page.getByRole('button', { name: 'Não conforme', exact: true }).first().click();
  await expect(page.getByText(/abrirá OS/)).toBeVisible();
  await page.getByRole('button', { name: 'Salvar checklist' }).click();
  await expect(page.getByText(/Selecione o equipamento|Descreva o problema em/)).toBeVisible();
});

test('manutenção abre o formulário e fecha com ESC', async ({ page }) => {
  await page.goto('/?screen=manutencao');
  await page.getByRole('button', { name: 'Abrir OS' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});
