import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  PAPEIS,
  SITUACOES,
  SOLICITACOES,
  cpfValido,
  etapaPendente,
  reajuste,
  tipoDoPedido,
  nomeDaEtapa,
  pedidoVisivel,
  podeDecidir,
  tokenValido,
  validarFormulario,
} from '../api/_shared/contratacao-regras.js';
import { handler } from '../api/contratacao.js';
import { substituirClienteSupabase } from '../api/_shared/supabase-admin.js';
import { getContratacaoTokenFromUrl, isContratacaoLinkUrl } from '../src/app/routing/publicRoutes';

const SOL = '00000000-0000-0000-0000-000000000002';
const RH = '00000000-0000-0000-0000-000000000003';
const BRUNO = '00000000-0000-0000-0000-000000000004';
const AUX = '00000000-0000-0000-0000-000000000005';
const MARCELO = '00000000-0000-0000-0000-000000000006';
const TOKEN = 'a'.repeat(64);
const leitor = (userId: string, papeis: string[] = [], admin = false) => ({ userId, nome: 'X', admin, papeis });

const formOk = {
  data: '2026-11-16', candidato: 'João Pereira', cpf: '529.982.247-25', inicio: '2026-12-01', prioridade: 'Alta', motivo: 'aumento',
  tipo: 'efetivo', posicao: 'Pedreiro', quantidade: '1', requisitante: 'Giulia', area: 'Obra 3', itens: ['alojamento', 'celular'],
};

test('formulário: candidato, CPF e início obrigatórios; "nenhum item" exclusivo', () => {
  const vazio = validarFormulario({});
  for (const campo of ['data', 'candidato', 'cpf', 'inicio', 'prioridade', 'motivo', 'tipo', 'posicao', 'quantidade', 'requisitante', 'area', 'itens']) {
    assert.ok(vazio.erros[campo], `falta o erro de ${campo}`);
  }
  const ok = validarFormulario({ ...formOk, itens: ['celular', 'nenhum', 'inventado'] });
  assert.deepEqual(ok.erros, {});
  assert.equal(ok.formulario.cpf, '52998224725');
  assert.deepEqual(ok.formulario.itens, ['nenhum']);
  assert.ok(validarFormulario({ ...formOk, cpf: '529.982.247-24' }).erros.cpf);
  assert.ok(validarFormulario({ ...formOk, motivo: 'outro' }).erros.motivoOutro);
  assert.ok(validarFormulario({ ...formOk, inicio: '2026-02-30' }).erros.inicio);
  assert.equal(cpfValido('111.111.111-11'), false);
});

const pedido = (status: string, etapa: number | null, extra = {}) => ({ id: 'p1', requester_user_id: SOL, status, etapa_atual: etapa, rejected_stage: null, ...extra });
const deBruno = { stage: 'gerente_1', signer_user_id: BRUNO };

const doRh = { stage: 'rh', signer_user_id: RH };

test('ordem rígida (17/11/2026): 1º RH, 2º Bruno, 3º Marcelo; ninguém pula etapa', () => {
  assert.equal(etapaPendente(pedido('etapa_1', 1)), 'rh');
  assert.equal(etapaPendente(pedido('etapa_2', 2)), 'gerente_1');
  assert.equal(etapaPendente(pedido('etapa_3', 3)), 'gerente_2');
  assert.equal(etapaPendente(pedido('concluido', null)), null);
  assert.equal(podeDecidir(pedido('etapa_1', 1), [], leitor(RH, ['rh'])), true);
  assert.equal(podeDecidir(pedido('etapa_1', 1), [], leitor(BRUNO, ['gerente_1'])), false);
  assert.equal(podeDecidir(pedido('etapa_1', 1), [], leitor(MARCELO, ['gerente_2'])), false);
  assert.equal(podeDecidir(pedido('etapa_2', 2), [doRh], leitor(BRUNO, ['gerente_1'])), true);
  assert.equal(podeDecidir(pedido('etapa_3', 3), [doRh, deBruno], leitor(MARCELO, ['gerente_2'])), true);
  assert.equal(podeDecidir(pedido('etapa_3', 3), [doRh, deBruno], leitor(BRUNO, ['gerente_1', 'gerente_2'])), false, 'quem já assinou não assina outra etapa');
  assert.equal(podeDecidir(pedido('concluido', null), [], leitor(RH, ['rh'])), false);
  assert.equal(podeDecidir(pedido('etapa_1', 1), [], leitor(AUX, ['auxiliar'])), false);
});

