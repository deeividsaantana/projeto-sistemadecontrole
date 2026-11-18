import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { substituirClienteSupabase } from '../api/_shared/supabase-admin.js';
import { handler, liberarCriarSenha, problemaDaSenha, senhaQueNinguemSabe } from '../api/primeiro-acesso.js';
import { regrasDaSenha } from '../src/utils/regrasDaSenha';

const PESSOA = '33333333-3333-4333-8333-333333333333';
type Linha = Record<string, unknown>;

/** Supabase de mentira: a tabela dos links em memória e o Auth com uma pessoa. */
const bancoFalso = ({ desativada = false, falhaAoGravarSenha = false } = {}) => {
  const linhas: Linha[] = [];
  const senhas: string[] = [];
  const consulta = (operacao: 'select' | 'update', mudanca?: Linha) => {
    const filtros: Array<(linha: Linha) => boolean> = [];
    const alvo = () => linhas.filter(linha => filtros.every(filtro => filtro(linha)));
    const executar = () => {
      const achadas = alvo();
      if (operacao === 'update' && mudanca) for (const linha of achadas) Object.assign(linha, mudanca);
      return achadas;
    };
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (campo: string, valor: unknown) => { filtros.push(linha => linha[campo] === valor); return builder; },
      is: (campo: string, valor: unknown) => { filtros.push(linha => (linha[campo] ?? null) === valor); return builder; },
      gt: (campo: string, valor: string) => { filtros.push(linha => String(linha[campo]) > valor); return builder; },
      limit: () => builder,
      maybeSingle: () => Promise.resolve({ data: executar()[0] ?? null, error: null }),
      then: (resolver: (valor: unknown) => unknown) => Promise.resolve({ data: executar(), error: null }).then(resolver),
    };
    return builder;
  };
  return {
    linhas,
    senhas,
    from: () => ({
      select: () => consulta('select'),
      update: (mudanca: Linha) => consulta('update', mudanca),
      insert: async (linha: Linha) => { linhas.push({ used_at: null, revoked_at: null, ...linha }); return { error: null }; },
    }),
    rpc: async () => ({ data: true, error: null }),
    auth: {
      admin: {
        listUsers: async () => ({
          data: { users: [{ id: PESSOA, email: 'ana@obra.com', user_metadata: { full_name: 'Ana Souza' }, app_metadata: {}, banned_until: desativada ? '2999-01-01T00:00:00Z' : null }] },
          error: null,
        }),
        getUserById: async () => ({
          data: { user: { id: PESSOA, email: 'ana@obra.com', user_metadata: { full_name: 'Ana Souza' }, app_metadata: {}, banned_until: desativada ? '2999-01-01T00:00:00Z' : null } },
          error: null,
        }),
        updateUserById: async (_id: string, { password }: { password: string }) => {
          if (falhaAoGravarSenha) return { data: null, error: new Error('Auth fora do ar') };
          senhas.push(password);
          return { data: {}, error: null };
        },
      },
    },
  };
};

const chamar = async (corpo: Record<string, unknown>) => {
  const resposta = await handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify(corpo) });
  return { status: resposta.statusCode, corpo: JSON.parse(resposta.body) };
};

const comBanco = async (banco: ReturnType<typeof bancoFalso>, teste: () => Promise<void>) => {
  substituirClienteSupabase(banco);
  try { await teste(); } finally { substituirClienteSupabase(null); }
};

const liberar = () => liberarCriarSenha({ organizationId: 'renea', userId: PESSOA, createdBy: 'dono' });
const verificar = async (email: string) => (await chamar({ action: 'verificar', email })).corpo.data?.criarSenha;

test('primeiro acesso na entrada: digitou o e-mail sem senha, cria a senha uma vez só', async () => {
  const banco = bancoFalso();
  await comBanco(banco, async () => {
    assert.equal(await verificar('ana@obra.com'), false, 'sem liberação, entra com a senha que tem');
    await liberar();
    assert.equal(banco.linhas.length, 1);
    assert.equal(await verificar(' ANA@obra.com '), true, 'maiúscula e espaço não atrapalham');
    assert.equal(await verificar('outra@obra.com'), false, 'e-mail sem login não cria nada');
    assert.equal((await chamar({ action: 'criar', email: 'ana@obra.com', senha: 'obra2026', repetida: 'obra2027' })).status, 422, 'as duas precisam ser iguais');
    assert.equal(banco.linhas[0].used_at, null, 'senha recusada não fecha a liberação');
    assert.equal((await chamar({ action: 'criar', email: 'ana@obra.com', senha: 'obra2026', repetida: 'obra2026' })).status, 200);
    assert.deepEqual(banco.senhas, ['obra2026']);
    assert.equal(await verificar('ana@obra.com'), false, 'depois de criar, volta a pedir a senha normal');
    assert.equal((await chamar({ action: 'criar', email: 'ana@obra.com', senha: 'outra2026', repetida: 'outra2026' })).status, 409, 'ninguém troca a senha depois');
    assert.deepEqual(banco.senhas, ['obra2026']);
    assert.equal((await chamar({ action: 'verificar', email: 'nao-e-email' })).status, 422);
    assert.equal((await handler({ httpMethod: 'GET', headers: {}, body: '' })).statusCode, 405, 'só POST');
  });
});

