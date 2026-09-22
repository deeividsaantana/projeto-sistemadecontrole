import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Columns3, FileSpreadsheet, Loader2, Search, X } from 'lucide-react';
import OperationalAnalysisPanel from './OperationalAnalysisPanel';
import type { OperationalAnalysis } from '../utils/operationalAnalysis';

export interface SpreadsheetPreviewRow {
  [column: string]: string | number | null | undefined;
}

export interface ImportBatchPreviewViewModel {
  readonly batchId: string;
  readonly sourceHash: string;
  readonly sheets: readonly {
    sheetName: string;
    recognized: boolean;
    domain?: string;
    rowCount: number;
    reason?: string;
    columnMapping?: readonly { column: string; mappedTo: string | null }[];
  }[];
  readonly counts: Readonly<Record<string, number>>;
  readonly rows: readonly { reference: string; status: string; messages: readonly string[] }[];
  readonly dryRunRan: boolean;
  readonly onRunDryRun: () => void;
  readonly applyAuthorized?: boolean;
}

interface SpreadsheetImportReviewProps {
  open: boolean;
  title: string;
  fileName: string;
  validCount: number;
  ignoredCount?: number;
  columns: string[];
  rows: SpreadsheetPreviewRow[];
  note?: string;
  analysis?: OperationalAnalysis;
  confirming?: boolean;
  batchPreview?: ImportBatchPreviewViewModel;
  onCancel: () => void;
  onConfirm: () => void;
}

const displayValue = (value: SpreadsheetPreviewRow[string]) => {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
};

