import { expect, test } from '@playwright/test';

/**
 * Fumaça das telas: cada uma precisa montar sem erro de página, sem estourar a
 * largura no celular e mostrando o próprio título. É a checagem que antes eu
 * fazia à mão a cada versão.
 */
const TELAS: Array<{ screen: string; titulo: string | RegExp }> = [
  { screen: 'painel', titulo: 'Painel de Controle' },
  { screen: 'manutencao', titulo: 'Manutenção' },
  { screen: 'colaboradores', titulo: 'Colaboradores' },
  { screen: 'cadastros', titulo: /.+/ },
  { screen: 'combustivel', titulo: /.+/ },
  { screen: 'estacas', titulo: /.+/ },
  { screen: 'frotas', titulo: /.+/ },
  { screen: 'presenca', titulo: /.+/ },
];

for (const { screen, titulo } of TELAS) {
  test(`${screen} monta sem erro e cabe na tela`, async ({ page }) => {
    const erros: string[] = [];
    page.on('pageerror', erro => erros.push(erro.message));

    await page.goto(`/?screen=${screen}`);
    await expect(page.getByRole('heading', { name: titulo, level: 1 })).toBeAttached();

    const estouro = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(estouro, 'a página não pode rolar na horizontal').toBeLessThanOrEqual(0);
    expect(erros, 'nenhum erro de página').toEqual([]);
  });
}

test('shell viewport usa largura total sem limite', async ({ page }) => {
  await page.goto('/?screen=painel');
  const viewport = page.locator('#main-tab-viewport');
  await expect(viewport).toBeVisible();
  await expect(viewport).toHaveCSS('max-width', '1440px');
});

test('cadastros oferece busca nomeada no grupo de filtros', async ({ page }) => {
  await page.goto('/?screen=cadastros');
  const filters = page.getByRole('region', { name: 'Filtros de cadastros' });
  await expect(filters.getByRole('searchbox', { name: 'Buscar cadastros' })).toBeVisible();
});

test('cadastros cabe em notebook sem zoom e mostra a lista logo de cara', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 700 });
  await page.goto('/?screen=cadastros');
  const primeira = page.locator('[data-linha-lista]:visible').first();
  await expect(primeira).toBeVisible();
  const estouro = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(estouro, 'a tabela não pode empurrar a página para o lado').toBeLessThanOrEqual(0);
  const topo = await primeira.evaluate(linha => linha.getBoundingClientRect().top);
  expect(topo, 'a primeira linha aparece sem rolar').toBeLessThan(400);

  // A TabelaPadrao rola por dentro: a lista desce, busca e cabeçalho ficam na tela.
  const area = page.locator('#database-lists-viewport [role="region"]');
  await area.hover();
  for (let vez = 0; vez < 4; vez += 1) await page.mouse.wheel(0, 600);
  await expect.poll(() => area.evaluate(elemento => elemento.scrollTop)).toBeGreaterThan(200);
  const busca = await page.getByRole('searchbox', { name: 'Buscar cadastros' }).boundingBox();
  expect(busca?.y ?? -1, 'a busca fica na tela ao rolar a lista').toBeGreaterThanOrEqual(0);
  const cabecalho = await page.locator('#database-lists-viewport thead th').last().boundingBox();
  expect(cabecalho?.y ?? -1, 'o cabeçalho da tabela fica abaixo dos filtros').toBeGreaterThan((busca?.y ?? 0) + (busca?.height ?? 0));
  expect((cabecalho?.y ?? 999) + (cabecalho?.height ?? 0), 'o cabeçalho continua dentro da tela').toBeLessThan(700);
});

