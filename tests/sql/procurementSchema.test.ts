import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const migration = fs.readFileSync('supabase/migrations/202611130001_procurement_core.sql', 'utf8');

test('schema de compras tem tabelas canônicas e constraints de quantidade', () => {
  for (const tabela of ['erp_requests', 'erp_request_items', 'erp_purchase_orders', 'erp_logistics_tracking', 'erp_audit_trail']) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${tabela}`));
  }
  assert.match(migration, /quantity_requested numeric\([^)]*\) not null check \(quantity_requested > 0\)/i);
  assert.match(migration, /version integer not null default 1/i);
});

test('auditoria de compras é append-only e bloqueia update/delete', () => {
  assert.match(migration, /erp_audit_trail.*append-only|append-only.*erp_audit_trail/is);
  assert.match(migration, /raise exception .*audit|auditoria.*imut[aá]vel/is);
});

test('criação de solicitação e auditoria ocorrem na mesma função SQL', () => {
  assert.match(migration, /create or replace function public\.create_erp_request/is);
  assert.match(migration, /insert into public\.erp_requests/is);
  assert.match(migration, /insert into public\.erp_audit_trail/is);
  assert.match(migration, /returns public\.erp_requests/is);
});

test('recebimento persiste logística e exige conciliação da NF', () => {
  assert.match(migration, /insert into public\.erp_logistics_tracking/is);
  assert.match(migration, /invoice_number.*destination_type.*quantity_received/is);
  assert.match(migration, /quantity_received.*quantity_requested/is);
});