test('primeiro acesso: liberar de novo fecha a anterior; login desativado nunca cria senha', async () => {
  const banco = bancoFalso();
  await comBanco(banco, async () => {
    await liberar();
    await liberar();
    assert.ok(banco.linhas[0].revoked_at, 'só fica uma aberta');
    assert.equal(banco.linhas.filter(linha => !linha.revoked_at && !linha.used_at).length, 1);
    assert.equal(await verificar('ana@obra.com'), true);
  });
  const desativada = bancoFalso({ desativada: true });
  await comBanco(desativada, async () => {
    await liberar();
    assert.equal(await verificar('ana@obra.com'), false);
    assert.equal((await chamar({ action: 'criar', email: 'ana@obra.com', senha: 'obra2026', repetida: 'obra2026' })).status, 409);
    assert.deepEqual(desativada.senhas, []);
  });
});

test('primeiro acesso: se o Auth falhar ao gravar, a pessoa pode tentar de novo', async () => {
  const banco = bancoFalso({ falhaAoGravarSenha: true });
  await comBanco(banco, async () => {
    await liberar();
    assert.equal((await chamar({ action: 'criar', email: 'ana@obra.com', senha: 'obra2026', repetida: 'obra2026' })).status, 500);
    assert.equal(banco.linhas[0].used_at, null);
  });
});

test('regras da senha iguais na tela e no servidor', () => {
  const casos: Array<[string, string]> = [['', ''], ['abc123', 'abc123'], ['abcdefgh', 'abcdefgh'], ['12345678', '12345678'], ['obra2026', 'obra2027'], ['obra2026', 'obra2026'], ['a1'.repeat(40), 'a1'.repeat(40)]];
  for (const [senha, repetida] of casos) {
    assert.equal(regrasDaSenha(senha, repetida).every(regra => regra.ok), problemaDaSenha(senha, repetida) === '', `${senha}/${repetida}`);
  }
  assert.notEqual(senhaQueNinguemSabe(), senhaQueNinguemSabe());
  assert.ok(senhaQueNinguemSabe().length >= 40);
});

test('banco: liberações só para a API, com RLS e sem senha guardada', () => {
  const sql = fs.readFileSync('supabase/migrations/202611180002_primeiro_acesso_cria_senha.sql', 'utf8');
  assert.match(sql, /alter table public\.erp_first_access_links enable row level security/);
  assert.match(sql, /revoke all on public\.erp_first_access_links from public, anon, authenticated/);
  assert.doesNotMatch(sql, /grant[^;]*to (anon|authenticated)/);
  assert.doesNotMatch(sql, /password|senha text/i);
});

test('ninguém digita senha ao criar login e não existe mais link de senha', () => {
  const usuarios = fs.readFileSync('src/components/UsuariosTab.tsx', 'utf8');
  const dev = fs.readFileSync('src/components/DevTab.tsx', 'utf8');
  const masterData = fs.readFileSync('api/master-data.js', 'utf8');
  const entrada = fs.readFileSync('src/auth/LoginScreen.tsx', 'utf8');
  const servidor = fs.readFileSync('server/index.js', 'utf8');
  assert.doesNotMatch(usuarios, /Senha temporária|form\.password/);
  assert.doesNotMatch(dev, /senhaMostrada|Gerar senha temporária|gerarLinkDeSenha|LinkDePrimeiroAcesso/);
  assert.match(usuarios, /<AvisoDePrimeiroAcesso/);
  assert.match(dev, /<AvisoDePrimeiroAcesso/);
  assert.doesNotMatch(masterData, /body\.password/);
  assert.match(masterData, /password: senhaQueNinguemSabe\(\)/);
  assert.match(entrada, /usePrecisaCriarSenha\(username\)/);
  const aviso = fs.readFileSync('src/components/perfil/AvisoDePrimeiroAcesso.tsx', 'utf8');
  assert.doesNotMatch(aviso, /href=|wa\.me|location\.origin/, 'nenhum link: a pessoa só entra como sempre');
  assert.match(entrada, /Digite novamente/);
  assert.equal(fs.existsSync('src/PrimeiroAcessoApp.tsx'), false);
  assert.match(servidor, /\$\{prefix\}\/primeiro-acesso`, toExpressHandler\(primeiroAcesso\)/);
});
