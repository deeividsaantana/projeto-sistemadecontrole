import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { substituirClienteSupabase } from '../api/_shared/supabase-admin.js';
import { handler } from '../api/contratacao.js';
import { aplicarExclusoes, apagarDeVez, criarExclusao } from '../src/cloud/exclusoes';
import { importarPlanilhaDeControle } from '../src/utils/solicitacoesPlanilha';

// Apagar solicitação de vez (18/11/2026): só o dono do sistema (erp_dev_owners).

const DEV = '11111111-1111-4111-8111-111111111111';
const PEDIDO = '33333333-3333-4333-8333-333333333333';
const ler = (arquivo: string) => fs.readFileSync(arquivo, 'utf8');

test('compras: apagado de vez sai do retrato sem cópia guardada', () => {
  const agora = '2026-11-18T10:00:00.000Z';
  const marca = apagarDeVez(criarExclusao({ tabela: 'solicitacoes', registro: { id: 's1', numero: 'SOL-2026-0001' }, rotulo: 'SOL-2026-0001', usuario: 'Deivid', agora }), 'Deivid', agora);
  assert.deepEqual(marca.registro, {}, 'nada do pedido fica guardado');
  const retrato = aplicarExclusoes({ solicitacoes: [{ id: 's1' }, { id: 's2' }], exclusoes: [marca] });
  assert.deepEqual(retrato.solicitacoes, [{ id: 's2' }], 'aparelho atrasado não traz de volta');
});

test('compras: a planilha não traz de volta o pedido apagado de vez', () => {
  const abas = [{ nome: 'Solicitações', linhas: [
    { linha: 3, valores: { Data: new Date('2026-06-12T00:00:00Z'), 'N° do pedido': 51, Solicitante: 'Carlos', Item: 'Enxada', Unidade: 'Und.', Quantidade: 2 } },
    { linha: 4, valores: { Data: new Date('2026-06-15T00:00:00Z'), 'N° do pedido': 52, Solicitante: 'Thiago', Item: 'Arame', Unidade: 'Kg', Quantidade: 10 } },
    { linha: 5, valores: { Data: new Date('2026-06-15T00:00:00Z'), 'N° do pedido': 53, Solicitante: 'Thiago', Item: 'Pá', Unidade: 'Und.', Quantidade: 1, 'Código do site': 'SOL-2026-0099/1' } },
  ] }];
  const todas = importarPlanilhaDeControle(abas, [], 'x', '2026-11-18T10:00:00.000Z');
  assert.equal(todas.novas.length, 3);
  const semApagadas = importarPlanilhaDeControle(abas, [], 'x', '2026-11-18T10:00:00.000Z', new Set(['controle-pedido-52', 'SOL-2026-0099']));
  assert.deepEqual(semApagadas.novas.map(sol => sol.id), ['controle-pedido-51']);
});

