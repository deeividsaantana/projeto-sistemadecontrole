import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migrationUrl = new URL('../supabase/migrations/202607310003_v2_3_equipment_operations.sql', import.meta.url);
const migration = readFileSync(migrationUrl, 'utf8');

[
  'equipment_external_identifiers',
  'equipment_mobilizations',
  'equipment_operator_assignments',
  'equipment_operational_events',
].forEach(tableName => {
  assert.match(migration, new RegExp(`create table if not exists public\\.${tableName}\\b`));
  assert.match(migration, new RegExp(`alter table public\\.${tableName} enable row level security`));
});

assert.match(migration, /add column if not exists fleet_kind/);
assert.match(migration, /add column if not exists external_sge_code/);
assert.match(migration, /add column if not exists availability_target/);
assert.match(migration, /create or replace function public\.stage_master_data_import/);
assert.match(migration, /'equipment',\s*'vehicles'/);
assert.match(migration, /create or replace view public\.equipment_operational_overview/);
assert.match(migration, /event_type in \('daily_part', 'maintenance', 'availability', 'status'\)/);
assert.match(migration, /Identificadores externos da frota, incluindo o código SGE/);
assert.doesNotMatch(migration, /drop table/i);
assert.doesNotMatch(migration, /truncate table/i);
