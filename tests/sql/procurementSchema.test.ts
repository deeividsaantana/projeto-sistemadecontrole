import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const migration = fs.readFileSync('supabase/migrations/202611130001_procurement_core.sql', 'utf8');

test('schema de compras tem tabelas canônicas e constraints de quantidade', () => {
  for (const tabela of ['erp_requests', 'erp_purchase_orders', 'erp_logistics_tracking', 'erp_audit_trail']) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${tabela}`));
  }
  assert.match(migration, /quantity_requested numeric\([^)]*\) not null check \(quantity_requested > 0\)/i);
  assert.match(migration, /version integer not null default 1/i);
});

test('auditoria de compras é append-only e bloqueia update/delete', () => {
  assert.match(migration, /erp_audit_trail.*append-only|append-only.*erp_audit_trail/is);
  assert.match(migration, /raise exception .*audit|auditoria.*imut[aá]vel/is);
});
