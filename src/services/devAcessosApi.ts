import { supabaseAuth as auth } from '../auth/supabaseAuth';
import type { Capacidade } from '../utils/permissoes';
import type { UserRole } from '../app/navigation/navigation';

/** Painel Dev de acessos: tudo passa por /api/dev-acessos, que confere no banco se é o dev. */
export type PapelContratacaoDev = 'rh' | 'gerente_1' | 'gerente_2' | 'auxiliar';

export interface PessoaDev {
  user_id: string;
  name: string;
  email: string;
  membership: string;
  claimed_role: string;
  active: boolean;
  last_sign_in_at: string | null;
  dev: boolean;
}

export interface MudancaDeAcesso {
  id: number;
  actor_name: string;
  target_user_id: string;
  target_name: string;
  kind: 'aba' | 'perfil' | 'situacao' | 'contratacao' | 'criacao' | 'senha';
  item: string;
  before: string | null;
  after: string | null;
  undoes_id: number | null;
  undone: boolean;
  created_at: string;
}

export interface DadosPainelDev {
  me: string;
  people: PessoaDev[];
  rules: Array<{ user_id: string; tab: string; actions: Capacidade[]; updated_at: string }>;
  hiring: Array<{ user_id: string; role: PapelContratacaoDev }>;
  audit: MudancaDeAcesso[];
}

interface Envelope<T> { success: boolean; data?: T; message?: string }

const chamar = async <T>(init: RequestInit = {}): Promise<T> => {
  const usuario = auth.currentUser;
  if (!usuario) throw new Error('Entre com seu login para continuar.');
  const resposta = await fetch('/api/dev-acessos', {
    ...init,
    headers: { Authorization: `Bearer ${await usuario.getIdToken()}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    cache: 'no-store',
  }).catch(() => { throw new Error('Sem conexão com o servidor. Confira a internet e tente de novo.'); });
  const corpo = await resposta.json().catch(() => ({})) as Envelope<T>;
  if (!resposta.ok || corpo.success !== true) throw new Error(corpo.message || 'Não foi possível concluir. Tente de novo.');
  return corpo.data as T;
};

const enviar = (corpo: Record<string, unknown>) => chamar<{ id: number }>({ method: 'POST', body: JSON.stringify(corpo) });

export const carregarPainelDev = () => chamar<DadosPainelDev>({ method: 'GET' });
/** actions null volta ao padrão do perfil; lista vazia tira a aba. */
export const mudarAbaDaPessoa = (userId: string, tab: string, actions: Capacidade[] | null) => enviar({ action: 'aba', user_id: userId, tab, actions });
/** A senha temporária volta só nesta resposta: mostre uma vez e não guarde. */
export const criarLoginDev = (fullName: string, email: string, role: UserRole) =>
  chamar<{ id: number; user_id: string; senha: string }>({ method: 'POST', body: JSON.stringify({ action: 'criar', fullName, email, role }) });
export const gerarNovaSenha = (userId: string) =>
  chamar<{ id: number; senha: string }>({ method: 'POST', body: JSON.stringify({ action: 'senha', user_id: userId }) });
export const mudarPerfilDaPessoa = (userId: string, value: UserRole) => enviar({ action: 'perfil', user_id: userId, value });
export const mudarSituacaoDaPessoa = (userId: string, ativo: boolean) => enviar({ action: 'situacao', user_id: userId, value: ativo ? 'ativo' : 'inativo' });
export const mudarContratacaoDaPessoa = (userId: string, role: PapelContratacaoDev, active: boolean) => enviar({ action: 'contratacao', user_id: userId, role, active });
export const desfazerMudanca = (id: number) => enviar({ action: 'desfazer', id });
