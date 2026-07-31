import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/202607310005_v2_5_travel_operations.sql'),
  'utf8',
);
const gateway = fs.readFileSync(path.join(root, 'netlify/functions/master-data.js'), 'utf8');
const contract = fs.readFileSync(path.join(root, 'netlify/functions/_shared/master-data-contract.js'), 'utf8');

test('v2.5 cria ticket, eventos, divergências e lotes de impressão', () => {
  assert.match(migration, /create table if not exists public\.travel_tickets/i);
  assert.match(migration, /create table if not exists public\.travel_ticket_events/i);
  assert.match(migration, /create table if not exists public\.travel_divergences/i);
  assert.match(migration, /create table if not exists public\.travel_print_batches/i);
  assert.match(migration, /create table if not exists public\.travel_print_batch_items/i);
  assert.match(migration, /create or replace view public\.travel_operation_overview/i);
});

test('ticket canônico referencia os quatro cadastros mestres previstos', () => {
  assert.match(migration, /equipment_id uuid/i);
  assert.match(migration, /material_id uuid/i);
  assert.match(migration, /destination_location_id uuid/i);
  assert.match(migration, /work_branch_id uuid/i);
  assert.match(migration, /duration_minutes/i);
});

test('importação preserva linhas na revisão sem promover automaticamente', () => {
  assert.match(migration, /create table if not exists public\.travel_review_items/i);
  assert.match(migration, /create or replace function public\.stage_travel_import/i);
  assert.match(migration, /promotion', 'manual_only'/i);
  assert.doesNotMatch(migration, /insert into public\.travel_tickets[\s\S]*stage_travel_import/i);
});

test('gateway autentica e encaminha o lote gradual de viagens', () => {
  assert.match(contract, /sanitizeTravelImportRequest/);
  assert.match(gateway, /body\.action === 'stage-travel-import'/);
  assert.match(gateway, /rpc\/stage_travel_import/);
});
