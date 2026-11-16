// Solicitação de Contratação assinável (fluxo de 16/11/2026): lista, abertura
// (só dados; o banco gera o link individual), leitura pelo link
// /contratacao-link/<token>, assinatura em ordem rígida (1ª gerente -> 2ª
// gerente -> RH) e papéis. Quem é quem vem da sessão (token do Supabase),
// nunca do corpo do pedido; quem pode assinar a etapa atual o banco confere.
import crypto from 'node:crypto';
import {
  cleanString,
  functionErrorResponse,
  getSupabaseAdmin,
  jsonResponse,
  parseJsonBody,
  requireSupabaseUser,
} from './_shared/supabase-admin.js';
import { assertHttpMethod, httpError } from './_shared/api-security.js';
import {
  ETAPAS,
  emAberto,
  formularioCanonico,
  pedidoVisivel,
  tokenValido,
  validarFormulario,
} from './_shared/contratacao-regras.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const erroDoBanco = error => {
  const code = String(error?.code || '');
  const status = code === 'P0001' ? 409 : code === 'P0002' ? 404 : code === 'P0003' ? 403 : code === 'P0004' ? 422 : 0;
  if (!status) return error;
  return httpError(String(error.message || 'Operação recusada.'), status);
};

const assinaturaDoCorpo = valor => {
  const metodo = valor?.method === 'desenho' ? 'desenho' : valor?.method === 'digitado' ? 'digitado' : '';
  if (!metodo) throw httpError('Escolha desenhar ou digitar a assinatura.', 422);
  if (metodo === 'desenho') {
    const imagem = String(valor.image_data || '');
    if (!imagem.startsWith('data:image/png;base64,') || imagem.length > 200_000) throw httpError('Desenhe a assinatura de novo: o desenho não chegou.', 422);
    return { method: metodo, image_data: imagem };
  }
  return { method: metodo };
};

export const leitorDaSessao = async (client, staff) => {
  const { data, error } = await client.from('erp_hiring_roles').select('role')
    .eq('organization_id', staff.organizationId).eq('user_id', staff.uid);
  if (error) throw error;
  return { userId: staff.uid, nome: staff.name, admin: staff.role === 'admin', papeis: (data || []).map(linha => linha.role) };
};

const COLUNAS_ASSINATURA = 'id, request_id, stage, signer_user_id, signer_name, signer_cargo, method, image_data, form_hash, signed_at, hash_validacao';
const COLUNAS_AUDITORIA = 'request_id, actor_name, action, from_status, to_status, details, created_at';

/** O link só sai enquanto o pedido corre; encerrado, o token nem vai para a tela. */
const montarPedido = (pedido, assinaturas, auditoria) => {
  const { client_key: _chave, link_token: token, ...resto } = pedido;
  return {
    ...resto,
    link_token: emAberto(pedido.status) ? token : null,
    signatures: assinaturas.filter(item => item.request_id === pedido.id),
    history: auditoria.filter(item => item.request_id === pedido.id),
  };
};

/** Nomes de quem assina cada etapa, para os selos "1. Bruno (Gerente)". */
const titularesDaEmpresa = async (client, staff) => {
  const { data, error } = await client.from('erp_hiring_roles').select('role, user_name')
    .eq('organization_id', staff.organizationId).in('role', ETAPAS);
  if (error) throw error;
  return Object.fromEntries(ETAPAS.map(etapa => [etapa, (data || []).filter(linha => linha.role === etapa).map(linha => linha.user_name)]));
};

/**
 * Link individual. Login obrigatório (a sessão já foi conferida). Encerrado:
 * responde só "expirado", sem nenhum dado do candidato. Em aberto: só quem
 * abriu, o administrador e quem tem papel na contratação veem o pedido.
 */
