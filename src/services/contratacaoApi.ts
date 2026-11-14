import { supabaseAuth as auth } from '../auth/supabaseAuth';

/** Formulário do documento SGR-FRH-21-373-01-000-000-0008 (regras em api/_shared/contratacao-regras.js). */
export interface FormularioContratacao {
  data: string;
  prioridade: string;
  motivo: string;
  motivoOutro: string;
  tipo: string;
  posicao: string;
  quantidade: number | string;
  salario: string;
  requisitante: string;
  area: string;
  itens: string[];
  obs: string;
  aprovados: string;
  comentarios: string;
}

export type Etapa = 'solicitante' | 'rh' | 'gerente';
export type SituacaoContratacao = 'aguardando_rh' | 'aguardando_gerente' | 'aprovada' | 'recusada';
export type PapelContratacao = 'rh' | 'gerente' | 'auxiliar';

export interface AssinaturaContratacao {
  id: string;
  stage: Etapa;
  signer_user_id: string;
  signer_name: string;
  method: 'desenho' | 'digitado';
  image_data: string | null;
  form_hash: string;
  signed_at: string;
  /** Assinatura de etapa à frente de quem vê: só nome e hora. */
  oculta?: boolean;
}

export interface EventoContratacao {
  actor_name: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  details: { reason?: string; method?: string };
  created_at: string;
}

export interface PedidoContratacao {
  id: string;
  request_number: string;
  requester_user_id: string;
  requester_name: string;
  form: FormularioContratacao;
  form_hash: string;
  status: SituacaoContratacao;
  rejected_stage: 'rh' | 'gerente' | null;
  rejection_reason: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  signatures: AssinaturaContratacao[];
  history: EventoContratacao[];
}

export interface Leitor {
  userId: string;
  nome: string;
  admin: boolean;
  papeis: PapelContratacao[];
}

export interface PessoaContratacao {
  user_id: string;
  name: string;
  email: string;
  roles: PapelContratacao[];
}

export interface DadosContratacao {
  me: Leitor;
  requests: PedidoContratacao[];
  people?: PessoaContratacao[];
}

export interface AssinaturaEnviada {
  method: 'desenho' | 'digitado';
  image_data?: string;
}

interface Envelope<T> { success: boolean; data?: T; message?: string }

const chamar = async <T>(init: RequestInit = {}): Promise<T> => {
  const usuario = auth.currentUser;
  if (!usuario) throw new Error('Entre com seu login para continuar.');
  const resposta = await fetch('/api/contratacao', {
    ...init,
    headers: { Authorization: `Bearer ${await usuario.getIdToken()}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    cache: 'no-store',
  }).catch(() => { throw new Error('Sem conexão com o servidor. Confira a internet e tente de novo.'); });
  const corpo = await resposta.json().catch(() => ({})) as Envelope<T>;
  if (!resposta.ok || corpo.success !== true) throw new Error(corpo.message || 'Não foi possível concluir. Tente de novo.');
  return corpo.data as T;
};

export const carregarContratacoes = () => chamar<DadosContratacao>({ method: 'GET' });

export const criarContratacao = (form: FormularioContratacao, signature: AssinaturaEnviada, clientKey: string) =>
  chamar<PedidoContratacao>({ method: 'POST', body: JSON.stringify({ action: 'criar', form, signature, client_key: clientKey }) });

export const decidirContratacao = (pedido: Pick<PedidoContratacao, 'id' | 'version'>, decisao: 'aprovar' | 'recusar', signature?: AssinaturaEnviada, reason?: string) =>
  chamar<PedidoContratacao>({ method: 'POST', body: JSON.stringify({ action: 'decidir', request_id: pedido.id, version: pedido.version, decision: decisao, signature, reason }) });

export const definirPapelContratacao = (userId: string, role: PapelContratacao, active: boolean) =>
  chamar<void>({ method: 'POST', body: JSON.stringify({ action: 'papel', user_id: userId, role, active }) });
