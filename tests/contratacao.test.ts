import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  assinaturasVisiveis,
  pedidoVisivel,
  podeDecidir,
  validarFormulario,
} from '../api/_shared/contratacao-regras.js';
import { handler } from '../api/contratacao.js';
import { substituirClienteSupabase } from '../api/_shared/supabase-admin.js';

const SOL = '00000000-0000-0000-0000-000000000002';
const RH = '00000000-0000-0000-0000-000000000003';
const GER = '00000000-0000-0000-0000-000000000004';
const AUX = '00000000-0000-0000-0000-000000000005';
const leitor = (userId: string, papeis: string[] = [], admin = false) => ({ userId, nome: 'X', admin, papeis });

const formOk = {
  data: '2026-11-14', prioridade: 'Alta', motivo: 'aumento', tipo: 'efetivo', posicao: 'Pedreiro',
  quantidade: '2', requisitante: 'Thiago', area: 'Obra 3', itens: ['alojamento', 'celular'],
};

test('formulário: campos obrigatórios e "nenhum item" exclusivo', () => {
  const vazio = validarFormulario({});
  for (const campo of ['data', 'prioridade', 'motivo', 'tipo', 'posicao', 'quantidade', 'requisitante', 'area', 'itens']) {
    assert.ok(vazio.erros[campo], `falta o erro de ${campo}`);
  }
  const ok = validarFormulario({ ...formOk, itens: ['celular', 'nenhum', 'inventado'] });
  assert.deepEqual(ok.erros, {});
  assert.deepEqual(ok.formulario.itens, ['nenhum']);
  assert.equal(ok.formulario.quantidade, 2);
  assert.ok(validarFormulario({ ...formOk, motivo: 'outro' }).erros.motivoOutro);
  assert.ok(validarFormulario({ ...formOk, data: '2026-02-30' }).erros.data);
  assert.ok(validarFormulario({ ...formOk, quantidade: '1.5' }).erros.quantidade);
});

const pedido = (status: string, extra = {}) => ({ id: 'p1', requester_user_id: SOL, status, rejected_stage: null, ...extra });
const assinaturas = [
  { stage: 'solicitante', signer_user_id: SOL, image_data: 'data:image/png;base64,S' },
  { stage: 'rh', signer_user_id: RH, image_data: 'data:image/png;base64,R' },
];

test('filas rígidas: gerente não vê o que ainda está no RH; quem não tem papel só vê o seu', () => {
  assert.equal(pedidoVisivel(pedido('aguardando_rh'), leitor(GER, ['gerente'])), false);
  assert.equal(pedidoVisivel(pedido('aguardando_gerente'), leitor(GER, ['gerente'])), true);
  assert.equal(pedidoVisivel(pedido('recusada', { rejected_stage: 'rh' }), leitor(GER, ['gerente'])), false);
  assert.equal(pedidoVisivel(pedido('aguardando_rh'), leitor(RH, ['rh'])), true);
  assert.equal(pedidoVisivel(pedido('aguardando_rh'), leitor('outro')), false);
  assert.equal(pedidoVisivel(pedido('aguardando_rh'), leitor(SOL)), true);
  assert.equal(pedidoVisivel(pedido('aguardando_rh'), leitor(AUX, ['auxiliar'])), true);
});

test('assinatura de etapa à frente aparece só como "assinado", sem o traço', () => {
  const doSolicitante = assinaturasVisiveis(pedido('aguardando_gerente'), assinaturas, leitor(SOL));
  assert.equal(doSolicitante.find(a => a.stage === 'solicitante')?.image_data, 'data:image/png;base64,S');
  assert.equal(doSolicitante.find(a => a.stage === 'rh')?.image_data, null);
  assert.equal(assinaturasVisiveis(pedido('aguardando_gerente'), assinaturas, leitor(GER, ['gerente']))[1].image_data, 'data:image/png;base64,R');
  assert.equal(assinaturasVisiveis(pedido('aprovada'), assinaturas, leitor(SOL))[1].image_data, 'data:image/png;base64,R');
});

test('só quem tem o papel da etapa decide, e nunca assina duas etapas', () => {
  assert.equal(podeDecidir(pedido('aguardando_rh'), assinaturas.slice(0, 1), leitor(RH, ['rh'])), true);
  assert.equal(podeDecidir(pedido('aguardando_rh'), assinaturas.slice(0, 1), leitor(GER, ['gerente'])), false);
  assert.equal(podeDecidir(pedido('aguardando_gerente'), assinaturas, leitor(RH, ['rh', 'gerente'])), false);
  assert.equal(podeDecidir(pedido('aguardando_gerente'), assinaturas, leitor(AUX, ['auxiliar'])), false);
  assert.equal(podeDecidir(pedido('aprovada'), assinaturas, leitor(GER, ['gerente'])), false);
});

