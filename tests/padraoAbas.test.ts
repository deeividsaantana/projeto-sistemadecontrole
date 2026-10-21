import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';

/**
 * Trava do padrão das abas (CONTRIBUTING.md, seção 4). Toda tela em
 * src/components/*Tab.tsx e o Painel precisam de:
 * - pageHeader: cabeçalho com o PageHeader comum (o Painel é a referência e
 *   tem cabeçalho próprio);
 * - gsap: animação de entrada com GSAP;
 * - movimentoReduzido: respeito a prefers-reduced-motion;
 * - corForaDaPaleta: nenhuma cor hex solta fora da paleta RENEA.
 *
 * PENDENCIAS guarda o que cada aba ainda deve na data da trava. A lista só
 * diminui: aba nova precisa nascer no padrão, uma aba não pode perder um
 * item que já cumpre, e quando uma aba passa a cumprir um item o teste pede
 * para tirar esse item da lista.
 */
type Regra = 'pageHeader' | 'gsap' | 'movimentoReduzido' | 'corForaDaPaleta';

// #5b6870 e #c2410c são as cores de TEXTO (cinza e laranja com 4,5:1 no
// branco); #718087 e #f26a2e ficam para fundo, borda e ícone decorativo.
const PALETA = new Set(['#176b4d', '#f26a2e', '#718087', '#f7f8f6', '#5b6870', '#c2410c']);

const PENDENCIAS: Record<string, readonly Regra[]> = {
  TicketsJazidaTab: ['pageHeader', 'gsap', 'movimentoReduzido', 'corForaDaPaleta'],
};

const components = new URL('../src/components/', import.meta.url);
const telas = ['Dashboard', ...readdirSync(components)
  .filter(file => file.endsWith('Tab.tsx'))
  .map(file => file.replace(/\.tsx$/, ''))];

