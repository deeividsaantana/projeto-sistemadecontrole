import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');

const primaryScreens = [
  ['dashboard', 'src/components/Dashboard.tsx'],
  ['modo-campo', 'src/components/ModoCampoTab.tsx'],
  ['central-operacional', 'src/components/CentralOperacionalTab.tsx'],
  ['planejamento', 'src/components/PlanejamentoTab.tsx'],
  ['diario-obra', 'src/components/DiarioObraTab.tsx'],
  ['tickets-jazida', 'src/components/TicketsJazidaTab.tsx'],
  ['estacas', 'src/components/EstacasTab.tsx'],
  ['controle-equipamentos', 'src/components/ControleEquipamentosDiarioTab.tsx'],
  ['manutencao', 'src/components/ManutencaoTab.tsx'],
  ['lancamentos', 'src/components/LancamentosTab.tsx'],
  ['colaboradores', 'src/components/ColaboradoresTab.tsx'],
  ['presenca', 'src/components/ControlePresencaTab.tsx'],
  ['materiais', 'src/components/MateriaisTab.tsx'],
  ['relatorios', 'src/components/RelatoriosTab.tsx'],
  ['administracao', 'src/components/AdministracaoTab.tsx'],
] as const;

test('as 15 abas primarias usam o mesmo envelope de tamanho', () => {
  const css = read('src/index.css');
  assert.match(css, /width:\s*min\(100%,\s*96rem\)/);
  assert.match(css, /min-height:\s*calc\(100vh - 7rem\)/);
  assert.match(css, /#main-tab-viewport \.renea-filter-bar/);
});

test('abas primarias possuem id de tela estavel para o padrao visual', () => {
  for (const [id, path] of primaryScreens) {
    const source = read(path);
    assert.match(source, new RegExp(`id=["']${id}-tab["']`), `${id} precisa expor ${id}-tab`);
  }
});

test('criterio de lancamento cansado esta documentado no design system', () => {
  const source = read('docs/SAAS_DESIGN_SYSTEM.md');
  assert.match(source, /Critério de lançamento cansado/);
  assert.match(source, /pessoa cansada no fim do dia/);
});
