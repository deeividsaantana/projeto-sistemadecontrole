import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const migration = read('supabase/migrations/202610080001_enable_public_submissions_realtime.sql');
assert.match(
  migration,
  /create table if not exists public\.erp_public_submissions/i,
  'a migration de recuperação precisa restaurar a fila quando a migration anterior não foi aplicada',
);
assert.match(
  migration,
  /alter publication supabase_realtime add table public\.erp_public_submissions/i,
  'envios públicos precisam fazer parte da publicação Realtime',
);

const gateway = read('src/cloud/cloudSyncGateway.ts');
assert.match(
  gateway,
  /typeof error === 'object' && error && 'message' in error/,
  'erros estruturados do Supabase precisam preservar a mensagem para o alerta',
);
