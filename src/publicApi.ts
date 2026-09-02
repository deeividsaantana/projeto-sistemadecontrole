import type {
  Funcionario,
  FuncionarioDisponivel,
  Empresa,
  GrupoEquipe,
  ObraLocal,
  PresencaApontamento,
  PresencaStatus,
  TicketJazida,
} from './types';

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data?: T;
}

const PUBLIC_API_TIMEOUT_MS = 8_000;

const callPublicApi = async <T,>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> => {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  init?.signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeoutId = globalThis.setTimeout(() => controller.abort(), PUBLIC_API_TIMEOUT_MS);
  try {
    const response = await fetch(path, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({ success: false, message: 'Resposta inválida do serviço.' })) as ApiEnvelope<T>;
    if (!response.ok || !payload.success) {
      throw new Error(payload.message || 'O serviço público não respondeu.');
    }
    return payload;
  } catch (error) {
    if (controller.signal.aborted && !init?.signal?.aborted) {
      throw new Error('O serviço demorou mais de 8 segundos. Verifique a conexão e tente novamente.');
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
    init?.signal?.removeEventListener('abort', abortFromCaller);
  }
};

const stableRequestKey = (kind: string, payload: unknown) => {
  const source = JSON.stringify(payload);
  let hash = 2166136261;
  let secondaryHash = 374761393;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
    secondaryHash ^= source.charCodeAt(index);
    secondaryHash = Math.imul(secondaryHash, 2246822519);
  }
  return `${kind}:${(hash >>> 0).toString(16).padStart(8, '0')}${(secondaryHash >>> 0).toString(16).padStart(8, '0')}`;
};

export interface PublicPresenceConfig {
  gruposEquipe: GrupoEquipe[];
  funcionarios: Funcionario[];
  /** Efetivo ativo fora das equipes do link, oferecido para inclusão em campo. */
  funcionariosDisponiveis?: FuncionarioDisponivel[];
  empresas: Empresa[];
  obras: ObraLocal[];
  meuGrupo?: GrupoEquipe | null;
  meusRegistros?: PresencaApontamento[];
  datasDisponiveis?: string[];
  dataSelecionada?: string;
  /** Observação do dia inteiro da equipe, quando houver. */
  observacaoDia?: string;
  historicoPorData?: Record<string, PresencaApontamento[]>;
  observacoesPorData?: Record<string, string>;
  dataAtual?: string;
}

export const loadPublicPresenceConfig = async (token: string, data = ''): Promise<PublicPresenceConfig> => {
  const dateParam = data ? `&data=${encodeURIComponent(data)}` : '';
  const response = await callPublicApi<PublicPresenceConfig>(
    `/.netlify/functions/public-presenca?token=${encodeURIComponent(token)}${dateParam}`,
  );
  if (!response.data || !Array.isArray(response.data.gruposEquipe)) {
    throw new Error('A lista de equipes retornada pelo serviço é inválida.');
  }
  return response.data;
};

export const submitPublicPresence = async (
  token: string,
  grupoId: string,
  data: string,
  items: Array<{ funcionarioId: string; status: PresencaStatus; observacao: string }>,
  observacaoDia = '',
) => {
  const payload = { token, grupoId, data, items, observacaoDia };
  const response = await callPublicApi<{ submissionId: string; createdAtIso: string }>('/.netlify/functions/public-presenca', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': stableRequestKey('presenca', payload) },
    body: JSON.stringify(payload),
  });
  return {
    success: true,
    message: response.message || 'Presença enviada com segurança.',
    submissionId: response.data?.submissionId,
    createdAtIso: response.data?.createdAtIso,
  };
};

export const updatePublicPresenceRecord = async (
  token: string,
  grupoId: string,
  funcionarioId: string,
  status: PresencaStatus,
  observacao: string,
) => {
  const payload = { token, grupoId, funcionarioId, status, observacao };
  const response = await callPublicApi<{ record: PresencaApontamento }>('/.netlify/functions/public-presenca', {
    method: 'PATCH',
    headers: { 'X-Idempotency-Key': stableRequestKey('presenca-update', payload) },
    body: JSON.stringify(payload),
  });
  return {
    success: true,
    message: response.message || 'Situação atualizada com segurança.',
    record: response.data?.record,
  };
};

/**
 * Vincula um colaborador do efetivo ativo à equipe do link. O serviço público
 * recusa quem já está em outra equipe ativa, para que ninguém seja contado
 * duas vezes no efetivo do dia.
 */
