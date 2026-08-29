import type {
  ApontamentoQuantidadeItem,
  ApontamentoRamo,
  ClimaApontamento,
  CondicaoApontamento,
  Funcionario,
  Empresa,
  GrupoEquipe,
  ObraLocal,
  PresencaStatus,
  TicketJazida,
  TurnoApontamento,
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
  empresas: Empresa[];
  obras: ObraLocal[];
}

export const loadPublicPresenceConfig = async (token: string): Promise<PublicPresenceConfig> => {
  const response = await callPublicApi<PublicPresenceConfig>(
    `/.netlify/functions/public-presenca?token=${encodeURIComponent(token)}`,
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
) => {
  const payload = { token, grupoId, data, items };
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

export interface PublicApontamentoConfig {
  ramos: ApontamentoRamo[];
}

export interface PublicApontamentoPayload {
  data: string;
  empresa: string;
  responsavel: string;
  funcaoApontador: string;
  funcoes: ApontamentoQuantidadeItem[];
  equipamentos: ApontamentoQuantidadeItem[];
  clima: Record<TurnoApontamento, ClimaApontamento>;
  condicao: Record<TurnoApontamento, CondicaoApontamento>;
  descricaoAtividade: string;
  observacao: string;
}

export const loadPublicApontamentoConfig = async (token: string): Promise<PublicApontamentoConfig> => {
  const response = await callPublicApi<PublicApontamentoConfig>(
    `/.netlify/functions/public-apontamento?token=${encodeURIComponent(token)}`,
  );
  if (!response.data) throw new Error('Configuração de apontamento não encontrada.');
  return response.data;
};

export const submitPublicApontamento = async (
  token: string,
  ramoId: string,
  payload: PublicApontamentoPayload,
) => {
  const requestPayload = { token, ramoId, ...payload };
  const response = await callPublicApi<never>('/.netlify/functions/public-apontamento', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': stableRequestKey('apontamento', requestPayload) },
    body: JSON.stringify(requestPayload),
  });
  return { success: true, message: response.message || 'Apontamento enviado com segurança.' };
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
