import { supabaseAuth as auth } from '../auth/supabaseAuth';

export type TipoSolicitacao = 'contratacao' | 'promocao' | 'desligamento';

/**
 * Formulário das 3 solicitações (regras em api/_shared/contratacao-regras.js).
 * Contratação: SGR-FRH-21-373-01-000-000-0008. Promoção: "Solicitação de
 * cargo e salário" (…0011). Desligamento: "Check list de desligamento" (…0027).
 * Cada tipo usa só os seus campos; pedido antigo sem `solicitacao` é contratação.
 */
export interface FormularioContratacao {
  solicitacao?: TipoSolicitacao;
  data: string;
  /** Candidato (16/11/2026). Pedidos antigos não têm: a tela mostra "—". */
  candidato?: string;
  cpf?: string;
  inicio?: string;
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
  // Promoção (cargo e salário)
  alteracao?: string;
  registro?: string;
  admissao?: string;
  ultimaAlteracao?: string;
  cargoAtual?: string;
  cargoProposto?: string;
  salarioAtual?: string;
  salarioProposto?: string;
  nivelAtual?: string;
  nivelProposto?: string;
  justificativa?: string;
  // Desligamento (check list)
  desligamento?: string;
  motivoDeslig?: string;
  solicitadoPor?: string;
  pagamentoRescisao?: string;
  convenios?: string[];
  procedimentos?: string[];
  acessos?: string[];
  devolucao?: string[];
  devolucaoOutros?: string;
}

export type Etapa = 'rh' | 'gerente_1' | 'gerente_2';
export type SituacaoContratacao = 'etapa_1' | 'etapa_2' | 'etapa_3' | 'concluido' | 'recusada';
export type PapelContratacao = Etapa | 'auxiliar';
/** Nomes marcados em "Quem assina" para cada etapa. */

export interface AssinaturaContratacao {
  id: string;
  /** 'solicitante' só aparece em pedidos do fluxo antigo (antes de 16/11/2026). */
  stage: Etapa | 'solicitante' | 'gerente';
  signer_user_id: string;
  signer_name: string;
  signer_cargo: string | null;
  hash_validacao: string | null;
  method: 'desenho' | 'digitado';
  image_data: string | null;
  form_hash: string;
  signed_at: string;
}

export interface EventoContratacao {
  actor_name: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  details: { reason?: string; method?: string; cargo?: string; hash_validacao?: string };
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
  etapa_atual: 1 | 2 | 3 | null;
  /** Só vem enquanto o pedido está em aberto; encerrado, o link expirou. */
  link_token: string | null;
  concluded_at: string | null;
  rejected_stage: Etapa | 'gerente' | null;
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
  /** Dono do sistema: só ele apaga pedidos de vez (o servidor confere de novo). */
  dev?: boolean;
  papeis: PapelContratacao[];
  /** Desenho guardado por esta pessoa para as próximas assinaturas. */
  assinaturaSalva?: string | null;
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

/** Resposta do link individual: o pedido, ou só o aviso de expirado. */
export type DadosDoLink =
  | { me: Leitor; expirado: 'concluido' | 'recusada' }
  | { me: Leitor; request: PedidoContratacao; expirado?: undefined };

export interface AssinaturaEnviada {
  /** 'salva': o servidor usa o desenho guardado desta pessoa. */
  method: 'desenho' | 'digitado' | 'salva';
  image_data?: string;
  /** Guardar este desenho para as próximas vezes. */
  guardar?: boolean;
}

interface Envelope<T> { success: boolean; data?: T; message?: string }

const chamar = async <T>(init: RequestInit = {}, busca = ''): Promise<T> => {
  const usuario = auth.currentUser;
  if (!usuario) throw new Error('Entre com seu login para continuar.');
  const resposta = await fetch(`/api/contratacao${busca}`, {
    ...init,
    headers: { Authorization: `Bearer ${await usuario.getIdToken()}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    cache: 'no-store',
  }).catch(() => { throw new Error('Sem conexão com o servidor. Confira a internet e tente de novo.'); });
  const corpo = await resposta.json().catch(() => ({})) as Envelope<T>;
  if (!resposta.ok || corpo.success !== true) throw new Error(corpo.message || 'Não foi possível concluir. Tente de novo.');
  return corpo.data as T;
};

export const carregarContratacoes = () => chamar<DadosContratacao>({ method: 'GET' });

export const carregarPeloLink = (token: string) => chamar<DadosDoLink>({ method: 'GET' }, `?token=${encodeURIComponent(token)}`);

export const criarContratacao = (form: FormularioContratacao, clientKey: string) =>
  chamar<PedidoContratacao>({ method: 'POST', body: JSON.stringify({ action: 'criar', form, client_key: clientKey }) });

/** Pelo link, o token vai junto e o servidor confere que é deste pedido. Assinando, `reason` é o comentário opcional. */
export const decidirContratacao = (pedido: Pick<PedidoContratacao, 'id' | 'version'>, decisao: 'aprovar' | 'recusar', signature?: AssinaturaEnviada, reason?: string, token?: string) =>
  chamar<PedidoContratacao>({ method: 'POST', body: JSON.stringify({ action: 'decidir', request_id: pedido.id, version: pedido.version, decision: decisao, signature, reason, token }) });

/** Apaga o pedido de vez (só o dono do sistema). */
export const apagarContratacao = (requestId: string) =>
  chamar<{ request_number: string }>({ method: 'POST', body: JSON.stringify({ action: 'apagar', request_id: requestId }) });

export const apagarAssinaturaSalva = () => chamar<void>({ method: 'POST', body: JSON.stringify({ action: 'apagar_assinatura' }) });

/** Endereço do link individual de um pedido. */
export const linkDoPedido = (token: string) => `${window.location.origin}/contratacao-link/${token}`;

export const definirPapelContratacao = (userId: string, role: PapelContratacao, active: boolean) =>
  chamar<void>({ method: 'POST', body: JSON.stringify({ action: 'papel', user_id: userId, role, active }) });
