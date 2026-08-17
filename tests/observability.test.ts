import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createApiRequestContext,
  sanitizeLogDetails,
  withApiTelemetry,
} from '../netlify/functions/_shared/observability.js';

test('observabilidade preserva request id existente e anonimiza origem por hash', () => {
  const context = createApiRequestContext({
    httpMethod: 'post',
    path: '/.netlify/functions/master-data',
    headers: {
      'x-request-id': 'req-operacional-123',
      'x-forwarded-for': '192.168.0.10, proxy',
    },
  }, 'master-data');

  assert.equal(context.requestId, 'req-operacional-123');
  assert.equal(context.method, 'POST');
  assert.equal(context.functionName, 'master-data');
  assert.equal(context.ipHash.length, 24);
  assert.notEqual(context.ipHash, '192.168.0.10');
});

test('observabilidade redige detalhes sensiveis antes de logar', () => {
  const details = sanitizeLogDetails({
    authorization: 'Bearer segredo',
    apiKey: 'abc',
    statusCode: 500,
    message: 'falha operacional',
  });

  assert.equal(details.authorization, '[redacted]');
  assert.equal(details.apiKey, '[redacted]');
  assert.equal(details.statusCode, 500);
  assert.equal(details.message, 'falha operacional');
});

test('telemetria injeta X-Request-Id na resposta da function', async () => {
  const originalInfo = console.info;
  const logs: string[] = [];
  console.info = (message?: unknown) => {
    logs.push(String(message));
  };
  try {
    const response = await withApiTelemetry({
      httpMethod: 'GET',
      path: '/.netlify/functions/master-data',
      headers: { 'x-request-id': 'req-telemetria-1' },
    }, 'master-data', async () => ({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }));

    assert.equal(response.headers['X-Request-Id'], 'req-telemetria-1');
    assert.equal(logs.length, 2);
    assert.match(logs[0], /api\.request\.started/);
    assert.match(logs[1], /api\.request\.finished/);
  } finally {
    console.info = originalInfo;
  }
});
