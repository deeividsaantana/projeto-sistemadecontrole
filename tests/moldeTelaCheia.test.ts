import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/**
 * Trava do molde de página (auditoria de front de 21/10/2026, C1/A1/A2/A3/M1):
 * a aba já nasce em tela cheia (sem botão), usa 100% da largura e as
 * subtelas usam o AbasDaTela, com role=tablist e aria-selected.
 */
const ler = (caminho: string) => readFileSync(caminho, 'utf8');
const css = ler('src/index.css');
const telaCheia = ler('src/shared/ui/TelaCheia.tsx');
const abas = ler('src/shared/ui/AbasDaTela.tsx');
const NO_MOLDE = {
  'src/components/CombustivelOperacionalTab.tsx': 'combustivel-tab',
  'src/components/ControleEquipamentosDiarioTab.tsx': 'controle-equipamentos-tab',
  'src/components/ControlePresencaTab.tsx': 'presenca-tab',
  'src/components/TicketsJazidaTab.tsx': 'tickets-jazida-tab',
} as const;

test('a TelaCheia desconta a barra do topo e o recuo, e só a área de dados rola', () => {
  assert.match(css, /\.renea-tela-cheia \{[^}]*height: calc\(100dvh - var\(--renea-topo\) - 2 \* var\(--renea-respiro\)\)/);
  assert.match(css, /\.renea-tela-cheia__dados \{[^}]*overflow-y: auto/);
  assert.match(css, /#main-tab-viewport \{ --renea-topo: 3\.25rem;/, 'a altura da barra do topo (52 px) mora numa variável só');
  assert.match(telaCheia, /flex min-h-0 min-w-0 flex-1 flex-col/);
  const app = ler('src/App.tsx');
  assert.match(app, /id="main-tab-viewport"[^\n]*p-\[var\(--renea-respiro\)\]/, 'o recuo do App é o mesmo que a TelaCheia desconta');
});

test('nenhuma aba tem teto de largura: todas usam 100%', () => {
  assert.doesNotMatch(css, /max-width: 1580px|max-width: 1600px|min\(100%, 96rem\)|min\(100%, 120rem\)/);
  for (const arquivo of Object.keys(NO_MOLDE)) {
    assert.doesNotMatch(ler(arquivo), /max-w-\[1[0-9]{3}px\]/, arquivo);
  }
});

test('Combustível, Frotas, Presença e Viagens da jazida nascem cheias, sem botão de tela cheia', () => {
  for (const [arquivo, id] of Object.entries(NO_MOLDE)) {
    const fonte = ler(arquivo);
    assert.match(fonte, new RegExp(`<TelaCheia[^>]*id="${id}"`), arquivo);
    assert.match(fonte, /<AbasDaTela/, arquivo);
    assert.doesNotMatch(fonte, /telaCheia|CHAVE_TELA_CHEIA|Maximize2|<main\b/, arquivo);
  }
});

test('o AbasDaTela é acessível e aguenta subtelas agrupadas', () => {
  assert.match(abas, /role="tablist"/);
  assert.match(abas, /role="tab"/);
  assert.match(abas, /aria-selected=\{/);
  assert.match(abas, /ArrowRight[\s\S]*ArrowLeft[\s\S]*Home[\s\S]*End/);
  assert.match(abas, /export interface GrupoDeAbas/);
  assert.match(abas, /lg:flex-wrap lg:overflow-visible/, 'no computador a linha quebra em vez de rolar para o lado');
});

// Materiais (fase 2): 14 subtelas em abas agrupadas, sem o menu lateral
// interno. As janelas de lançamento seguem com o botão de tela cheia delas.
test('Materiais nasce cheia, com abas agrupadas no topo e sem menu lateral interno', () => {
  const fonte = ler('src/components/MateriaisTab.tsx');
  assert.match(fonte, /<TelaCheia[\s\S]*?id="materiais-tab"/);
  assert.match(fonte, /<AbasDaTela/);
  assert.doesNotMatch(fonte, /<MateriaisSecoes\b|CHAVE_TELA_CHEIA|Maximize2|<main\b|max-w-\[1[0-9]{3}px\]/);
  const secoes = ler('src/components/materiais/MateriaisSecoes.tsx');
  assert.match(secoes, /grupo: grupo\.id/, 'subtelas em grupos');
  assert.doesNotMatch(secoes, /<nav\b|createPortal/, 'o menu lateral interno não volta');
  const uso = ler('src/components/MateriaisUtilizacaoPanel.tsx');
  assert.match(uso, /<AbasDaTela/, 'classes de Uso por ramo em abas, não em chips');
  assert.doesNotMatch(uso, /aria-pressed/);
});
