import React, { useCallback, useEffect, useState } from 'react';
import { CloudOff, RefreshCw, Wifi } from 'lucide-react';
import { listOfflineCommands } from '../utils/offlineQueue';

export default function OfflineStatusV29() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pending, setPending] = useState(0);
  const refresh = useCallback(async () => setPending((await listOfflineCommands()).length), []);
  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    window.addEventListener('renea-offline-queue-change', refresh);
    void refresh();
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
      window.removeEventListener('renea-offline-queue-change', refresh);
    };
  }, [refresh]);
  if (online && pending === 0) return null;
  return (
    <div className={`fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border px-4 py-2 text-xs font-black shadow-2xl ${online ? 'border-amber-500/30 bg-slate-950 text-amber-300' : 'border-rose-500/30 bg-slate-950 text-rose-300'}`}>
      {online ? <Wifi className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
      {online ? `${pending} operação(ões) aguardando sincronização` : 'Modo offline: dados locais continuam disponíveis'}
      <button type="button" onClick={() => void refresh()} aria-label="Atualizar estado offline"><RefreshCw className="h-3.5 w-3.5" /></button>
    </div>
  );
}
