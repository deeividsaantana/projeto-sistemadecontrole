import type {
  ApontamentoQuantidadeItem,
  ApontamentoRamo,
  ClimaApontamento,
  CondicaoApontamento,
  Funcionario,
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

const callPublicApi = async <T,>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> => {
  const response = await fetch(path, {
    ...init,
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
};

export interface PublicPresenceConfig {
  gruposEquipe: GrupoEquipe[];
  funcionarios: Funcionario[];
  obras: ObraLocal[];
}

export const loadPublicPresenceConfig = async (token: string): Promise<PublicPresenceConfig> => {
  const response = await callPublicApi<PublicPresenceConfig>(
    `/.netlify/functions/public-presenca?token=${encodeURIComponent(token)}`,
  );
  if (!response.data) throw new Error('Configuração de presença não encontrada.');
  return response.data;
};

export const submitPublicPresence = async (
  token: string,
  grupoId: string,
  data: string,
  items: Array<{ funcionarioId: string; status: PresencaStatus; observacao: string }>,
) => {
  const response = await callPublicApi<never>('/.netlify/functions/public-presenca', {
    method: 'POST',
    body: JSON.stringify({ token, grupoId, data, items }),
  });
  return { success: true, message: response.message || 'Presença enviada com segurança.' };
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
  const response = await callPublicApi<never>('/.netlify/functions/public-apontamento', {
    method: 'POST',
    body: JSON.stringify({ token, ramoId, ...payload }),
  });
  return { success: true, message: response.message || 'Apontamento enviado com segurança.' };
};

export const searchPendingPublicTickets = async (query: string): Promise<TicketJazida[]> => {
  const response = await callPublicApi<{ tickets: TicketJazida[] }>(
    `/.netlify/functions/public-tickets?q=${encodeURIComponent(query)}`,
  );
  return response.data?.tickets || [];
};

export const reservePublicTicketNumberViaApi = async (): Promise<string> => {
  const response = await callPublicApi<{ ticketNumero: string }>('/.netlify/functions/public-tickets', {
    method: 'POST',
    body: JSON.stringify({ action: 'reserve' }),
  });
  if (!response.data?.ticketNumero) throw new Error('Número de ticket não retornado.');
  return response.data.ticketNumero;
};

export const savePublicTicketViaApi = async (ticket: TicketJazida) => {
  const response = await callPublicApi<{ ticket: TicketJazida }>('/.netlify/functions/public-tickets', {
    method: 'POST',
    body: JSON.stringify({ action: 'save', ticket }),
  });
  return {
    success: true,
    message: response.message || 'Ticket salvo com segurança.',
    ticket: response.data?.ticket || ticket,
  };
};
