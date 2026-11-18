import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { substituirClienteSupabase } from '../api/_shared/supabase-admin.js';
import { acoesDoCorpo, handler, senhaTemporaria, travaDoProprioAcesso } from '../api/dev-acessos.js';
import { ROLE_ACCESS } from '../src/app/navigation/navigation';
import {
  abasLiberadas,
  acoesEfetivas,
  motivoDaTrava,
  podeComRegras,
  regrasDasLinhas,
  resumoDasAcoes,
} from '../src/utils/regrasDeAcesso';

const DEV = '11111111-1111-4111-8111-111111111111';
const OUTRO = '22222222-2222-4222-8222-222222222222';

test('a aba Dev só abre para quem o banco marca como dev, nem para outro administrador', () => {
  assert.equal(abasLiberadas('admin', {}, false).includes('dev'), false);
  assert.equal(abasLiberadas('admin', {}, true).includes('dev'), true);
  for (const perfil of ['gestor', 'operador', 'leitura'] as const) assert.equal(ROLE_ACCESS[perfil].includes('dev'), false);
});

test('regras por pessoa: ver, lançar, aprovar e excluir aba por aba; sem regra vale o perfil', () => {
  const regras = regrasDasLinhas([
    { tab: 'estacas', actions: [] },
    { tab: 'lancamentos', actions: ['ver'] },
    { tab: 'cadastros', actions: ['editar'] },
    { tab: 'manutencao', actions: ['ver', 'excluir'] },
    { tab: 'dev', actions: ['ver'] },
    { tab: 'dashboard', actions: [] },
    { tab: 'pluviometro', actions: 'ver' },
  ]);
  assert.deepEqual(regras, {
    estacas: [], lancamentos: ['ver'], cadastros: ['ver', 'editar'], manutencao: ['ver', 'excluir'],
  }, 'Lançar já traz Ver; dev, Visão geral sem Ver e lixo são ignorados');
  const abas = abasLiberadas('operador', regras, false);
  assert.equal(abas.includes('estacas'), false);
  assert.equal(abas.includes('cadastros'), true, 'operador ganha Cadastros quando liberado');
  assert.equal(abas.includes('dashboard'), true);
  assert.equal(podeComRegras('operador', 'lancamentos', 'editar', regras), false, 'só Ver corta o lançamento');
  assert.equal(podeComRegras('operador', 'lancamentos', 'ver', regras), true);
  assert.equal(podeComRegras('operador', 'cadastros', 'editar', regras), true);
  assert.equal(podeComRegras('operador', 'cadastros', 'excluir', regras), false);
  assert.equal(podeComRegras('operador', 'manutencao', 'excluir', regras), true, 'excluir sem lançar é possível');
  assert.equal(podeComRegras('operador', 'manutencao', 'editar', regras), false);
  assert.equal(podeComRegras('operador', 'programacao', 'editar', regras), true, 'sem regra vale o perfil');
  assert.deepEqual(acoesEfetivas('leitura', 'lancamentos', {}), []);
  assert.deepEqual(acoesEfetivas('leitura', 'dashboard', {}), ['ver']);
  assert.deepEqual(acoesEfetivas('admin', 'cadastros', {}), ['ver', 'editar', 'aprovar', 'excluir']);
  assert.equal(resumoDasAcoes([]), '—');
  assert.equal(resumoDasAcoes(['ver', 'editar']), 'Lança');
  assert.equal(resumoDasAcoes(['ver', 'excluir']), 'V·E');
});