test('3 tipos: contratação, promoção e desligamento, cada um com os seus campos', () => {
  assert.deepEqual(Object.keys(SOLICITACOES), ['contratacao', 'promocao', 'desligamento']);
  assert.equal(tipoDoPedido({}), 'contratacao', 'pedido antigo sem tipo é contratação');
  assert.equal(validarFormulario(formOk).formulario.solicitacao, 'contratacao');

  const promoVazia = validarFormulario({ solicitacao: 'promocao' });
  for (const campo of ['alteracao', 'data', 'candidato', 'area', 'cargoProposto', 'justificativa']) assert.ok(promoVazia.erros[campo], `promoção: falta o erro de ${campo}`);
  assert.equal(promoVazia.erros.cpf, undefined, 'promoção não pede CPF');
  const promo = validarFormulario({ solicitacao: 'promocao', alteracao: 'promocao', data: '2026-11-17', candidato: 'Carlos Souza', area: 'Obra 3', salarioAtual: 'R$ 2.000,00', salarioProposto: 'R$ 2.500,00', justificativa: 'Assumiu a frente.', itens: ['celular'] });
  assert.deepEqual(promo.erros, {});
  assert.equal('itens' in promo.formulario, false, 'campo de outro tipo não entra');
  assert.equal(reajuste('R$ 2.000,00', 'R$ 2.500,00'), '25%');
  assert.equal(reajuste('', 'R$ 2.500,00'), '—');

  const deslVazio = validarFormulario({ solicitacao: 'desligamento' });
  for (const campo of ['data', 'candidato', 'posicao', 'desligamento', 'motivoDeslig']) assert.ok(deslVazio.erros[campo], `desligamento: falta o erro de ${campo}`);
  const desl = validarFormulario({ solicitacao: 'desligamento', data: '2026-11-17', candidato: 'Marcos Rocha', posicao: 'Motorista / Obra 3', desligamento: '2026-11-28', motivoDeslig: 'termino', convenios: ['medico', 'inventado'], devolucao: ['cracha'], devolucaoOutros: 'bota' });
  assert.deepEqual(desl.erros, {});
  assert.deepEqual(desl.formulario.convenios, ['medico']);
  assert.equal(desl.formulario.devolucaoOutros, '', '"outros" só vale com Uniforme / outros marcado');
});

test('nomes sérios nas assinaturas (18/11/2026): Recursos Humanos e Gerência, com a ordem', () => {
  assert.equal(nomeDaEtapa('rh'), 'Recursos Humanos (1ª assinatura)');
  assert.equal(nomeDaEtapa('gerente_1'), 'Gerência (2ª assinatura)');
  assert.equal(nomeDaEtapa('gerente_2'), 'Gerência (3ª assinatura)');
  for (const texto of [...Object.values(SITUACOES), ...Object.values(PAPEIS)]) assert.doesNotMatch(String(texto), /\bRH\b|Gerente\b/, texto);
  const link = fs.readFileSync('src/ContratacaoLinkApp.tsx', 'utf8');
  assert.match(link, /document\.title = 'Documentações'/, 'título da aba do navegador');
  const peloLink = fs.readFileSync('src/components/contratacao/ContratacaoPeloLink.tsx', 'utf8');
  assert.match(peloLink, /<OutrosPedidos /, 'pelo link a pessoa vê também os outros pedidos');
});

test('quem vê: quem abriu, admin e quem tem papel; o resto não', () => {
  assert.equal(pedidoVisivel(pedido('etapa_1', 1), leitor(MARCELO, ['gerente_2'])), true);
  assert.equal(pedidoVisivel(pedido('etapa_1', 1), leitor(SOL)), true);
  assert.equal(pedidoVisivel(pedido('etapa_1', 1), leitor('outro')), false);
  assert.equal(pedidoVisivel(pedido('etapa_1', 1), leitor('admin', [], true)), true);
});

