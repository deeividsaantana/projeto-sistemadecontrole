import { useEffect, useState } from 'react';
import { CloudOff } from 'lucide-react';

export default function OfflineStatusV29() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);
  if (online) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-rose-500/30 bg-slate-950 px-4 py-2 text-xs font-black text-rose-300 shadow-2xl">
      <CloudOff className="h-4 w-4" />
      Sem conexão: os dados permanecem disponíveis neste dispositivo
    </div>
  );
}