test('cadastros exclui de verdade, guarda na Lixeira e deixa desfazer', async ({ page }) => {
  await page.goto('/?screen=cadastros');
  await page.locator('[data-linha-lista]:visible').first().click();
  await page.getByTestId('cadastro-excluir').click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Supabase');
  await dialog.getByTestId('cadastro-confirmar').click();
  const aviso = page.getByTestId('cadastro-aviso');
  await expect(aviso).toContainText('excluído');
  // Os tipos são abas no topo, também no celular. Para o administrador a
  // Lixeira mora no grupo "Lixeira e acessos", que abre a segunda linha.
  const grupoSistema = page.getByTestId('cadastro-aba-grupo-sistema');
  if (await grupoSistema.isVisible()) await grupoSistema.click();
  await page.getByTestId('cadastro-categoria-lixeira').click();
  await expect(page.getByTestId('cadastro-categoria-lixeira')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('cadastro-lixeira')).toContainText('excluído por');
  await aviso.getByRole('button', { name: 'Desfazer' }).click();
  await expect(page.getByTestId('cadastro-lixeira')).toContainText('A Lixeira está vazia');
});

test('cadastros trava exclusão de cadastro usado e oferece inativar', async ({ page }) => {
  await page.goto('/?screen=cadastros&blockedRegistry=1');
  await page.locator('[data-linha-lista]:visible').first().click();
  await page.getByTestId('cadastro-excluir').click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Não dá para excluir');
  await expect(dialog.getByRole('list', { name: 'Onde é usado' })).toContainText('Abastecimentos');
  await expect(dialog.getByRole('button', { name: 'Inativar' })).toBeVisible();
  await expect(dialog.getByTestId('cadastro-confirmar')).toHaveCount(0);
});

test('cadastros marca vários, exclui de uma vez e desfaz o lote', async ({ page }) => {
  await page.goto('/?screen=cadastros');
  const caixas = page.locator('[data-linha-lista]:visible input[type="checkbox"]');
  for (const indice of [0, 1, 2]) await caixas.nth(indice).check();
  const barra = page.getByTestId('cadastro-barra-selecao');
  await expect(barra).toContainText('3 marcados');
  await barra.getByTestId('cadastro-excluir-marcados').click();
  const dialog = page.getByTestId('cadastro-confirmacao-lote');
  await expect(dialog).toContainText('Excluir 3 cadastros');
  await dialog.getByTestId('cadastro-confirmar-lote').click();
  const aviso = page.getByTestId('cadastro-aviso');
  await expect(aviso).toContainText('3 cadastros excluídos');
  await expect(barra).toHaveCount(0);
  await aviso.getByRole('button', { name: 'Desfazer' }).click();
  await expect(aviso).toContainText('3 cadastros voltaram');
});

test('cadastros em lote deixa de fora o que está em uso e diz qual', async ({ page }) => {
  await page.goto('/?screen=cadastros&emUso=alguns');
  await page.locator('[data-linha-lista]:visible input[type="checkbox"]').first().check();
  // O preview tem 48 colaboradores ativos; "Marcar todos" pega a lista filtrada inteira.
  await page.getByTestId('cadastro-marcar-todos').click();
  await expect(page.getByTestId('cadastro-barra-selecao')).toContainText('48 marcados');
  await page.getByTestId('cadastro-excluir-marcados').click();
  const dialog = page.getByTestId('cadastro-confirmacao-lote');
  await expect(dialog).toContainText('de fora por estar em uso');
  await expect(dialog.getByRole('list', { name: 'Ficam de fora' })).toContainText('Abastecimentos');
  await dialog.getByTestId('cadastro-confirmar-lote').click();
  await expect(page.getByTestId('cadastro-aviso')).toContainText('por estar em uso');
});

test('painel mostra cada indicador executivo uma única vez', async ({ page }) => {
  await page.goto('/?screen=painel');

  const painel = page.locator('#dashboard-tab');
  await expect(painel.getByText('Fechamento operacional', { exact: true })).toBeHidden();
  await expect(painel.getByText('Pulso do dia', { exact: true })).toBeHidden();
  await expect(painel.getByText('Combustível', { exact: true })).toHaveCount(1);
  await expect(painel.getByText('Pessoas em campo', { exact: true })).toHaveCount(1);
  await expect(painel.locator('[data-dashboard-hero]')).toHaveCount(0);
});

