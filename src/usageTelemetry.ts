import { auth } from './firebase';

export interface UsageSummaryItem {
  id: string;
  label: string;
  count: number;
}

export interface UsageSummary {
  periodDays: number;
  totalViews: number;
  activeUsers: number;
  tabs: UsageSummaryItem[];
  updatedAt: string;
}

const endpoint = '/.netlify/functions/usage-telemetry';
const isLocalPreview = () => typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);

const getAuthorizationHeaders = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error('Faça login para registrar o uso do sistema.');
  return {
    Authorization: `Bearer ${await user.getIdToken()}`,
    'Content-Type': 'application/json',
  };
};

export const recordTabUsage = async (tabId: string, label: string) => {
  if (isLocalPreview()) return;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: await getAuthorizationHeaders(),
      body: JSON.stringify({ kind: 'tab_view', key: tabId, label }),
      keepalive: true,
    });
    if (!response.ok) throw new Error(`Telemetria recusada (${response.status}).`);
  } catch (error) {
    // A medição nunca pode impedir o trabalho operacional.
    console.warn('Não foi possível registrar o uso desta aba:', error);
  }
};

export const loadUsageSummary = async (periodDays = 30): Promise<UsageSummary> => {
  if (isLocalPreview()) throw new Error('Resumo de uso disponível somente no ambiente Netlify.');
  const response = await fetch(`${endpoint}?days=${Math.max(1, Math.min(90, periodDays))}`, {
    headers: await getAuthorizationHeaders(),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success !== true) {
    throw new Error(payload?.message || 'Não foi possível carregar o uso real do sistema.');
  }
  return payload.summary as UsageSummary;
};
