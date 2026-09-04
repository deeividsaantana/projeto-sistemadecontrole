import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { mergeCloudSnapshotsWithBaseline, resolvePublishPayload } from '../src/cloudMerge';

const cloudSyncSource = readFileSync(new URL('../src/firebaseCloudSync.ts', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

// Cenário real de dois usuários: o controle de versão do envio (a "geração"
// do manifesto) só percebe quem publica DURANTE o nosso envio. Um aparelho
// que ficou para trás — abriu de manhã, não baixou nada desde então — passava
// direto por essa checagem e publicava o próprio retrato por cima, apagando
// da nuvem tudo que os colegas lançaram no intervalo.

test('aparelho em dia publica exatamente o que tem, sem mesclar nada', () => {
  const local = { ticketsJazida: [{ id: 't1' }], updatedAt: 'x' };
  const resolved = resolvePublishPayload({
    localPayload: local,
    remoteSnapshot: { ticketsJazida: [{ id: 't1' }] },
    remoteUpdatedAt: '2026-09-03T10:00:00.000Z',
    knownCloudVersion: '2026-09-03T10:00:00.000Z',
  });
  assert.equal(resolved, local);
});

test('primeira publicacao (nuvem vazia) sobe o retrato local intacto', () => {
  const local = { ticketsJazida: [{ id: 't1' }] };
  const resolved = resolvePublishPayload({
    localPayload: local,
    remoteSnapshot: null,
    remoteUpdatedAt: '',
    knownCloudVersion: '',
  });
  assert.equal(resolved, local);
});

test('aparelho desatualizado nao apaga o lancamento do colega ao publicar', () => {
  // Usuário B publicou "presenca-b" enquanto o usuário A estava com a tela
  // aberta sem baixar. A agora salva "presenca-a" e envia.
  const remoteSnapshot = {
    presencasLink: [{ id: 'presenca-b' }],
    controleEquipamentosDiario: [{ id: 'frota-b' }],
  };
  const localPayload = {
    presencasLink: [{ id: 'presenca-a' }],
    controleEquipamentosDiario: [{ id: 'frota-a' }],
  };
  const resolved = resolvePublishPayload({
    localPayload,
    remoteSnapshot,
    remoteUpdatedAt: '2026-09-03T12:00:00.000Z',
    knownCloudVersion: '2026-09-03T09:00:00.000Z',
  }) as Record<string, Array<{ id: string }>>;

  assert.deepEqual(
    resolved.presencasLink.map(item => item.id).sort(),
    ['presenca-a', 'presenca-b'],
  );
  assert.deepEqual(
    resolved.controleEquipamentosDiario.map(item => item.id).sort(),
    ['frota-a', 'frota-b'],
  );
});

test('tabela que o aparelho atrasado nem tocou continua vindo da nuvem', () => {
  const resolved = resolvePublishPayload({
    localPayload: { presencasLink: [{ id: 'presenca-a' }] },
    remoteSnapshot: {
      presencasLink: [],
      abastecimentos: [{ id: 'abast-b' }],
    },
    remoteUpdatedAt: '2026-09-03T12:00:00.000Z',
    knownCloudVersion: '',
  }) as Record<string, Array<{ id: string }>>;

  assert.deepEqual(resolved.abastecimentos.map(item => item.id), ['abast-b']);
  assert.deepEqual(resolved.presencasLink.map(item => item.id), ['presenca-a']);
});

test('exclusao feita neste aparelho nao volta por causa da mesclagem', () => {
  // A apagou "frota-2" e ainda não publicou. B publicou outra coisa nesse
  // meio tempo. Sem a base, a mesclagem devolveria "frota-2" para a nuvem.
  const resolved = resolvePublishPayload({
    localPayload: { controleEquipamentosDiario: [{ id: 'frota-1' }] },
    remoteSnapshot: { controleEquipamentosDiario: [{ id: 'frota-1' }, { id: 'frota-2' }] },
    remoteUpdatedAt: '2026-09-03T12:00:00.000Z',
    knownCloudVersion: '2026-09-03T09:00:00.000Z',
    baseline: { controleEquipamentosDiario: ['frota-1', 'frota-2'] },
  }) as Record<string, Array<{ id: string }>>;

  assert.deepEqual(resolved.controleEquipamentosDiario.map(item => item.id), ['frota-1']);
});

test('registro criado pelo colega sobrevive mesmo com base registrada', () => {
  // Mesmo cenário, mas "frota-3" nunca esteve neste aparelho: é novidade do
  // colega, e não pode ser confundida com uma exclusão local.
  const resolved = resolvePublishPayload({
    localPayload: { controleEquipamentosDiario: [{ id: 'frota-1' }] },
    remoteSnapshot: { controleEquipamentosDiario: [{ id: 'frota-1' }, { id: 'frota-3' }] },
    remoteUpdatedAt: '2026-09-03T12:00:00.000Z',
    knownCloudVersion: '2026-09-03T09:00:00.000Z',
    baseline: { controleEquipamentosDiario: ['frota-1'] },
  }) as Record<string, Array<{ id: string }>>;

  assert.deepEqual(
    resolved.controleEquipamentosDiario.map(item => item.id).sort(),
    ['frota-1', 'frota-3'],
  );
});

test('exclusao e criacao simultaneas convivem no mesmo envio', () => {
  const resolved = resolvePublishPayload({
    localPayload: { presencasLink: [{ id: 'p1' }, { id: 'p-novo-aqui' }] },
    remoteSnapshot: { presencasLink: [{ id: 'p1' }, { id: 'p-apagado' }, { id: 'p-novo-colega' }] },
    remoteUpdatedAt: '2026-09-03T12:00:00.000Z',
    knownCloudVersion: '2026-09-03T09:00:00.000Z',
    baseline: { presencasLink: ['p1', 'p-apagado'] },
  }) as Record<string, Array<{ id: string }>>;

  assert.deepEqual(
    resolved.presencasLink.map(item => item.id).sort(),
    ['p-novo-aqui', 'p-novo-colega', 'p1'],
  );
});

test('sem base registrada, preserva tudo em vez de arriscar apagar', () => {
  // Aparelho que nunca concluiu uma sincronização não tem como provar que
  // apagou algo. Nesse caso o comportamento seguro é não apagar nada.
  const resolved = resolvePublishPayload({
    localPayload: { presencasLink: [{ id: 'p1' }] },
    remoteSnapshot: { presencasLink: [{ id: 'p1' }, { id: 'p2' }] },
    remoteUpdatedAt: '2026-09-03T12:00:00.000Z',
    knownCloudVersion: '',
  }) as Record<string, Array<{ id: string }>>;

  assert.deepEqual(resolved.presencasLink.map(item => item.id).sort(), ['p1', 'p2']);
});

test('exclusao feita pelo colega nao volta por causa da copia local antiga', () => {
  // O outro lado da mesma moeda: A apagou "frota-9" e publicou. Este
  // aparelho ainda tem "frota-9" em memória e vai publicar agora.
  const resolved = resolvePublishPayload({
    localPayload: { controleEquipamentosDiario: [{ id: 'frota-1' }, { id: 'frota-9' }] },
    remoteSnapshot: { controleEquipamentosDiario: [{ id: 'frota-1' }] },
    remoteUpdatedAt: '2026-09-03T12:00:00.000Z',
    knownCloudVersion: '2026-09-03T09:00:00.000Z',
    baseline: { controleEquipamentosDiario: ['frota-1', 'frota-9'] },
  }) as Record<string, Array<{ id: string }>>;

  assert.deepEqual(resolved.controleEquipamentosDiario.map(item => item.id), ['frota-1']);
});

test('registro criado aqui sobrevive mesmo faltando no remoto', () => {
  // Não pode ser confundido com "o colega apagou": nunca esteve na base.
  const resolved = resolvePublishPayload({
    localPayload: { controleEquipamentosDiario: [{ id: 'frota-1' }, { id: 'frota-nova' }] },
    remoteSnapshot: { controleEquipamentosDiario: [{ id: 'frota-1' }] },
    remoteUpdatedAt: '2026-09-03T12:00:00.000Z',
    knownCloudVersion: '2026-09-03T09:00:00.000Z',
    baseline: { controleEquipamentosDiario: ['frota-1'] },
  }) as Record<string, Array<{ id: string }>>;

  assert.deepEqual(
    resolved.controleEquipamentosDiario.map(item => item.id).sort(),
    ['frota-1', 'frota-nova'],
  );
});

test('no conflito (dois envios ao mesmo tempo) a exclusao tambem e respeitada', () => {
  // Aqui já se sabe que houve conflito: a mesclagem é incondicional, mas
  // continua sem desfazer a exclusão local nem descartar o dado do colega.
  const merged = mergeCloudSnapshotsWithBaseline(
    { ticketsJazida: [{ id: 't1' }, { id: 't-apagado' }, { id: 't-do-colega' }] },
    { ticketsJazida: [{ id: 't1' }] },
    { ticketsJazida: ['t1', 't-apagado'] },
  ) as Record<string, Array<{ id: string }>>;

  assert.deepEqual(merged.ticketsJazida.map(item => item.id).sort(), ['t-do-colega', 't1']);
});

test('conflito sem base nao apaga nada', () => {
  const merged = mergeCloudSnapshotsWithBaseline(
    { ticketsJazida: [{ id: 't1' }, { id: 't2' }] },
    { ticketsJazida: [{ id: 't1' }] },
    undefined,
  ) as Record<string, Array<{ id: string }>>;

  assert.deepEqual(merged.ticketsJazida.map(item => item.id).sort(), ['t1', 't2']);
});

test('o envio real usa essa protecao, e nao so a checagem de geracao', () => {
  // A checagem de geração sozinha não vê o aparelho que está atrasado desde
  // antes do envio começar. Estas asserções impedem que a proteção volte a
  // ficar só no papel.
  assert.match(cloudSyncSource, /resolvePublishPayload/);
  assert.match(
    cloudSyncSource,
    /uploadWithConflictMerge\(database, data, knownCloudVersion, baseline\)/,
  );
  // E o App precisa informar de fato qual versão este aparelho já baixou,
  // além da base que distingue exclusão local de novidade do colega.
  assert.match(
    appSource,
    /const knownCloudVersion = localStorage\.getItem\('renea_last_cloud_sync_iso'\)/,
  );
  assert.match(appSource, /uploadFirebaseBackup\(\s*db,\s*data,\s*knownCloudVersion,\s*cloudBaselineRef\.current,\s*\)/);
  // A base precisa ser reabastecida nos dois momentos em que este aparelho
  // volta a ficar igual à nuvem: ao publicar e ao baixar.
  assert.match(appSource, /cloudBaselineRef\.current = uploadResult\.publishedBaseline/);
  assert.match(appSource, /cloudBaselineRef\.current = captureCloudBaseline\(data\)/);
  // O caminho de conflito também precisa honrar a base, e não só a
  // pré-checagem — senão a exclusão volta justamente quando há concorrência.
  assert.match(
    cloudSyncSource,
    /mergeCloudSnapshotsWithBaseline\(\s*remote\.data,\s*payload,\s*baseline,\s*\)/,
  );
});

test('edicao mais recente do colega vence a copia velha do aparelho atrasado', () => {
  const resolved = resolvePublishPayload({
    localPayload: {
      controleEquipamentosDiario: [
        { id: 'frota-1', status: 'Disponível', atualizadoEm: '2026-09-03T08:00:00.000Z' },
      ],
    },
    remoteSnapshot: {
      controleEquipamentosDiario: [
        { id: 'frota-1', status: 'Em manutenção', atualizadoEm: '2026-09-03T11:00:00.000Z' },
      ],
    },
    remoteUpdatedAt: '2026-09-03T11:00:00.000Z',
    knownCloudVersion: '2026-09-03T07:00:00.000Z',
  }) as Record<string, Array<{ status: string }>>;

  assert.equal(resolved.controleEquipamentosDiario[0].status, 'Em manutenção');
});
