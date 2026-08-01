import React, { useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { z } from 'zod';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Database,
  FileSearch,
  LoaderCircle,
  Search,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import type {
  ApontamentoRamo,
  Empresa,
  Equipamento,
  Funcionario,
  MaterialCadastro,
  MaterialRegistro,
  ObraLocal,
} from '../types';
import {
  analyzeMasterWorkbook,
  buildExistingMasterIndex,
  MASTER_DATA_ENTITY_LABELS,
  type MasterWorkbookAnalysis,
  type MasterWorkbookReviewRow,
} from '../masterData/masterWorkbook';
import {
  loadMasterDataGatewayStatus,
  stageMasterDataImport,
  type StagedMasterDataImport,
  type MasterDataReviewEntity,
} from '../services/masterDataApi';

interface MasterDataReviewCenterProps {
  empresas: Empresa[];
  obras: ObraLocal[];
  funcionarios: Funcionario[];
  materiais: MaterialCadastro[];
  registrosMateriais: MaterialRegistro[];
  ramos: ApontamentoRamo[];
  equipamentos: Equipamento[];
  onApplyMasterWorkbook: (analysis: MasterWorkbookAnalysis) => Promise<{ success: boolean; message: string }>;
}

const stageSchema = z.object({
  operatorNote: z.string().trim().max(500, 'A observação deve ter até 500 caracteres.'),
  confirmReviewed: z.boolean().refine(value => value, 'Confirme que a revisão foi conferida antes de preservar os lotes.'),
});

type StageForm = z.infer<typeof stageSchema>;

interface StageOutcome {
  successful: StagedMasterDataImport[];
  failed: Array<{ entity: MasterDataReviewEntity; message: string }>;
}

const statusLabel = {
  ready: 'Novo',
  matched: 'Já cadastrado',
  duplicate: 'Duplicado',
  invalid: 'Inválido',
} as const;

const statusClass = {
  ready: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  matched: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  duplicate: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  invalid: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
} as const;

const columns: ColumnDef<MasterWorkbookReviewRow>[] = [
  {
    accessorKey: 'rowNumber',
    header: 'Linha',
    cell: info => <span className="font-mono text-slate-400">{String(info.getValue())}</span>,
  },
  {
    accessorKey: 'displayValue',
    header: 'Valor de origem',
    cell: info => <strong className="text-slate-100">{String(info.getValue() || 'Sem valor')}</strong>,
  },
  {
    accessorKey: 'canonicalKey',
    header: 'Chave canônica',
    cell: info => <span className="font-mono text-[10px] text-slate-400">{String(info.getValue() || 'não formada')}</span>,
  },
  {
    accessorKey: 'status',
    header: 'Revisão',
    cell: info => {
      const value = info.getValue() as MasterWorkbookReviewRow['status'];
      return <span className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-black uppercase ${statusClass[value]}`}>{statusLabel[value]}</span>;
    },
  },
  {
    id: 'aliases',
    header: 'Aliases',
    accessorFn: row => row.aliases.join(' | '),
    cell: info => <span className="text-[10px] text-slate-400">{String(info.getValue() || '—')}</span>,
  },
  {
    id: 'issues',
    header: 'Alertas',
    accessorFn: row => row.issues.join(' '),
    cell: info => <span className="text-[10px] leading-relaxed text-amber-200">{String(info.getValue() || 'Sem alertas')}</span>,
  },
];

export default function MasterDataReviewCenter({
  empresas,
  obras,
  funcionarios,
  materiais,
  registrosMateriais,
  ramos,
  equipamentos,
  onApplyMasterWorkbook,
}: MasterDataReviewCenterProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [analysis, setAnalysis] = useState<MasterWorkbookAnalysis | null>(null);
  const [activeEntity, setActiveEntity] = useState<MasterDataReviewEntity>('companies');
  const [globalFilter, setGlobalFilter] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [applyOutcome, setApplyOutcome] = useState<{ success: boolean; message: string } | null>(null);

  const existingIndex = useMemo(() => buildExistingMasterIndex({
    empresas,
    obras,
    funcionarios,
    materiais,
    registrosMateriais,
    ramos,
    equipamentos,
  }), [empresas, obras, funcionarios, materiais, registrosMateriais, ramos, equipamentos]);

  const gatewayQuery = useQuery({
    queryKey: ['master-data-gateway-status'],
    queryFn: loadMasterDataGatewayStatus,
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<StageForm>({
    defaultValues: {
      operatorNote: '',
      confirmReviewed: false,
    },
  });

  const activeRows = useMemo(
    () => analysis?.rows.filter(row => row.entity === activeEntity) || [],
    [analysis, activeEntity],
  );

  const table = useReactTable({
    data: activeRows,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  const stageMutation = useMutation({
    mutationFn: async (values: StageForm): Promise<StageOutcome> => {
      if (!analysis) throw new Error('Analise uma planilha mestre antes de preservar os lotes.');
      const successful: StagedMasterDataImport[] = [];
      const failed: StageOutcome['failed'] = [];

      for (const summary of analysis.summaries) {
        const rows = analysis.rows
          .filter(row => row.entity === summary.entity)
          .map(row => ({
            sheetName: row.sheetName,
            rowNumber: row.rowNumber,
            entity: row.entity,
            canonicalKey: row.canonicalKey,
            displayValue: row.displayValue,
            normalized: row.normalized,
            aliases: row.aliases,
            candidateRecordIds: row.candidateRecordIds,
            status: row.status,
            issues: row.issues,
            reviewNote: row.reviewNote,
            raw: row.raw,
          }));
        try {
          successful.push(await stageMasterDataImport(
            analysis.sourceName,
            summary.entity,
            summary.sheetName,
            rows,
            {
              operatorNote: values.operatorNote,
              deferredSheets: analysis.deferredSheets,
              totalDeferredRows: analysis.totalDeferredRows,
              source: 'master-workbook-v2.2',
            },
          ));
        } catch (error) {
          failed.push({
            entity: summary.entity,
            message: error instanceof Error ? error.message : 'Falha desconhecida.',
          });
        }
      }
      return { successful, failed };
    },
  });

  const handleWorkbook = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsAnalyzing(true);
    setAnalysisError('');
    setApplyOutcome(null);
    stageMutation.reset();
    try {
      const result = await analyzeMasterWorkbook(file, existingIndex);
      if (result.totalMasterRows === 0) throw new Error('Nenhuma aba mestre compatível foi encontrada.');
      setAnalysis(result);
      setActiveEntity(result.summaries[0]?.entity || 'companies');
      setGlobalFilter('');
      reset({ operatorNote: '', confirmReviewed: false });
    } catch (error) {
      setAnalysis(null);
      setAnalysisError(error instanceof Error ? error.message : 'Não foi possível analisar a planilha mestre.');
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const submitStage = handleSubmit(values => {
    const parsed = stageSchema.safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach(issue => {
        const field = issue.path[0];
        if (field === 'operatorNote' || field === 'confirmReviewed') {
          setError(field, { type: 'validate', message: issue.message });
        }
      });
      return;
    }
    if (!analysis) {
      setAnalysisError('Analise uma planilha mestre antes de preservar os lotes.');
      return;
    }
    if (!gatewayQuery.data?.configured) {
      setAnalysisError('O Supabase opcional precisa estar configurado para preservar a fila de revisão.');
      return;
    }
    stageMutation.mutate(parsed.data);
  });

  const applyMasterWorkbook = async () => {
    if (!analysis || isApplying) return;
    const confirmed = window.confirm(
      'Atualizar os cadastros do ERP com as linhas novas e já correspondidas? Duplicidades e linhas inválidas continuarão guardadas para revisão.',
    );
    if (!confirmed) return;
    setIsApplying(true);
    setApplyOutcome(null);
    try {
      setApplyOutcome(await onApplyMasterWorkbook(analysis));
    } catch (error) {
      setApplyOutcome({
        success: false,
        message: error instanceof Error ? error.message : 'Não foi possível atualizar os cadastros mestres.',
      });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <section className="rounded-2xl border border-emerald-500/20 bg-slate-900 p-5 shadow-xl" id="master-data-review-center">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-2 flex items-center gap-2 text-emerald-300">
            <Database className="h-5 w-5" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Cadastros Mestres v3.2</span>
          </div>
          <h2 className="text-lg font-extrabold text-white">Central de importação, aliases e duplicidades</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Analisa empresas, fornecedores, materiais, locais, ramos, colaboradores, equipamentos, veículos e identificadores SGE.
            Depois da conferência, os cadastros válidos podem ser aplicados ao ERP; duplicidades e linhas inválidas continuam preservadas para revisão.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-[10px] font-black uppercase ${
            gatewayQuery.data?.configured
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
          }`}>
            {gatewayQuery.isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
            {gatewayQuery.data?.configured ? 'Supabase pronto' : 'Modo local preservado'}
          </div>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xlsm" className="hidden" onChange={handleWorkbook} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalyzing}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {isAnalyzing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {isAnalyzing ? 'Analisando...' : 'Selecionar planilha mestre ou frota'}
          </button>
        </div>
      </div>

      {(analysisError || gatewayQuery.error) && (
        <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          {analysisError || (gatewayQuery.error instanceof Error ? gatewayQuery.error.message : 'Supabase opcional ainda não configurado.')}
        </div>
      )}

      {!analysis ? (
        <div className="mt-5 grid min-h-36 place-items-center rounded-xl border border-dashed border-slate-700 bg-slate-950/50 p-6 text-center">
          <div>
            <FileSearch className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-2 text-sm font-bold text-slate-300">Nenhuma planilha mestre em revisão</p>
            <p className="mt-1 text-[10px] text-slate-500">A análise não altera os cadastros atuais e pode funcionar mesmo sem Supabase.</p>
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3"><span className="block text-[9px] font-bold uppercase text-slate-500">Linhas mestre</span><strong className="text-xl text-white">{analysis.totalMasterRows}</strong></div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3"><span className="block text-[9px] font-bold uppercase text-emerald-400">Novas</span><strong className="text-xl text-white">{analysis.rows.filter(row => row.status === 'ready').length}</strong></div>
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3"><span className="block text-[9px] font-bold uppercase text-cyan-400">Já cadastradas</span><strong className="text-xl text-white">{analysis.rows.filter(row => row.status === 'matched').length}</strong></div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3"><span className="block text-[9px] font-bold uppercase text-amber-400">Duplicadas</span><strong className="text-xl text-white">{analysis.rows.filter(row => row.status === 'duplicate').length}</strong></div>
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3"><span className="block text-[9px] font-bold uppercase text-rose-400">Inválidas</span><strong className="text-xl text-white">{analysis.rows.filter(row => row.status === 'invalid').length}</strong></div>
          </div>

          <div className="flex flex-col gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <strong className="text-sm text-emerald-100">Atualizar os cadastros usados pelo sistema</strong>
              <p className="mt-1 max-w-3xl text-[10px] leading-relaxed text-slate-300">
                Empresas, locais, colaboradores, materiais, ramos, equipamentos e veículos serão criados ou atualizados pela chave mestre.
                Linhas incompletas, duplicadas e vínculos não localizados permanecem na fila de revisão, sem descarte.
              </p>
            </div>
            <button
              type="button"
              onClick={applyMasterWorkbook}
              disabled={isApplying}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-xs font-black text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {isApplying ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              {isApplying ? 'Atualizando...' : 'Aplicar Planilha Mestre'}
            </button>
          </div>

          {applyOutcome && (
            <div className={`rounded-xl border px-4 py-3 text-xs font-bold ${
              applyOutcome.success
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
            }`}>
              {applyOutcome.message}
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
            {analysis.summaries.map(summary => (
              <button
                key={summary.entity}
                type="button"
                onClick={() => {
                  setActiveEntity(summary.entity);
                  setGlobalFilter('');
                }}
                className={`rounded-lg border px-3 py-2 text-[10px] font-black uppercase transition ${
                  activeEntity === summary.entity
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                    : 'border-slate-700 bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                {MASTER_DATA_ENTITY_LABELS[summary.entity]} · {summary.totalRows}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <strong className="text-sm text-white">{MASTER_DATA_ENTITY_LABELS[activeEntity]}</strong>
              <span className="ml-2 text-[10px] text-slate-500">{table.getFilteredRowModel().rows.length} linha(s)</span>
            </div>
            <label className="relative block w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={globalFilter}
                onChange={event => setGlobalFilter(event.target.value)}
                placeholder="Buscar valor, chave ou alerta..."
                className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 text-xs text-white outline-none focus:border-emerald-500"
              />
            </label>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-800">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-950 text-[9px] uppercase tracking-wider text-slate-500">
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map(header => (
                        <th key={header.id} className="px-3 py-3 font-black">
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900">
                  {table.getRowModel().rows.map(row => (
                    <tr key={row.id} className="align-top hover:bg-slate-850/60">
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="max-w-xs px-3 py-3">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950 px-3 py-2">
              <span className="text-[10px] text-slate-500">Página {table.getState().pagination.pageIndex + 1} de {Math.max(1, table.getPageCount())}</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="rounded-lg border border-slate-700 p-2 text-slate-300 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                <button type="button" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="rounded-lg border border-slate-700 p-2 text-slate-300 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          </div>

          {analysis.deferredSheets.length > 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div>
                  <strong className="text-xs text-amber-200">{analysis.totalDeferredRows} linha(s) fora do escopo v2.2 não foram convertidas</strong>
                  <p className="mt-1 text-[10px] leading-relaxed text-slate-400">Elas permanecem na planilha original. A central apenas registra quais abas serão tratadas nas versões de equipamentos e módulos operacionais.</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {analysis.deferredSheets.map(sheet => (
                      <span key={sheet.sheetName} title={sheet.reason} className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[9px] text-slate-400">{sheet.sheetName}: {sheet.rowCount}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={submitStage} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
              <div className="flex-1">
                <strong className="text-sm text-white">Preservar fila de revisão no Supabase</strong>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-400">Cria um lote por entidade. Duplicidades, inválidos, aliases e valores originais permanecem disponíveis para decisão; nenhum cadastro é promovido automaticamente.</p>
                <textarea
                  {...register('operatorNote')}
                  rows={2}
                  placeholder="Observação opcional da conferência"
                  className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500"
                />
                {errors.operatorNote && <p className="mt-1 text-[10px] text-rose-300">{errors.operatorNote.message}</p>}
                <label className="mt-3 flex items-start gap-2 text-[10px] text-slate-300">
                  <input {...register('confirmReviewed')} type="checkbox" className="mt-0.5 accent-emerald-500" />
                  Confirmo que revisei os totais e entendo que este envio apenas prepara a homologação.
                </label>
                {errors.confirmReviewed && <p className="mt-1 text-[10px] text-rose-300">{errors.confirmReviewed.message}</p>}
              </div>
              <button
                type="submit"
                disabled={stageMutation.isPending || !gatewayQuery.data?.configured}
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
              >
                {stageMutation.isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
                {stageMutation.isPending ? 'Preservando...' : 'Preservar revisão'}
              </button>
            </div>
          </form>

          {stageMutation.data && (
            <div className={`rounded-xl border p-4 text-xs ${
              stageMutation.data.failed.length === 0
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
            }`}>
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="h-4 w-4" />
                {stageMutation.data.successful.length} entidade(s) preservada(s); {stageMutation.data.failed.length} falha(s).
              </div>
              {stageMutation.data.failed.map(item => (
                <p key={item.entity} className="mt-1 text-[10px]">{MASTER_DATA_ENTITY_LABELS[item.entity]}: {item.message}</p>
              ))}
            </div>
          )}

          {stageMutation.error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-200">
              {stageMutation.error instanceof Error ? stageMutation.error.message : 'Não foi possível preservar a revisão.'}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
