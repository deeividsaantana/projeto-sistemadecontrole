// Painel Dev de acessos (16/11/2026). Só o dono do sistema usa: cada chamada
// passa por funções do banco que conferem erp_dev_owners antes de ler ou
// gravar (supabase/migrations/202611160001_painel_dev_acessos.sql). Quem é
// quem vem da sessão (token do Supabase), nunca do corpo do pedido.
// Senha o dev não vê nem escolhe (18/11/2026): login novo e "esqueci a senha"
// geram um link de primeiro acesso (api/primeiro-acesso.js) e a pessoa cria
// a própria senha.
import {
  functionErrorResponse,
  getAdminAuth,
  getSupabaseAdmin,
  jsonResponse,
  parseJsonBody,
  requireSupabaseUser,
} from './_shared/supabase-admin.js';
import { assertHttpMethod, httpError } from './_shared/api-security.js';
import { createUser, getRequestContext, updateUser } from './master-data.js';
import { criarLinkDePrimeiroAcesso } from './primeiro-acesso.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ABA = /^[a-z][a-z-]{1,40}$/;
const ACOES = ['ver', 'editar', 'aprovar', 'excluir'];
const PERFIS = new Set(['admin', 'gestor', 'operador', 'leitura']);
// Os mesmos papéis da aba Contratação (17/11/2026): 1ª RH, 2ª e 3ª gerente, auxiliar.
const PAPEIS_CONTRATACAO = new Set(['rh', 'gerente_1', 'gerente_2', 'auxiliar']);

export const erroDoBanco = error => {
  const code = String(error?.code || '');
  if (code === 'PGRST202' || code === '42883' || code === '42P01') {
    return httpError('O painel ainda não foi ligado no banco. Rode o arquivo banco/painel-dev-acessos.sql no Supabase.', 409);
  }
  const status = code === 'P0001' ? 409 : code === 'P0002' ? 404 : code === 'P0003' ? 403 : code === 'P0004' ? 422 : 0;
  if (!status) return error;
  return httpError(String(error.message || 'Operação recusada.'), status);
};

const pessoaValida = valor => {
  const id = String(valor || '');
  if (!UUID.test(id)) throw httpError('Pessoa inválida.', 422);
  return id;
};

/** A mesma trava do banco, já aqui, para o perfil e a situação (que mudam no Auth). */
export const travaDoProprioAcesso = ({ alvo, ator, tipo, valor }) => {
  if (alvo !== ator) return;
  if (tipo === 'perfil' && valor !== 'admin') throw httpError('Trava de segurança: você não pode tirar o seu próprio perfil de administrador.', 409);
  if (tipo === 'situacao' && valor !== 'ativo') throw httpError('Trava de segurança: você não pode inativar o seu próprio login.', 409);
};

const chamar = async (client, funcao, args) => {
  const { data, error } = await client.rpc(funcao, args);
  if (error) throw erroDoBanco(error);
  return data;
};

const assertDev = async (client, staff) => {
  const ehDev = await chamar(client, 'erp_is_dev', { p_organization_id: staff.organizationId, p_user_id: staff.uid });
  if (ehDev !== true) throw httpError('Só o dono do sistema mexe nos acessos.', 403);
};

const ator = staff => ({ user_id: staff.uid, name: staff.name });

/** null volta ao padrão do perfil; lista (mesmo vazia) é a regra da pessoa. */
export const acoesDoCorpo = valor => {
  if (valor === null) return null;
  if (!Array.isArray(valor) || valor.some(acao => !ACOES.includes(acao))) throw httpError('Ação inválida.', 422);
  return ACOES.filter(acao => valor.includes(acao) || (acao === 'ver' && valor.length > 0));
};

const mudarAba = (client, staff, userId, aba, acoes, desfaz = null) => {
  if (!ABA.test(aba) || aba === 'dev') throw httpError('Aba inválida.', 422);
  return chamar(client, 'set_erp_access_rule', {
    p_organization_id: staff.organizationId, p_actor: ator(staff), p_user_id: userId, p_tab: aba, p_actions: acoes, p_undoes: desfaz,
  });
};

