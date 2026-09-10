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

test('CTRL+ENTER salva sem procurar o botão', async ({ page }) => {
  await page.goto('/?screen=ocorrencias');
  await page.getByRole('button', { name: 'Nova ocorrência' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  // Sem descrição, salvar precisa reclamar: é a prova de que o atalho disparou
  // a mesma validação do botão, em vez de fechar o diálogo em silêncio.
  await page.keyboard.press('Control+Enter');
  await expect(page.getByText('Descreva a ocorrência.')).toBeVisible();
});

test('painel: 7d, 14d e 30d mudam de verdade a régua do gráfico', async ({ page }) => {
  await page.goto('/?screen=painel');
  const eixo = () => page.evaluate(() => [...document.querySelectorAll('#dashboard-tab svg text')]
    .map(no => no.textContent || '').filter(texto => /^\d{2}\/\d{2}$/.test(texto)));

  const sete = await eixo();
  expect(sete.length, 'o gráfico começa com a régua de 7 dias').toBeGreaterThan(1);

  await page.getByRole('button', { name: '30d', exact: true }).click();
  await expect.poll(async () => (await eixo())[0], { message: 'a régua de 30 dias começa antes' }).not.toBe(sete[0]);
  const trinta = await eixo();

  await page.getByRole('button', { name: '14d', exact: true }).click();
  await expect.poll(async () => (await eixo())[0]).not.toBe(trinta[0]);
  const quatorze = await eixo();
  expect(quatorze[0], 'a régua de 14 dias é diferente da de 7').not.toBe(sete[0]);

  await page.getByRole('button', { name: '7d', exact: true }).click();
  await expect.poll(async () => (await eixo())[0]).toBe(sete[0]);
  expect(await eixo(), 'voltar para 7 dias devolve a régua original').toEqual(sete);
});

test('frota: a relação do dia abre e fecha o restante do grupo sem perder itens', async ({ page }) => {
  await page.goto('/?screen=frotas');
  const chips = page.locator('#fleet-reference-title').locator('xpath=ancestor::section[1]').locator('ul li');

  const parcial = await chips.count();
  expect(parcial, 'a relação começa recortada').toBeGreaterThan(0);

  const abrir = page.getByRole('button', { name: /Ver os outros \d+ de Basculantes/ });
  await expect(abrir).toBeVisible();
  await abrir.click();

  await expect.poll(async () => chips.count(), { message: 'abrir mostra mais equipamentos' }).toBeGreaterThan(parcial);

  await page.getByRole('button', { name: 'Mostrar menos' }).first().click();
  await expect.poll(async () => chips.count()).toBe(parcial);
});

test('cabeçalho de módulo é compacto e não repete o nome da obra antigo', async ({ page }, info) => {
  await page.goto('/?screen=producao');
  const cabecalho = page.locator('.renea-page-header');
  await expect(cabecalho).toBeVisible();

  // A capa editorial anterior tinha 12,75 rem de altura mínima e comia a
  // primeira dobra. Num ERP a primeira dobra é do dado.
  // No celular o título quebra e as ações ganham uma linha própria, então o
  // teto é maior — mas continua bem abaixo dos 328 px da capa anterior.
  const teto = info.project.name === 'celular' ? 170 : 110;
  const caixa = await cabecalho.boundingBox();
  expect(caixa!.height, `a faixa do cabeçalho cabe em ${teto}px`).toBeLessThan(teto);

  await expect(page.locator('h1'), 'uma única h1 por tela').toHaveCount(1);
  await expect(page.locator('.renea-page-header__photo')).toHaveCount(0);
  await expect(page.getByText(/Mário Covas|Trecho Leste/)).toHaveCount(0);
});

// O link público é o que a obra usa todo dia e era o único caminho sem e2e:
// os testes provavam o backend, mas ninguém provava que o encarregado
// consegue marcar, enviar e voltar num dia anterior.
test('link público: marcar, enviar e voltar a um dia anterior na régua', async ({ page }) => {
  await page.goto('/?screen=presenca-fluxo');

  const cartoes = page.locator('.presence-public__status-grid');
  const total = await cartoes.count();
  expect(total).toBeGreaterThan(0);
  for (let i = 0; i < total; i += 1) {
    await cartoes.nth(i).getByRole('button', { name: 'Presente' }).click();
  }

  const enviar = page.getByRole('button', { name: /Enviar presença/i });
  await expect(enviar).toBeEnabled();
  await enviar.click();

  // O comprovante confirma que o envio chegou, e é dele que sai a régua.
  await expect(page.getByText('env-e2e-001')).toBeVisible();
  const regua = page.getByRole('region', { name: 'Histórico de apontamentos da equipe' });
  await expect(regua).toBeVisible();

  // Voltar um dia tem de trazer o dia anterior de verdade — com a gente
  // daquele dia — e não repintar o dia corrente. O dia anterior chega por
  // busca sob demanda: é justamente o caminho que passou a valer quando a
  // resposta deixou de trazer os 30 dias de uma vez.
  await regua.getByRole('button').last().click();
  await page.getByRole('button', { name: /Ver a lista deste dia/i }).click();

  // A lista sempre mostra a equipe inteira; o que muda entre um dia e outro é
  // quem tem situação registrada. No dia anterior, Sebastião tem; João não.
  const cartaoDe = (nome: string) =>
    page.locator('.presence-public__employee-card').filter({ hasText: nome });
  await expect(cartaoDe('Sebastião Rodrigues Lima').locator('.presence-public__status-pill'))
    .toHaveText('Presente');
  await expect(cartaoDe('João Batista dos Santos').locator('.presence-public__status-pill'))
    .toHaveCount(0);
});

// Desligar alguém ou marcar férias é registro de RH: precisa de data e motivo,
// e a situação escolhida decide se a pessoa continua no efetivo da obra.
test('colaborador: mudar a situação pede data e motivo', async ({ page }) => {
  await page.goto('/?screen=colaboradores');
  await page.getByText('João Batista dos Santos').first().click();

  await page.getByRole('button', { name: /Alterar situação/i }).click();
  const dialogo = page.getByRole('dialog');
  await expect(dialogo).toBeVisible();

  await expect(dialogo.getByRole('combobox')).toBeVisible();
  await expect(dialogo.locator('input[type="date"]')).toBeVisible();
  await expect(dialogo.getByPlaceholder(/Fim de contrato/i)).toBeVisible();

  for (const situacao of ['ATIVO', 'FÉRIAS', 'AFASTADO', 'DESMOBILIZADO', 'INATIVO']) {
    // exact: 'ATIVO' é pedaço de 'INATIVO'.
    await expect(dialogo.getByRole('option', { name: situacao, exact: true })).toHaveCount(1);
  }
});

// A equipe que não usou o link não pode ficar sem apontamento: o painel avisa
// que faltou e é dali mesmo que sai o lançamento manual.
test('presença: a equipe que não enviou pode ser lançada pelo painel', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?screen=presenca-admin');

  const lancar = page.getByRole('button', { name: /Lançar presença/i }).first();
  await expect(lancar).toBeVisible();
  await lancar.click();

  const dialogo = page.getByRole('dialog');
  await expect(dialogo).toBeVisible();
  // O lançamento tem de deixar claro que foi feito pelo painel, e não no campo.
  await expect(dialogo.getByText(/marcado como feito pelo painel/i)).toBeVisible();
  await expect(dialogo.locator('input[type="date"]')).toBeVisible();

  // Sem conferir ninguém, não dá para lançar.
  const confirmar = dialogo.getByRole('button', { name: 'Lançar presença', exact: true });
  await expect(confirmar).toBeDisabled();

  await dialogo.getByRole('button', { name: 'Presente', exact: true }).first().click();
  await expect(confirmar).toBeEnabled();
});

// O mapa de chuvas é o quadro que justifica prazo em contrato. Ele lê o
// pluviômetro do diário e precisa distinguir "não choveu" de "ninguém lançou".
test('mapa de chuvas soma o pluviômetro do diário e marca o dia sem lançamento', async ({ page }) => {
  await page.goto('/?screen=diario-obra');

  const mapa = page.locator('#mapa-de-chuvas');
  await expect(mapa).toBeVisible();

  // 0+3+12+28+1,5+62+7+4+33+9 = 159,5 mm no mês da amostra.
  await expect(mapa.getByText('159,5 mm')).toBeVisible();

  const dia4 = mapa.getByRole('gridcell', { name: /Dia 4:/ });
  await expect(dia4).toHaveAttribute('aria-label', /12 mm/);

  const dia6 = mapa.getByRole('gridcell', { name: /Dia 6:/ });
  await expect(dia6).toHaveAttribute('aria-label', /sem diário lançado/);

  await expect(mapa.getByRole('button', { name: 'PDF' })).toBeVisible();
});
