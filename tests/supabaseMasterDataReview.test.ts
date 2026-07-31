import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migrationUrl = new URL('../supabase/migrations/202607310002_v2_2_master_data_review.sql', import.meta.url);
const migration = readFileSync(migrationUrl, 'utf8');

assert.match(migration, /create table if not exists public\.master_data_aliases/);
assert.match(migration, /create table if not exists public\.master_data_review_items/);
assert.match(migration, /create or replace function public\.stage_master_data_import/);
assert.match(migration, /public\.ingest_import_batch/);
assert.match(migration, /on conflict \(organization_id, entity_name, normalized_alias\) do nothing/);
assert.match(migration, /alter table public\.master_data_aliases enable row level security/);
assert.match(migration, /alter table public\.master_data_review_items enable row level security/);
assert.match(migration, /duplicidades e inválidos nunca são promovidos silenciosamente/);
assert.doesNotMatch(migration, /drop table/i);
assert.doesNotMatch(migration, /truncate table/i);
