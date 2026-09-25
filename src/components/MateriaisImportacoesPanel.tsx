import { useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import SpreadsheetImportReview, { type ImportBatchPreviewViewModel } from './SpreadsheetImportReview';
import { readWorkbookFile } from '../imports/workbookReader';
import { runImportPipeline } from '../imports/runImportPipeline';
import type { ImportDisposition, ImportPreview } from '../imports/types';
import type { MovimentoMaterial } from '../types';
import type { Material } from '../types';
import { buildMaterialImportApplication } from '../imports/materialImportApplication';

interface Props {
  movimentos: MovimentoMaterial[];
  materiais: Material[];
  responsavel: string;
  /** Ramos cadastrados: o local de aplicação com o mesmo nome já entra vinculado. */
  etapas?: ReadonlyArray<{ id: string; nome: string }>;
  onApply: (materials: Material[], movements: MovimentoMaterial[]) => void;
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

export default function MateriaisImportacoesPanel({ movimentos, materiais, responsavel, etapas = [], onApply, onError }: Props) {
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<ImportPreview<unknown> | null>(null);
  const [truncationNote, setTruncationNote] = useState('');
  const [excludedSheets, setExcludedSheets] = useState<Set<string>>(new Set());
  const [dryRunRan, setDryRunRan] = useState(false);
  const [isReading, setIsReading] = useState(false);
  // O modal de prévia cobre a tela inteira: se abrisse assim que o arquivo
  // termina de ler, os checkboxes de abas incluídas ficariam atrás dele,
  // inacessíveis. Por isso a leitura só mostra o resumo + checklist na
  // própria página; o modal só abre quando a pessoa confirma quais abas
  // quer incluir.
  const [reviewOpen, setReviewOpen] = useState(false);
  const [resultSummary, setResultSummary] = useState('');

  const resetAll = () => {
    setPreview(null);
    setDryRunRan(false);
    setTruncationNote('');
    setExcludedSheets(new Set());
    setReviewOpen(false);
  };

  const handleFileSelected = async (file: File) => {
    setIsReading(true);
    setDryRunRan(false);
    setTruncationNote('');
    setExcludedSheets(new Set());
    setReviewOpen(false);
    setResultSummary('');
    try {
      const workbook = await readWorkbookFile(file);
      const result = runImportPipeline(workbook, domain =>
        domain === 'materials-receipts' || domain === 'materials-movements' ? movimentos : undefined);
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

  const toggleSheetExcluded = (sheetName: string) => {
    setDryRunRan(false);
    setExcludedSheets(current => {
      const next = new Set(current);
      if (next.has(sheetName)) next.delete(sheetName); else next.add(sheetName);
      return next;
    });
  };

  // Deixa de fora, na aplicação, qualquer aba marcada manualmente — sem
  // remover da leitura/prévia (a aba continua visível e contável acima).
  // Existe para casos como uma aba com Tabela do Excel corrompida/arrastada:
  // a pessoa vê os números reais na prévia e decide não aplicar aquela aba
  // desta vez, sem precisar editar código.
  const effectivePreview = preview && excludedSheets.size > 0
    ? { ...preview, rows: preview.rows.filter(item => !excludedSheets.has(item.row.lineage.sourceSheet)) }
    : preview;

  const sheetsWithRows = preview
    ? Array.from(new Set(preview.rows.map(item => item.row.lineage.sourceSheet)))
    : [];

  const batchPreview: ImportBatchPreviewViewModel | undefined = effectivePreview ? {
    batchId: effectivePreview.batchId,
    sourceHash: effectivePreview.sourceHash,
    sheets: effectivePreview.sheets,
    counts: Object.fromEntries(
      Object.entries(effectivePreview.rows.reduce<Record<ImportDisposition, number>>((acc, item) => {
        acc[item.disposition] = (acc[item.disposition] || 0) + 1;
        return acc;
      }, {} as Record<ImportDisposition, number>)).map(([status, count]) => [STATUS_LABELS[status as ImportDisposition], count]),
    ),
    rows: effectivePreview.rows.map(item => ({
      reference: `${effectivePreview.sourceFile} › ${item.row.lineage.sourceSheet} › linha ${item.row.lineage.sourceRow}`,
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
    {preview && !reviewOpen && (
      <div className="space-y-3">
        {sheetsWithRows.length > 1 && (
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-black uppercase text-slate-500">Abas incluídas na aplicação</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {sheetsWithRows.map(sheetName => (
                <label key={sheetName} className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-bold ${excludedSheets.has(sheetName) ? 'border-slate-300 bg-slate-100 text-slate-400 line-through' : 'border-emerald-300 bg-emerald-50 text-emerald-800'}`}>
                  <input type="checkbox" checked={!excludedSheets.has(sheetName)} onChange={() => toggleSheetExcluded(sheetName)} />
                  {sheetName}
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={resetAll} className="min-h-9 rounded-md border border-slate-300 bg-white px-4 text-xs font-black text-slate-700">Cancelar</button>
          <button type="button" onClick={() => setReviewOpen(true)} className="min-h-9 rounded-md bg-emerald-600 px-4 text-xs font-black text-white">Ver prévia e continuar</button>
        </div>
      </div>
    )}
    <SpreadsheetImportReview
      open={reviewOpen}
      title="Prévia de importação — Materiais"
      fileName={fileName}
      validCount={effectivePreview?.rows.filter(item => item.disposition === 'new').length ?? 0}
      columns={[]}
      rows={[]}
      note={truncationNote || undefined}
      batchPreview={batchPreview}
      confirming={false}
      onCancel={resetAll}
      onConfirm={() => {
        if (!effectivePreview || !dryRunRan) return;
        const applied = buildMaterialImportApplication(effectivePreview, materiais, movimentos, responsavel, etapas);
        onApply(applied.materials, applied.movements);
        // Nenhuma linha pode sumir em silêncio: mesmo o gate de materiais já
        // bater com a chave operacional do adaptador, o resumo mostra sempre
        // o que foi de fato gravado e o que ficou de fora, por consistência
        // com estacas/viagens.
        setResultSummary(
          `Aplicado: ${applied.materials.length} material(is) novo(s) e ${applied.movements.length} movimento(s). `
          + `Fora do lote: ${applied.skipped.duplicate} duplicado(s), ${applied.skipped.review} em conferência (dado incompleto)${applied.skipped.other ? `, ${applied.skipped.other} outro(s)` : ''}.`,
        );
        resetAll();
      }}
    />
  </div>;
}
