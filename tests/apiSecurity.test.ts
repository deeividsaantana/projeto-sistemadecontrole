import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertHttpMethod,
  assertIdempotencyKey,
  assertValidEntityId,
  extractBearerToken,
  mergeSecurityHeaders,
  optionsResponse,
} from '../netlify/functions/_shared/api-security.js';

test('extrai token bearer sem aceitar autorizacao ausente', () => {
  assert.equal(extractBearerToken({ headers: { authorization: 'Bearer token-seguro' } }), 'token-seguro');
  assert.equal(extractBearerToken({ headers: { Authorization: 'bearer outro-token' } }), 'outro-token');
  assert.equal(extractBearerToken({ headers: { authorization: 'Basic abc' } }), '');
  assert.equal(extractBearerToken({ headers: {} }), '');
});

test('aplica headers defensivos padrao nas respostas da API', () => {
  const headers = mergeSecurityHeaders({ 'Cache-Control': 'no-store' });
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.equal(headers['Referrer-Policy'], 'no-referrer');
  assert.equal(headers['Permissions-Policy'], 'camera=(), microphone=(), geolocation=()');
  assert.equal(headers['Cache-Control'], 'no-store');
});

test('responde preflight sem exigir autenticacao', () => {
  const response = optionsResponse(['GET', 'POST', 'OPTIONS']);
  const headers = response.headers as Record<string, string>;
  assert.equal(response.statusCode, 204);
  assert.equal(headers.Allow, 'GET, POST, OPTIONS');
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.equal(response.body, '');
});

test('bloqueia metodo fora do contrato com allow header', () => {
  assert.equal(assertHttpMethod({ httpMethod: 'GET' }, ['GET', 'POST']), 'GET');
  assert.throws(
    () => assertHttpMethod({ httpMethod: 'PUT' }, ['GET', 'POST']),
    (error: Error & { statusCode?: number; headers?: Record<string, string> }) => (
      error.statusCode === 405 && error.headers?.Allow === 'GET, POST'
    ),
  );
});

test('valida chave de idempotencia opcional para operacoes mutaveis', () => {
  assert.equal(assertIdempotencyKey({ headers: {} }), '');
  assert.equal(
    assertIdempotencyKey({ headers: { 'x-idempotency-key': 'operacao:cadastro-123' } }),
    'operacao:cadastro-123',
  );
  assert.throws(
    () => assertIdempotencyKey({ headers: { 'x-idempotency-key': 'curta' } }),
    (error: Error & { statusCode?: number }) => error.statusCode === 400,
  );
});

test('valida identificadores usados em paths do Firestore', () => {
  assert.equal(assertValidEntityId('renea_2026-obra'), 'renea_2026-obra');
  assert.throws(
    () => assertValidEntityId('../outra-colecao'),
    (error: Error & { statusCode?: number }) => error.statusCode === 400,
  );
  assert.throws(
    () => assertValidEntityId(''),
    (error: Error & { statusCode?: number }) => error.statusCode === 400,
  );
});
