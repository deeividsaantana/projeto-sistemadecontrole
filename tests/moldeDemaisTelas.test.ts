import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/**
 * Trava do molde nas demais telas (auditoria de front de 21/10/2026, fase 2):
 * Painel, Meu dia, Diário de Obra, Previsto x Executado, Relatórios,
 * Administração e Manutenção nascem em tela cheia, com o PageHeader no topo e
 * as subtelas no AbasDaTela. A casca usa as janelas comuns.
 */
const ler = (caminho: string) => readFileSync(caminho, 'utf8');

const TELAS = {
  'src/components/Dashboard.tsx': { id: 'dashboard-tab', abas: false },
  'src/components/MeuDiaTab.tsx': { id: 'meu-dia-tab', abas: true },
  'src/components/DiarioObraTab.tsx': { id: 'diario-obra-tab', abas: false },
  'src/components/PlanejamentoTab.tsx': { id: 'planejamento-tab', abas: true },
  'src/components/RelatoriosTab.tsx': { id: 'relatorios-tab', abas: false },
  'src/components/AdministracaoTab.tsx': { id: 'administracao-tab', abas: true },
  'src/components/ManutencaoTab.tsx': { id: 'manutencao-tab', abas: true },
} as const;

test('as demais telas usam a TelaCheia com PageHeader, sem teto de largura', () => {
  for (const [arquivo, { id, abas }] of Object.entries(TELAS)) {
    const fonte = ler(arquivo);
    assert.match(fonte, new RegExp(`<TelaCheia[^>]*id="${id}"`), arquivo);
    assert.match(fonte, /<PageHeader/, arquivo);
    assert.doesNotMatch(fonte, /max-w-\[1[0-9]{3}px\]|<main\b/, arquivo);
    if (abas) {
      assert.match(fonte, /<AbasDaTela/, `${arquivo} deve ter as subtelas no AbasDaTela`);
      assert.doesNotMatch(fonte, /aria-current=\{[^}]*'page'/, `${arquivo} voltou a usar botão solto como aba`);
    }
  }
});

test('o Painel tem o mesmo recuo das outras abas', () => {
  assert.doesNotMatch(ler('src/App.tsx'), /dashboard-viewport/);
});

test('o mapa de chuvas é uma grade completa, com linhas por semana (M7)', () => {
  const mapa = ler('src/components/MapaChuva.tsx');
  assert.match(mapa, /role="row"/);
  assert.match(mapa, /role="columnheader"/);
  assert.match(mapa, /role="gridcell"/);
  assert.match(mapa, /ArrowDown: 7/, 'as setas andam pelo calendário');
});

test('Meu dia: caixas de marcar de 24 px no Fechamento (M4)', () => {
  assert.match(ler('src/components/meuDia/ChecklistDoDia.tsx'), /type="checkbox"\s+className="size-6/);
});

test('Previsto x Executado: cartão de frente é h2 logo abaixo do h1 (M3)', () => {
  assert.match(ler('src/components/planejamento/FrentesDoDia.tsx'), /<h2 className="break-words/);
  assert.doesNotMatch(ler('src/components/planejamento/FrentesDoDia.tsx'), /<h3\b/);
});

test('a casca usa as janelas comuns (A11)', () => {
  const sino = ler('src/app/shell/NotificationCenter.tsx');
  assert.match(sino, /<Modal\b/);
  assert.doesNotMatch(sino, /fixed inset-0 z-40/, 'o sino não monta janela à mão');
  const importacao = ler('src/components/SpreadsheetImportReview.tsx');
  assert.match(importacao, /<Modal\b/);
  assert.match(importacao, /<caption/);
  assert.match(importacao, /scope="col"/);
  const pesquisa = ler('src/app/shell/PesquisaGlobal.tsx');
  assert.match(pesquisa, /aria-modal="true"/);
  assert.match(pesquisa, /role="combobox"/);
  assert.match(pesquisa, /key !== 'Tab'/, 'o Tab fica preso na pesquisa');
});

test('a área de dados da TelaCheia prende o texto de leitor de tela', () => {
  assert.match(ler('src/shared/ui/TelaCheia.tsx'), /renea-tela-cheia__dados relative/);
});