test('compras: botão só para o dono e o banco recusa o envio de quem não é', () => {
  const app = ler('src/App.tsx');
  assert.match(app, /const handleExcluirSolicitacao[\s\S]*?if \(!alvo \|\| !meuAcesso\.ehDev\) return;/);
  assert.match(app, /podeApagar=\{meuAcesso\.ehDev\}/);
  assert.match(ler('src/components/SolicitacoesTab.tsx'), /podeExcluir=\{podeApagar\}/);
  assert.match(ler('src/components/solicitacoes/DetalheSolicitacao.tsx'), /<ConfirmDialog[\s\S]*?Apagar de vez/);
  const sql = ler('supabase/migrations/202611180001_apagar_de_vez_so_dev.sql');
  assert.match(sql, /function public\.erp_recusar_por_perfil[\s\S]*?perform public\.erp_recusar_apagar_so_dev\(p_organization_id, p_antes, p_depois\);\s*\n\s*if coalesce\(auth\.jwt\(\)/, 'confere antes do atalho de perfil, vale para todo mundo');
  assert.match(sql, /function public\.erp_recusar_apagar_so_dev[\s\S]*?not public\.erp_is_dev\(p_organization_id, auth\.uid\(\)\)[\s\S]*?ROLE_WRITE_DENIED/);
  assert.doesNotMatch(sql, /grant execute[^;]*to (authenticated|anon)/);
});

const clienteFalso = (ehDev: boolean) => {
  const chamadas: string[] = [];
  const consulta = (linhas: unknown[]) => {
    const builder: Record<string, unknown> = {};
    for (const metodo of ['select', 'eq', 'limit', 'in', 'order']) builder[metodo] = () => builder;
    builder.maybeSingle = () => Promise.resolve({ data: linhas[0] ?? null, error: null });
    return builder;
  };
  return {
    chamadas,
    auth: { getUser: async () => ({ data: { user: { id: DEV, email: 'd@x', user_metadata: { full_name: 'Dono' }, app_metadata: {} } }, error: null }) },
    from: (tabela: string) => consulta(tabela === 'organization_members' ? [{ organization_id: 'renea', role: 'admin' }] : []),
    rpc: async (nome: string, args: Record<string, unknown>) => {
      chamadas.push(nome);
      if (nome === 'erp_is_dev') return { data: ehDev, error: null };
      assert.deepEqual(args.p_actor, { user_id: DEV, name: 'Dono' }, 'autor vem da sessão');
      return { data: { request_number: 'CONT-2026-0001' }, error: null };
    },
  };
};
const evento = (body: unknown) => ({ httpMethod: 'POST', headers: { authorization: 'Bearer token' }, body: JSON.stringify(body) });

test('RH: só o dono apaga pelo servidor; o banco confere de novo', async () => {
  const outro = clienteFalso(false);
  substituirClienteSupabase(outro);
  try {
    assert.equal((await handler(evento({ action: 'apagar', request_id: PEDIDO }))).statusCode, 403);
    assert.deepEqual(outro.chamadas, ['erp_is_dev'], 'nada é apagado');
  } finally {
    substituirClienteSupabase(null);
  }
  const dono = clienteFalso(true);
  substituirClienteSupabase(dono);
  try {
    assert.equal((await handler(evento({ action: 'apagar', request_id: 'x' }))).statusCode, 422);
    const resposta = await handler(evento({ action: 'apagar', request_id: PEDIDO }));
    assert.equal(resposta.statusCode, 200);
    assert.deepEqual(dono.chamadas, ['erp_is_dev', 'erp_hiring_delete_request']);
  } finally {
    substituirClienteSupabase(null);
  }
  const sql = ler('supabase/migrations/202611180001_apagar_de_vez_so_dev.sql');
  assert.match(sql, /function public\.erp_hiring_delete_request[\s\S]*?not public\.erp_is_dev\(p_organization_id, v_actor\)/);
  assert.match(sql, /grant execute on function public\.erp_hiring_delete_request\(text, jsonb, uuid\) to service_role;/);
  assert.match(sql, /set_config\('erp\.apagar_pedido', 'sim', true\)/, 'a chave vale só dentro da transação');
  assert.match(ler('src/components/ContratacaoTab.tsx'), /\{me\?\.dev && \(/);
});

test('programação: corrigir segue livre; apagar lançamento de vez só o dono', () => {
  const app = ler('src/App.tsx');
  assert.match(app, /const handleApagarProducao[\s\S]*?if \(!alvo \|\| !meuAcesso\.ehDev\) return;[\s\S]*?tabela: 'producaoRegistros'/);
  assert.match(app, /onSaveProducao=\{handleSaveProducao\}\s*podeApagar=\{meuAcesso\.ehDev\}/);
  const tela = ler('src/components/ProgramacaoTab.tsx');
  assert.match(tela, /onApagar=\{podeApagar && onApagarProducao \?/);
  assert.match(tela, /<ConfirmDialog[\s\S]*?Apagar de vez este lançamento\?/);
  const sql = ler('supabase/migrations/202611180001_apagar_de_vez_so_dev.sql');
  assert.match(sql, /v_tabelas text\[\] := array\['solicitacoes', 'producaoRegistros'\]/);
});
