import assert from 'node:assert/strict';
import test from 'node:test';
import { contarInativos, estaAtivo, inativar, reativar, somenteAtivos } from '../src/utils/inativacao';
import type { Inativavel } from '../src/utils/inativacao';

interface Lancamento extends Inativavel { valor: number }

const registro = (id: string, extra: Partial<Lancamento> = {}): Lancamento => ({ id, valor: 100, ...extra });

test('inativar não remove nada da lista: o registro continua no arquivo', () => {
  const lista = [registro('a'), registro('b'), registro('c')];
  const depois = inativar(lista, ['b'], 'Deivid', '2026-09-10T12:00:00.000Z');

  assert.equal(depois.length, 3, 'nenhum registro sumiu');
  assert.equal(depois[1].inativoEm, '2026-09-10T12:00:00.000Z');
  assert.equal(depois[1].inativoPor, 'Deivid');
  assert.deepEqual(somenteAtivos(depois).map(item => item.id), ['a', 'c']);
});

test('o registro inativo pode voltar exatamente como era', () => {
  const original = registro('a');
  const inativado = inativar([original], ['a'], 'Deivid');
  const voltou = reativar(inativado, ['a']);

  assert.deepEqual(voltou[0], original, 'a volta não deixa resíduo de inativação');
  assert.equal(estaAtivo(voltou[0]), true);
});

test('inativar duas vezes não reescreve quem já estava inativo', () => {
  const lista = inativar([registro('a')], ['a'], 'Deivid', '2026-09-01T00:00:00.000Z');
  const denovo = inativar(lista, ['a'], 'Outro', '2026-09-10T00:00:00.000Z');

  assert.equal(denovo[0].inativoEm, '2026-09-01T00:00:00.000Z', 'a data original é preservada');
  assert.equal(denovo[0].inativoPor, 'Deivid');
});

test('registro sem o campo é ativo — nada quebra no que já existe', () => {
  const antigos = [registro('a'), registro('b')];
  assert.equal(somenteAtivos(antigos).length, 2);
  assert.equal(contarInativos(antigos), 0);
});

test('lista ausente ou inválida não derruba a tela', () => {
  assert.deepEqual(somenteAtivos(undefined), []);
  assert.deepEqual(somenteAtivos(null), []);
  assert.equal(contarInativos(undefined), 0);
});

test('inativar sem ids devolve a mesma lista, sem cópia inútil', () => {
  const lista = [registro('a')];
  assert.equal(inativar(lista, [], 'Deivid'), lista);
});

// O motivo mais forte para inativar em vez de apagar, neste sistema, é a
// sincronização: uma exclusão feita num aparelho apagava o registro para todos.
// Uma inativação é uma alteração — viaja pela nuvem sem destruir nada.
test('inativação atravessa a nuvem sem apagar o registro dos outros aparelhos', async () => {
  const { mergeCloudTableWithBaseline } = await import('../src/cloudMerge');

  const original = { id: 'ab-1', valor: 100, updatedAt: '2026-09-01T00:00:00.000Z' };
  const naNuvem = [original, { id: 'ab-2', valor: 200, updatedAt: '2026-09-01T00:00:00.000Z' }];
  const noAparelho = inativar(
    [{ ...original, updatedAt: '2026-09-10T00:00:00.000Z' }, naNuvem[1]],
    ['ab-1'],
    'Deivid',
    '2026-09-10T00:00:00.000Z',
  );

  const resultado = mergeCloudTableWithBaseline(naNuvem, noAparelho, ['ab-1', 'ab-2']) as Array<
    { id: string; inativoEm?: string }
  >;

  assert.equal(resultado.length, 2, 'nada foi removido da nuvem');
  assert.equal(resultado.find(item => item.id === 'ab-1')?.inativoEm, '2026-09-10T00:00:00.000Z');
  assert.equal(resultado.find(item => item.id === 'ab-2')?.inativoEm, undefined);
});
