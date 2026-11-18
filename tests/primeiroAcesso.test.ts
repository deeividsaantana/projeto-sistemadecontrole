import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { substituirClienteSupabase, stableHash } from '../api/_shared/supabase-admin.js';
import { criarLinkDePrimeiroAcesso, handler, problemaDaSenha, senhaQueNinguemSabe } from '../api/primeiro-acesso.js';
import { getPrimeiroAcessoTokenFromUrl, isContratacaoLinkUrl, isPrimeiroAcessoUrl, isPublicLinkUrl } from '../src/app/routing/publicRoutes';
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

test('primeiro acesso: a pessoa cria a própria senha uma vez só e o banco guarda só o resumo do código', async () => {
  const banco = bancoFalso();
  await comBanco(banco, async () => {
    const codigo = await criarLinkDePrimeiroAcesso({ organizationId: 'renea', userId: PESSOA, createdBy: 'dono' });
    assert.match(codigo, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(banco.linhas.length, 1);
    assert.equal(banco.linhas[0].token_hash, stableHash(codigo));
    assert.equal(JSON.stringify(banco.linhas).includes(codigo), false, 'o código não fica no banco');
    const dias = (Date.parse(String(banco.linhas[0].expires_at)) - Date.parse(String(banco.linhas[0].created_at))) / 86_400_000;
    assert.equal(dias, 7);

    const visto = await chamar({ action: 'ver', token: codigo });
    assert.equal(visto.status, 200);
    assert.deepEqual(visto.corpo.data, { nome: 'Ana Souza', email: 'ana@obra.com' });

    assert.equal((await chamar({ action: 'criar', token: codigo, senha: 'obra2026', repetida: 'obra2027' })).status, 422, 'as duas precisam ser iguais');
    assert.equal(banco.linhas[0].used_at, null, 'senha recusada não gasta o link');
    const criada = await chamar({ action: 'criar', token: codigo, senha: 'obra2026', repetida: 'obra2026' });
    assert.equal(criada.status, 200);
    assert.deepEqual(banco.senhas, ['obra2026']);
    assert.ok(banco.linhas[0].used_at);

    assert.equal((await chamar({ action: 'criar', token: codigo, senha: 'outra2026', repetida: 'outra2026' })).status, 410, 'segunda vez não vale');
    assert.equal((await chamar({ action: 'ver', token: codigo })).status, 410);
    assert.deepEqual(banco.senhas, ['obra2026']);
  });
});

test('primeiro acesso: link vencido, cancelado, inventado ou de login desativado não troca senha', async () => {
  const banco = bancoFalso();
  await comBanco(banco, async () => {
    const antigo = await criarLinkDePrimeiroAcesso({ organizationId: 'renea', userId: PESSOA, createdBy: 'dono' });
    const novo = await criarLinkDePrimeiroAcesso({ organizationId: 'renea', userId: PESSOA, createdBy: 'dono' });
    assert.ok(banco.linhas[0].revoked_at, 'link novo cancela o anterior');
    assert.equal((await chamar({ action: 'criar', token: antigo, senha: 'obra2026', repetida: 'obra2026' })).status, 410);
    banco.linhas[1].expires_at = new Date(Date.now() - 1000).toISOString();
    assert.equal((await chamar({ action: 'criar', token: novo, senha: 'obra2026', repetida: 'obra2026' })).status, 410, 'vencido');
    assert.equal((await chamar({ action: 'ver', token: 'x'.repeat(43) })).status, 410, 'inventado');
    assert.equal((await chamar({ action: 'ver', token: '../../etc' })).status, 410);
    assert.equal((await handler({ httpMethod: 'GET', headers: {}, body: '' })).statusCode, 405, 'só POST: o código não vai no endereço da API');
    assert.deepEqual(banco.senhas, []);
  });
  const desativada = bancoFalso({ desativada: true });
  await comBanco(desativada, async () => {
    const codigo = await criarLinkDePrimeiroAcesso({ organizationId: 'renea', userId: PESSOA, createdBy: 'dono' });
    assert.equal((await chamar({ action: 'criar', token: codigo, senha: 'obra2026', repetida: 'obra2026' })).status, 403);
    assert.deepEqual(desativada.senhas, []);
  });
});

test('primeiro acesso: se o Auth falhar ao gravar, o link volta a valer', async () => {
  const banco = bancoFalso({ falhaAoGravarSenha: true });
  await comBanco(banco, async () => {
    const codigo = await criarLinkDePrimeiroAcesso({ organizationId: 'renea', userId: PESSOA, createdBy: 'dono' });
    assert.equal((await chamar({ action: 'criar', token: codigo, senha: 'obra2026', repetida: 'obra2026' })).status, 500);
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

test('rota /primeiro-acesso abre leve, separada do ERP e dos outros links', () => {
  const codigo = 'A'.repeat(43);
  assert.equal(getPrimeiroAcessoTokenFromUrl({ pathname: `/primeiro-acesso/${codigo}`, search: '' }), codigo);
  assert.equal(getPrimeiroAcessoTokenFromUrl({ pathname: '/primeiro-acesso/curto', search: '' }), '');
  assert.equal(isPrimeiroAcessoUrl({ pathname: '/primeiro-acesso/curto', search: '' }), true, 'link quebrado mostra "link sem validade"');
  assert.equal(isPrimeiroAcessoUrl({ pathname: '/', search: '' }), false);
  assert.equal(isPublicLinkUrl({ pathname: `/primeiro-acesso/${codigo}`, search: '' }), false);
  assert.equal(isContratacaoLinkUrl({ pathname: `/primeiro-acesso/${codigo}`, search: '' }), false);
  const servidor = fs.readFileSync('server/index.js', 'utf8');
  assert.match(servidor, /\$\{prefix\}\/primeiro-acesso`, toExpressHandler\(primeiroAcesso\)/);
});

test('banco: links de primeiro acesso só para a API, com RLS e sem senha guardada', () => {
  const sql = fs.readFileSync('supabase/migrations/202611180002_primeiro_acesso_cria_senha.sql', 'utf8');
  assert.match(sql, /alter table public\.erp_first_access_links enable row level security/);
  assert.match(sql, /revoke all on public\.erp_first_access_links from public, anon, authenticated/);
  assert.doesNotMatch(sql, /grant[^;]*to (anon|authenticated)/);
  assert.doesNotMatch(sql, /password|senha text/i);
  assert.match(sql, /token_hash text primary key/);
});

test('ninguém digita senha ao criar login: Dev e Cadastros mandam o link', () => {
  const usuarios = fs.readFileSync('src/components/UsuariosTab.tsx', 'utf8');
  const dev = fs.readFileSync('src/components/DevTab.tsx', 'utf8');
  const masterData = fs.readFileSync('api/master-data.js', 'utf8');
  assert.doesNotMatch(usuarios, /Senha temporária|form\.password/);
  assert.doesNotMatch(dev, /senhaMostrada|Gerar senha temporária/);
  assert.match(usuarios, /<LinkDePrimeiroAcesso/);
  assert.match(dev, /<LinkDePrimeiroAcesso/);
  assert.doesNotMatch(masterData, /body\.password/);
  assert.match(masterData, /password: senhaQueNinguemSabe\(\)/);
});
