import React, { useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw, ShieldCheck } from 'lucide-react';
import type { HistoryLog } from '../types';
import { loadPersistedAuditTrail, type PersistedAuditLog } from '../services/masterDataApi';

type AuditoriaTabProps = {
  historyLogs: HistoryLog[];
};

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value || 'Sem data' : date.toLocaleString('pt-BR');
};

export default function AuditoriaTab({ historyLogs }: AuditoriaTabProps) {
  const [remoteLogs, setRemoteLogs] = useState<PersistedAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      setRemoteLogs(await loadPersistedAuditTrail());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível consultar a auditoria protegida.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const localLogs = useMemo(() => historyLogs.slice(0, 100), [historyLogs]);

  return (
    <section className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-400">Governança</p>
          <h1 className="mt-1 text-2xl font-black text-white">Auditoria</h1>
          <p className="mt-1 text-sm text-slate-400">Histórico local e trilha protegida das operações administrativas.</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-700 px-3 text-xs font-bold text-slate-200 hover:border-emerald-500 disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <header className="flex items-center gap-2 border-b border-slate-800 p-4">
            <Activity className="h-5 w-5 text-sky-400" />
            <div><h2 className="font-bold text-white">Histórico operacional</h2><p className="text-xs text-slate-500">{localLogs.length} evento(s) no dispositivo</p></div>
          </header>
          <div className="max-h-[520px] overflow-y-auto">
            {localLogs.map(log => (
              <div key={log.id} className="border-b border-slate-800 p-4 last:border-0">
                <div className="flex items-center justify-between gap-3"><strong className="text-sm text-white">{log.acao} • {log.tela}</strong><span className="text-[10px] text-slate-500">{log.timestamp}</span></div>
                <p className="mt-1 text-xs text-slate-400">{log.descricao}</p>
                <p className="mt-2 text-[10px] font-bold uppercase text-slate-500">{log.usuario}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <header className="flex items-center gap-2 border-b border-slate-800 p-4">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <div><h2 className="font-bold text-white">Trilha protegida</h2><p className="text-xs text-slate-500">Operações persistidas via Netlify e Firebase</p></div>
          </header>
          <div className="max-h-[520px] overflow-y-auto">
            {error ? <p className="p-4 text-sm text-amber-300">{error}</p> : null}
            {!loading && !error && remoteLogs.length === 0 ? <p className="p-4 text-sm text-slate-500">Nenhuma operação administrativa persistida ainda.</p> : null}
            {remoteLogs.map(log => (
              <div key={log.id} className="border-b border-slate-800 p-4 last:border-0">
                <div className="flex items-center justify-between gap-3"><strong className="text-sm text-white">{log.action} • {log.module}</strong><span className="text-[10px] text-slate-500">{formatDate(log.createdAtIso)}</span></div>
                <p className="mt-1 break-all text-xs text-slate-400">Registro: {log.recordId}</p>
                <p className="mt-2 text-[10px] font-bold uppercase text-slate-500">{log.userEmail || log.userId}</p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
