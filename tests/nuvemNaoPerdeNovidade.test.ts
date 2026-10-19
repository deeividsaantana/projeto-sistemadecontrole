import assert from 'node:assert/strict';
import test from 'node:test';
import { manterNovidadesLocais } from '../src/cloud/novidadesLocais';
import { resolvePublishPayload } from '../src/cloudMerge';

test('C5: download mantém o que este aparelho criou e ainda não subiu', () => {
  const base = { equipamentos: ['eq-1', 'eq-2'] };
  const nuvem = { equipamentos: [{ id: 'eq-1' }, { id: 'eq-3' }] };
  const local = { equipamentos: [{ id: 'eq-1' }, { id: 'eq-2' }, { id: 'eq-novo' }] };
  const { retrato, mantidas } = manterNovidadesLocais(nuvem, local, base);
  const ids = (retrato.equipamentos as { id: string }[]).map(item => item.id).sort();
  assert.deepEqual(ids, ['eq-1', 'eq-3', 'eq-novo'], 'eq-2 foi apagado por outro aparelho e sai; eq-novo fica');
  assert.deepEqual(mantidas, [{ tabela: 'equipamentos', mantidos: 1 }]);
});

test('C5: sem base da última sincronização nada local é mantido', () => {
  const nuvem = { equipamentos: [{ id: 'eq-1' }] };
  const local = { equipamentos: [{ id: 'eq-velho' }] };
  const { retrato, mantidas } = manterNovidadesLocais(nuvem, local, undefined);
  assert.equal(retrato, nuvem);
  assert.equal(mantidas.length, 0);
});

test('C5: novidade local com marca de exclusão não volta', () => {
  const base = { equipamentos: [], exclusoes: [] };
  const nuvem = {
    equipamentos: [],
    exclusoes: [{ id: 'x1', tabela: 'equipamentos', registroId: 'eq-novo', excluidoEm: '2026-10-18T10:00:00.000Z', excluidoPor: 'Deivid' }],
  };
  const local = { equipamentos: [{ id: 'eq-novo' }] };
  const { retrato } = manterNovidadesLocais(nuvem, local, base);
  assert.deepEqual(retrato.equipamentos, []);
});

test('C6: envio com histórico vazio não apaga o histórico da nuvem', () => {
  const publicado = resolvePublishPayload({
    localPayload: { historyLogs: [], equipamentos: [{ id: 'eq-1' }] },
    remoteSnapshot: { historyLogs: [{ id: 'log-1' }, { id: 'log-2' }], equipamentos: [{ id: 'eq-1' }] },
    remoteUpdatedAt: '2026-10-18T10:00:00.000Z',
    knownCloudVersion: '2026-10-18T10:00:00.000Z',
  });
  assert.deepEqual((publicado.historyLogs as { id: string }[]).map(item => item.id), ['log-1', 'log-2']);
});

test('C6: na versão conhecida, apagar equipamento e presença continua valendo', () => {
  const publicado = resolvePublishPayload({
    localPayload: { equipamentos: [{ id: 'eq-1' }], presencasLink: [] },
    remoteSnapshot: { equipamentos: [{ id: 'eq-1' }, { id: 'eq-2' }], presencasLink: [{ id: 'p1' }] },
    remoteUpdatedAt: '2026-10-18T10:00:00.000Z',
    knownCloudVersion: '2026-10-18T10:00:00.000Z',
  });
  assert.deepEqual(publicado.equipamentos, [{ id: 'eq-1' }]);
  assert.deepEqual(publicado.presencasLink, []);
});
