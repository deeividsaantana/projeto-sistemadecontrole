import assert from 'node:assert/strict';
import test from 'node:test';
import { roleFromMembership } from '../src/app/navigation/navigation';
import { appRoleFor, membershipRoleFor } from '../api/_shared/supabase-admin.js';

const PERFIS = ['admin', 'gestor', 'operador', 'leitura'] as const;

test('o perfil escolhido ao criar o usuário volta igual no login, no app e na API', () => {
  for (const perfil of PERFIS) {
    const noBanco = membershipRoleFor(perfil);
    assert.ok(['admin', 'editor', 'viewer'].includes(noBanco), `${perfil} vira ${noBanco}, fora do que o banco aceita`);
    assert.equal(roleFromMembership(noBanco, perfil), perfil);
    assert.equal(appRoleFor(noBanco, perfil), perfil);
  }
});

test('gestor e operador gravam como editor, que é o que o banco deixa salvar na nuvem', () => {
  assert.equal(membershipRoleFor('gestor'), 'editor');
  assert.equal(membershipRoleFor('operador'), 'editor');
  assert.equal(membershipRoleFor('leitura'), 'viewer');
});

test('editor antigo, sem perfil guardado, entra como gestor e não como só leitura', () => {
  assert.equal(roleFromMembership('editor'), 'gestor');
  assert.equal(roleFromMembership('viewer'), 'leitura');
  assert.equal(roleFromMembership('admin'), 'admin');
});
