// Painel Dev no preview: dados de exemplo em memória, com a mesma trava do
// próprio acesso e o mesmo desfazer do servidor (api/dev-acessos.js).
import type { DadosPainelDev, MudancaDeAcesso, PapelContratacaoDev } from '../src/services/devAcessosApi';
import type { Capacidade } from '../src/utils/permissoes';
import type { UserRole } from '../src/app/navigation/navigation';
import { normalizarAcoes } from '../src/utils/regrasDeAcesso';
export type * from '../src/services/devAcessosApi';

const agora = Date.now();
const iso = (horas: number) => new Date(agora - horas * 3_600_000).toISOString();
const dados: DadosPainelDev = {
  me: 'u-deivid',
  people: [
    { user_id: 'u-bruno', name: 'Bruno Luscher', email: 'bruno@renea.com.br', membership: 'editor', claimed_role: 'gestor', active: true, last_sign_in_at: iso(3), dev: false },
    { user_id: 'u-cassia', name: 'Cássia Moura', email: 'cassia@renea.com.br', membership: 'editor', claimed_role: 'operador', active: true, last_sign_in_at: iso(20), dev: false },
    { user_id: 'u-deivid', name: 'Deivid Brandão', email: 'deivid@renea.com.br', membership: 'admin', claimed_role: 'admin', active: true, last_sign_in_at: iso(0.2), dev: true },
    { user_id: 'u-giulia', name: 'Giulia Yukari', email: 'giulia@renea.com.br', membership: 'viewer', claimed_role: 'leitura', active: true, last_sign_in_at: iso(48), dev: false },
    { user_id: 'u-jose', name: 'José Augusto', email: 'jose@renea.com.br', membership: 'editor', claimed_role: 'operador', active: false, last_sign_in_at: iso(400), dev: false },
    { user_id: 'u-sergio', name: 'Sérgio Lima', email: 'sergio@renea.com.br', membership: 'editor', claimed_role: 'operador', active: true, last_sign_in_at: iso(5), dev: false },
  ],
  rules: [
    { user_id: 'u-giulia', tab: 'lancamentos', actions: ['ver'], updated_at: iso(30) },
    { user_id: 'u-cassia', tab: 'cadastros', actions: ['ver', 'editar'], updated_at: iso(26) },
    { user_id: 'u-sergio', tab: 'estacas', actions: [], updated_at: iso(2) },
  ],
  hiring: [{ user_id: 'u-bruno', role: 'gerente' }, { user_id: 'u-giulia', role: 'auxiliar' }],
  audit: [],
};
let proximo = 1;
const nome = (id: string) => dados.people.find(p => p.user_id === id)?.name ?? '';
const anotar = (linha: Omit<MudancaDeAcesso, 'id' | 'actor_name' | 'target_name' | 'undone' | 'created_at'>, horas = 0) => {
  const item: MudancaDeAcesso = { ...linha, id: proximo++, actor_name: 'Deivid Brandão', target_name: nome(linha.target_user_id), undone: false, created_at: iso(horas) };
  dados.audit.unshift(item);
  if (item.undoes_id) { const desfeita = dados.audit.find(a => a.id === item.undoes_id); if (desfeita) desfeita.undone = true; }
  return { id: item.id };
};
anotar({ target_user_id: 'u-giulia', kind: 'aba', item: 'lancamentos', before: null, after: 'ver', undoes_id: null }, 30);
anotar({ target_user_id: 'u-cassia', kind: 'aba', item: 'cadastros', before: null, after: 'ver,editar', undoes_id: null }, 26);
anotar({ target_user_id: 'u-sergio', kind: 'aba', item: 'estacas', before: null, after: '', undoes_id: null }, 2);

const espera = () => new Promise(r => setTimeout(r, 150));
const copia = () => structuredClone(dados);
const trava = (id: string, texto: string) => { if (id === dados.me) throw new Error(texto); };

