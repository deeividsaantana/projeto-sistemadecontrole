import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const tab = readFileSync(new URL('../src/components/QuadroFrotaTab.tsx', import.meta.url), 'utf-8');
const cartao = readFileSync(new URL('../src/components/quadroFrota/CartaoArrastavel.tsx', import.meta.url), 'utf-8');
const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf-8');

test('Quadro da Frota deixa selecionar várias máquinas pra mover ou excluir de uma vez', () => {
  assert.match(tab, /const \[modoSelecao, setModoSelecao\] = useState\(false\)/);
  assert.match(tab, /data-testid="quadro-alternar-selecao"/);
  assert.match(tab, /data-testid="quadro-barra-selecao"/, 'a barra de ações da seleção precisa existir');
  assert.match(tab, /moverSelecionadosPara/, 'mover as selecionadas pro canteiro escolhido');
  assert.match(tab, /excluirSelecionados/, 'excluir o lançamento do dia das selecionadas');
  assert.match(tab, /onDeleteMany\(selecionadosExcluiveis\.map\(cartao => cartao\.registroId!\)\)/, 'só exclui quem já tem lançamento no dia');
});

test('o arrastar desliga sozinho enquanto a seleção está ativa', () => {
  assert.match(tab, /onDragEnd=\{modoSelecao \? undefined : arrastarSoltou\}/);
  assert.match(cartao, /disabled: !podeArrastar \|\| modoSelecao/);
});

test('busca do Quadro espera parar de digitar antes de refiltrar (não trava a tela)', () => {
  assert.match(tab, /const \[buscaTexto, setBuscaTexto\] = useState\(''\)/);
  assert.match(tab, /window\.setTimeout\(\(\) => setFiltros\(atual => \(atual\.busca === buscaTexto/);
  assert.match(tab, /value=\{buscaTexto\} onChange=\{event => setBuscaTexto\(event\.target\.value\)\}/);
});

test('a animação de entrada das abas não prende mais os elementos "fixed" dentro da tela', () => {
  // Sem "both": o fill-mode preso fazia qualquer barra position:fixed (como
  // a de seleção em lote e o "Salvar tudo" do Lançar) ficar presa lá embaixo
  // no meio do conteúdo, em vez de grudada no rodapé da tela de verdade.
  assert.match(css, /#main-tab-viewport > \* \{ animation: renea-v3-enter 360ms cubic-bezier\(\.2,\.8,\.2,1\); \}/);
  assert.doesNotMatch(css, /#main-tab-viewport > \* \{ animation: renea-v3-enter 360ms cubic-bezier\(\.2,\.8,\.2,1\) both; \}/);
});
