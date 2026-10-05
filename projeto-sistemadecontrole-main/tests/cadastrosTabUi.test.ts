import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const tab = readFileSync(new URL('../src/components/CadastrosTab.tsx', import.meta.url), 'utf8');
const confirmacao = readFileSync(new URL('../src/components/cadastros/CadastroConfirmacao.tsx', import.meta.url), 'utf8');

test('cadastros confirma exclusão e inativação numa janela acessível', () => {
  assert.match(confirmacao, /role="alertdialog"/);
  assert.match(confirmacao, /aria-modal="true"/);
  assert.match(confirmacao, /aria-labelledby="cadastro-delete-title"/);
  // O nome e o código do cadastro aparecem na janela; os botões travam enquanto grava.
  assert.match(confirmacao, /Excluir \$\{nome\}\?/);
  assert.match(confirmacao, /Código \{codigo\}/);
  assert.match(confirmacao, /disabled=\{processando\}/);
  assert.match(tab, /<CadastroConfirmacao/);
  assert.doesNotMatch(tab, /window\.confirm/);
  assert.doesNotMatch(confirmacao, /window\.confirm/);
});

test('cadastro usado em lançamento não é excluído: a janela lista onde é usado e oferece inativar', () => {
  assert.match(confirmacao, /const travada = acao === 'excluir' && usos\.length > 0/);
  assert.match(confirmacao, /aria-label="Onde é usado"/);
  assert.match(confirmacao, /onClick=\{onInativarNoLugar\}/);
});

const lote = readFileSync(new URL('../src/components/cadastros/CadastroConfirmacaoLote.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('exclusão em lote confirma quantos saem e lista os que ficam por estar em uso', () => {
  assert.match(lote, /role="alertdialog"/);
  assert.match(lote, /aria-label="Ficam de fora"/);
  assert.match(lote, /disabled=\{processando\}/);
  assert.match(tab, /<CadastroConfirmacaoLote/);
  // O lote grava tudo numa gravação só: chamadas seguidas perderiam exclusões.
  assert.match(app, /const excluirCadastros = /);
  assert.match(app, /itens\.map\(\(\{ item, rotulo \}\) => criarExclusao/);
  assert.match(app, /const handleRestaurarCadastros = /);
});
