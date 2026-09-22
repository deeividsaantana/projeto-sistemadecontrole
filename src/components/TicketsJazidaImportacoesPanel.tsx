import { useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import SpreadsheetImportReview, { type ImportBatchPreviewViewModel } from './SpreadsheetImportReview';
import { readWorkbookFile } from '../imports/workbookReader';
import { runImportPipeline } from '../imports/runImportPipeline';
import type { ImportDisposition, ImportPreview } from '../imports/types';
import { buildTravelImportApplication } from '../imports/travelImportApplication';
import type { TicketJazida } from '../types';

interface Props {
  tickets: readonly TicketJazida[];
  responsavel: string;
  onApply: (tickets: TicketJazida[]) => void;
  onError: (message: string) => void;
}

const STATUS_LABELS: Record<ImportDisposition, string> = {
  new: 'Novo',
  'potential-update': 'Possível atualização',
  unchanged: 'Sem alteração',
  'duplicate-in-file': 'Duplicado no arquivo',
  review: 'Conferência',
  invalid: 'Inválido',
  deferred: 'Adiado',
};

/**
 * Mesmo fluxo de MateriaisImportacoesPanel.tsx, para o domínio "travels"
 * (abas LIBERAÇÃO/RECEBIMENTO → TicketJazida). Não substitui o botão de
 * importação já existente em TicketsJazidaTab (handleImportTicketsFile) —
 * fica ao lado, como o caminho com dry-run/lote/lineage/idempotência.
 */
export default function TicketsJazidaImportacoesPanel({ tickets, responsavel, onApply, onError }: Props) {
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<ImportPreview<unknown> | null>(null);
  const [truncationNote, setTruncationNote] = useState('');
  const [dryRunRan, setDryRunRan] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [resultSummary, setResultSummary] = useState('');

  const handleFileSelected = async (file: File) => {
    setIsReading(true);
    setDryRunRan(false);
    setTruncationNote('');
    setResultSummary('');
    try {
      const workbook = await readWorkbookFile(file);
      const result = runImportPipeline(workbook, domain => (domain === 'travels' ? tickets : undefined));
      setFileName(file.name);
      setPreview(result);
      if (workbook.truncatedSheets?.length) {
        setTruncationNote(
          `Aba(s) muito maior(es) que o esperado foram cortadas por segurança, sem travar a leitura: ${workbook.truncatedSheets
            .map(sheet => `${sheet.sheetName} (${sheet.originalRowsDeclared.toLocaleString('pt-BR')} linhas declaradas, ${sheet.keptRows.toLocaleString('pt-BR')} lidas)`)
            .join('; ')}. Confira manualmente se há dado real além do corte.`,
        );
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível ler a planilha selecionada.');
      setPreview(null);
    } finally {
      setIsReading(false);
    }
  };

  const batchPreview: ImportBatchPreviewViewModel | undefined = preview ? {
    batchId: preview.batchId,
    sourceHash: preview.sourceHash,
    sheets: preview.sheets,
    counts: Object.fromEntries(Object.entries(preview.counts).map(([status, count]) => [STATUS_LABELS[status as ImportDisposition], count])),
    rows: preview.rows.map(item => ({
      reference: `${preview.sourceFile} › ${item.row.lineage.sourceSheet} › linha ${item.row.lineage.sourceRow}`,
      status: STATUS_LABELS[item.disposition],
      messages: item.row.lineage.validationMessages,
    })),
    dryRunRan,
    onRunDryRun: () => setDryRunRan(true),
    applyAuthorized: true,
  } : undefined;

  return <div className="mt-3 space-y-3">
    <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-white px-4 text-center text-xs font-bold text-slate-600 hover:border-emerald-500 hover:text-emerald-700">
      <Upload className="h-5 w-5" />
      {isReading ? 'Lendo planilha...' : 'Selecionar planilha (.xlsx) para prévia'}
      <input type="file" accept=".xlsx,.xlsm" className="hidden" disabled={isReading} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void handleFileSelected(file); }} />
    </label>
    {preview && <p className="flex items-center gap-2 text-xs font-semibold text-slate-600"><FileSpreadsheet className="h-4 w-4 text-emerald-700" /> {fileName} lido · {preview.rows.length} linha(s) classificada(s).</p>}
    {resultSummary && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">{resultSummary}</p>}
    <SpreadsheetImportReview
      open={Boolean(preview)}
      title="Prévia de importação — Viagens (Tickets Jazida)"
      fileName={fileName}
      validCount={preview?.counts.new ?? 0}
      columns={[]}
      rows={[]}
      note={truncationNote || undefined}
      batchPreview={batchPreview}
      confirming={false}
      onCancel={() => { setPreview(null); setDryRunRan(false); setTruncationNote(''); }}
      onConfirm={() => {
        if (!preview || !dryRunRan) return;
        const applied = buildTravelImportApplication(preview, tickets, responsavel);
        onApply(applied.tickets);
        // Nenhuma linha pode sumir em silêncio: o dry-run mostra "Novo" com
        // base só em ticket+via, mas a aplicação real ainda exige
        // data/ticket/quantidade completos — por isso o resumo depois de
        // aplicar sempre mostra o que foi de fato gravado e o que ficou de
        // fora, mesmo quando os números não batem com a prévia.
        setResultSummary(
          `Aplicado: ${applied.tickets.length} ticket(s). `
          + `Fora do lote: ${applied.skipped.duplicate} duplicado(s), ${applied.skipped.review} em conferência (dado incompleto), `
          + `${applied.skipped.reference} de aba só de referência (sem registro próprio)${applied.skipped.other ? `, ${applied.skipped.other} outro(s)` : ''}.`,
        );
        setPreview(null);
        setDryRunRan(false);
        setTruncationNote('');
      }}
    />
  </div>;
}
