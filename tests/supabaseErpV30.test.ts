import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrations = [
  '202607310006_v2_6_stake_operations.sql',
  '202607310007_v2_7_executive_analytics.sql',
  '202607310008_v2_8_reporting_snapshots.sql',
  '202607310009_v3_0_document_intelligence.sql',
].map(name => readFileSync(resolve('supabase/migrations', name), 'utf8'));

test('migrações 2.6 a 3.0 não contêm comandos destrutivos', () => {
  const sql = migrations.join('\n').toLowerCase();
  assert.equal(/\bdrop\s+table\b/.test(sql), false);
  assert.equal(/\btruncate\b/.test(sql), false);
  assert.equal(/\bdelete\s+from\b/.test(sql), false);
});

test('migrações incluem estacas, snapshots, auditoria e RLS', () => {
  const sql = migrations.join('\n').toLowerCase();
  assert.match(sql, /stake_lots/);
  assert.match(sql, /stake_drivings/);
  assert.match(sql, /reporting_snapshots/);
  assert.match(sql, /document_analysis_audit/);
  assert.equal((sql.match(/enable row level security/g) || []).length >= 4, true);
});