test('link individual: rota e token', () => {
  assert.equal(getContratacaoTokenFromUrl({ pathname: `/contratacao-link/${TOKEN}`, search: '' }), TOKEN);
  assert.equal(isContratacaoLinkUrl({ pathname: `/contratacao-link/${TOKEN}`, search: '' }), true);
  assert.equal(isContratacaoLinkUrl({ pathname: '/contratacao', search: '' }), true);
  assert.equal(isContratacaoLinkUrl({ pathname: '/contratacao-link/', search: '' }), false);
  assert.equal(tokenValido(TOKEN), true);
  assert.equal(tokenValido('x'.repeat(64)), false);
  assert.equal(tokenValido(`${TOKEN}0`), false);
});

/** Supabase falso: guarda as chamadas de rpc e devolve linhas por tabela. */
const clienteFalso = (tabelas: Record<string, unknown[]>, usuario = { id: SOL, email: 's@x', user_metadata: { full_name: 'Thiago' } }) => {
  const chamadas: Array<{ nome: string; args: Record<string, unknown> }> = [];
  const consulta = (linhas: unknown[]) => {
    const resultado = { data: linhas, error: null };
    const builder: Record<string, unknown> = {};
    for (const metodo of ['select', 'eq', 'order', 'limit', 'in', 'delete']) builder[metodo] = () => builder;
    builder.upsert = (linha: unknown) => { chamadas.push({ nome: 'upsert', args: linha as Record<string, unknown> }); return Promise.resolve({ error: null }); };
    builder.eq = (coluna: string, valor: unknown) => (coluna === 'link_token' ? consulta(linhas.filter(linha => (linha as Record<string, unknown>).link_token === valor)) : builder);
    builder.maybeSingle = () => Promise.resolve({ data: linhas[0] ?? null, error: null });
    builder.then = (ok: (valor: unknown) => unknown) => Promise.resolve(resultado).then(ok);
    return builder;
  };
  return {
    chamadas,
    auth: { getUser: async () => ({ data: { user: { ...usuario, app_metadata: {} } }, error: null }) },
    from: (tabela: string) => consulta(tabela === 'organization_members' ? [{ organization_id: 'renea', role: 'editor' }] : tabelas[tabela] ?? []),
    rpc: async (nome: string, args: Record<string, unknown>) => { chamadas.push({ nome, args }); return { data: { id: 'novo', status: 'etapa_1', link_token: TOKEN, client_key: 'segredo' }, error: null }; },
  };
};
const evento = (method: string, body?: unknown) => ({ httpMethod: method, headers: { authorization: 'Bearer token' }, body: body ? JSON.stringify(body) : '' });

test('API: quem abre é o login da sessão; a resposta traz o link e nunca a chave de envio', async () => {
  const cliente = clienteFalso({});
  substituirClienteSupabase(cliente);
  try {
    const resposta = await handler(evento('POST', { action: 'criar', form: formOk, client_key: 'chave-123456789', p_actor: { user_id: RH } }));
    assert.equal(resposta.statusCode, 201);
    const { args } = cliente.chamadas[0];
    assert.deepEqual(args.p_actor, { user_id: SOL, name: 'Thiago' });
    assert.equal('p_signature' in args, false, 'quem abre não assina mais');
    assert.match(String(args.p_form_hash), /^[0-9a-f]{64}$/);
    const corpo = JSON.parse(resposta.body);
    assert.equal(corpo.data.link_token, TOKEN);
    assert.equal(corpo.data.client_key, undefined);
    const ruim = await handler(evento('POST', { action: 'criar', form: {}, client_key: 'chave-123456789' }));
    assert.equal(ruim.statusCode, 422);
  } finally {
    substituirClienteSupabase(null);
  }
});

const pedidoDoBanco = (status: string, etapa: number | null) => ({ ...pedido(status, etapa), link_token: TOKEN, client_key: 'segredo', form: { candidato: 'João', cpf: '52998224725' } });