const abrirPeloLink = async (client, staff, leitor, token) => {
  if (!tokenValido(token)) throw httpError('Link inválido. Confira se copiou o link inteiro.', 404);
  const { data: pedido, error } = await client.from('erp_hiring_requests').select('*')
    .eq('organization_id', staff.organizationId).eq('link_token', token).maybeSingle();
  if (error) throw error;
  if (!pedido) throw httpError('Link inválido. Confira se copiou o link inteiro.', 404);
  if (!emAberto(pedido.status)) {
    return jsonResponse(200, { success: true, data: { me: leitor, expirado: pedido.status === 'recusada' ? 'recusada' : 'concluido' } });
  }
  if (!pedidoVisivel(pedido, leitor)) {
    throw httpError('Seu login não participa desta solicitação. Peça ao administrador para marcar você em "Quem assina".', 403);
  }
  const [respAssinaturas, respAuditoria, titulares] = await Promise.all([
    client.from('erp_hiring_signatures').select(COLUNAS_ASSINATURA).eq('request_id', pedido.id),
    client.from('erp_hiring_audit').select(COLUNAS_AUDITORIA).eq('request_id', pedido.id).order('created_at', { ascending: true }),
    titularesDaEmpresa(client, staff),
  ]);
  if (respAssinaturas.error) throw respAssinaturas.error;
  if (respAuditoria.error) throw respAuditoria.error;
  return jsonResponse(200, { success: true, data: {
    me: leitor,
    titulares,
    request: montarPedido(pedido, respAssinaturas.data || [], respAuditoria.data || []),
  } });
};

