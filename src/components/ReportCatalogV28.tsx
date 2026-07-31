import React, { useMemo, useState } from 'react';
import { FileArchive, FileSpreadsheet, Printer, Search } from 'lucide-react';
import { filterReportCatalog, REPORT_CATALOG } from '../utils/reportCatalog';

export default function ReportCatalogV28() {
  const [search, setSearch] = useState('');
  const [moduleName, setModuleName] = useState('');
  const modules = Array.from(new Set(REPORT_CATALOG.map(item => item.modulo)));
  const reports = useMemo(() => filterReportCatalog(search, moduleName), [search, moduleName]);

  return (
    <section className="space-y-4 rounded-2xl border border-emerald-500/20 bg-slate-950 p-5 print:hidden">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400">ERP v2.8</p><h2 className="text-xl font-black text-white">Catálogo de relatórios</h2><p className="text-xs text-slate-500">Exportação Excel, PDF, CSV e impressão com fechamento por período.</p></div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3"><Search className="h-4 w-4 text-slate-500" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar relatório" className="bg-transparent py-2 text-xs text-white outline-none" /></label>
          <select value={moduleName} onChange={e => setModuleName(e.target.value)} className="input-dark"><option value="">Todos os módulos</option>{modules.map(item => <option key={item}>{item}</option>)}</select>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {reports.map(report => <article key={report.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="flex items-start gap-3"><div className="rounded-lg bg-emerald-500/10 p-2"><FileArchive className="h-4 w-4 text-emerald-400" /></div><div><p className="text-[9px] font-black uppercase tracking-wider text-emerald-400">{report.modulo}</p><h3 className="font-black text-white">{report.nome}</h3></div></div><p className="mt-3 text-xs leading-relaxed text-slate-500">{report.descricao}</p><div className="mt-3 flex flex-wrap gap-1">{report.formatos.map(format => <span key={format} className="rounded bg-slate-800 px-2 py-1 text-[9px] font-bold text-slate-300">{format}</span>)}</div></article>)}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500"><FileSpreadsheet className="h-4 w-4 text-emerald-400" /> Use os botões de exportação do relatório selecionado. <Printer className="ml-2 h-4 w-4 text-emerald-400" /> Os períodos arquivados permanecem íntegros e fora do painel ativo.</div>
    </section>
  );
}