test('API: link concluído responde só "expirado", sem dados do candidato', async () => {
  substituirClienteSupabase(clienteFalso({ erp_hiring_requests: [pedidoDoBanco('concluido', null)], erp_hiring_roles: [{ role: 'rh' }] }));
  try {
    const resposta = await handler({ ...evento('GET'), queryStringParameters: { token: TOKEN } });
    assert.equal(resposta.statusCode, 200);
    assert.doesNotMatch(resposta.body, /João|52998224725/);
    assert.equal(JSON.parse(resposta.body).data.expirado, 'concluido');
  } finally {
    substituirClienteSupabase(null);
  }
});

test('API: link aberto exige papel e não aceita token torto', async () => {
  substituirClienteSupabase(clienteFalso({ erp_hiring_requests: [pedidoDoBanco('etapa_1', 1)], erp_hiring_roles: [] }, { id: 'f0000000-0000-0000-0000-000000000009', email: 'o@x', user_metadata: { full_name: 'Outro' } }));
  try {
    const semPapel = await handler({ ...evento('GET'), queryStringParameters: { token: TOKEN } });
    assert.equal(semPapel.statusCode, 403);
    const torto = await handler({ ...evento('GET'), queryStringParameters: { token: '../x' } });
    assert.equal(torto.statusCode, 404);
  } finally {
    substituirClienteSupabase(null);
  }
  substituirClienteSupabase(clienteFalso({ erp_hiring_requests: [pedidoDoBanco('etapa_1', 1)], erp_hiring_roles: [{ role: 'gerente_2', user_name: 'Marcelo Suegama' }], erp_hiring_signatures: [], erp_hiring_audit: [] }));
  try {
    const comPapel = await handler({ ...evento('GET'), queryStringParameters: { token: TOKEN } });
    const corpo = JSON.parse(comPapel.body);
    assert.equal(comPapel.statusCode, 200);
    assert.equal(corpo.data.request.link_token, TOKEN);
    assert.equal(corpo.data.request.client_key, undefined);
  } finally {
    substituirClienteSupabase(null);
  }
});

test('API: assinar pelo link confere o token do pedido; a etapa o banco confere', async () => {
  const cliente = clienteFalso({ erp_hiring_requests: [pedidoDoBanco('etapa_1', 1)] });
  substituirClienteSupabase(cliente);
  try {
    const outro = await handler(evento('POST', { action: 'decidir', request_id: '11111111-1111-4111-8111-111111111111', version: 1, decision: 'aprovar', signature: { method: 'digitado' }, token: TOKEN }));
    assert.equal(outro.statusCode, 404, 'token de outro pedido');
    assert.equal(cliente.chamadas.length, 0);
  } finally {
    substituirClienteSupabase(null);
  }
});

test('API: a lista não entrega o link de pedido encerrado', async () => {
  const pedidos = [{ ...pedidoDoBanco('etapa_2', 2), id: 'a' }, { ...pedidoDoBanco('concluido', null), id: 'b' }, { ...pedidoDoBanco('etapa_1', 1), id: 'c', requester_user_id: RH }];
  const cliente = clienteFalso({ erp_hiring_requests: pedidos, erp_hiring_roles: [], erp_hiring_signatures: [], erp_hiring_audit: [] });
  substituirClienteSupabase(cliente);
  try {
    const corpo = JSON.parse((await handler(evento('GET'))).body);
    assert.deepEqual(corpo.data.requests.map((item: { id: string }) => item.id), ['a', 'b'], 'sem papel: só os próprios');
    assert.equal(corpo.data.requests[0].link_token, TOKEN);
    assert.equal(corpo.data.requests[1].link_token, null);
    assert.equal(corpo.data.people, undefined, 'só o administrador recebe a lista de pessoas');
  } finally {
    substituirClienteSupabase(null);
  }
});

