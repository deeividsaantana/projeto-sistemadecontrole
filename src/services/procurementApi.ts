import { supabaseAuth as auth } from '../auth/supabaseAuth';
import type { DadosAbertura, Solicitacao } from '../utils/solicitacoes';

interface ApiEnvelope<T> { success: boolean; data?: T; message?: string }

const headers = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error('Faça login para consultar Solicitações e Compras.');
  return { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' };
};

const request = async <T>(init: RequestInit = {}) => {
  const response = await fetch('/api/procurement', {
    ...init,
    headers: { ...await headers(), ...(init.headers || {}) },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({})) as ApiEnvelope<T>;
  if (!response.ok || payload.success !== true) throw new Error(payload.message || 'Não foi possível acessar Solicitações e Compras.');
  return payload.data as T;
};

export const createProcurementRequest = async (dados: DadosAbertura, requestNumber: string) => {
  if (!dados.itens.length) throw new Error('Inclua pelo menos um item.');
  return request<Solicitacao>({
    method: 'POST',
    body: JSON.stringify({
      request_number: requestNumber,
      work_front: dados.frente,
      stake_application: dados.estacamento,
      items: dados.itens.map(item => ({
        item_type: item.tipo,
        technical_description: item.descricao,
        quantity_requested: item.quantidade,
        unit: item.unidade,
        desired_deadline: item.prazoDesejado,
        allow_partial: item.permiteParcial,
        quantity_first_delivery: item.quantidadePrimeiraEntrega,
      })),
    }),
  });
};

export const loadProcurementRequests = async (status = '') => {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const response = await fetch(`/api/procurement${query}`, {
    method: 'GET',
    headers: { ...await headers(), Accept: 'application/json' },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({})) as ApiEnvelope<Solicitacao[]>;
  if (!response.ok || payload.success !== true) throw new Error(payload.message || 'Não foi possível carregar as solicitações.');
  return payload.data || [];
};