const listar = async (client, staff, leitor) => {
  const { data: pedidos, error } = await client.from('erp_hiring_requests').select('*')
    .eq('organization_id', staff.organizationId).order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  const visiveis = (pedidos || []).filter(pedido => pedidoVisivel(pedido, leitor));
  const ids = visiveis.map(pedido => pedido.id);
  let assinaturas = [];
  let auditoria = [];
  if (ids.length) {
    const [respAssinaturas, respAuditoria] = await Promise.all([
      client.from('erp_hiring_signatures').select(COLUNAS_ASSINATURA).in('request_id', ids),
      client.from('erp_hiring_audit').select(COLUNAS_AUDITORIA).in('request_id', ids).order('created_at', { ascending: true }),
    ]);
    if (respAssinaturas.error) throw respAssinaturas.error;
    if (respAuditoria.error) throw respAuditoria.error;
    assinaturas = respAssinaturas.data || [];
    auditoria = respAuditoria.data || [];
  }
  const resultado = visiveis.map(pedido => montarPedido(pedido, assinaturas, auditoria));
  const titulares = await titularesDaEmpresa(client, staff);
  let pessoas;
  if (leitor.admin) {
    const [membros, papeis] = await Promise.all([
      client.from('organization_members').select('user_id').eq('organization_id', staff.organizationId),
      client.from('erp_hiring_roles').select('user_id, role, user_name, user_email').eq('organization_id', staff.organizationId),
    ]);
    if (membros.error) throw membros.error;
    if (papeis.error) throw papeis.error;
    const { data: usuarios, error: erroUsuarios } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (erroUsuarios) throw erroUsuarios;
    const porId = new Map((usuarios?.users || []).map(usuario => [usuario.id, usuario]));
    pessoas = (membros.data || []).map(({ user_id: id }) => {
      const usuario = porId.get(id);
      return {
        user_id: id,
        name: usuario?.user_metadata?.full_name || usuario?.email || 'Sem nome',
        email: usuario?.email || '',
        roles: (papeis.data || []).filter(linha => linha.user_id === id).map(linha => linha.role),
      };
    }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }
  return jsonResponse(200, { success: true, data: { me: leitor, requests: resultado, people: pessoas, titulares } });
};

const criar = async (client, staff, corpo) => {
  const { formulario, erros } = validarFormulario(corpo.form);
  if (Object.keys(erros).length) throw httpError(Object.values(erros)[0], 422, { fields: erros });
  const hash = crypto.createHash('sha256').update(formularioCanonico(formulario)).digest('hex');
  const { data, error } = await client.rpc('create_erp_hiring_request', {
    p_organization_id: staff.organizationId,
    p_actor: { user_id: staff.uid, name: staff.name },
    p_form: formulario,
    p_form_hash: hash,
    p_client_key: cleanString(corpo.client_key, 80),
  });
  if (error) throw erroDoBanco(error);
  return jsonResponse(201, { success: true, data: montarPedido(data, [], []) });
};

const decidir = async (client, staff, corpo) => {
  const id = String(corpo.request_id || '');
  const versao = Number(corpo.version);
  if (!UUID.test(id) || !Number.isInteger(versao) || versao < 1) throw httpError('Pedido inválido.', 422);
  const decisao = corpo.decision === 'aprovar' ? 'aprovar' : corpo.decision === 'recusar' ? 'recusar' : '';
  if (!decisao) throw httpError('Decisão inválida.', 422);
  const motivo = cleanString(corpo.reason, 1000);
  if (decisao === 'recusar' && motivo.length < 3) throw httpError('Escreva o motivo da recusa.', 422);
  // Pelo link, o token tem que ser o deste pedido e o pedido tem que estar
  // em aberto. Quem é o aprovador da etapa atual o banco confere sempre.
  if (corpo.token !== undefined) {
    if (!tokenValido(corpo.token)) throw httpError('Link inválido.', 404);
    const { data: doLink, error: erroLink } = await client.from('erp_hiring_requests').select('id, status')
      .eq('organization_id', staff.organizationId).eq('link_token', corpo.token).maybeSingle();
    if (erroLink) throw erroLink;
    if (!doLink || doLink.id !== id) throw httpError('Link inválido.', 404);
    if (!emAberto(doLink.status)) throw httpError('Este link expirou. A solicitação já foi encerrada.', 410);
  }
  const { data, error } = await client.rpc('sign_erp_hiring_request', {
    p_organization_id: staff.organizationId,
    p_request_id: id,
    p_expected_version: versao,
    p_actor: { user_id: staff.uid, name: staff.name },
    p_decision: decisao,
    p_signature: decisao === 'aprovar' ? assinaturaDoCorpo(corpo.signature) : {},
    p_reason: decisao === 'recusar' ? motivo : null,
  });
  if (error) throw erroDoBanco(error);
  return jsonResponse(200, { success: true, data });
};

const definirPapel = async (client, staff, corpo) => {
  const id = String(corpo.user_id || '');
  if (!UUID.test(id)) throw httpError('Pessoa inválida.', 422);
  if (!['gerente_1', 'gerente_2', 'rh', 'auxiliar'].includes(corpo.role)) throw httpError('Papel inválido.', 422);
  const { error } = await client.rpc('set_erp_hiring_role', {
    p_organization_id: staff.organizationId,
    p_actor: { user_id: staff.uid, name: staff.name },
    p_user_id: id,
    p_role: corpo.role,
    p_active: corpo.active === true,
  });
  if (error) throw erroDoBanco(error);
  return jsonResponse(200, { success: true });
};

export const handler = async event => {
  try {
    const metodo = assertHttpMethod(event, ['GET', 'POST']);
    const staff = await requireSupabaseUser(event);
    const client = getSupabaseAdmin();
    if (metodo === 'GET') {
      const leitor = await leitorDaSessao(client, staff);
      const token = event.queryStringParameters?.token;
      if (token !== undefined) return await abrirPeloLink(client, staff, leitor, String(token));
      return await listar(client, staff, leitor);
    }
    const corpo = parseJsonBody(event, 400_000);
    if (corpo.action === 'criar') return await criar(client, staff, corpo);
    if (corpo.action === 'decidir') return await decidir(client, staff, corpo);
    if (corpo.action === 'papel') return await definirPapel(client, staff, corpo);
    throw httpError('Ação inválida.', 422);
  } catch (error) {
    return functionErrorResponse(error);
  }
};