test('manutenção apresenta central operacional e fluxo das OS', async ({ page }) => {
  await page.goto('/?screen=manutencao');

  await expect(page.getByRole('heading', { name: 'Manutenção', level: 1 })).toBeVisible();
  // As ordens abrem primeiro; a fila de oficina é a aba ao lado.
  await expect(page.getByText(/\d+ ordens? de serviço/)).toBeVisible();
  await page.getByRole('tab', { name: /^(Fila de oficina|Fila)/ }).click();
  await expect(page.getByRole('heading', { name: 'Fila de oficina', level: 2 })).toBeVisible();
  await expect(page.getByText('OS em curso, ordenadas pelo tempo parado do equipamento')).toBeVisible();
});

test('manutenção identifica a categoria do equipamento', async ({ page }) => {
  await page.goto('/?screen=manutencao');
  await page.getByRole('tab', { name: /^(Fila de oficina|Fila)/ }).click();

  await expect(page.locator('[aria-label="Caminhão basculante"]').first()).toBeVisible();
});

test('módulo preserva h1 e remove o cabeçalho visual', async ({ page }) => {
  await page.goto('/?screen=pluviometro');

  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('.renea-page-header__copy')).toHaveClass(/sr-only/);
  const semanticCopy = await page.locator('.renea-page-header__copy').boundingBox();
  expect(semanticCopy?.width).toBeLessThanOrEqual(1);
  expect(semanticCopy?.height).toBeLessThanOrEqual(1);
  await expect(page.locator('.renea-page-header')).toHaveCSS('min-height', '0px');
});

test('controle de frotas remove o lançamento rápido e leva as visões ao topo', async ({ page }) => {
  await page.goto('/?screen=frotas');

  await expect(page.getByText('Lançamento rápido')).toHaveCount(0);
  const topViews = page.locator('.renea-page-header').getByRole('tablist', { name: 'Subtelas do controle de frotas' });
  await expect(topViews).toBeVisible();
  // No celular a aba mostra o nome curto ("Dia").
  await expect(topViews.getByRole('tab', { name: /^(Situação do dia|Dia)$/ })).toHaveAttribute('aria-selected', 'true');
});