/** Supabase falso: guarda as chamadas de rpc e devolve linhas por tabela. */
const clienteFalso = (tabelas: Record<string, unknown[]>, usuario = { id: SOL, email: 's@x', user_metadata: { full_name: 'Thiago' } }) => {
  const chamadas: Array<{ nome: string; args: Record<string, unknown> }> = [];
  const consulta = (linhas: unknown[]) => {
    const resultado = { data: linhas, error: null };
    const builder: Record<string, unknown> = {};
    for (const metodo of ['select', 'eq', 'order', 'limit', 'in']) builder[metodo] = () => builder;
    builder.maybeSingle = () => Promise.resolve({ data: linhas[0] ?? null, error: null });
    builder.then = (ok: (valor: unknown) => unknown) => Promise.resolve(resultado).then(ok);
    return builder;
  };
  return {
    chamadas,
    auth: { getUser: async () => ({ data: { user: { ...usuario, app_metadata: {} } }, error: null }) },
    from: (tabela: string) => consulta(tabela === 'organization_members' ? [{ organization_id: 'renea', role: 'editor' }] : tabelas[tabela] ?? []),
    rpc: async (nome: string, args: Record<string, unknown>) => { chamadas.push({ nome, args }); return { data: { id: 'novo', status: 'aguardando_rh' }, error: null }; },
  };
};
const evento = (method: string, body?: unknown) => ({ httpMethod: method, headers: { authorization: 'Bearer token' }, body: body ? JSON.stringify(body) : '' });

test('API: quem assina é o login da sessão, nunca o nome do corpo', async () => {
  const cliente = clienteFalso({});
  substituirClienteSupabase(cliente);
  try {
    const resposta = await handler(evento('POST', { action: 'criar', form: formOk, signature: { method: 'digitado' }, client_key: 'chave-123456789', p_actor: { user_id: RH } }));
    assert.equal(resposta.statusCode, 201);
    const { args } = cliente.chamadas[0];
    assert.deepEqual(args.p_actor, { user_id: SOL, name: 'Thiago' });
    assert.match(String(args.p_form_hash), /^[0-9a-f]{64}$/);
    const ruim = await handler(evento('POST', { action: 'criar', form: {}, signature: { method: 'digitado' }, client_key: 'chave-123456789' }));
    assert.equal(ruim.statusCode, 422);
    const semDesenho = await handler(evento('POST', { action: 'criar', form: formOk, signature: { method: 'desenho', image_data: 'javascript:x' }, client_key: 'chave-123456789' }));
    assert.equal(semDesenho.statusCode, 422);
  } finally {
    substituirClienteSupabase(null);
  }
});

test('API: a lista sai filtrada pelo papel de quem pediu', async () => {
  const pedidos = [pedido('aguardando_rh', { id: 'a' }), pedido('aguardando_gerente', { id: 'b' }), pedido('aguardando_rh', { id: 'c', requester_user_id: RH })];
  const cliente = clienteFalso({ erp_hiring_requests: pedidos, erp_hiring_roles: [{ role: 'gerente' }], erp_hiring_signatures: [], erp_hiring_audit: [] }, { id: GER, email: 'g@x', user_metadata: { full_name: 'Gerente' } });
  substituirClienteSupabase(cliente);
  try {
    const resposta = await handler(evento('GET'));
    const corpo = JSON.parse(resposta.body);
    assert.deepEqual(corpo.data.requests.map((item: { id: string }) => item.id), ['b']);
    assert.equal(corpo.data.people, undefined, 'só o administrador recebe a lista de pessoas');
  } finally {
    substituirClienteSupabase(null);
  }
});

test('banco confere sequência, papel, separação de funções e auditoria só cresce', () => {
  const sql = fs.readFileSync('supabase/migrations/202611140001_solicitacao_contratacao.sql', 'utf8');
  assert.match(sql, /Esta etapa é de %\. Você não pode assinar por ela/);
  assert.match(sql, /Quem já assinou uma etapa deste pedido não assina outra/);
  assert.match(sql, /v_request\.version <> p_expected_version/);
  assert.match(sql, /before update or delete on public\.erp_hiring_audit/);
  assert.match(sql, /before update or delete on public\.erp_hiring_signatures/);
  assert.match(sql, /m\.role = 'admin'/);
  for (const tabela of ['erp_hiring_roles', 'erp_hiring_requests', 'erp_hiring_signatures', 'erp_hiring_audit']) {
    assert.match(sql, new RegExp(`alter table public\\.${tabela} enable row level security`));
  }
  assert.match(sql, /revoke all on public\.erp_hiring_roles, public\.erp_hiring_requests, public\.erp_hiring_signatures, public\.erp_hiring_audit from public, anon, authenticated/);
});
