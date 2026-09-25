import assert from 'node:assert/strict';
import test from 'node:test';
import { aplicarExclusoes, criarExclusao, exclusoesAtivas, restaurarExclusao } from '../src/cloud/exclusoes';
import { mergeCloudSnapshotsWithBaseline, resolvePublishPayload } from '../src/cloudMerge';

const josue = { id: 'COL-0163', nome: 'Josué Pereira', matricula: '01063' };
const cleiton = { id: 'COL-0144', nome: 'Cleiton Lima', matricula: '01044' };
const excluirJosue = (agora = '2026-09-25T12:00:00.000Z') => criarExclusao({
  tabela: 'funcionarios', registro: josue, rotulo: josue.nome, usuario: 'Deivid', agora,
});

test('exclusão ativa tira o registro do retrato e guarda quem excluiu', () => {
  const exclusao = excluirJosue();
  assert.equal(exclusao.excluidoPor, 'Deivid');
  assert.deepEqual(exclusao.registro, josue);
  const resultado = aplicarExclusoes({ funcionarios: [josue, cleiton], exclusoes: [exclusao] });
  assert.deepEqual((resultado.funcionarios as { id: string }[]).map(item => item.id), ['COL-0144']);
});

test('restaurar desfaz, e excluir de novo volta a valer', () => {
  const primeira = excluirJosue('2026-09-25T12:00:00.000Z');
  const restaurada = restaurarExclusao(primeira, 'Deivid', '2026-09-25T12:05:00.000Z');
  assert.equal(aplicarExclusoes({ funcionarios: [josue], exclusoes: [restaurada] }).funcionarios.length, 1);
  const segunda = excluirJosue('2026-09-25T13:00:00.000Z');
  assert.equal(aplicarExclusoes({ funcionarios: [josue], exclusoes: [restaurada, segunda] }).funcionarios.length, 0);
  assert.equal(exclusoesAtivas([restaurada, segunda]).size, 1);
});

test('aparelho sem base de sincronização não ressuscita o cadastro excluído', () => {
  // Nuvem: Josué já excluído. Aparelho novo ainda tem o Josué da semente e
  // publica sem base: a mesclagem de duas vias devolveria o registro.
  const remoto = { funcionarios: [cleiton], exclusoes: [excluirJosue()] };
  const local = { funcionarios: [josue, cleiton], exclusoes: [] };
  const publicado = mergeCloudSnapshotsWithBaseline(remoto, local, undefined);
  assert.deepEqual((publicado.funcionarios as { id: string }[]).map(item => item.id), ['COL-0144']);
  assert.equal((publicado.exclusoes as unknown[]).length, 1);
});

test('aparelho atrasado que ainda não tem a tabela de exclusões não apaga as marcas', () => {
  const remoto = { funcionarios: [cleiton], exclusoes: [excluirJosue()] };
  const localAntigo = { funcionarios: [josue, cleiton] };
  const publicado = resolvePublishPayload({
    localPayload: localAntigo,
    remoteSnapshot: remoto,
    remoteUpdatedAt: '2026-09-25T12:00:01.000Z',
    knownCloudVersion: '2026-09-20T08:00:00.000Z',
  });
  assert.equal((publicado.exclusoes as unknown[]).length, 1);
  assert.equal((publicado.funcionarios as unknown[]).length, 1);
});

test('exclusão feita aqui vence o registro que ainda está na nuvem', () => {
  const remoto = { funcionarios: [josue, cleiton], exclusoes: [] };
  const local = { funcionarios: [cleiton], exclusoes: [excluirJosue()] };
  const publicado = mergeCloudSnapshotsWithBaseline(remoto, local, undefined);
  assert.deepEqual((publicado.funcionarios as { id: string }[]).map(item => item.id), ['COL-0144']);
});

test('restauração feita num aparelho chega aos outros', () => {
  const exclusao = excluirJosue();
  const restaurada = restaurarExclusao(exclusao, 'Deivid', '2026-09-25T12:05:00.000Z');
  const remoto = { funcionarios: [cleiton], exclusoes: [exclusao] };
  const local = { funcionarios: [cleiton, { ...josue, atualizadoEm: '2026-09-25T12:05:00.000Z' }], exclusoes: [restaurada] };
  const publicado = mergeCloudSnapshotsWithBaseline(remoto, local, { funcionarios: ['COL-0144'], exclusoes: [exclusao.id] });
  assert.equal((publicado.funcionarios as unknown[]).length, 2);
  assert.equal((publicado.exclusoes as { restauradoEm?: string }[])[0].restauradoEm, '2026-09-25T12:05:00.000Z');
});

test('marcas de exclusão nunca somem numa mesclagem, mesmo com base', () => {
  const exclusao = excluirJosue();
  const publicado = mergeCloudSnapshotsWithBaseline(
    { funcionarios: [cleiton], exclusoes: [exclusao] },
    { funcionarios: [cleiton], exclusoes: [] },
    { funcionarios: ['COL-0144'], exclusoes: [exclusao.id] },
  );
  assert.equal((publicado.exclusoes as unknown[]).length, 1);
});

test('a cópia para restaurar deixa de fora foto grande', () => {
  const comFoto = { ...josue, foto: `data:image/png;base64,${'A'.repeat(30_000)}` };
  const exclusao = criarExclusao({ tabela: 'funcionarios', registro: comFoto, rotulo: 'Josué', usuario: 'Deivid', agora: '2026-09-25T12:00:00.000Z' });
  assert.equal('foto' in exclusao.registro, false);
  assert.equal(exclusao.registro.nome, 'Josué Pereira');
});

test('retrato sem exclusões volta o mesmo objeto', () => {
  const retrato = { funcionarios: [josue] };
  assert.equal(aplicarExclusoes(retrato), retrato);
});
