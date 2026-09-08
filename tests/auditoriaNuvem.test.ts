import assert from 'node:assert/strict';
import test from 'node:test';
import { captureCloudBaseline, mergeCloudSnapshotsWithBaseline, resolvePublishPayload } from '../src/cloudMerge';

test('AUDITORIA: o corte de 2.000 eventos do histórico apaga da nuvem os mais antigos', () => {
  const antigos = Array.from({ length: 3 }, (_, i) => ({ id: `log-antigo-${i}`, descricao: 'antigo' }));
  const nuvem = { historyLogs: [...antigos] };
  // Base: o que este aparelho enxergava na última sincronização.
  const baseline = captureCloudBaseline(nuvem);
  // O aparelho corta os antigos ao registrar um evento novo (o slice(0, 2_000)).
  const local = { historyLogs: [{ id: 'log-novo', descricao: 'novo' }] };
  const publicado = mergeCloudSnapshotsWithBaseline(nuvem, local, baseline) as { historyLogs: { id: string }[] };
  const ids = publicado.historyLogs.map(item => item.id);
  assert.deepEqual(ids, ['log-novo'], 'os três antigos saem do que vai para a nuvem');
});

test('AUDITORIA: sem base, o corte do histórico não apaga nada da nuvem', () => {
  const nuvem = { historyLogs: [{ id: 'log-antigo-0' }] };
  const local = { historyLogs: [{ id: 'log-novo' }] };
  const publicado = mergeCloudSnapshotsWithBaseline(nuvem, local, undefined) as { historyLogs: { id: string }[] };
  assert.deepEqual(publicado.historyLogs.map(i => i.id).sort(), ['log-antigo-0', 'log-novo']);
});

test('AUDITORIA: aparelho em dia publica o próprio retrato, corte incluído, sem mesclar', () => {
  const local = { historyLogs: [{ id: 'log-novo' }] };
  const publicado = resolvePublishPayload({
    localPayload: local,
    remoteSnapshot: { historyLogs: [{ id: 'log-antigo-0' }, { id: 'log-novo' }] },
    remoteUpdatedAt: 'v1',
    knownCloudVersion: 'v1',
    baseline: undefined,
  }) as { historyLogs: { id: string }[] };
  assert.deepEqual(publicado.historyLogs.map(i => i.id), ['log-novo'], 'o antigo some sem passar por mesclagem');
});