export default function SpreadsheetImportReview({
  open,
  title,
  fileName,
  validCount,
  ignoredCount = 0,
  columns,
  rows,
  note,
  analysis,
  confirming = false,
  batchPreview,
  onCancel,
  onConfirm
}: SpreadsheetImportReviewProps) {
  const [query, setQuery] = useState('');
  const [showAllColumns, setShowAllColumns] = useState(false);
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setShowAllColumns(false);
  }, [open, fileName]);
  const previewColumns = showAllColumns ? columns : columns.slice(0, 6);
  const visibleRows = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('pt-BR');
    if (!term) return rows;
    return rows.filter(row => columns.some(column => displayValue(row[column]).toLocaleLowerCase('pt-BR').includes(term)));
  }, [columns, query, rows]);

  return (
    <>
      {open && (
        <div
          className="renea-enter fixed inset-0 z-[120] flex items-center justify-center bg-white p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="spreadsheet-import-title"
        >
          <div
            className="renea-enter flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-700">
                  <FileSpreadsheet className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase text-emerald-700">Revisão da importação</p>
                  <h2 id="spreadsheet-import-title" className="mt-1 text-lg font-black text-slate-950">{title}</h2>
                  <p className="mt-1 truncate text-xs text-slate-500" title={fileName}>{fileName}</p>
                </div>
              </div>
              <button type="button" onClick={onCancel} disabled={confirming} className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50" title="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5 sm:px-6">
              {!batchPreview && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <span className="text-[10px] font-black uppercase text-slate-500">Linhas reconhecidas</span>
                  <strong className="mt-1 block text-2xl text-slate-950">{rows.length}</strong>
                </div>
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
                  <span className="text-[10px] font-black uppercase text-emerald-700">Prontas para importar</span>
                  <strong className="mt-1 block text-2xl text-emerald-950">{validCount}</strong>
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                  <span className="text-[10px] font-black uppercase text-amber-700">Sem dados reconhecíveis</span>
                  <strong className="mt-1 block text-2xl text-amber-950">{ignoredCount}</strong>
                </div>
                <div className="rounded-md border border-sky-200 bg-sky-50 p-4">
                  <span className="text-[10px] font-black uppercase text-slate-500">Colunas reconhecidas</span>
                  <strong className="mt-1 block text-2xl text-slate-950">{columns.length}</strong>
                </div>
              </div>}

              {note && (
                <div className="mt-4 flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-xs font-semibold leading-relaxed text-sky-950">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
                  <span>{note}</span>
                </div>
              )}

              {analysis && (
                <div className="mt-4">
                  <OperationalAnalysisPanel analysis={analysis} variant="light" />
                </div>
              )}

              {batchPreview && (
                <div className="mt-5 space-y-4">
                  <div className="rounded-md border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div><span className="text-[10px] font-black uppercase text-slate-500">Lote de importação</span><p className="mt-1 font-mono text-xs text-slate-800">{batchPreview.batchId}</p></div>
                      <div className="text-right"><span className="text-[10px] font-black uppercase text-slate-500">Hash do arquivo (SHA-256)</span><p className="mt-1 font-mono text-[10px] text-slate-500" title={batchPreview.sourceHash}>{batchPreview.sourceHash.slice(0, 16)}…</p></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                    {Object.entries(batchPreview.counts).map(([status, count]) => <div key={status} className="rounded-md border border-slate-200 bg-slate-50 p-3"><span className="text-[9px] font-black uppercase text-slate-500">{status}</span><strong className="mt-1 block text-lg text-slate-950">{count}</strong></div>)}
                  </div>
                  <div className="overflow-hidden rounded-md border border-slate-200">
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5"><h3 className="text-xs font-black uppercase text-slate-700">Abas da planilha</h3></div>
                    <ul className="divide-y divide-slate-100">{batchPreview.sheets.map(sheet => <li key={sheet.sheetName} className="px-4 py-2.5 text-xs"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><span className="font-bold text-slate-800">{sheet.sheetName}</span><span className={sheet.recognized ? 'text-emerald-700' : 'text-amber-700'}>{sheet.recognized ? `${sheet.domain} · ${sheet.rowCount} linha(s)` : `Pendente de mapeamento · ${sheet.rowCount} linha(s) · ${sheet.reason}`}</span></div>{sheet.columnMapping && <div className="mt-1.5 flex flex-wrap gap-1">{sheet.columnMapping.map(mapping => <span key={mapping.column} className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${mapping.mappedTo ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`} title={mapping.mappedTo ? `Mapeada para ${mapping.mappedTo}` : 'Coluna sem correspondência'}>{mapping.column}{mapping.mappedTo ? ` → ${mapping.mappedTo}` : ' (sem correspondência)'}</span>)}</div>}</li>)}</ul>
                  </div>
                  <div className="overflow-hidden rounded-md border border-slate-200"><div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5"><h3 className="text-xs font-black uppercase text-slate-700">Linhas e referência de origem</h3></div><ul className="max-h-[30vh] divide-y divide-slate-100 overflow-auto">{batchPreview.rows.slice(0, 200).map((row, index) => <li key={index} className="px-4 py-2 text-xs"><div className="flex items-center justify-between gap-2"><span className="font-mono text-slate-700">{row.reference}</span><span className="font-black uppercase text-slate-500">{row.status}</span></div>{row.messages.length > 0 && <ul className="mt-1 list-disc pl-4 text-[11px] text-slate-500">{row.messages.map((message, messageIndex) => <li key={messageIndex}>{message}</li>)}</ul>}</li>)}</ul></div>
                </div>
              )}

              {!batchPreview && <div className="mt-5 overflow-hidden rounded-md border border-slate-200">
                <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xs font-black uppercase text-slate-700">Conferência dos dados</h3>
                    <span className="text-[10px] font-bold text-slate-500">Mostrando até 50 linhas • {visibleRows.length} encontrada(s)</span>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <label className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Localizar na importação" className="h-9 w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 text-xs text-slate-800 outline-none focus:border-emerald-500 sm:w-56" />
                    </label>
                    {columns.length > 6 && (
                      <button type="button" onClick={() => setShowAllColumns(value => !value)} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-[10px] font-black text-slate-700 hover:bg-slate-100">
                        <Columns3 className="h-3.5 w-3.5" /> {showAllColumns ? 'Colunas principais' : `Ver ${columns.length} colunas`}
                      </button>
                    )}
                  </div>
                </div>
                <div className="max-h-[44vh] overflow-auto">
                  <table className="w-full min-w-[620px] border-collapse text-left text-xs">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-white">
                        {previewColumns.map(column => (
                          <th key={column} className="border-b border-slate-200 px-3 py-2.5 font-black text-slate-600">{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.slice(0, 50).map((row, index) => (
                        <tr key={index} className="odd:bg-slate-50/70">
                          {previewColumns.map(column => (
                            <td key={column} className="max-w-52 truncate border-b border-slate-100 px-3 py-2.5 text-slate-700" title={displayValue(row[column])}>
                              {displayValue(row[column])}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {visibleRows.length === 0 && (
                        <tr><td colSpan={Math.max(1, previewColumns.length)} className="px-4 py-8 text-center text-xs font-semibold text-slate-500">Nenhuma linha corresponde à pesquisa.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>}
            </div>

            {batchPreview ? <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-[10px] font-bold leading-relaxed text-slate-500 sm:max-w-md">Somente linhas novas e válidas serão gravadas. Duplicadas e linhas em conferência permanecem fora do lote.</p>
              <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={onCancel} className="min-h-10 rounded-md border border-slate-300 bg-white px-5 text-xs font-black text-slate-700">Fechar</button><button type="button" onClick={batchPreview.onRunDryRun} className="min-h-10 rounded-md border border-emerald-600 bg-white px-5 text-xs font-black text-emerald-700">{batchPreview.dryRunRan ? 'Executar dry-run novamente' : 'Executar dry-run'}</button><button type="button" onClick={onConfirm} disabled={!batchPreview.applyAuthorized || !batchPreview.dryRunRan || validCount === 0} className="min-h-10 rounded-md bg-emerald-700 px-5 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">Aplicar importação</button></div>
            </div> : <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button type="button" onClick={onCancel} disabled={confirming} className="min-h-10 rounded-md border border-slate-300 bg-white px-5 text-xs font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50">
                Cancelar
              </button>
              <button type="button" onClick={onConfirm} disabled={confirming || validCount === 0} className="flex min-h-10 items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 text-xs font-black text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300">
                {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {confirming ? 'Importando...' : `Confirmar ${validCount} registro(s)`}
              </button>
            </div>}
          </div>
        </div>
      )}
    </>
  );
}
