import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migrationUrl = new URL('../supabase/migrations/202607310001_v2_1_foundation.sql', import.meta.url);
const migration = readFileSync(migrationUrl, 'utf8');

const requiredTables = [
  'organizations',
  'app_users',
  'companies',
  'locations',
  'work_branches',
  'equipment',
  'vehicles',
  'collaborators',
  'suppliers',
  'materials',
  'convoys',
  'fuel_types',
  'lubricant_products',
  'service_stages',
  'import_batches',
  'import_rows',
  'import_issues',
  'audit_events',
];

requiredTables.forEach(tableName => {
  assert.match(migration, new RegExp(`create table if not exists public\\.${tableName}\\b`));
  assert.match(migration, new RegExp(`alter table public\\.${tableName} enable row level security`));
});

assert.match(migration, /create or replace function public\.ingest_import_batch/);
assert.match(migration, /jsonb_array_elements\(p_rows\) with ordinality/);
assert.match(migration, /item\.ordinality::integer/);
assert.match(migration, /Preserva cada linha bruta recebida/);
assert.match(migration, /create or replace function public\.audit_row_change/);
assert.match(migration, /create or replace view public\.master_data_catalog/);
assert.doesNotMatch(migration, /drop table/i);
assert.doesNotMatch(migration, /truncate table/i);
