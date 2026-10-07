import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeCloudSnapshots, mergeCloudTable } from '../src/cloudMerge';

test('preserva o lancamento novo de cada lado no conflito', () => {
  // O caso real: outro usuario publicou enquanto o nosso envio subia. Nenhum
  // dos dois lancamentos pode desaparecer.
  const remote = [{ id: 'a', prefixo: 'CB100' }];
  const local = [{ id: 'b', prefixo: 'CB200' }];
  const merged = mergeCloudTable(remote, local) as Array<{ id: string }>;
  assert.equal(merged.length, 2);
  assert.deepEqual(merged.map(item => item.id).sort(), ['a', 'b']);
});

test('mesmo registro nos dois lados fica com a versao mais recente', () => {
  const remote = [{ id: 'a', status: 'Em operação', atualizadoEm: '2026-09-03T12:00:00.000Z' }];
  const local = [{ id: 'a', status: 'Em manutenção', atualizadoEm: '2026-09-03T13:00:00.000Z' }];
  assert.equal((mergeCloudTable(remote, local)[0] as { status: string }).status, 'Em manutenção');
  // E o contrario tambem: a copia local velha nao sobrescreve a nuvem recente.
  assert.equal((mergeCloudTable(local, remote)[0] as { status: string }).status, 'Em manutenção');
});

test('sem data comparavel prevalece o que ja esta publicado', () => {
  const remote = [{ id: 'a', status: 'publicado' }];
  const local = [{ id: 'a', status: 'copia local' }];
  assert.equal((mergeCloudTable(remote, local)[0] as { status: string }).status, 'publicado');
});

test('registro datado vence registro sem data', () => {
  const remote = [{ id: 'a', status: 'sem data' }];
  const local = [{ id: 'a', status: 'com data', atualizadoEm: '2026-09-03T13:00:00.000Z' }];
  assert.equal((mergeCloudTable(remote, local)[0] as { status: string }).status, 'com data');
});

test('registro sem id e preservado dos dois lados sem duplicar identicos', () => {
  const remote = [{ nome: 'sem id' }, { nome: 'so na nuvem' }];
  const local = [{ nome: 'sem id' }, { nome: 'so local' }];
  const merged = mergeCloudTable(remote, local) as Array<{ nome: string }>;
  assert.deepEqual(merged.map(item => item.nome).sort(), ['sem id', 'so local', 'so na nuvem']);
});

test('mescla todas as tabelas do snapshot e mantem tabela que existe so de um lado', () => {
  const remote = {
    updatedAt: '2026-09-03T12:00:00.000Z',
    controleEquipamentosDiario: [{ id: 'frota-1' }],
    abastecimentos: [{ id: 'abast-1' }],
  };
  const local = {
    updatedAt: '2026-09-03T13:00:00.000Z',
    controleEquipamentosDiario: [{ id: 'frota-2' }],
    ticketsJazida: [{ id: 'ticket-1' }],
  };
  const merged = mergeCloudSnapshots(remote, local) as Record<string, Array<{ id: string }>>;
  assert.deepEqual(
    (merged.controleEquipamentosDiario).map(item => item.id).sort(),
    ['frota-1', 'frota-2'],
  );
  // Tabela intocada pelo envio local continua vindo da nuvem.
  assert.deepEqual(merged.abastecimentos.map(item => item.id), ['abast-1']);
  // Tabela que so existe localmente entra no resultado.
  assert.deepEqual(merged.ticketsJazida.map(item => item.id), ['ticket-1']);
});

test('snapshot remoto ausente devolve o local intacto', () => {
  const local = { controleEquipamentosDiario: [{ id: 'frota-1' }] };
  assert.deepEqual(mergeCloudSnapshots(null, local), local);
});
