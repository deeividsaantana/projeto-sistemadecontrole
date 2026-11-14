import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

/**
 * Pedido do usuário em 14/11/2026: a aba Pedidos mostra todos os cards de
 * uma vez (sem "Mostrar mais"), Excel/PDF/Importar ficam dentro de
 * Relatórios e o Filtros fica na linha das abas, abrindo o painel acima dos cards.
 */
const fonte = readFileSync(new URL('../src/components/SolicitacoesTab.tsx', import.meta.url), 'utf8');

test('Pedidos: sem botão "Mostrar mais", todos os cards na tela', () => {
  assert.doesNotMatch(fonte, /Mostrar mais|POR_VEZ/);
  assert.match(fonte, /pedidos\.map\(\(\{ sol \}\)/);
});

test('Pedidos: Excel, PDF e Importar só dentro de Relatórios', () => {
  const topo = fonte.slice(fonte.indexOf('actions={'), fonte.indexOf('faixa={'));
  assert.doesNotMatch(topo, /exportar\(|gerarPdf|arquivo\.current/);
  assert.match(fonte, /id: "arquivos", rotulo: "Excel, PDF e importar"/);
});

test('Pedidos: Filtros abre e fecha no lugar, sem trocar de tela', () => {
  assert.doesNotMatch(fonte, /setSubtela\("filtros"\)/);
  assert.match(fonte, /aria-expanded=\{filtrosAbertos\}/);
});
