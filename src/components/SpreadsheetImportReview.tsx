import React from 'react';
import { AlertTriangle, Check, FileSpreadsheet, Loader2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import OperationalAnalysisPanel from './OperationalAnalysisPanel';
import type { OperationalAnalysis } from '../utils/operationalAnalysis';

export interface SpreadsheetPreviewRow {
  [column: string]: string | number | null | undefined;
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
  onCancel,
  onConfirm
}: SpreadsheetImportReviewProps) {
  const previewColumns = columns.slice(0, 6);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="spreadsheet-import-title"
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
                  <span className="text-[10px] font-black uppercase text-emerald-700">Registros válidos</span>
                  <strong className="mt-1 block text-2xl text-emerald-950">{validCount}</strong>
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                  <span className="text-[10px] font-black uppercase text-amber-700">Ignorados</span>
                  <strong className="mt-1 block text-2xl text-amber-950">{ignoredCount}</strong>
                </div>
                <div className="col-span-2 rounded-md border border-slate-200 bg-slate-50 p-4 sm:col-span-1">
                  <span className="text-[10px] font-black uppercase text-slate-500">Colunas reconhecidas</span>
                  <strong className="mt-1 block text-2xl text-slate-950">{columns.length}</strong>
                </div>
              </div>

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

              <div className="mt-5 overflow-hidden rounded-md border border-slate-200">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <h3 className="text-xs font-black uppercase text-slate-700">Amostra dos dados</h3>
                  <span className="text-[10px] font-bold text-slate-500">Até {Math.min(rows.length, 5)} linhas</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-white">
                        {previewColumns.map(column => (
                          <th key={column} className="border-b border-slate-200 px-3 py-2.5 font-black text-slate-600">{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 5).map((row, index) => (
                        <tr key={index} className="odd:bg-slate-50/70">
                          {previewColumns.map(column => (
                            <td key={column} className="max-w-52 truncate border-b border-slate-100 px-3 py-2.5 text-slate-700" title={displayValue(row[column])}>
                              {displayValue(row[column])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <button type="button" onClick={onCancel} disabled={confirming} className="min-h-10 rounded-md border border-slate-300 bg-white px-5 text-xs font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50">
                Cancelar
              </button>
              <button type="button" onClick={onConfirm} disabled={confirming || validCount === 0} className="flex min-h-10 items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 text-xs font-black text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300">
                {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {confirming ? 'Importando...' : `Confirmar ${validCount} registro(s)`}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