test('banco: ordem das 3 assinaturas, hash por assinatura, link e travas de acesso', () => {
  const sql = fs.readFileSync('supabase/migrations/202611160001_contratacao_link_tres_assinaturas.sql', 'utf8');
  assert.match(sql, /Aguardando assinatura prioritária de: %/);
  assert.match(sql, /Quem já assinou uma etapa deste pedido não assina outra/);
  assert.match(sql, /v_request\.version <> p_expected_version/);
  assert.match(sql, /hash_validacao/);
  assert.match(sql, /erp_hiring_requests_link_token_idx/);
  assert.match(sql, /m\.role = 'admin'/);
  for (const tabela of ['erp_hiring_roles', 'erp_hiring_requests', 'erp_hiring_signatures', 'erp_hiring_audit']) {
    assert.match(sql, new RegExp(`alter table public\\.${tabela} enable row level security`));
  }
  assert.match(sql, /revoke all on public\.erp_hiring_roles, public\.erp_hiring_requests, public\.erp_hiring_signatures, public\.erp_hiring_audit from public, anon, authenticated/);
  const antigo = fs.readFileSync('supabase/migrations/202611140001_solicitacao_contratacao.sql', 'utf8');
  assert.match(antigo, /before update or delete on public\.erp_hiring_signatures/, 'assinatura continua imutável');
});

test('banco (17/11/2026): ordem RH -> Bruno -> Marcelo, pula etapa já assinada e assinatura salva trancada', () => {
  const sql = fs.readFileSync('supabase/migrations/202611170001_solicitacoes_rh_ordem_e_assinatura_salva.sql', 'utf8');
  assert.match(sql, /case v_request\.etapa_atual when 1 then 'rh' when 2 then 'gerente_1' when 3 then 'gerente_2' end/);
  assert.match(sql, /not exists \(select 1 from public\.erp_hiring_signatures s where s\.request_id = v_request\.id and s\.stage = e\.st\)/);
  assert.match(sql, /status = 'concluido', etapa_atual = null, concluded_at = v_now/);
  assert.match(sql, /Quem já assinou uma etapa deste pedido não assina outra/);
  assert.match(sql, /alter table public\.erp_hiring_saved_signatures enable row level security/);
  assert.match(sql, /revoke all on public\.erp_hiring_saved_signatures from public, anon, authenticated/);
  assert.match(sql, /length\(image_data\) <= 200000/);
});

test('API: assinatura salva vem do banco (nunca da tela) e "guardar" grava depois de assinar', async () => {
  const salva = `data:image/png;base64,${'A'.repeat(40)}`;
  const cliente = clienteFalso({ erp_hiring_saved_signatures: [{ image_data: salva }] });
  substituirClienteSupabase(cliente);
  try {
    const comSalva = await handler(evento('POST', { action: 'decidir', request_id: '11111111-1111-4111-8111-111111111111', version: 1, decision: 'aprovar', signature: { method: 'salva', image_data: 'data:image/png;base64,FALSA' }, reason: 'Ok do RH' }));
    assert.equal(comSalva.statusCode, 200);
    const assinatura = cliente.chamadas.find(chamada => chamada.nome === 'sign_erp_hiring_request');
    assert.deepEqual(assinatura?.args.p_signature, { method: 'desenho', image_data: salva });
    assert.equal(assinatura?.args.p_reason, 'Ok do RH', 'comentário ao assinar vai para o histórico');

    const desenho = `data:image/png;base64,${'B'.repeat(40)}`;
    await handler(evento('POST', { action: 'decidir', request_id: '11111111-1111-4111-8111-111111111111', version: 1, decision: 'aprovar', signature: { method: 'desenho', image_data: desenho, guardar: true } }));
    const guardou = cliente.chamadas.find(chamada => chamada.nome === 'upsert');
    assert.equal(guardou?.args.image_data, desenho);
    assert.equal(guardou?.args.user_id, SOL, 'guarda para quem está logado');
  } finally {
    substituirClienteSupabase(null);
  }
  substituirClienteSupabase(clienteFalso({}));
  try {
    const semSalva = await handler(evento('POST', { action: 'decidir', request_id: '11111111-1111-4111-8111-111111111111', version: 1, decision: 'aprovar', signature: { method: 'salva' } }));
    assert.equal(semSalva.statusCode, 422);
  } finally {
    substituirClienteSupabase(null);
  }
});