test('trava do próprio acesso: não tira aba de si, não sai de admin, não se inativa nem troca a senha aqui', () => {
  assert.ok(motivoDaTrava({ tipo: 'aba', aba: 'estacas', acoes: [] }, true));
  assert.equal(motivoDaTrava({ tipo: 'aba', aba: 'estacas', acoes: ['ver'] }, true), null);
  assert.equal(motivoDaTrava({ tipo: 'aba', aba: 'estacas', acoes: null }, true), null);
  assert.equal(motivoDaTrava({ tipo: 'aba', aba: 'estacas', acoes: [] }, false), null);
  assert.ok(motivoDaTrava({ tipo: 'aba', aba: 'dashboard', acoes: [] }, false));
  assert.ok(motivoDaTrava({ tipo: 'perfil', perfil: 'gestor' }, true));
  assert.ok(motivoDaTrava({ tipo: 'situacao', ativo: false }, true));
  assert.ok(motivoDaTrava({ tipo: 'senha' }, true));
  assert.equal(motivoDaTrava({ tipo: 'senha' }, false), null);
  assert.throws(() => travaDoProprioAcesso({ alvo: DEV, ator: DEV, tipo: 'perfil', valor: 'gestor' }), /Trava de segurança/);
  assert.throws(() => travaDoProprioAcesso({ alvo: DEV, ator: DEV, tipo: 'situacao', valor: 'inativo' }), /Trava de segurança/);
  assert.doesNotThrow(() => travaDoProprioAcesso({ alvo: OUTRO, ator: DEV, tipo: 'situacao', valor: 'inativo' }));
});

test('senha temporária: 12 letras e números sem os que se confundem; ações do corpo são conferidas', () => {
  const senhas = new Set(Array.from({ length: 50 }, () => senhaTemporaria()));
  assert.equal(senhas.size, 50);
  for (const senha of senhas) assert.match(senha, /^(?=.*[a-z])(?=.*[A-Z])(?=.*[2-9])[a-km-np-zA-HJ-NP-Z2-9]{12}$/);
  assert.deepEqual(acoesDoCorpo(['excluir']), ['ver', 'excluir']);
  assert.deepEqual(acoesDoCorpo([]), []);
  assert.equal(acoesDoCorpo(null), null);
  assert.throws(() => acoesDoCorpo(['tudo']), /Ação inválida/);
});

const clienteFalso = (ehDev: boolean) => {
  const chamadas: Array<{ nome: string; args: Record<string, unknown> }> = [];
  const consulta = (linhas: unknown[]) => {
    const builder: Record<string, unknown> = {};
    for (const metodo of ['select', 'eq', 'limit']) builder[metodo] = () => builder;
    builder.maybeSingle = () => Promise.resolve({ data: linhas[0] ?? null, error: null });
    return builder;
  };
  return {
    chamadas,
    auth: { getUser: async () => ({ data: { user: { id: DEV, email: 'd@x', user_metadata: { full_name: 'Dono' }, app_metadata: {} } }, error: null }) },
    from: (tabela: string) => consulta(tabela === 'organization_members' ? [{ organization_id: 'renea', role: 'admin' }] : []),
    rpc: async (nome: string, args: Record<string, unknown>) => {
      chamadas.push({ nome, args });
      if (nome === 'erp_is_dev') return { data: ehDev, error: null };
      return { data: nome === 'erp_dev_panel' ? { people: [] } : 7, error: null };
    },
  };
};
const evento = (method: string, body?: unknown) => ({ httpMethod: method, headers: { authorization: 'Bearer token' }, body: body ? JSON.stringify(body) : '' });

test('API: administrador que não é dev recebe 403 e nada é gravado', async () => {
  const cliente = clienteFalso(false);
  substituirClienteSupabase(cliente);
  try {
    assert.equal((await handler(evento('GET'))).statusCode, 403);
    assert.equal((await handler(evento('POST', { action: 'aba', user_id: OUTRO, tab: 'estacas', actions: ['ver'] }))).statusCode, 403);
    assert.deepEqual(cliente.chamadas.map(c => c.nome), ['erp_is_dev', 'erp_is_dev']);
  } finally {
    substituirClienteSupabase(null);
  }
});

