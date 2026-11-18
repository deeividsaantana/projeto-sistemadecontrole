// Primeiro acesso (18/11/2026): a pessoa abre o link que recebeu e cria a
// própria senha. Quem criou o login nunca vê essa senha. O banco guarda só o
// resumo do código do link; o link vale 7 dias e funciona uma vez só
// (supabase/migrations/202611180002_primeiro_acesso_cria_senha.sql).
// Tudo vai por POST para o código não ficar em log de endereço.
import crypto from 'node:crypto';
import {
  enforceRateLimit,
  functionErrorResponse,
  getAdminAuth,
  getSupabaseAdmin,
  jsonResponse,
  parseJsonBody,
  stableHash,
} from './_shared/supabase-admin.js';
import { assertHttpMethod, httpError } from './_shared/api-security.js';

export const VALIDADE_DO_LINK_DIAS = 7;
const TABELA = 'erp_first_access_links';
const CODIGO = /^[A-Za-z0-9_-]{43}$/;

const LINK_VENCIDO = 'Este link já foi usado ou venceu. Peça um link novo para quem criou o seu login.';

/** Senha que ninguém conhece: o login nasce com ela até a pessoa criar a sua. */
export const senhaQueNinguemSabe = () => crypto.randomBytes(32).toString('base64url');

/** Regras da senha, as mesmas da tela. Volta o motivo ou '' quando está boa. */
export const problemaDaSenha = (senha, repetida) => {
  const texto = String(senha ?? '');
  if (texto.length < 8) return 'A senha precisa ter pelo menos 8 letras ou números.';
  if (Buffer.byteLength(texto, 'utf8') > 72) return 'A senha está grande demais. Use até 72 letras ou números.';
  if (!/[A-Za-zÀ-ÿ]/.test(texto) || !/[0-9]/.test(texto)) return 'Use letras e números na senha.';
  if (texto !== String(repetida ?? '')) return 'As duas senhas não estão iguais. Digite de novo.';
  return '';
};

/**
 * Cria um link de primeiro acesso para a pessoa e cancela os anteriores dela.
 * Devolve só o código (vai para a tela de quem criou o login); o banco fica
 * só com o resumo.
 */
export const criarLinkDePrimeiroAcesso = async ({ organizationId, userId, createdBy }) => {
  const client = getSupabaseAdmin();
  const agora = new Date();
  const { error: erroCancelar } = await client.from(TABELA).update({ revoked_at: agora.toISOString() })
    .eq('user_id', userId).is('used_at', null).is('revoked_at', null);
  if (erroCancelar) throw erroDaTabela(erroCancelar);
  const codigo = crypto.randomBytes(32).toString('base64url');
  const { error } = await client.from(TABELA).insert({
    token_hash: stableHash(codigo),
    organization_id: organizationId,
    user_id: userId,
    created_by: createdBy || null,
    created_at: agora.toISOString(),
    expires_at: new Date(agora.getTime() + VALIDADE_DO_LINK_DIAS * 86_400_000).toISOString(),
  });
  if (error) throw erroDaTabela(error);
  return codigo;
};

const erroDaTabela = error => {
  const code = String(error?.code || '');
  if (code === '42P01' || code === 'PGRST205') {
    return httpError('O primeiro acesso ainda não foi ligado no banco. Rode o arquivo primeiro-acesso-cria-senha-18-11.sql no Supabase.', 409);
  }
  return error;
};

const codigoDoCorpo = corpo => {
  const codigo = String(corpo.token || '');
  if (!CODIGO.test(codigo)) throw httpError(LINK_VENCIDO, 410);
  return codigo;
};

const linkValido = async (client, codigo) => {
  const { data, error } = await client.from(TABELA).select('user_id, expires_at, used_at, revoked_at')
    .eq('token_hash', stableHash(codigo)).maybeSingle();
  if (error) throw erroDaTabela(error);
  if (!data || data.used_at || data.revoked_at || new Date(data.expires_at) <= new Date()) throw httpError(LINK_VENCIDO, 410);
  return data;
};

const pessoaDoLink = async userId => {
  const pessoa = await getAdminAuth().getUser(userId).catch(() => null);
  if (!pessoa) throw httpError(LINK_VENCIDO, 410);
  if (pessoa.disabled) throw httpError('Este login está desativado. Fale com quem criou o seu acesso.', 403);
  return pessoa;
};

const ver = async (client, codigo) => {
  const link = await linkValido(client, codigo);
  const pessoa = await pessoaDoLink(link.user_id);
  return { nome: pessoa.displayName || '', email: pessoa.email || '' };
};

const criarSenha = async (client, codigo, senha, repetida) => {
  const problema = problemaDaSenha(senha, repetida);
  if (problema) throw httpError(problema, 422);
  const link = await linkValido(client, codigo);
  const pessoa = await pessoaDoLink(link.user_id);
  // Marca como usado só se ainda estiver livre: dois envios ao mesmo tempo, só um passa.
  const agora = new Date().toISOString();
  const { data: usado, error } = await client.from(TABELA).update({ used_at: agora })
    .eq('token_hash', stableHash(codigo)).is('used_at', null).is('revoked_at', null).gt('expires_at', agora)
    .select('user_id').maybeSingle();
  if (error) throw erroDaTabela(error);
  if (!usado) throw httpError(LINK_VENCIDO, 410);
  const { error: erroSenha } = await client.auth.admin.updateUserById(usado.user_id, { password: String(senha) });
  if (erroSenha) {
    // A senha não foi gravada: o link volta a valer para a pessoa tentar de novo.
    await client.from(TABELA).update({ used_at: null }).eq('token_hash', stableHash(codigo));
    throw erroSenha;
  }
  return { email: pessoa.email || '' };
};

export const handler = async event => {
  try {
    assertHttpMethod(event, ['POST']);
    const corpo = parseJsonBody(event, 4_000);
    await enforceRateLimit(null, event, 'primeiro-acesso', 20, 600);
    const client = getSupabaseAdmin();
    const codigo = codigoDoCorpo(corpo);
    if (corpo.action === 'ver') return jsonResponse(200, { success: true, data: await ver(client, codigo) });
    if (corpo.action === 'criar') return jsonResponse(200, { success: true, data: await criarSenha(client, codigo, corpo.senha, corpo.repetida) });
    throw httpError('Ação inválida.', 422);
  } catch (error) {
    return functionErrorResponse(error);
  }
};
