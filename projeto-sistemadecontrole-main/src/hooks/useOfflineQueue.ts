import { useEffect, useState } from 'react';
import { listOfflineCommands } from '../utils/offlineQueue';

/**
 * Conta comandos na fila offline (IndexedDB + fallback localStorage).
 * Ouve 'renea-offline-queue-change' (disparado por enqueue/remove),
 * mudanças de conexão e um poll de 30s — mesmo padrão de ModoCampoTab.
 */
export function useOfflineQueueCount(pollMs = 30_000): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      listOfflineCommands()
        .then(commands => { if (active) setCount(commands.length); })
        .catch(() => { if (active) setCount(0); });
    };
    refresh();
    const timer = window.setInterval(refresh, pollMs);
    window.addEventListener('renea-offline-queue-change', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('renea-offline-queue-change', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
    };
  }, [pollMs]);
  return count;
}