test('manutenção abre o formulário e fecha com ESC', async ({ page }) => {
  await page.goto('/?screen=manutencao');
  await page.getByRole('button', { name: 'Abrir OS' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
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

test('manutenção abre OS por N, foca equipamento e valida salvar por CTRL+ENTER', async ({ page }) => {
  await page.goto('/?screen=manutencao');
  await expect(page.getByRole('button', { name: 'Abrir OS' })).toBeVisible();
  await page.keyboard.press('n');

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const equipamento = dialog.getByRole('combobox', { name: 'Equipamento', exact: true });
  await expect(equipamento).toBeFocused();

  await page.keyboard.press('Control+Enter');
  await expect(dialog.getByText('Selecione o equipamento da ordem.')).toBeVisible();
  // O erro fica ligado ao campo, para leitor de tela e para quem vê só a cor.
  await expect(equipamento).toHaveAttribute('aria-invalid', 'true');
  await expect(equipamento).toHaveAccessibleDescription('Selecione o equipamento da ordem.');
  await expect(equipamento).toBeFocused();
});

test('manutenção apresenta uma fila operacional acionável sem cards duplicados', async ({ page }) => {
  await page.goto('/?screen=manutencao');
  await page.getByRole('tab', { name: /^(Fila de oficina|Fila)/ }).click();

  const queue = page.getByRole('region', { name: 'Fila operacional de manutenção' });
  await expect(queue).toBeVisible();
  await expect(queue.getByText('CB770')).toBeVisible();
  await expect(queue.getByRole('button', { name: /Editar OS-0100/ })).toBeVisible();
  await expect(page.getByText('Manutenções em Destaque')).toHaveCount(0);
});

test('painel não duplica a navegação principal dentro do conteúdo', async ({ page }) => {
  await page.goto('/?screen=painel');
  await expect(page.getByRole('navigation', { name: 'Módulos da obra' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Registrar operação' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Novo lançamento' })).toHaveCount(0);
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
  await page.goto('/?screen=pluviometro');
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
  await page.goto('/?screen=presenca');

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
  await page.goto('/?screen=pluviometro');

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

// "Tudo interativo": o número do painel não é só leitura, é o caminho. Clicar
// numa frente recorta o painel inteiro por ela, e clicar de novo desfaz.
test('painel de presença: clicar numa frente recorta o painel e clicar de novo desfaz', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?screen=presenca');

  const frentes = page.locator('article').filter({ hasText: 'Onde falta gente' });
  await expect(frentes).toBeVisible();

  const primeira = frentes.getByRole('button').first();
  await expect(primeira).toHaveAttribute('aria-pressed', 'false');

  await primeira.click();
  await expect(primeira).toHaveAttribute('aria-pressed', 'true');
  // O recorte passa a valer no painel inteiro: o botão de filtros mostra o crachá.
  await expect(page.getByRole('button', { name: /^Filtros/ })).toContainText('1');

  await primeira.click();
  await expect(primeira).toHaveAttribute('aria-pressed', 'false');
});

test('painel de presença: quem falta sempre leva aos registros da pessoa', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?screen=presenca');

  const cartao = page.locator('article').filter({ hasText: 'Quem falta sempre' });
  await expect(cartao).toBeVisible();
  await expect(cartao.getByRole('combobox')).toBeVisible();
});

test('Quadro e Manutenção se abrem um no outro já buscando o prefixo da máquina', async ({ page }) => {
  // A Fila de oficina fica na subtela Hoje, que abre primeiro.
  await page.goto('/?screen=manutencao&shell=1');
  await page.getByRole('button', { name: /^Ver .+ no quadro$/ }).first().click();
  await expect(page).toHaveURL(/screen=frotas.*busca=/);
  // O Quadro carrega sob demanda: na primeira abertura do servidor pode passar de 5 s.
  await expect(page.getByRole('tab', { name: /^Quadro/, selected: true }).first()).toBeVisible({ timeout: 20_000 });
  const prefixo = new URL(page.url()).searchParams.get('busca') || '';
  await expect(page.getByTestId('quadro-busca')).toHaveValue(prefixo);

  await page.goto('/?screen=frotas&shell=1');
  await page.getByRole('tab', { name: /^Quadro/ }).first().click();
  await page.getByTestId('quadro-situacao-manutencao').click();
  await page.getByTestId('quadro-arrastar-CB1012').getByRole('button').first().click();
  await page.getByTestId('quadro-ver-ordens').click();
  await expect(page).toHaveURL(/screen=manutencao.*busca=CB1012/);
  await expect(page.getByRole('tab', { name: /^(Ordens de serviço|OS)/, selected: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByPlaceholder('Número, prefixo, problema, responsável...')).toHaveValue('CB1012');
});

test('manutenção: "Continuar além de 10 h" tira o teto do card e registra quem decidiu', async ({ page }) => {
  await page.goto('/?screen=manutencao&shell=1');
  // Preso pelo prefixo: depois do clique o botão some e não serve para achar o card.
  const cartao = page.getByTestId('cartao-parada').filter({ has: page.getByRole('heading', { name: 'CB770' }) });
  await cartao.getByTestId('parada-continuar-alem').click();
  // Pede confirmação antes de gravar: cancelar não muda nada.
  await expect(cartao.getByText('A OS não fecha sozinha')).toBeVisible();
  await cartao.getByRole('button', { name: 'Cancelar' }).click();
  await expect(cartao.getByTestId('parada-alem-aviso')).toHaveCount(0);
  await cartao.getByTestId('parada-continuar-alem').click();
  await cartao.getByTestId('parada-continuar-alem-confirmar').click();
  await expect(cartao.getByTestId('parada-alem-aviso')).toContainText('Segue contando até a liberação, por decisão de');
  await expect(cartao).toContainText('sem teto');
  await expect(cartao.getByTestId('parada-continuar-alem')).toHaveCount(0);
  // E dá para voltar atrás.
  await cartao.getByTestId('parada-voltar-regra').click();
  await expect(cartao.getByTestId('parada-alem-aviso')).toHaveCount(0);
  await expect(cartao).toContainText('/ 10 h');
});
