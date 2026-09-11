import assert from 'node:assert/strict';
import test from 'node:test';
import { captureCloudBaseline, mergeCloudSnapshotsWithBaseline } from '../src/cloudMerge';

test('o corte de 2.000 do histórico não apaga da nuvem o que o colega lançou', () => {
  // A nuvem tem o histórico de dois aparelhos.
  const doColega = Array.from({ length: 3 }, (_, i) => ({ id: `log-colega-${i}`, descricao: 'lançado pelo colega' }));
  const meus = Array.from({ length: 2 }, (_, i) => ({ id: `log-meu-${i}`, descricao: 'lançado por mim' }));
  const nuvem = { historyLogs: [...meus, ...doColega] };

  // Este aparelho baixou tudo: essa é a base.
  const baseline = captureCloudBaseline(nuvem);

  // Salvo algo novo. saveAndLog corta em 2.000 — aqui simulo o corte deixando
  // só o que é meu, que é o que sobra quando o limite estoura.
  const local = { historyLogs: [{ id: 'log-novo', descricao: 'acabei de salvar' }, ...meus] };

  const publicado = mergeCloudSnapshotsWithBaseline(nuvem, local, baseline) as { historyLogs: { id: string }[] };
  const ids = publicado.historyLogs.map(item => item.id);
  for (const registro of doColega) {
    assert.ok(ids.includes(registro.id), `${registro.id} sumiu da nuvem por causa do corte local`);
  }
  assert.ok(ids.includes('log-novo'), 'o evento novo também é publicado');
  assert.equal(new Set(ids).size, ids.length, 'sem duplicata');
});

test('exclusão de verdade em outras tabelas continua valendo', () => {
  const nuvem = { equipamentos: [{ id: 'eq-1' }, { id: 'eq-2' }] };
  const baseline = captureCloudBaseline(nuvem);
  const local = { equipamentos: [{ id: 'eq-1' }] };
  const publicado = mergeCloudSnapshotsWithBaseline(nuvem, local, baseline) as { equipamentos: { id: string }[] };
  assert.deepEqual(publicado.equipamentos.map(item => item.id), ['eq-1'], 'apagar um equipamento continua apagando');
});
