import assert from 'node:assert/strict';
import test from 'node:test';
import { loadCloudSnapshot, selecaoDoRetrato } from '../api/_shared/cloud-snapshot.js';

const fakeClient = (row: unknown, chamadas: string[] = []) => ({
  from(tabela: string) {
    chamadas.push(`from:${tabela}`);
    const consulta = {
      select(colunas: string) { chamadas.push(`select:${colunas}`); return consulta; },
      eq(coluna: string, valor: string) { chamadas.push(`eq:${coluna}=${valor}`); return consulta; },
      maybeSingle: async () => ({ data: row, error: null }),
    };
    return consulta;
  },
});

test('links de campo leem as chaves pedidas do retrato publicado pelo app', async () => {
  const chamadas: string[] = [];
  const snapshot = await loadCloudSnapshot(null, ['gruposEquipe', 'funcionarios'], {
    cacheTtlMs: 0,
    client: fakeClient({ funcionarios: [{ id: 'f1' }], gruposEquipe: [{ id: 'g1', token: 't' }] }, chamadas),
  });
  assert.deepEqual(snapshot, { funcionarios: [{ id: 'f1' }], gruposEquipe: [{ id: 'g1', token: 't' }] });
  assert.ok(chamadas.includes('from:erp_snapshots'));
  assert.ok(chamadas.includes('select:funcionarios:payload->funcionarios,gruposEquipe:payload->gruposEquipe'));
  assert.ok(chamadas.includes('eq:organization_id=renea'));
});

test('chave ausente no retrato some da resposta em vez de virar lista inventada', async () => {
  const snapshot = await loadCloudSnapshot(null, ['etapas', 'materiaisCadastro'], {
    cacheTtlMs: 0,
    client: fakeClient({ etapas: null, materiaisCadastro: [{ id: 'm1' }] }),
  });
  assert.deepEqual(snapshot, { materiaisCadastro: [{ id: 'm1' }] });
});

test('sem retrato na nuvem devolve vazio', async () => {
  const snapshot = await loadCloudSnapshot(null, ['obras'], { cacheTtlMs: 0, client: fakeClient(null) });
  assert.deepEqual(snapshot, {});
});

test('nome de tabela estranho não entra na consulta', () => {
  assert.throws(() => selecaoDoRetrato(['obras,payload']));
  assert.equal(selecaoDoRetrato(null), 'payload');
});
