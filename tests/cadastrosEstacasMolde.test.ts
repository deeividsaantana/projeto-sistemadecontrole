import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

/**
 * Cadastros e Controle de Estacas no molde de página (auditoria de front de
 * 21/10/2026, fase 2): TelaCheia, subtelas como abas no topo (AbasDaTela),
 * sem menu lateral interno, tabelas na TabelaPadrao e o organograma numa
 * janela de verdade (Modal), sem janela feita à mão.
 */
const ler = (caminho: string) => readFileSync(caminho, 'utf8');
const cadastros = ler('src/components/CadastrosTab.tsx');
const estacas = ler('src/components/EstacasTab.tsx');
const organograma = ler('src/components/OrganizationChart.tsx');

test('Cadastros nasce em tela cheia com os tipos agrupados em abas no topo', () => {
  assert.match(cadastros, /<TelaCheia[\s\S]*id="cadastros-tab"/);
  assert.match(cadastros, /<AbasDaTela id="cadastros"/);
  assert.match(cadastros, /idAbaAtiva=\{idDaAba\('cadastros', vista\)\}/);
  assert.doesNotMatch(cadastros, /--tabela-altura-max|--cad-filtros|erp-module|lg:grid-cols-\[14rem/, 'sem altura máxima à mão, sem coluna de menu');
  assert.equal(existsSync('src/components/cadastros/CadastroTipos.tsx'), false, 'o menu lateral interno saiu');
});

test('o organograma abre num Modal e não tem janela feita à mão', () => {
  assert.match(cadastros, /<Modal[\s\S]*title="Organograma de colaboradores"[\s\S]*<OrganizationChart/);
  assert.doesNotMatch(organograma, /fixed inset-0|createPortal/);
  assert.doesNotMatch(organograma, /outline-none/, 'campo do organograma mostra o foco');
  assert.doesNotMatch(organograma, /text-\[(8|9|10|11)px\]/);
});

test('Estacas nasce em tela cheia com as seis subtelas em abas no topo', () => {
  assert.match(estacas, /<TelaCheia[\s\S]*id="estacas-tab"/);
  assert.match(estacas, /<AbasDaTela id="estacas"[^>]*testId="estacas-secao"/);
  assert.doesNotMatch(estacas, /EstacasSecoes|lg:grid-cols-\[14rem|erp-module/);
  assert.equal(existsSync('src/components/estacas/EstacasSecoes.tsx'), false, 'o menu lateral interno saiu');
});

test('as tabelas de Estacas usam a TabelaPadrao (50 por página), sem <table> à mão na tela', () => {
  for (const arquivo of ['ListaEstacas', 'RecebimentosEstacas', 'RelatoriosEstacas']) {
    const fonte = ler(`src/components/estacas/${arquivo}.tsx`);
    assert.match(fonte, /<TabelaPadrao/, arquivo);
  }
  const lista = ler('src/components/estacas/ListaEstacas.tsx');
  assert.doesNotMatch(lista, /<table|PAGINA = 100|Mostrar mais/, 'a lista não desenha 100 linhas de uma vez');
  assert.doesNotMatch(ler('src/components/estacas/RecebimentosEstacas.tsx'), /<table/);
  // Relatórios: só a versão de papel (relatório inteiro) é tabela à mão, com caption e th scope.
  const relatorios = ler('src/components/estacas/RelatoriosEstacas.tsx');
  assert.match(relatorios, /print:table/);
  assert.match(relatorios, /<caption/);
  assert.match(relatorios, /scope="col"/);
});

test('a caixa de marcar da TabelaPadrao tem 24 px também no computador (M4)', () => {
  const tabela = ler('src/shared/ui/TabelaPadrao.tsx');
  assert.match(tabela, /const CAIXA = 'size-6 /);
  assert.doesNotMatch(tabela, /const CAIXA = [^\n]*md:size-5/);
});
