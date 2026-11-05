import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

// Lê as migrations na ordem do nome e reconstrói quais políticas ficam de pé no fim.
const pasta = new URL('../supabase/migrations/', import.meta.url);
const migrations = readdirSync(pasta).filter(nome => nome.endsWith('.sql')).sort()
  .map(nome => ({ nome, sql: readFileSync(new URL(nome, pasta), 'utf8').replace(/--[^\n]*/g, '') }));

interface Politica { nome: string; tabela: string; texto: string; migration: string }

const politicasFinais = (): Politica[] => {
  const ativas = new Map<string, Politica>();
  for (const { nome: migration, sql } of migrations) {
    const comandos = [...sql.matchAll(/(create|drop)\s+policy\s+(if\s+exists\s+)?"([^"]+)"\s+on\s+(?:public\.)?([a-z_]+)([^;]*);/gi)];
    for (const [, acao, , nome, tabela, resto] of comandos) {
      const chave = `${tabela}|${nome}`;
      if (acao.toLowerCase() === 'drop') ativas.delete(chave);
      else ativas.set(chave, { nome, tabela, texto: resto.replace(/\s+/g, ' '), migration });
    }
  }
  return [...ativas.values()];
};

const PONTE = ['legacy_documents', 'erp_public_submissions', 'erp_public_tickets'];

test('nenhuma política que sobra depois das migrations libera tudo com using (true) ou with check (true)', () => {
  const abertas = politicasFinais().filter(item => /using\s*\(\s*true\s*\)|with\s+check\s*\(\s*true\s*\)/i.test(item.texto));
  assert.deepEqual(abertas.map(item => `${item.tabela}: "${item.nome}" (${item.migration})`), []);
});

test('legacy_documents é só do servidor: sem política e sem acesso para authenticated e anon', () => {
  assert.deepEqual(politicasFinais().filter(item => item.tabela === 'legacy_documents').map(item => item.nome), []);
  const todo = migrations.map(item => item.sql).join('\n');
  assert.match(todo, /revoke\s+all\s+on\s+(table\s+)?public\.legacy_documents\s+from\s+[^;]*authenticated/i);
  assert.match(todo, /revoke\s+all\s+on\s+(table\s+)?public\.legacy_documents\s+from\s+[^;]*anon/i);
});

test('anon sem acesso às filas e tickets; authenticated não insere nem apaga na fila de envios', () => {
  const todo = migrations.map(item => item.sql).join('\n');
  assert.match(todo, /revoke\s+all\s+on\s+table\s+public\.erp_public_submissions\s+from\s+anon/i);
  assert.match(todo, /revoke\s+all\s+on\s+table\s+public\.erp_public_tickets\s+from\s+anon/i);
  assert.match(todo, /revoke\s+insert,\s*delete,\s*truncate\s+on\s+table\s+public\.erp_public_submissions\s+from\s+authenticated/i);
  assert.match(todo, /revoke\s+truncate\s+on\s+table\s+public\.erp_public_tickets\s+from\s+authenticated/i);
});

test('filas e tickets públicos: membro da organização lê, admin ou editor grava', () => {
  for (const tabela of PONTE.filter(nome => nome !== 'legacy_documents')) {
    const daTabela = politicasFinais().filter(item => item.tabela === tabela);
    const leitura = daTabela.filter(item => /for\s+select/i.test(item.texto));
    assert.ok(leitura.length > 0, `${tabela} precisa de leitura para o tempo real`);
    for (const item of leitura) assert.match(item.texto, /is_organization_member\(\s*organization_id\s*\)/, `${tabela}: "${item.nome}"`);
    const escrita = daTabela.filter(item => !/for\s+select/i.test(item.texto));
    assert.ok(escrita.length > 0, `${tabela} precisa de política de escrita`);
    for (const item of escrita) {
      assert.match(item.texto, /has_organization_role\(\s*organization_id\s*,\s*array\['admin',\s*'editor'\]/, `${tabela}: "${item.nome}"`);
      assert.doesNotMatch(item.texto, /for\s+all/i, `${tabela}: "${item.nome}" não pode ser for all`);
    }
  }
});