test('API: o dev muda a aba com o login da sessão como autor, nunca o do corpo', async () => {
  const cliente = clienteFalso(true);
  substituirClienteSupabase(cliente);
  try {
    const resposta = await handler(evento('POST', { action: 'aba', user_id: OUTRO, tab: 'estacas', actions: ['editar'], p_actor: { user_id: OUTRO } }));
    assert.equal(resposta.statusCode, 200);
    const chamada = cliente.chamadas.find(c => c.nome === 'set_erp_access_rule')!;
    assert.deepEqual(chamada.args.p_actor, { user_id: DEV, name: 'Dono' });
    assert.deepEqual(chamada.args.p_actions, ['ver', 'editar']);
    assert.equal((await handler(evento('POST', { action: 'aba', user_id: OUTRO, tab: 'dev', actions: ['ver'] }))).statusCode, 422, 'a aba Dev não se distribui');
    assert.equal((await handler(evento('POST', { action: 'aba', user_id: 'x', tab: 'estacas', actions: ['ver'] }))).statusCode, 422);
    assert.equal((await handler(evento('POST', { action: 'perfil', user_id: DEV, value: 'leitura' }))).statusCode, 409, 'trava do próprio perfil');
    assert.equal((await handler(evento('POST', { action: 'senha', user_id: DEV }))).statusCode, 409, 'a própria senha não muda por aqui');
    assert.equal((await handler(evento('POST', { action: 'aba', user_id: OUTRO, tab: 'estacas', actions: ['tudo'] }))).statusCode, 422);
    assert.equal((await handler(evento('GET'))).statusCode, 200);
  } finally {
    substituirClienteSupabase(null);
  }
});

test('API: "Quem assina" do Dev usa os papéis da Contratação (RH, 2º e 3º gerente, auxiliar)', async () => {
  const cliente = clienteFalso(true);
  substituirClienteSupabase(cliente);
  try {
    for (const role of ['rh', 'gerente_1', 'gerente_2', 'auxiliar']) {
      assert.equal((await handler(evento('POST', { action: 'contratacao', user_id: OUTRO, role, active: true }))).statusCode, 200, role);
    }
    assert.equal((await handler(evento('POST', { action: 'contratacao', user_id: OUTRO, role: 'gerente', active: true }))).statusCode, 422, 'papel antigo saiu');
    const papeis = cliente.chamadas.filter(c => c.nome === 'set_erp_hiring_role').map(c => c.args.p_role);
    assert.deepEqual(papeis, ['rh', 'gerente_1', 'gerente_2', 'auxiliar']);
  } finally {
    substituirClienteSupabase(null);
  }
});

test('banco: dev conferido nas funções, histórico só cresce e desfaz uma vez só', () => {
  const sql = fs.readFileSync('supabase/migrations/202611160001_painel_dev_acessos.sql', 'utf8');
  assert.match(sql, /before update or delete on public\.erp_access_audit/);
  assert.match(sql, /unique index if not exists erp_access_audit_desfaz_uma_vez/);
  assert.match(sql, /você não pode esconder uma aba de si mesmo/);
  assert.match(sql, /actions <@ array\['ver', 'editar', 'aprovar', 'excluir'\]/);
  assert.doesNotMatch(sql, /password|senha text/i, 'senha nunca vai para o banco do painel');
  for (const funcao of ['set_erp_access_rule', 'record_erp_access_change', 'erp_dev_panel']) {
    assert.match(sql, new RegExp(`function public\\.${funcao}[\\s\\S]*?public\\.erp_assert_dev\\(`), `${funcao} confere o dev`);
  }
  for (const tabela of ['erp_dev_owners', 'erp_access_rules', 'erp_access_audit']) {
    assert.match(sql, new RegExp(`alter table public\\.${tabela} enable row level security`));
  }
  assert.doesNotMatch(sql, /grant (insert|update|delete)[^;]*to authenticated/);
  assert.doesNotMatch(sql, /grant execute[^;]*to authenticated/);
});
