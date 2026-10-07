import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildRequestHash } from '../api/_shared/idempotency.js';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('o app chama a API em /api/ e não no endereço antigo', () => {
  for (const file of ['src/publicApi.ts', 'src/services/masterDataApi.ts', 'src/usageTelemetry.ts']) {
    const source = read(file);
    assert.match(source, /'\/api\/|`\/api\//, file);
    assert.doesNotMatch(source, /\.netlify\/functions/, file);
  }
});

test('o servidor da Render atende /api/ e mantém o endereço antigo', () => {
  const server = read('server/index.js');
  assert.match(server, /for \(const prefix of \['\/api', '\/\.netlify\/functions'\]\)/);
  for (const route of ['public-presenca', 'public-tickets', 'master-data', 'usage-telemetry']) {
    assert.match(server, new RegExp(`\\$\\{prefix\\}/${route}`), route);
  }
});

test('repetir um envio pelo endereço novo reaproveita a idempotência do antigo', () => {
  const body = JSON.stringify({ nome: 'Teste' });
  assert.equal(
    buildRequestHash({ httpMethod: 'POST', path: '/api/master-data', body }),
    buildRequestHash({ httpMethod: 'POST', path: '/.netlify/functions/master-data', body }),
  );
});
