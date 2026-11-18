// Primeiro acesso (18/11/2026): quem cria o login não escolhe nem vê a senha.
// Na tela de entrada a pessoa digita o e-mail; se o login ainda não tem
// senha dela, aparece "Crie sua senha" e ela cria ali mesmo.
//
// "Ainda sem senha" é uma linha aberta em erp_first_access_links (migração
// 202611180002): nasce quando o login é criado, ou quando o dono libera
// "criar senha nova" para quem esqueceu. A linha fecha (used_at) na hora em
// que a pessoa cria a senha, de forma atômica: dois envios ao mesmo tempo,
// só um passa. Login desativado nunca cria senha.
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

const TABELA = 'erp_first_access_links';
// Sem prazo: a pessoa cria a senha quando for entrar pela primeira vez.
const SEM_PRAZO = '2999-12-31T00:00:00.000Z';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Senha que ninguém conhece: o login nasce com ela até a pessoa criar a sua. */
export const senhaQueNinguemSabe = () => crypto.randomBytes(32).toString('base64url');

/** Regras da senha, as mesmas da tela (src/utils/regrasDaSenha.ts). Volta o motivo ou '' quando está boa. */
export const problemaDaSenha = (senha, repetida) => {
  const texto = String(senha ?? '');
  if (texto.length < 8) return 'A senha precisa ter pelo menos 8 letras ou números.';
  if (Buffer.byteLength(texto, 'utf8') > 72) return 'A senha está grande demais. Use até 72 letras ou números.';
  if (!/[A-Za-zÀ-ÿ]/.test(texto) || !/[0-9]/.test(texto)) return 'Use letras e números na senha.';
  if (texto !== String(repetida ?? '')) return 'As duas senhas não estão iguais. Digite de novo.';
  return '';
};

const erroDaTabela = error => {
  const code = String(error?.code || '');
  if (code === '42P01' || code === 'PGRST205') {
    return httpError('O primeiro acesso ainda não foi ligado no banco. Rode o arquivo primeiro-acesso-cria-senha-18-11.sql no Supabase.', 409);
  }
  return error;
};

/**
 * Deixa a pessoa criar a própria senha na tela de entrada. Usado ao criar o
 * login e quando o dono libera "criar senha nova". Fecha o que estava aberto.
 */
export const liberarCriarSenha = async ({ organizationId, userId, createdBy }) => {
  const client = getSupabaseAdmin();
  const agora = new Date().toISOString();
  const { error: erroFechar } = await client.from(TABELA).update({ revoked_at: agora })
    .eq('user_id', userId).is('used_at', null).is('revoked_at', null);
  if (erroFechar) throw erroDaTabela(erroFechar);
  const { error } = await client.from(TABELA).insert({
    token_hash: stableHash(`criar-senha|${userId}|${crypto.randomBytes(16).toString('hex')}`),
    organization_id: organizationId,
    user_id: userId,
    created_by: createdBy || null,
    created_at: agora,
    expires_at: SEM_PRAZO,
  });
  if (error) throw erroDaTabela(error);
};

/** A pessoa do e-mail e a liberação aberta dela, ou null quando já tem senha. */
const pendenciaDoEmail = async (client, email) => {
  const pessoa = await getAdminAuth().getUserByEmail(email).catch(error => {
    if (error?.code === 'auth/user-not-found') return null;
    throw error;
  });
  if (!pessoa || pessoa.disabled) return null;
  const { data, error } = await client.from(TABELA).select('token_hash')
    .eq('user_id', pessoa.uid).is('used_at', null).is('revoked_at', null).gt('expires_at', new Date().toISOString())
    .limit(1).maybeSingle();
  if (error) throw erroDaTabela(error);
  return data ? { pessoa, chave: data.token_hash } : null;
};

const emailDoCorpo = corpo => {
  const email = String(corpo.email || '').trim().toLowerCase().slice(0, 320);
  if (!EMAIL.test(email)) throw httpError('E-mail inválido.', 422);
  return email;
};

const criarSenha = async (client, email, senha, repetida) => {
  const problema = problemaDaSenha(senha, repetida);
  if (problema) throw httpError(problema, 422);
  const pendencia = await pendenciaDoEmail(client, email);
  if (!pendencia) throw httpError('Este login já tem senha. Entre com ela ou use "Recuperar senha".', 409);
  const agora = new Date().toISOString();
  const { data: fechada, error } = await client.from(TABELA).update({ used_at: agora })
    .eq('token_hash', pendencia.chave).is('used_at', null).is('revoked_at', null)
    .select('user_id').maybeSingle();
  if (error) throw erroDaTabela(error);
  if (!fechada) throw httpError('Este login já tem senha. Entre com ela ou use "Recuperar senha".', 409);
  const { error: erroSenha } = await client.auth.admin.updateUserById(fechada.user_id, { password: String(senha) });
  if (erroSenha) {
    // A senha não foi gravada: a pessoa pode tentar de novo.
    await client.from(TABELA).update({ used_at: null }).eq('token_hash', pendencia.chave);
    throw erroSenha;
  }
  return { email };
};

export const handler = async event => {
  try {
    assertHttpMethod(event, ['POST']);
    const corpo = parseJsonBody(event, 4_000);
    const client = getSupabaseAdmin();
    const email = emailDoCorpo(corpo);
    if (corpo.action === 'verificar') {
      await enforceRateLimit(null, event, 'primeiro-acesso-verificar', 60, 600);
      return jsonResponse(200, { success: true, data: { criarSenha: Boolean(await pendenciaDoEmail(client, email)) } });
    }
    if (corpo.action === 'criar') {
      await enforceRateLimit(null, event, 'primeiro-acesso-criar', 10, 600);
      return jsonResponse(200, { success: true, data: await criarSenha(client, email, corpo.senha, corpo.repetida) });
    }
    throw httpError('Ação inválida.', 422);
  } catch (error) {
    return functionErrorResponse(error);
  }
};