const regrasQueFaltam = (tela: string): Regra[] => {
  const source = readFileSync(new URL(`${tela}.tsx`, components), 'utf8');
  const faltam: Regra[] = [];
  if (tela !== 'Dashboard' && !source.includes('PageHeader')) faltam.push('pageHeader');
  if (!/useGSAP|gsap\./.test(source)) faltam.push('gsap');
  if (!/prefers-reduced-motion|matchMedia\(|useReducedMotion|reducedMotion/.test(source)) faltam.push('movimentoReduzido');
  const cores = (source.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map(cor => cor.toLowerCase());
  if (cores.some(cor => !PALETA.has(cor))) faltam.push('corForaDaPaleta');
  return faltam;
};

for (const tela of telas) {
  test(`${tela} segue o padrão das abas`, () => {
    const faltam = regrasQueFaltam(tela);
    const pendente = new Set(PENDENCIAS[tela] ?? []);
    const novas = faltam.filter(regra => !pendente.has(regra));
    assert.deepEqual(novas, [], `${tela} saiu do padrão em: ${novas.join(', ')}. Veja CONTRIBUTING.md, seção 4.`);
    const resolvidas = [...pendente].filter(regra => !faltam.includes(regra));
    assert.deepEqual(resolvidas, [], `${tela} já cumpre ${resolvidas.join(', ')}: tire da lista PENDENCIAS.`);
  });
}

test('a lista de pendências só cita telas que existem', () => {
  const sobrando = Object.keys(PENDENCIAS).filter(tela => !telas.includes(tela));
  assert.deepEqual(sobrando, []);
});

test('toda aba do menu abre uma tela e toda aba principal tem permissão', async () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const { NAVIGATION_GROUPS, PRIMARY_MODULE_IDS, ROLE_ACCESS } = await import('../src/app/navigation/navigation');
  const semTela = NAVIGATION_GROUPS
    .flatMap(group => group.items.map(item => item.id))
    .filter(id => !app.includes(`activeTab === '${id}'`));
  assert.deepEqual(semTela, [], 'aba no menu sem tela no App.tsx');
  const semPermissao = PRIMARY_MODULE_IDS.filter(id => !ROLE_ACCESS.admin.includes(id));
  assert.deepEqual(semPermissao, [], 'aba principal sem permissão em ROLE_ACCESS');
  // Tela que o App monta e nenhum perfil abre é código morto: o App manda
  // quem tenta para o Painel. Foram 18 até 16/10/2026 (auditoria das abas, G6).
  const inalcancaveis = [...app.matchAll(/activeTab === '([a-z-]+)' &&/g)]
    .map(match => match[1])
    .filter(id => !ROLE_ACCESS.admin.includes(id));
  assert.deepEqual(inalcancaveis, [], 'tela no App.tsx que nenhum perfil consegue abrir');
});

test('toda tela *Tab.tsx é aberta por algum arquivo', () => {
  const fontes = ['../src/App.tsx', ...readdirSync(components)
    .filter(file => file.endsWith('.tsx'))
    .map(file => `../src/components/${file}`)]
    .map(path => readFileSync(new URL(path, import.meta.url), 'utf8'))
    .join('\n');
  const orfas = telas
    .filter(tela => tela !== 'Dashboard')
    .filter(tela => !new RegExp(`['/]${tela}['"]`).test(fontes));
  assert.deepEqual(orfas, [], 'tela que nenhum arquivo abre: remova ou ligue ao menu');
});

// Auditoria de front (21/10/2026, A6): #718087 dá 4,08:1 e #f26a2e 3,05:1 no
// branco. Como letra valem #5b6870 e #c2410c; o selo com letra branca usa o
// fundo #c2410c. As cores claras seguem livres para fundo, borda e ícone.
const fontesDoApp = readdirSync(new URL('../src/', import.meta.url), { recursive: true, encoding: 'utf8' })
  .filter(arquivo => /\.(tsx?|css)$/.test(arquivo))
  .map(arquivo => ({ arquivo, fonte: readFileSync(new URL(`../src/${arquivo}`, import.meta.url), 'utf8') }));

test('cinza #718087 e laranja #f26a2e não viram cor de letra', () => {
  const letraClara = /text-\[#(718087|f26a2e)\]|(?:^|[;{\s])color:\s*#(718087|f26a2e)\b|bg-\[#f26a2e\][^'"`]*text-white/im;
  const fora = fontesDoApp.filter(({ fonte }) => letraClara.test(fonte)).map(({ arquivo }) => arquivo);
  assert.deepEqual(fora, [], 'use #5b6870 (cinza) ou #c2410c (laranja) como cor de letra');
});

// Auditoria de front (21/10/2026, A9): piso de 12px para texto. 11px só no
// rótulo de cabeçalho de tabela em maiúsculas; o relatório impresso da frota
// segue a medida do papel.
test('nenhum texto abaixo de 12px', () => {
  const tamanhos = (trecho: string) => [...trecho.matchAll(/text-\[(\d+(?:\.\d+)?)px\]|font-size:\s*(\d*\.?\d+)(px|rem)/g)]
    .map(([, classe, valor, unidade]) => classe ? Number(classe) : Number(valor) * (unidade === 'rem' ? 16 : 1))
    .filter(tamanho => tamanho < 12);
  // Na folha de estilo a regra é o bloco inteiro; no componente, a linha.
  const trechos = (arquivo: string, fonte: string) => arquivo.endsWith('.css')
    ? [...fonte.matchAll(/([^{}]*)\{([^{}]*)\}/g)].map(([bloco, seletor]) => ({ trecho: bloco, cabecalho: /(^|[\s>,])th\b/.test(seletor) }))
    : fonte.split('\n').map(linha => ({ trecho: linha, cabecalho: /<th(ead)?\b/.test(linha) }));
  const fora = fontesDoApp
    .filter(({ arquivo }) => !arquivo.endsWith('FleetReportLayout.tsx'))
    .flatMap(({ arquivo, fonte }) => trechos(arquivo, fonte).flatMap(({ trecho, cabecalho }) => tamanhos(trecho)
      .filter(tamanho => !(tamanho >= 11 && cabecalho && trecho.includes('uppercase')))
      .map(tamanho => `${arquivo} (${tamanho}px): ${trecho.trim().slice(0, 60)}`)));
  assert.deepEqual(fora, [], 'use text-xs (12px) ou maior');
});

// Auditoria de front (21/10/2026, B1): o primeiro Tab da casca leva à aba.
test('a casca começa pelo link de pular para o conteúdo', () => {
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const raiz = app.indexOf('id="app-root"');
  assert.ok(raiz > 0, 'App.tsx sem #app-root');
  const link = app.indexOf('<PularParaConteudo />', raiz);
  assert.ok(link > raiz && link - raiz < 200, 'o link deve ser o primeiro item dentro de #app-root');
  assert.match(app, /id="main-tab-viewport" tabIndex=\{-1\}/);
});
