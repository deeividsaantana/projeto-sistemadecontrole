import { expect, test } from '@playwright/test';

/**
 * Fumaça das telas: cada uma precisa montar sem erro de página, sem estourar a
 * largura no celular e mostrando o próprio título. É a checagem que antes eu
 * fazia à mão a cada versão.
 */
const TELAS: Array<{ screen: string; titulo: string | RegExp }> = [
  { screen: 'painel', titulo: 'Visão operacional' },
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

test('lançamento rápido: atalhos, busca por prefixo e ESC', async ({ page }) => {
  const erros: string[] = [];
  page.on('pageerror', e => erros.push(e.message));
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto('/?screen=frotas');
  await page.waitForTimeout(600);

  // Alt+N abre o lançamento rápido
  await page.keyboard.press('Alt+n');
  const painel = page.getByRole('dialog').first();
  await expect(painel, 'Alt+N abre o formulário').toBeVisible({ timeout: 4000 });

  // o painel é montado em portal, fora da árvore da tela
  const noBody = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return dialog ? dialog.closest('#frota-tab, #controle-equipamentos-tab') === null : false;
  });
  expect(noBody, 'painel montado em portal sobre o body').toBe(true);

  // Alt+P foca o prefixo; digitar + Enter busca o equipamento
  await page.keyboard.press('Alt+p');
  await page.keyboard.type('CB770');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const equipamento = await page.locator('select').filter({ hasText: 'Selecione ou use o prefixo' }).first().inputValue().catch(() => '');
  expect(equipamento, 'prefixo preencheu o equipamento').not.toBe('');

  // ESC fecha
  await page.keyboard.press('Escape');
  await expect(painel).toBeHidden({ timeout: 3000 });
  expect(erros, 'sem erro de página').toEqual([]);
});

test('painel: período, filtro de situação e tooltip do gráfico', async ({ page }) => {
  await page.goto('/?screen=painel');
  const painel = page.locator('#dashboard-tab');
  await expect(painel).toBeVisible();

  // O período reescreve o subtítulo e a série do gráfico.
  const subtitulo = painel.locator('h1 + p');
  await expect(subtitulo, 'painel abre em 7 dias').toContainText('7 dias');
  await page.getByRole('button', { name: '30 dias' }).click();
  await expect(subtitulo, 'o filtro de período muda a janela').toContainText('30 dias');
  await page.getByRole('button', { name: '7 dias' }).click();

  // O gráfico responde ao teclado e abre o tooltip com a composição do dia.
  const grafico = painel.getByRole('img').first();
  await grafico.focus();
  await page.keyboard.press('ArrowLeft');
  const tooltip = painel.getByRole('status');
  await expect(tooltip, 'seta seleciona um ponto e abre o tooltip').toBeVisible();
  await expect(tooltip).toContainText('Em operação');
  await page.keyboard.press('Escape');
  await expect(tooltip, 'ESC solta o ponto selecionado').toBeHidden();

  // A situação escolhida atravessa até a prévia de equipamentos.
  await page.selectOption('#painel-situacao', 'manutencao');
  await expect(painel.getByText('Filtrado por Em manutenção')).toBeVisible();

  await expect(painel.getByText(/undefined|NaN|\[object/), 'sem valor derivado quebrado').toHaveCount(0);
});

test('cabeçalho editorial: sangra até a borda, mostra o chapéu e não baixa foto no celular', async ({ page }, info) => {
  const fotos: string[] = [];
  page.on('request', req => { if (/renea-editorial/.test(req.url())) fotos.push(req.url()); });
  await page.goto('/?screen=producao');
  const faixa = page.locator('.renea-page-header__band');
  await expect(faixa).toBeVisible();
  await expect(page.locator('.renea-page-header__eyebrow')).toHaveText('Execução que entrega resultados');

  const caixa = await faixa.boundingBox();
  const largura = page.viewportSize()!.width;
  // A faixa vai de ponta a ponta do espaço de trabalho: sem moldura branca.
  expect(caixa!.x).toBeLessThanOrEqual(1);
  expect(caixa!.width).toBeGreaterThanOrEqual(Math.min(largura, 1440) - 1);

  // Só há uma <h1> por tela, e é a do cabeçalho.
  await expect(page.locator('h1')).toHaveCount(1);

  await page.waitForTimeout(300);
  if (info.project.name === 'celular') {
    expect(fotos, 'o celular não deve baixar a foto decorativa').toEqual([]);
  } else {
    expect(fotos.length, 'o desktop baixa a foto da faixa').toBeGreaterThan(0);
  }
});
