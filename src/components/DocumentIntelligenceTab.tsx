import React, { useState } from 'react';
import { AlertTriangle, BrainCircuit, CheckCircle2, FileSearch, ShieldCheck } from 'lucide-react';
import type { DocumentAnalysis } from '../utils/documentIntelligence';
import { readOperationalDocument } from '../utils/documentIntelligence';

export default function DocumentIntelligenceTab() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const analyze = async () => {
    if (!file && !text.trim()) {
      setError('Selecione um arquivo ou cole o texto extraído por OCR.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      setAnalysis(await readOperationalDocument(file || new File([''], 'texto.txt', { type: 'text/plain' }), text));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível analisar o documento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-emerald-500/20 bg-slate-950 p-6">
        <div className="flex items-start gap-4"><div className="rounded-xl bg-emerald-500/10 p-3"><BrainCircuit className="h-6 w-6 text-emerald-400" /></div><div><p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400">ERP v3.0</p><h2 className="text-2xl font-black text-white">Inteligência documental operacional</h2><p className="mt-1 text-xs text-slate-400">Leitura local, preenchimento assistido, inconsistências e sugestões. A operação não depende de IA externa.</p></div></div>
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-950 p-6 text-xs font-black text-slate-300 hover:border-emerald-500/50"><FileSearch className="h-5 w-5 text-emerald-400" />{file ? file.name : 'Selecionar PDF, TXT ou CSV'}<input type="file" accept=".pdf,.txt,.csv,text/plain,application/pdf" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={12} placeholder="Cole aqui texto de OCR, ticket, NF, recebimento de estacas ou relatório comercial..." className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs text-white outline-none focus:border-emerald-500" />
          <button type="button" onClick={() => void analyze()} disabled={loading} className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white hover:bg-emerald-500 disabled:opacity-50">{loading ? 'Analisando localmente...' : 'Analisar documento'}</button>
          {error && <p className="text-xs font-bold text-rose-400">{error}</p>}
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          {!analysis ? <div className="flex h-full min-h-72 flex-col items-center justify-center text-center"><ShieldCheck className="h-10 w-10 text-slate-700" /><p className="mt-3 text-sm font-black text-slate-400">Nenhum documento analisado</p><p className="mt-1 max-w-sm text-xs text-slate-600">Os campos somente são sugeridos; a gravação nos módulos continua exigindo revisão humana.</p></div> : <div className="space-y-4"><div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-wider text-emerald-400">Tipo identificado</p><h3 className="text-lg font-black text-white">{analysis.type}</h3></div><span className={`rounded-full px-3 py-1 text-xs font-black ${analysis.requiresHumanReview ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'}`}>{Math.round(analysis.confidence * 100)}% confiança</span></div><div className="grid gap-2 sm:grid-cols-2">{analysis.fields.map(field => <div key={field.field} className="rounded-lg border border-slate-800 bg-slate-950 p-3"><p className="text-[9px] font-black uppercase text-slate-600">{field.label}</p><p className="mt-1 break-words text-xs font-bold text-white">{field.value}</p><p className="mt-1 text-[9px] text-slate-600">{Math.round(field.confidence * 100)}% · {field.source}</p></div>)}</div>{analysis.inconsistencies.length > 0 ? <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4"><p className="flex items-center gap-2 text-xs font-black text-amber-300"><AlertTriangle className="h-4 w-4" /> Revisão necessária</p>{analysis.inconsistencies.map(item => <p key={item} className="mt-1 text-xs text-amber-200/70">• {item}</p>)}</div> : <p className="flex items-center gap-2 text-xs font-black text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Sem inconsistências automáticas</p>}</div>}
        </section>
      </div>
    </div>
  );
}