const criarLogin = async (event, client, staff, corpo) => {
  const email = String(corpo.email || '').trim().toLowerCase();
  const nome = String(corpo.fullName || '').trim().slice(0, 240);
  const perfil = String(corpo.role || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError('E-mail inválido.', 422);
  if (!nome) throw httpError('Escreva o nome da pessoa.', 422);
  if (!PERFIS.has(perfil)) throw httpError('Perfil inválido.', 422);
  const existe = await getAdminAuth().getUserByEmail(email).catch(error => {
    if (error?.code === 'auth/user-not-found') return null;
    throw error;
  });
  if (existe) throw httpError('Esse e-mail já tem login. Para a pessoa criar uma senha nova, use "Link para criar senha" nela.', 409);
  const resposta = await createUser({ email, fullName: nome, role: perfil }, await getRequestContext(event));
  const { uid, primeiroAcesso } = JSON.parse(resposta.body).data;
  if (!primeiroAcesso) throw httpError('O login foi criado, mas o link não. Use "Link para criar senha" na pessoa.', 409);
  const id = await registrar(client, staff, uid, 'criacao', 'login', null, perfil);
  return { id, user_id: uid, token: primeiroAcesso };
};

/** "Esqueci a senha": link para a pessoa criar outra. A atual vale até ela criar. */
const linkDeSenha = async (client, staff, userId) => {
  if (userId === staff.uid) throw httpError('A sua própria senha você troca pelo "Recuperar senha" da tela de entrada.', 409);
  // Só troca a senha de quem é desta empresa.
  const { data: membro, error: erroMembro } = await client.from('organization_members').select('user_id')
    .eq('organization_id', staff.organizationId).eq('user_id', userId).maybeSingle();
  if (erroMembro) throw erroDoBanco(erroMembro);
  if (!membro) throw httpError('Pessoa não encontrada nesta empresa.', 404);
  const token = await criarLinkDePrimeiroAcesso({ organizationId: staff.organizationId, userId, createdBy: staff.uid });
  const id = await registrar(client, staff, userId, 'senha', 'link', null, 'link para criar senha');
  return { id, token };
};

const registrar = (client, staff, userId, tipo, item, antes, depois, desfaz = null) => chamar(client, 'record_erp_access_change', {
  p_organization_id: staff.organizationId, p_actor: ator(staff), p_user_id: userId, p_kind: tipo, p_item: item,
  p_before: antes, p_after: depois, p_undoes: desfaz,
});

/** Perfil e situação mudam pelo mesmo caminho da tela de Acessos (Auth + cadastro do usuário). */
const mudarPerfilOuSituacao = async (event, client, staff, userId, tipo, valor, desfaz = null) => {
  if (tipo === 'perfil' && !PERFIS.has(valor)) throw httpError('Perfil inválido.', 422);
  if (tipo === 'situacao' && valor !== 'ativo' && valor !== 'inativo') throw httpError('Situação inválida.', 422);
  travaDoProprioAcesso({ alvo: userId, ator: staff.uid, tipo, valor });
  const atual = await getAdminAuth().getUser(userId);
  const perfilAtual = PERFIS.has(atual.customClaims?.role) ? atual.customClaims.role : 'leitura';
  const situacaoAtual = atual.disabled ? 'inativo' : 'ativo';
  const antes = tipo === 'perfil' ? perfilAtual : situacaoAtual;
  if (antes === valor) throw httpError('Nada mudou: já está assim.', 409);
  const contexto = await getRequestContext(event);
  await updateUser({
    uid: userId,
    role: tipo === 'perfil' ? valor : perfilAtual,
    active: tipo === 'situacao' ? valor === 'ativo' : situacaoAtual === 'ativo',
  }, contexto);
  return registrar(client, staff, userId, tipo, tipo, antes, valor, desfaz);
};

const mudarContratacao = async (client, staff, userId, papel, ativo, desfaz = null) => {
  if (!PAPEIS_CONTRATACAO.has(papel)) throw httpError('Papel inválido.', 422);
  const { data, error } = await client.from('erp_hiring_roles').select('role')
    .eq('organization_id', staff.organizationId).eq('user_id', userId).eq('role', papel).maybeSingle();
  if (error) throw erroDoBanco(error);
  if (Boolean(data) === ativo) throw httpError('Nada mudou: já está assim.', 409);
  await chamar(client, 'set_erp_hiring_role', {
    p_organization_id: staff.organizationId, p_actor: ator(staff), p_user_id: userId, p_role: papel, p_active: ativo,
  });
  return registrar(client, staff, userId, 'contratacao', papel, ativo ? 'nao' : 'sim', ativo ? 'sim' : 'nao', desfaz);
};

/** Desfazer aplica de novo o "antes" da linha e grava uma linha nova que aponta para ela. */
const desfazer = async (event, client, staff, idTexto) => {
  const id = Number(idTexto);
  if (!Number.isSafeInteger(id) || id <= 0) throw httpError('Mudança inválida.', 422);
  const { data: linha, error } = await client.from('erp_access_audit').select('*')
    .eq('organization_id', staff.organizationId).eq('id', id).maybeSingle();
  if (error) throw erroDoBanco(error);
  if (!linha) throw httpError('Mudança não encontrada.', 404);
  const { data: jaDesfeita, error: erroDesfeita } = await client.from('erp_access_audit').select('id').eq('undoes_id', id).maybeSingle();
  if (erroDesfeita) throw erroDoBanco(erroDesfeita);
  if (jaDesfeita) throw httpError('Esta mudança já foi desfeita.', 409);
  const alvo = linha.target_user_id;
  if (linha.kind === 'aba') {
    const antes = linha.before_value === null ? null : String(linha.before_value).split(',').filter(Boolean);
    return mudarAba(client, staff, alvo, linha.item, antes, id);
  }
  if (linha.kind === 'perfil' || linha.kind === 'situacao') return mudarPerfilOuSituacao(event, client, staff, alvo, linha.kind, linha.before_value, id);
  if (linha.kind === 'contratacao') return mudarContratacao(client, staff, alvo, linha.item, linha.before_value === 'sim', id);
  throw httpError('Esta mudança não tem como ser desfeita.', 422);
};

export const handler = async event => {
  try {
    const metodo = assertHttpMethod(event, ['GET', 'POST']);
    const staff = await requireSupabaseUser(event);
    const client = getSupabaseAdmin();
    await assertDev(client, staff);
    if (metodo === 'GET') {
      const data = await chamar(client, 'erp_dev_panel', { p_organization_id: staff.organizationId, p_actor: ator(staff) });
      return jsonResponse(200, { success: true, data });
    }
    const corpo = parseJsonBody(event, 20_000);
    if (corpo.action === 'criar') return jsonResponse(201, { success: true, data: await criarLogin(event, client, staff, corpo) });
    if (corpo.action === 'senha') return jsonResponse(200, { success: true, data: await linkDeSenha(client, staff, pessoaValida(corpo.user_id)) });
    let id;
    if (corpo.action === 'aba') {
      id = await mudarAba(client, staff, pessoaValida(corpo.user_id), String(corpo.tab || ''), acoesDoCorpo(corpo.actions));
    } else if (corpo.action === 'perfil' || corpo.action === 'situacao') {
      id = await mudarPerfilOuSituacao(event, client, staff, pessoaValida(corpo.user_id), corpo.action, String(corpo.value || ''));
    } else if (corpo.action === 'contratacao') {
      id = await mudarContratacao(client, staff, pessoaValida(corpo.user_id), String(corpo.role || ''), corpo.active === true);
    } else if (corpo.action === 'desfazer') {
      id = await desfazer(event, client, staff, corpo.id);
    } else {
      throw httpError('Ação inválida.', 422);
    }
    return jsonResponse(200, { success: true, data: { id } });
  } catch (error) {
    return functionErrorResponse(error);
  }
};
