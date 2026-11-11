import assert from 'node:assert/strict';
import test from 'node:test';
import { descreverSalvamento, type EntradaSalvamento } from '../src/cloud/estadoSalvamento';

const base: EntradaSalvamento = { online: true, conectado: true, enviando: false, pendente: false, falhasSeguidas: 0 };

test('tudo certo: sincronizado, sem botão', () => {
  const d = descreverSalvamento(base);
  assert.equal(d.estado, 'sincronizado');
  assert.equal(d.tentarNovamente, false);
});

test('enviando tem prioridade e não oferece tentar de novo', () => {
  const d = descreverSalvamento({ ...base, enviando: true, pendente: true, falhasSeguidas: 2 });
  assert.equal(d.estado, 'enviando');
  assert.equal(d.tentarNovamente, false);
});

test('lançamento ainda não enviado aparece como salvo no aparelho', () => {
  const d = descreverSalvamento({ ...base, pendente: true });
  assert.equal(d.estado, 'aguardando');
  assert.match(d.rotulo, /Salvo no aparelho/);
});

test('envio que falhou diz que não chegou à nuvem e oferece tentar novamente', () => {
  const d = descreverSalvamento({ ...base, conectado: false, pendente: true, falhasSeguidas: 3 });
  assert.equal(d.estado, 'falhou');
  assert.equal(d.tentarNovamente, true);
  assert.match(d.detalhe, /Salvo neste aparelho/);
});

test('sem internet com dado pendente avisa que está salvo no aparelho', () => {
  const d = descreverSalvamento({ ...base, online: false, conectado: false, pendente: true, falhasSeguidas: 1 });
  assert.equal(d.estado, 'sem-conexao');
  assert.match(d.rotulo, /salvo no aparelho/);
});

test('fila offline conta como pendente mesmo sem envio em andamento', () => {
  assert.equal(descreverSalvamento({ ...base, pendenciasOffline: 2 }).estado, 'aguardando');
  assert.equal(descreverSalvamento({ ...base, online: false, conectado: false }).rotulo, 'Sem internet');
});

test('nuvem fora do ar sem nada pendente é só aviso de conexão', () => {
  assert.equal(descreverSalvamento({ ...base, conectado: false }).estado, 'sem-conexao');
});

test('a bolinha só diz se a nuvem está ok (verde) ou fora (amarela)', () => {
  assert.equal(descreverSalvamento(base).ponto, 'verde');
  assert.equal(descreverSalvamento({ ...base, pendente: true }).ponto, 'verde');
  assert.equal(descreverSalvamento({ ...base, conectado: false }).ponto, 'amarelo');
  assert.equal(descreverSalvamento({ ...base, online: false }).ponto, 'amarelo');
  assert.equal(descreverSalvamento({ ...base, conectado: false, pendente: true, falhasSeguidas: 2 }).ponto, 'amarelo');
});