const aba = (userId: string, tab: string, actions: Capacidade[] | null, undoes: number | null = null) => {
  const lista = actions === null ? null : normalizarAcoes(actions);
  if (lista && !lista.includes('ver')) trava(userId, 'Trava de segurança: você não pode esconder uma aba de si mesmo.');
  const atual = dados.rules.find(r => r.user_id === userId && r.tab === tab);
  dados.rules = dados.rules.filter(r => r !== atual);
  if (lista) dados.rules.push({ user_id: userId, tab, actions: lista, updated_at: iso(0) });
  return anotar({ target_user_id: userId, kind: 'aba', item: tab, before: atual ? atual.actions.join(',') : null, after: lista ? lista.join(',') : null, undoes_id: undoes });
};
const perfil = (userId: string, value: string, undoes: number | null = null) => {
  if (value !== 'admin') trava(userId, 'Trava de segurança: você não pode tirar o seu próprio perfil de administrador.');
  const p = dados.people.find(x => x.user_id === userId)!;
  const antes = p.claimed_role;
  p.claimed_role = value; p.membership = value === 'admin' ? 'admin' : value === 'leitura' ? 'viewer' : 'editor';
  return anotar({ target_user_id: userId, kind: 'perfil', item: 'perfil', before: antes, after: value, undoes_id: undoes });
};
const situacao = (userId: string, ativo: boolean, undoes: number | null = null) => {
  if (!ativo) trava(userId, 'Trava de segurança: você não pode inativar o seu próprio login.');
  const p = dados.people.find(x => x.user_id === userId)!;
  const antes = p.active; p.active = ativo;
  return anotar({ target_user_id: userId, kind: 'situacao', item: 'situacao', before: antes ? 'ativo' : 'inativo', after: ativo ? 'ativo' : 'inativo', undoes_id: undoes });
};
const contratacao = (userId: string, role: PapelContratacaoDev, active: boolean, undoes: number | null = null) => {
  dados.hiring = dados.hiring.filter(h => !(h.user_id === userId && h.role === role));
  if (active) dados.hiring.push({ user_id: userId, role });
  return anotar({ target_user_id: userId, kind: 'contratacao', item: role, before: active ? 'nao' : 'sim', after: active ? 'sim' : 'nao', undoes_id: undoes });
};

export const carregarPainelDev = async () => { await espera(); return copia(); };
export const mudarAbaDaPessoa = async (u: string, t: string, l: Capacidade[] | null) => { await espera(); return aba(u, t, l); };
const senhaDeExemplo = () => Array.from({ length: 12 }, () => 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 55)]).join('');
export const criarLoginDev = async (fullName: string, email: string, role: UserRole) => {
  await espera();
  const user_id = `u-${Date.now()}`;
  dados.people.push({ user_id, name: fullName, email, membership: role === 'admin' ? 'admin' : role === 'leitura' ? 'viewer' : 'editor', claimed_role: role, active: true, last_sign_in_at: null, dev: false });
  dados.people.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  return { ...anotar({ target_user_id: user_id, kind: 'criacao', item: 'login', before: null, after: role, undoes_id: null }), user_id, senha: senhaDeExemplo() };
};
export const gerarNovaSenha = async (u: string) => {
  await espera();
  trava(u, 'A sua própria senha você troca pelo "Recuperar senha" da tela de entrada.');
  return { ...anotar({ target_user_id: u, kind: 'senha', item: 'senha', before: null, after: 'nova senha temporária', undoes_id: null }), senha: senhaDeExemplo() };
};
export const mudarPerfilDaPessoa = async (u: string, v: string) => { await espera(); return perfil(u, v); };
export const mudarSituacaoDaPessoa = async (u: string, a: boolean) => { await espera(); return situacao(u, a); };
export const mudarContratacaoDaPessoa = async (u: string, r: PapelContratacaoDev, a: boolean) => { await espera(); return contratacao(u, r, a); };
export const desfazerMudanca = async (id: number) => {
  await espera();
  const l = dados.audit.find(a => a.id === id);
  if (!l || l.undone) throw new Error('Esta mudança já foi desfeita.');
  if (l.kind === 'aba') return aba(l.target_user_id, l.item, l.before === null ? null : l.before.split(',').filter(Boolean) as Capacidade[], id);
  if (l.kind === 'perfil') return perfil(l.target_user_id, l.before ?? 'leitura', id);
  if (l.kind === 'situacao') return situacao(l.target_user_id, l.before === 'ativo', id);
  if (l.kind === 'contratacao') return contratacao(l.target_user_id, l.item as PapelContratacaoDev, l.before === 'sim', id);
  throw new Error('Esta mudança não tem como ser desfeita.');
};
