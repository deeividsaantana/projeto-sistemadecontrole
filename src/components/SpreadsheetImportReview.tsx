import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Columns3, Loader2, Search } from 'lucide-react';
import { Modal } from '../shared/ui';
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

  // Janela comum do sistema (Modal): Esc fecha, o foco fica preso dentro e
  // ninguém fecha no meio de uma importação (busy). A prévia é uma tabela de
  // conferência das primeiras linhas, por isso fica com <caption> e th scope
  // em vez da TabelaPadrao.
  const rodape = batchPreview ? (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold leading-relaxed text-slate-600 sm:max-w-md">Somente linhas novas e válidas serão gravadas. Duplicadas e linhas em conferência permanecem fora do lote.</p>
      <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={onCancel} className="min-h-11 rounded-lg border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 lg:min-h-10">Fechar</button><button type="button" onClick={batchPreview.onRunDryRun} className="min-h-11 rounded-lg border border-emerald-600 bg-white px-5 text-sm font-bold text-emerald-800 lg:min-h-10">{batchPreview.dryRunRan ? 'Executar dry-run novamente' : 'Executar dry-run'}</button><button type="button" onClick={onConfirm} disabled={!batchPreview.applyAuthorized || !batchPreview.dryRunRan || validCount === 0} className="min-h-11 rounded-lg bg-emerald-700 px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700 lg:min-h-10">Aplicar importação</button></div>
    </div>
  ) : (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button type="button" onClick={onCancel} disabled={confirming} className="min-h-11 rounded-lg border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50 lg:min-h-10">
        Cancelar
      </button>
      <button type="button" onClick={onConfirm} disabled={confirming || validCount === 0} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700 lg:min-h-10">
        {confirming ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
        {confirming ? 'Importando...' : `Confirmar ${validCount} registro(s)`}
      </button>
    </div>
  );

  return (
    <Modal
      open={open}
      title={title}
      description={<>Revisão da importação · <span className="break-all">{fileName}</span></>}
      size="xl"
      busy={confirming}
      onClose={onCancel}
      footer={rodape}
    >
            <div>
              {!batchPreview && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <span className="text-xs font-black uppercase text-slate-600">Linhas reconhecidas</span>
                  <strong className="mt-1 block text-2xl text-slate-950">{rows.length}</strong>
                </div>
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
                  <span className="text-xs font-black uppercase text-emerald-800">Prontas para importar</span>
                  <strong className="mt-1 block text-2xl text-emerald-950">{validCount}</strong>
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                  <span className="text-xs font-black uppercase text-amber-800">Sem dados reconhecíveis</span>
                  <strong className="mt-1 block text-2xl text-amber-950">{ignoredCount}</strong>
                </div>
                <div className="rounded-md border border-sky-200 bg-sky-50 p-4">
                  <span className="text-xs font-black uppercase text-slate-600">Colunas reconhecidas</span>
                  <strong className="mt-1 block text-2xl text-slate-950">{columns.length}</strong>
                </div>
              </div>}

              {note && (
                <div className="mt-4 flex items-start gap-2 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-xs font-semibold leading-relaxed text-sky-950">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" aria-hidden="true" />
                  <span>{note}</span>
                </div>
              )}

              {analysis && (
                <div className="mt-4">
                  <OperationalAnalysisPanel analysis={analysis} />
                </div>
              )}

              {batchPreview && (
                <div className="mt-5 space-y-4">
                  <div className="rounded-md border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div><span className="text-xs font-black uppercase text-slate-500">Lote de importação</span><p className="mt-1 font-mono text-xs text-slate-800">{batchPreview.batchId}</p></div>
                      <div className="text-right"><span className="text-xs font-black uppercase text-slate-500">Hash do arquivo (SHA-256)</span><p className="mt-1 font-mono text-xs text-slate-500" title={batchPreview.sourceHash}>{batchPreview.sourceHash.slice(0, 16)}…</p></div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                    {Object.entries(batchPreview.counts).map(([status, count]) => <div key={status} className="rounded-md border border-slate-200 bg-slate-50 p-3"><span className="text-xs font-black uppercase text-slate-500">{status}</span><strong className="mt-1 block text-lg text-slate-950">{count}</strong></div>)}
                  </div>
                  <div className="overflow-hidden rounded-md border border-slate-200">
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5"><h3 className="text-xs font-black uppercase text-slate-700">Abas da planilha</h3></div>
                    <ul className="divide-y divide-slate-100">{batchPreview.sheets.map(sheet => <li key={sheet.sheetName} className="px-4 py-2.5 text-xs"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><span className="font-bold text-slate-800">{sheet.sheetName}</span><span className={sheet.recognized ? 'text-emerald-700' : 'text-amber-700'}>{sheet.recognized ? `${sheet.domain} · ${sheet.rowCount} linha(s)` : `Pendente de mapeamento · ${sheet.rowCount} linha(s) · ${sheet.reason}`}</span></div>{sheet.columnMapping && <div className="mt-1.5 flex flex-wrap gap-1">{sheet.columnMapping.map(mapping => <span key={mapping.column} className={`rounded border px-1.5 py-0.5 text-xs font-bold ${mapping.mappedTo ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`} title={mapping.mappedTo ? `Mapeada para ${mapping.mappedTo}` : 'Coluna sem correspondência'}>{mapping.column}{mapping.mappedTo ? ` → ${mapping.mappedTo}` : ' (sem correspondência)'}</span>)}</div>}</li>)}</ul>
                  </div>
                  <div className="overflow-hidden rounded-md border border-slate-200"><div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5"><h3 className="text-xs font-black uppercase text-slate-700">Linhas e referência de origem</h3></div><ul className="max-h-[30vh] divide-y divide-slate-100 overflow-auto">{batchPreview.rows.slice(0, 200).map((row, index) => <li key={index} className="px-4 py-2 text-xs"><div className="flex items-center justify-between gap-2"><span className="font-mono text-slate-700">{row.reference}</span><span className="font-black uppercase text-slate-500">{row.status}</span></div>{row.messages.length > 0 && <ul className="mt-1 list-disc pl-4 text-xs text-slate-500">{row.messages.map((message, messageIndex) => <li key={messageIndex}>{message}</li>)}</ul>}</li>)}</ul></div>
                </div>
              )}

              {!batchPreview && <div className="mt-5 overflow-hidden rounded-md border border-slate-200">
                <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xs font-black uppercase text-slate-700">Conferência dos dados</h3>
                    <span className="text-xs font-bold text-slate-600">Mostrando até 50 linhas • {visibleRows.length} encontrada(s)</span>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <label className="relative">
                      <span className="sr-only">Localizar na importação</span>
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5b6870]" aria-hidden="true" />
                      <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Localizar na importação" className="min-h-11 w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 text-sm text-slate-800 outline-none focus:border-emerald-500 sm:w-56 lg:min-h-10" />
                    </label>
                    {columns.length > 6 && (
                      <button type="button" onClick={() => setShowAllColumns(value => !value)} aria-pressed={showAllColumns} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-100 lg:min-h-10">
                        <Columns3 className="h-3.5 w-3.5" aria-hidden="true" /> {showAllColumns ? 'Colunas principais' : `Ver ${columns.length} colunas`}
                      </button>
                    )}
                  </div>
                </div>
                <div className="max-h-[44vh] overflow-auto" tabIndex={0} role="region" aria-label="Prévia das linhas da planilha">
                  <table className="w-full min-w-[620px] border-collapse text-left text-[13px]">
                    <caption className="sr-only">Prévia das primeiras linhas de {fileName}</caption>
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-white">
                        {previewColumns.map(column => (
                          <th key={column} scope="col" className="border-b border-slate-200 bg-[#f3f6f4] px-3 py-2.5 text-xs font-bold text-slate-700">{column}</th>
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
                        <tr><td colSpan={Math.max(1, previewColumns.length)} className="px-4 py-8 text-center text-sm font-semibold text-slate-600">Nenhuma linha corresponde à pesquisa.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>}
            </div>

    </Modal>
  );
}
