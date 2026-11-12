import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { CORES_AVATAR, corPeloNome, iniciaisDoNome, pessoaPeloNome } from '../src/utils/avatar';
import { cartaoDaPessoa, sanitizeAvatarPhoto, sanitizeUserProfile } from '../api/master-data.js';
import { getAdminAuth, substituirClienteSupabase } from '../api/_shared/supabase-admin.js';

test('iniciais: primeiro e último nome, sem acento quebrar nada', () => {
  assert.equal(iniciaisDoNome('Deivid Brandão De Souza Santana'), 'DS');
  assert.equal(iniciaisDoNome('Ângela'), 'ÂN');
  assert.equal(iniciaisDoNome('  '), '?');
});

test('quem não escolheu cor ganha sempre a mesma, e ela é da paleta', () => {
  const cor = corPeloNome('Aline Lima');
  assert.equal(corPeloNome('Aline Lima'), cor);
  assert.ok(CORES_AVATAR.some(opcao => opcao.valor === cor));
});

test('o lançamento acha a pessoa pelo nome, sem ligar para acento ou caixa', () => {
  const pessoas = [{ nome: 'José da Silva Costa', foto: 'x' }, { nome: 'Aline Lima', foto: null }];
  assert.equal(pessoaPeloNome(pessoas, 'jose da silva costa')?.foto, 'x');
  assert.equal(pessoaPeloNome(pessoas, 'Fulano'), undefined);
  assert.equal(pessoaPeloNome(pessoas, ''), undefined);
});

test('a foto de perfil só entra se for imagem pequena; vazio apaga', () => {
  assert.equal(sanitizeAvatarPhoto(''), null);
  assert.equal(sanitizeAvatarPhoto(undefined), null);
  const pequena = 'data:image/jpeg;base64,' + 'A'.repeat(8000);
  assert.equal(sanitizeAvatarPhoto(pequena), pequena);
  assert.throws(() => sanitizeAvatarPhoto('data:image/jpeg;base64,' + 'A'.repeat(90_000)), /imagem pequena/);
  assert.throws(() => sanitizeAvatarPhoto('data:text/html;base64,PHNjcmlwdD4='), /imagem pequena/);
  assert.throws(() => sanitizeAvatarPhoto('https://exemplo.com/foto.jpg'), /imagem pequena/);
});

test('editar outro campo do usuário não apaga a foto que já estava guardada', () => {
  const guardado = { avatarPhoto: 'data:image/jpeg;base64,QUJD', avatarColor: '#1d4ed8' };
  const perfil = sanitizeUserProfile({ ...guardado, ...JSON.parse(JSON.stringify({ role: 'gestor', avatarPhoto: undefined })) });
  assert.equal(perfil.avatarPhoto, guardado.avatarPhoto);
  assert.equal(perfil.avatarColor, '#1d4ed8');
});

test('o cartão da pessoa usa o nome completo, a cor e a foto', () => {
  assert.deepEqual(
    cartaoDaPessoa({ userId: 'u1', fullName: 'Aline Lima', profileName: 'Li', avatarColor: '#6d28d9', avatarPhoto: null }),
    { userId: 'u1', nome: 'Aline Lima', cor: '#6d28d9', foto: null },
  );
});

test('trocar o nome vai para o login e não desbloqueia quem está inativo', async () => {
  const chamadas: Array<Record<string, unknown>> = [];
  substituirClienteSupabase({
    auth: { admin: {
      getUserById: async () => ({ data: { user: { id: 'u1', user_metadata: { full_name: 'Velho', outro: 1 } } }, error: null }),
      updateUserById: async (_id: string, mudancas: Record<string, unknown>) => { chamadas.push(mudancas); return { data: { user: { id: 'u1', user_metadata: {} } }, error: null }; },
    } },
  });
  try {
    await getAdminAuth().updateUser('u1', { displayName: 'Novo Nome' });
    assert.deepEqual(chamadas[0], { user_metadata: { full_name: 'Novo Nome', outro: 1 } });
    await getAdminAuth().updateUser('u1', { disabled: true });
    assert.deepEqual(chamadas[1], { ban_duration: '876000h' });
  } finally {
    substituirClienteSupabase(null);
  }
});

test('o topo abre "Meu perfil" e mostra a mesma bolinha do resto do sistema', () => {
  const topo = readFileSync(new URL('../src/app/shell/DesktopTopBar.tsx', import.meta.url), 'utf8');
  assert.match(topo, /onClick=\{onAbrirPerfil\}/);
  assert.match(topo, /<Avatar /);
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /<MeuPerfilModal/);
  assert.match(app, /Meu perfil: nome e foto/, 'no celular o perfil fica no menu');
});
