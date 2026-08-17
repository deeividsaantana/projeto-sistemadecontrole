import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAuditRecord,
  changedAuditFields,
  sanitizeAuditValue,
} from '../netlify/functions/_shared/audit-log.js';

test('auditoria redige campos sensiveis e limita listas grandes', () => {
  const result = sanitizeAuditValue({
    nome: 'Cadastro',
    password: 'segredo',
    tokenPublico: 'token',
    linhas: Array.from({ length: 30 }, (_, index) => ({ index })),
  }) as Record<string, unknown>;

  assert.equal(result.password, '[redacted]');
  assert.equal(result.tokenPublico, '[redacted]');
  assert.equal(Array.isArray(result.linhas), true);
  assert.equal((result.linhas as unknown[]).length, 26);
  assert.deepEqual((result.linhas as unknown[]).at(-1), { truncatedItems: 5 });
});

test('auditoria calcula campos alterados de forma estavel', () => {
  assert.deepEqual(
    changedAuditFields({ nome: 'A', ativo: true }, { nome: 'B', ativo: true, codigo: '01' }),
    ['codigo', 'nome'],
  );
});

test('auditoria inclui usuario, perfil e request id no registro', () => {
  const record = buildAuditRecord({
    organizationId: 'renea',
    userId: 'usuario-1',
    role: 'admin',
    requestId: 'req-audit-1',
    staff: { email: 'ADMIN@EXEMPLO.COM' },
  }, 'UPDATE', 'equipment', 'eq-1', { nome: 'A' }, { nome: 'B' }, { origem: 'teste' });

  assert.equal(record.organizationId, 'renea');
  assert.equal(record.userEmail, 'admin@exemplo.com');
  assert.equal(record.userRole, 'admin');
  assert.equal(record.requestId, 'req-audit-1');
  assert.deepEqual(record.changedFields, ['nome']);
});
