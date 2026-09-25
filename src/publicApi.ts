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

const callPublicApi = async <T,>(path: string, init?: RequestInit, timeoutMs = PUBLIC_API_TIMEOUT_MS): Promise<ApiEnvelope<T>> => {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  init?.signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);
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
      throw new Error(`O serviço demorou mais de ${Math.round(timeoutMs / 1000)} segundos. Verifique a conexão e tente novamente.`);
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
    `/api/public-presenca?token=${encodeURIComponent(token)}${dateParam}`,
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
  const response = await callPublicApi<{ submissionId: string; createdAtIso: string }>('/api/public-presenca', {
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
  const response = await callPublicApi<{ record: PresencaApontamento }>('/api/public-presenca', {
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
  const response = await callPublicApi<{ funcionario: Funcionario }>('/api/public-presenca', {
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
  const response = await callPublicApi<{ funcionarioId: string }>('/api/public-presenca', {
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
  const response = await callPublicApi<{ observacaoDia: string }>('/api/public-presenca', {
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
    `/api/public-presenca?grupoId=${encodeURIComponent(grupoId)}&data=${encodeURIComponent(data)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${idToken}` } },
  );
  return {
    success: true,
    message: response.message || 'Dia zerado.',
    registrosRemovidos: response.data?.registrosRemovidos || 0,
  };
};

/** Remove registros específicos também da fonte pública, para que a recuperação
 * manual não os recrie depois da exclusão no painel. */
export const deletePublicPresenceRecords = async (
  targets: Array<{ submissionDocId: string; recordIds: string[] }>,
) => {
  const { auth } = await import('./firebase');
  const user = auth.currentUser;
  if (!user) throw new Error('Faça login novamente para excluir os registros.');
  const idToken = await user.getIdToken();
  const response = await callPublicApi<{ registrosRemovidos: number }>('/api/public-presenca', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ action: 'excluir-registros', targets }),
  });
  return {
    success: true,
    message: response.message || 'Registros excluídos permanentemente.',
    registrosRemovidos: response.data?.registrosRemovidos || 0,
  };
};


const ticketAccessHeaders = (accessToken: string) => ({
  'X-Renea-Ticket-Access': accessToken,
});

export const validatePublicTicketAccess = async (accessToken: string) => {
  await callPublicApi<{ valid: true }>('/api/public-tickets?action=validate', {
    headers: ticketAccessHeaders(accessToken),
  });
};

export const getSecurePublicTicketLink = async () => {
  const { auth } = await import('./firebase');
  const user = auth.currentUser;
  if (!user) throw new Error('Faça login novamente para gerar o link público.');
  const idToken = await user.getIdToken();
  const response = await callPublicApi<{ path: string }>('/api/public-tickets?action=link', {
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
    `/api/public-tickets?q=${encodeURIComponent(query)}`,
    { headers: ticketAccessHeaders(accessToken) },
  );
  return response.data?.tickets || [];
};

export const reservePublicTicketNumberViaApi = async (accessToken: string): Promise<string> => {
  const response = await callPublicApi<{ ticketNumero: string }>('/api/public-tickets', {
    method: 'POST',
    headers: ticketAccessHeaders(accessToken),
    body: JSON.stringify({ action: 'reserve' }),
  });
  if (!response.data?.ticketNumero) throw new Error('Número de ticket não retornado.');
  return response.data.ticketNumero;
};

export const savePublicTicketViaApi = async (ticket: TicketJazida, accessToken: string) => {
  const response = await callPublicApi<{ ticket: TicketJazida }>('/api/public-tickets', {
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

/** Material recebido num ramo, como o link do apontador enxerga. */
export interface PublicMaterialStock {
  ramoId: string;
  materialId: string;
  descricao: string;
  unidade: string;
  comprimentoPecaM?: number;
  recebido: number;
  usado: number;
  saldo: number;
}

export interface PublicMaterialBranch {
  id: string;
  nome: string;
  materiais: PublicMaterialStock[];
}

export interface PublicMaterialTodayUse {
  id: string;
  ramoId: string;
  materialId: string;
  quantidade: number;
  apontador: string;
  criadoEm: string;
}

export interface PublicMaterialView {
  dataAtual: string;
  ramos: PublicMaterialBranch[];
  lancamentosHoje: PublicMaterialTodayUse[];
}

export interface PublicMaterialUseInput {
  envioId: string;
  data: string;
  etapaServicoId: string;
  apontador: string;
  itens: Array<{ materialId: string; quantidade: number }>;
  observacao?: string;
  /** Fotos em data URL JPEG, já reduzidas no celular. */
  fotos?: string[];
}

const materialAccessHeaders = (accessToken: string) => ({
  'X-Renea-Material-Access': accessToken,
});

export const loadPublicMaterialView = async (accessToken: string): Promise<PublicMaterialView> => {
  const response = await callPublicApi<PublicMaterialView>('/api/public-materiais', {
    headers: materialAccessHeaders(accessToken),
  });
  if (!response.data) throw new Error('O servidor não devolveu os materiais.');
  return response.data;
};

export const submitPublicMaterialUse = async (accessToken: string, input: PublicMaterialUseInput) => {
  const response = await callPublicApi<{ id: string; replay: boolean; view: PublicMaterialView; fotos?: number; fotosFalharam?: boolean }>('/api/public-materiais', {
    method: 'POST',
    headers: materialAccessHeaders(accessToken),
    body: JSON.stringify(input),
  }, input.fotos?.length ? 60_000 : undefined);
  return {
    message: response.message || 'Uso salvo.',
    view: response.data?.view,
    fotosFalharam: Boolean(response.data?.fotosFalharam),
  };
};

export const getSecurePublicMaterialLink = async () => {
  const { auth } = await import('./firebase');
  const user = auth.currentUser;
  if (!user) throw new Error('Faça login novamente para gerar o link dos apontadores.');
  const idToken = await user.getIdToken();
  const response = await callPublicApi<{ path: string }>('/api/public-materiais?action=link', {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!response.data?.path) throw new Error('O servidor não retornou o link dos apontadores.');
  return `${window.location.origin}${response.data.path}`;
};
