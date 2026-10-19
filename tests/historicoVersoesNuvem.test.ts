import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(new URL('../supabase/migrations/202610190002_erp_snapshot_history_limite.sql', import.meta.url), 'utf8');

test('A31: gatilho guarda a versão substituída', () => {
  assert.match(migration, /values \(old\.organization_id, old\.version, old\.updated_at/);
  assert.match(migration, /after update on public\.erp_snapshots/);
  assert.match(migration, /new\.record_count < old\.record_count/, 'versão que encolhe sempre fica guardada');
});

test('A31: histórico tem limite para não encher o banco', () => {
  assert.match(migration, /limit 60/);
  assert.match(migration, /interval '45 days'/);
});
