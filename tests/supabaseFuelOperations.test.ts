import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/202607310004_v2_4_fuel_operations.sql'),
  'utf8',
);
const gateway = fs.readFileSync(path.join(root, 'netlify/functions/master-data.js'), 'utf8');
const contract = fs.readFileSync(path.join(root, 'netlify/functions/_shared/master-data-contract.js'), 'utf8');

test('v2.4 cria operação canônica e fila de revisão sem promoção automática', () => {
  assert.match(migration, /create table if not exists public\.fueling_events/i);
  assert.match(migration, /create table if not exists public\.fuel_review_items/i);
  assert.match(migration, /create or replace function public\.stage_fuel_import/i);
  assert.match(migration, /promotion', 'manual_only'/i);
  assert.doesNotMatch(migration, /insert into public\.fueling_events[\s\S]*stage_fuel_import/i);
});

test('competência, custo e capacidade ficam estruturados no PostgreSQL', () => {
  assert.match(migration, /competence date generated always/i);
  assert.match(migration, /cost_per_liter numeric/i);
  assert.match(migration, /tank_capacity_liters numeric/i);
  assert.match(migration, /fuel_review_summary/i);
});

test('gateway autentica e encaminha lotes completos para a RPC v2.4', () => {
  assert.match(contract, /sanitizeFuelImportRequest/);
  assert.match(gateway, /body\.action === 'stage-fuel-import'/);
  assert.match(gateway, /rpc\/stage_fuel_import/);
});
