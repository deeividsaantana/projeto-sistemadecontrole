import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('C2: link de tickets e app usam a mesma tabela', () => {
  const api = read('api/public-tickets.js');
  const app = read('src/supabase/tickets.ts');
  assert.match(app, /const table = 'erp_public_tickets'/);
  assert.match(api, /const TICKETS_TABLE = 'erp_public_tickets'/);
  assert.doesNotMatch(api, /sistemarenea_public_tickets/, 'o link não grava mais em legacy_documents');
  assert.match(api, /kind: TICKET_KIND/);
  assert.match(app, /\.eq\('kind', 'ticket_public'\)/);
});

test('C2: a tabela existe no banco e avisa o app em tempo real', () => {
  const migration = read('supabase/migrations/202610190001_erp_public_tickets.sql');
  assert.match(migration, /create table if not exists public\.erp_public_tickets/);
  assert.match(migration, /alter publication supabase_realtime add table public\.erp_public_tickets/);
  assert.match(migration, /enable row level security/);
});

test('C2: número do link não repete número dado pelo escritório', () => {
  const api = read('api/public-tickets.js');
  assert.match(api, /loadCloudSnapshot\(null, \['ticketsJazida'\]/);
});
