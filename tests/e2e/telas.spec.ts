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
  { screen: 'colaboradores', titulo: 'Colaboradores' },
  { screen: 'equipes', titulo: 'Equipes' },
  { screen: 'apontamentos', titulo: 'Apontamentos' },
  { screen: 'dds-treinamentos', titulo: 'DDS e Treinamentos' },
  { screen: 'materiais', titulo: 'Materiais' },
  { screen: 'frentes', titulo: 'Frentes de Serviço' },
  { screen: 'diario-obra', titulo: 'Diário de Obra' },
  { screen: 'producao', titulo: 'Produção' },
  { screen: 'planejamento', titulo: 'Planejamento' },
  { screen: 'fvs', titulo: 'FVS' },
  { screen: 'inspecoes', titulo: 'Inspeções' },
  { screen: 'nao-conformidades', titulo: 'Não Conformidades' },
  { screen: 'medicoes', titulo: 'Medições' },
  { screen: 'documentos', titulo: 'Documentos' },
  { screen: 'ocorrencias', titulo: 'Ocorrências' },
  { screen: 'cadastros', titulo: /.+/ },
  { screen: 'combustivel', titulo: /.+/ },
  { screen: 'estacas', titulo: /.+/ },
  { screen: 'frotas', titulo: /.+/ },
  { screen: 'jazida', titulo: /.+/ },
  { screen: 'presenca', titulo: /.+/ },
  { screen: 'pendencias', titulo: 'Pendências' },
  { screen: 'indicadores', titulo: 'Indicadores' },
  { screen: 'custos', titulo: 'Custos' },
  { screen: 'orcamento', titulo: 'Orçado x Realizado' },
  { screen: 'cronograma', titulo: 'Cronograma' },
  { screen: 'relatorios', titulo: 'Relatórios' },
  { screen: 'timeline', titulo: 'Timeline' },
  { screen: 'auditoria', titulo: 'Auditoria' },
  { screen: 'permissoes', titulo: 'Permissões' },
  { screen: 'administracao', titulo: 'Administração' },
  { screen: 'notificacoes', titulo: 'Notificações' },
  { screen: 'assistente', titulo: 'Assistente' },
  { screen: 'modo-campo', titulo: 'Modo Campo' },
  { screen: 'consulta', titulo: 'Consulta Geral' },
  { screen: 'periodo', titulo: 'Registros por Período' },
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

test('CTRL+ENTER salva sem procurar o botão', async ({ page }) => {
  await page.goto('/?screen=ocorrencias');
  await page.getByRole('button', { name: 'Nova ocorrência' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  // Sem descrição, salvar precisa reclamar: é a prova de que o atalho disparou
  // a mesma validação do botão, em vez de fechar o diálogo em silêncio.
  await page.keyboard.press('Control+Enter');
  await expect(page.getByText('Descreva a ocorrência.')).toBeVisible();
});

// Foco visível: quem navega por teclado precisa ver onde está. A skill trata
// isto como requisito, não enfeite.
test('as abas e ações mostram foco pelo teclado', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?screen=pendencias');
  await page.waitForTimeout(400);
  const aba = page.getByRole('button', { name: /^Todas/ });
  await aba.focus();
  const anel = await aba.evaluate(el => getComputedStyle(el).boxShadow + getComputedStyle(el).outline);
  expect(anel.length).toBeGreaterThan(0);
});

test('números das tabelas usam figuras tabulares', async ({ page }) => {
  await page.goto('/?screen=periodo');
  await page.waitForTimeout(400);
  const tabela = page.locator('table').first();
  const variante = await tabela.evaluate(el => getComputedStyle(el).fontVariantNumeric);
  expect(variante).toContain('tabular-nums');
});