export const addPublicPresenceMember = async (
  token: string,
  grupoId: string,
  funcionarioId: string,
) => {
  const payload = { action: 'adicionar-colaborador', token, grupoId, funcionarioId };
  const response = await callPublicApi<{ funcionario: Funcionario }>('/.netlify/functions/public-presenca', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': stableRequestKey('presenca-membro', payload) },
    body: JSON.stringify(payload),
  });
  return {
    success: true,
    message: response.message || 'Colaborador incluído na equipe.',
    funcionario: response.data?.funcionario,
  };
};

/** Remove o vínculo com a equipe sem desativar o colaborador no efetivo. */
export const removePublicPresenceMember = async (
  token: string,
  grupoId: string,
  funcionarioId: string,
) => {
  const payload = { action: 'remover-colaborador', token, grupoId, funcionarioId };
  const response = await callPublicApi<{ funcionarioId: string }>('/.netlify/functions/public-presenca', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': stableRequestKey('presenca-remover-membro', payload) },
    body: JSON.stringify(payload),
  });
  return {
    success: true,
    message: response.message || 'Colaborador removido da equipe.',
    funcionarioId: response.data?.funcionarioId || funcionarioId,
  };
};

/** Registra ou apaga a observação do dia da equipe, sem tocar em situações. */
export const updatePublicPresenceDayNote = async (
  token: string,
  grupoId: string,
  observacaoDia: string,
) => {
  const payload = { action: 'observacao-dia', token, grupoId, observacaoDia };
  const response = await callPublicApi<{ observacaoDia: string }>('/.netlify/functions/public-presenca', {
    method: 'PATCH',
    headers: { 'X-Idempotency-Key': stableRequestKey('presenca-nota-dia', payload) },
    body: JSON.stringify(payload),
  });
  return { success: true, message: response.message || 'Observação registrada.', observacaoDia: response.data?.observacaoDia ?? observacaoDia };
};

/**
 * Zera o dia de uma equipe: apaga os envios e a reserva, liberando um novo
 * apontamento pelo link. Exige conta de equipe — não é ação de link público.
 */
export const resetPresenceDay = async (grupoId: string, data: string) => {
  const { auth } = await import('./firebase');
  const user = auth.currentUser;
  if (!user) throw new Error('Faça login novamente para zerar o dia.');
  const idToken = await user.getIdToken();
  const response = await callPublicApi<{ enviosRemovidos: number; registrosRemovidos: number }>(
    `/.netlify/functions/public-presenca?grupoId=${encodeURIComponent(grupoId)}&data=${encodeURIComponent(data)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${idToken}` } },
  );
  return {
    success: true,
    message: response.message || 'Dia zerado.',
    registrosRemovidos: response.data?.registrosRemovidos || 0,
  };
};


const ticketAccessHeaders = (accessToken: string) => ({
  'X-Renea-Ticket-Access': accessToken,
});

export const validatePublicTicketAccess = async (accessToken: string) => {
  await callPublicApi<{ valid: true }>('/.netlify/functions/public-tickets?action=validate', {
    headers: ticketAccessHeaders(accessToken),
  });
};

export const getSecurePublicTicketLink = async () => {
  const { auth } = await import('./firebase');
  const user = auth.currentUser;
  if (!user) throw new Error('Faça login novamente para gerar o link público.');
  const idToken = await user.getIdToken();
  const response = await callPublicApi<{ path: string }>('/.netlify/functions/public-tickets?action=link', {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!response.data?.path) throw new Error('O servidor não retornou o link protegido.');
  return `${window.location.origin}${response.data.path}`;
};

export const searchPendingPublicTickets = async (
  query: string,
  accessToken: string,
): Promise<TicketJazida[]> => {
  const response = await callPublicApi<{ tickets: TicketJazida[] }>(
    `/.netlify/functions/public-tickets?q=${encodeURIComponent(query)}`,
    { headers: ticketAccessHeaders(accessToken) },
  );
  return response.data?.tickets || [];
};

export const reservePublicTicketNumberViaApi = async (accessToken: string): Promise<string> => {
  const response = await callPublicApi<{ ticketNumero: string }>('/.netlify/functions/public-tickets', {
    method: 'POST',
    headers: ticketAccessHeaders(accessToken),
    body: JSON.stringify({ action: 'reserve' }),
  });
  if (!response.data?.ticketNumero) throw new Error('Número de ticket não retornado.');
  return response.data.ticketNumero;
};

export const savePublicTicketViaApi = async (ticket: TicketJazida, accessToken: string) => {
  const response = await callPublicApi<{ ticket: TicketJazida }>('/.netlify/functions/public-tickets', {
    method: 'POST',
    headers: ticketAccessHeaders(accessToken),
    body: JSON.stringify({ action: 'save', ticket }),
  });
  return {
    success: true,
    message: response.message || 'Ticket salvo com segurança.',
    ticket: response.data?.ticket || ticket,
  };
};
