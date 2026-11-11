import type {
  Funcionario,
  FuncionarioDisponivel,
  Empresa,
  GrupoEquipe,
  ObraLocal,
  PresencaApontamento,
  PresencaStatus,
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
  /** Próximo sábado em YYYY-MM-DD */
  proximoSabado?: string;
  /** Escala do próximo sábado, por equipe */
  escalasSabado?: Record<string, Array<{ id: string; nome: string; escalado: boolean; observacao?: string }>>;
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

/** Salva a escala de sábado: quem da equipe vem trabalhar */
export const saveSaturdayScale = async (
  token: string,
  grupoId: string,
  scale: { funcionarios: Array<{ id: string; nome: string; escalado: boolean; observacao?: string }>; observacaoGeral?: string },
) => {
  const payload = { action: 'escala-sabado', token, grupoId, scale };
  const response = await callPublicApi<{ success: boolean }>('/api/public-presenca', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': stableRequestKey('escala-sabado', payload) },
    body: JSON.stringify(payload),
  });
  return { success: true, message: response.message || 'Escala de sábado salva.' };
};

/**
 * Zera o dia de uma equipe: apaga os envios e a reserva, liberando um novo
 * apontamento pelo link. Exige conta de equipe — não é ação de link público.
 */
export const resetPresenceDay = async (grupoId: string, data: string) => {
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

import { supabaseAuth as auth } from './auth/supabaseAuth';
