import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { Campo } from '../src/shared/ui/Lancamento';
import { problemasDoItem, problemasPorCampo } from '../src/utils/solicitacoes';

test('campo com erro marca aria-invalid e liga o aviso por aria-describedby', () => {
  const html = renderToStaticMarkup(
    <Campo rotulo="Quantidade" para="qtd" erro="Informe a quantidade."><input id="qtd" /></Campo>,
  );
  assert.match(html, /aria-invalid="true"/);
  assert.match(html, /aria-describedby="qtd-erro"/);
  assert.match(html, /<p id="qtd-erro"[^>]*>Informe a quantidade\.<\/p>/);
});

test('campo sem erro não marca aria-invalid', () => {
  const html = renderToStaticMarkup(
    <Campo rotulo="Quantidade" para="qtd" erro={null}><input id="qtd" /></Campo>,
  );
  assert.doesNotMatch(html, /aria-invalid/);
  assert.doesNotMatch(html, /aria-describedby/);
});

test('campo obrigatório mostra o asterisco só visualmente', () => {
  const html = renderToStaticMarkup(
    <Campo rotulo="Frente" para="f" obrigatorio><input id="f" /></Campo>,
  );
  assert.match(html, /<span aria-hidden="true"[^>]*> \*<\/span>/);
});

test('problemas por campo apontam o campo certo e mantêm a ordem da lista', () => {
  const item = { tipo: 'Material', descricao: '', quantidade: '0', unidade: 'un', prazoDesejado: '', permiteParcial: null };
  const porCampo = problemasPorCampo(item);
  assert.deepEqual(Object.keys(porCampo), ['descricao', 'quantidade', 'prazoDesejado', 'permiteParcial']);
  assert.deepEqual(problemasDoItem(item), Object.values(porCampo));
  assert.deepEqual(problemasPorCampo({ ...item, descricao: 'Vergalhão CA-50', quantidade: '2', prazoDesejado: '2026-11-20', permiteParcial: true }).especificacao?.startsWith('Aço'), true);
});
